package com.tinyclass.learning;

import com.tinyclass.common.api.*;
import com.tinyclass.common.persistence.DomainStore;
import com.tinyclass.family.GuardianService;
import com.tinyclass.learning.AssignmentDtos.*;
import com.tinyclass.learning.LibraryDtos.ActionInput;
import com.tinyclass.storage.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.security.*;
import java.time.Instant;
import java.util.*;
import static com.tinyclass.common.persistence.DomainStore.*;

@Service @Transactional(readOnly=true)
public class AssignmentService {
    private final DomainStore db;
    private final GuardianService guardians;
    private final LibraryService library;
    private final FileService files;
    public AssignmentService(DomainStore db,GuardianService guardians,LibraryService library,FileService files) { this.db=db; this.guardians=guardians; this.library=library; this.files=files; }
    public PageResponse<Map<String,Object>> list(UUID actor,int page,int size) {
        pagination(page,size);
        return db.page(db.rows("select a.id,a.title,a.source_type,a.target_type,a.status,a.available_at,a.due_at,a.version,a.created_at,c.name as class_name,s.full_name as student_name from assignments a left join classes c on c.id=a.class_id left join students s on s.id=a.student_id where a.teacher_id=? order by a.created_at desc,a.id desc limit ? offset ?",actor,size,(long)page*size),db.count("select count(*) from assignments where teacher_id=?",actor),page,size);
    }
    public Map<String,Object> detail(UUID actor,UUID assignment) {
        var result=owned(actor,assignment,false);
        result.remove("requestHash"); result.remove("teacherId");
        result.put("items",teacherItems(assignment));
        var recipients=db.rows("select r.id,r.student_id,s.full_name,r.granted_at,r.revoked_at,r.revoke_reason from assignment_recipients r join students s on s.id=r.student_id where r.assignment_id=? order by s.full_name,r.id",assignment);
        recipients.forEach(row->progressSummary(row,id(row,"studentId"),assignment));
        result.put("recipients",recipients);
        return result;
    }
    public List<Map<String,Object>> teacherItems(UUID assignment) { return db.rows("select i.id,i.lesson_id,i.position,i.is_required,i.completion_mode,i.allowed_response_types,l.title,l.status as lesson_status from assignment_items i join lessons l on l.id=i.lesson_id where i.assignment_id=? order by i.position",assignment); }
    @Transactional public Map<String,Object> create(UUID actor,CreateInput input,String trace) {
        validateDates(input.availableAt(),input.dueAt());
        // Serializes retries without trusting an unsigned client-provided owner or role.
        db.one("select id from users where id=? for update",actor);
        String hash=hash(db.json(input));
        var previous=db.rows("select id,request_hash from assignments where teacher_id=? and client_request_id=?",actor,input.clientRequestId());
        if(!previous.isEmpty()) {
            if(!hash.equals(previous.getFirst().get("requestHash"))) throw conflict("IDEMPOTENCY_CONFLICT","Mã yêu cầu đã dùng cho nội dung khác.");
            return detail(actor,id(previous.getFirst(),"id"));
        }
        boolean lesson="LESSON".equals(input.sourceType());
        if(lesson?(input.lessonId()==null||input.courseId()!=null):(input.courseId()==null||input.lessonId()!=null)) throw problem("INVALID_SOURCE","Chọn đúng một bài hoặc khóa học.");
        boolean classTarget="CLASS".equals(input.targetType());
        if(classTarget?(input.classId()==null||input.studentId()!=null):(input.studentId()==null||input.classId()!=null)) throw problem("INVALID_TARGET","Chọn đúng một lớp hoặc hồ sơ bé.");
        db.one("select id from "+(lesson?"lessons":"courses")+" where id=? and teacher_id=? and status<>'ARCHIVED'",lesson?input.lessonId():input.courseId(),actor);
        target(actor,input.classId(),input.studentId(),false);
        var source=lesson?db.rows("select id as lesson_id,default_completion_mode,default_response_types,true as is_required from lessons where id=?",input.lessonId()):
                db.rows("select l.id as lesson_id,l.default_completion_mode,l.default_response_types,cl.is_required from course_lessons cl join lessons l on l.id=cl.lesson_id where cl.course_id=? order by cl.position",input.courseId());
        UUID assignment=UUID.randomUUID();
        db.update("insert into assignments(id,teacher_id,title,source_type,lesson_id,course_id,target_type,class_id,student_id,available_at,due_at,status,client_request_id,request_hash) values(?,?,?,?,?,?,?,?,?,?,?,'DRAFT',?,?)",assignment,actor,input.title().strip(),input.sourceType(),input.lessonId(),input.courseId(),input.targetType(),input.classId(),input.studentId(),stamp(input.availableAt()),stamp(input.dueAt()),input.clientRequestId(),hash);
        int position=0;
        for(var row:source) db.update("insert into assignment_items(id,assignment_id,lesson_id,position,is_required,completion_mode,allowed_response_types) values(?,?,?,?,?,?,?::jsonb)",UUID.randomUUID(),assignment,row.get("lessonId"),position++,!"REFERENCE".equals(row.get("defaultCompletionMode"))&&(Boolean)row.get("isRequired"),row.get("defaultCompletionMode"),db.json(row.get("defaultResponseTypes")));
        db.audit(actor,"ASSIGNMENT_CREATED","ASSIGNMENT",assignment,Map.of("sourceType",input.sourceType(),"targetType",input.targetType()),null,trace);
        return detail(actor,assignment);
    }
    @Transactional public Map<String,Object> update(UUID actor,UUID assignment,DraftInput input,String trace) {
        var old=owned(actor,assignment,true); version(old,input.version());
        if(!"DRAFT".equals(old.get("status"))) throw conflict("INVALID_STATE","Lần giao đã xuất bản không thể sửa danh sách hoặc yêu cầu.");
        validateDates(input.availableAt(),input.dueAt());
        var existing=teacherItems(assignment); var expected=new HashSet<>(existing.stream().map(r->id(r,"id")).toList());
        if(input.items().size()!=expected.size()||!expected.equals(new HashSet<>(input.items().stream().map(ItemInput::id).toList()))) throw problem("INVALID_ASSIGNMENT_ITEMS","Danh sách phải giữ đúng các bài trong bản nháp; mỗi bài một lần.");
        int position=0;
        for(var item:input.items()) {
            validateMode(item.completionMode(),item.isRequired(),item.allowedResponseTypes());
            db.update("update assignment_items set position=?,is_required=?,completion_mode=?,allowed_response_types=?::jsonb where id=? and assignment_id=?",position++,item.isRequired(),item.completionMode(),db.json(item.allowedResponseTypes()),item.id(),assignment);
        }
        db.update("update assignments set title=?,available_at=?,due_at=?,version=version+1,updated_at=now() where id=?",input.title().strip(),stamp(input.availableAt()),stamp(input.dueAt()),assignment);
        db.audit(actor,"ASSIGNMENT_DRAFT_UPDATED","ASSIGNMENT",assignment,Map.of(),null,trace); return detail(actor,assignment);
    }
    @Transactional public Map<String,Object> action(UUID actor,UUID assignment,String action,ActionInput input,String trace) {
        var reference=owned(actor,assignment,false);
        if("publish".equals(action)) target(actor,id(reference,"classId"),id(reference,"studentId"),true);
        var row=owned(actor,assignment,true);
        if("publish".equals(action)&&"PUBLISHED".equals(row.get("status"))) return detail(actor,assignment);
        version(row,input.version());
        if("publish".equals(action)) {
            if(!"DRAFT".equals(row.get("status"))) throw conflict("INVALID_STATE","Chỉ xuất bản bản nháp.");
            if(row.get("availableAt")==null) throw problem("AVAILABLE_AT_REQUIRED","Chọn thời điểm mở bài.");
            String source="LESSON".equals(row.get("sourceType"))?"lessons":"courses";
            db.one("select id from "+source+" where id=? and teacher_id=? and status='PUBLISHED'",id(row,source.equals("lessons")?"lessonId":"courseId"),actor);
            var items=teacherItems(assignment); if(items.isEmpty()) throw conflict("ASSIGNMENT_EMPTY","Lần giao chưa có bài.");
            for(var item:items.stream().sorted(Comparator.comparing(r->id(r,"lessonId"))).toList()) {
                db.one("select id from lessons where id=? and teacher_id=? and status='PUBLISHED' for update",id(item,"lessonId"),actor);
                for(var block:library.blocks(id(item,"lessonId"))) if(block.get("fileId")!=null) {
                    if(!"READY".equals(files.owned(actor,id(block,"fileId")).getStatus())) throw conflict("FILE_NOT_READY","Tệp chưa sẵn sàng.");
                }
            }
            UUID classroom=id(row,"classId");
            var recipients=classroom!=null?db.rows("select e.student_id,e.id as enrollment_id from class_enrollments e join students s on s.id=e.student_id where e.class_id=? and e.status='ACTIVE' and s.status='ACTIVE' order by e.student_id",classroom):List.of(Map.<String,Object>of("studentId",row.get("studentId")));
            if(recipients.isEmpty()) throw conflict("NO_RECIPIENTS","Thêm bé đang hoạt động trước khi xuất bản lần giao.");
            for(var recipient:recipients) db.update("insert into assignment_recipients(id,assignment_id,student_id,source_enrollment_id) values(?,?,?,?)",UUID.randomUUID(),assignment,recipient.get("studentId"),recipient.get("enrollmentId"));
            db.update("update assignments set status='PUBLISHED',published_at=now(),version=version+1,updated_at=now() where id=?",assignment);
        } else if("revoke".equals(action)) {
            if(!"PUBLISHED".equals(row.get("status"))) throw conflict("INVALID_STATE","Chỉ thu hồi lần giao đã xuất bản.");
            if(clean(input.reason())==null) throw problem("REASON_REQUIRED","Ghi lý do thu hồi.");
            db.update("update assignments set status='REVOKED',revoked_at=now(),revoke_reason=?,version=version+1,updated_at=now() where id=?",input.reason().strip(),assignment);
            db.update("update assignment_recipients set revoked_at=now(),revoke_reason=? where assignment_id=? and revoked_at is null",input.reason().strip(),assignment);
        } else throw missing();
        db.audit(actor,"ASSIGNMENT_"+action.toUpperCase(Locale.ROOT),"ASSIGNMENT",assignment,Map.of(),input.reason(),trace); return detail(actor,assignment);
    }
    @Transactional public Map<String,Object> grant(UUID actor,UUID assignment,RecipientsInput input,String trace) {
        var ref=owned(actor,assignment,false); UUID classId=id(ref,"classId"); if(classId==null) throw conflict("INVALID_TARGET","Chỉ cấp thêm bé cho lần giao theo lớp.");
        target(actor,classId,null,true); var row=owned(actor,assignment,true); version(row,input.version());
        if(!"PUBLISHED".equals(row.get("status"))) throw conflict("INVALID_STATE","Chỉ cấp thêm cho lần giao đang xuất bản.");
        for(UUID child:new HashSet<>(input.studentIds())) {
            var enrollment=db.one("select e.id from class_enrollments e join students s on s.id=e.student_id where e.class_id=? and e.student_id=? and e.status='ACTIVE' and s.status='ACTIVE'",classId,child);
            db.update("insert into assignment_recipients(id,assignment_id,student_id,source_enrollment_id) values(?,?,?,?) on conflict(assignment_id,student_id) do update set source_enrollment_id=excluded.source_enrollment_id,granted_at=now(),revoked_at=null,revoke_reason=null",UUID.randomUUID(),assignment,child,enrollment.get("id"));
        }
        db.update("update assignments set version=version+1,updated_at=now() where id=?",assignment);
        db.audit(actor,"ASSIGNMENT_RECIPIENTS_GRANTED","ASSIGNMENT",assignment,Map.of("count",input.studentIds().size()),input.reason(),trace); return detail(actor,assignment);
    }
    private Map<String,Object> owned(UUID actor,UUID id,boolean lock) { return db.one("select id,teacher_id,title,source_type,lesson_id,course_id,target_type,class_id,student_id,available_at,due_at,status,published_at,revoked_at,revoke_reason,client_request_id,request_hash,version,created_at from assignments where id=? and teacher_id=?"+(lock?" for update":""),id,actor); }
    private void target(UUID actor,UUID classroom,UUID child,boolean publishing) {
        var row=classroom!=null?db.one("select id,status from classes where id=? and teacher_id=? for update",classroom,actor):db.one("select id,status from students where id=? and teacher_id=? for update",child,actor);
        if(classroom!=null) {
            if(publishing?!"ACTIVE".equals(row.get("status")):!Set.of("DRAFT","ACTIVE").contains(row.get("status"))) throw conflict("INVALID_TARGET_STATE","Lớp chưa thể nhận lần giao mới.");
        } else if(!"ACTIVE".equals(row.get("status"))) throw conflict("INVALID_TARGET_STATE","Hồ sơ bé đang được lưu trữ.");
    }
    // Every family list/count/item/file goes through the same current recipient/guardian/class checks.
    private static final String FAMILY_FROM=" from assignment_recipients r join assignments a on a.id=r.assignment_id join students s on s.id=r.student_id left join classes c on c.id=a.class_id left join class_enrollments e on e.id=r.source_enrollment_id where r.student_id=? and r.revoked_at is null and a.status='PUBLISHED' and s.status='ACTIVE' and (a.target_type='STUDENT' or (c.status in('ACTIVE','COMPLETED') and e.status in('ACTIVE','COMPLETED')))";
    public PageResponse<Map<String,Object>> familyList(UUID parent,UUID child,int page,int size) {
        guardians.child(parent,child); pagination(page,size);
        var rows=db.rows("select a.id,a.title,a.source_type,a.target_type,a.available_at,a.due_at,a.created_at,c.name as class_name"+FAMILY_FROM+" order by a.created_at desc,a.id desc limit ? offset ?",child,size,(long)page*size);
        rows.forEach(row->{ row.put("locked",!available(row)); progressSummary(row,child,id(row,"id")); });
        return db.page(rows,db.count("select count(*)"+FAMILY_FROM,child),page,size);
    }
    public Map<String,Object> familyAssignment(UUID parent,UUID child,UUID assignment) {
        guardians.child(parent,child);
        var result=db.one("select a.id,a.title,a.source_type,a.available_at,a.due_at,c.status as class_status,c.name as class_name"+FAMILY_FROM+" and a.id=?",child,assignment);
        boolean open=available(result); result.put("locked",!open); result.put("canInteract",!"COMPLETED".equals(result.get("classStatus")));
        result.remove("classStatus"); progressSummary(result,child,assignment);
        result.put("items",open?db.rows("select i.id,i.position,i.is_required,i.completion_mode,l.title,p.status as progress_status,p.completed_at from assignment_items i join lessons l on l.id=i.lesson_id left join student_progress p on p.assignment_item_id=i.id and p.student_id=? where i.assignment_id=? order by i.position",child,assignment):List.of());
        return result;
    }
    public Map<String,Object> familyOverview(UUID parent,UUID child,Instant now){
        guardians.child(parent,child);
        String open=" and a.available_at<=?",interactive=" and (a.target_type='STUDENT' or (c.status='ACTIVE' and e.status='ACTIVE'))";
        var result=new LinkedHashMap<String,Object>();
        result.put("availableAssignments",db.count("select count(*)"+FAMILY_FROM+open,child,stamp(now)));
        result.put("waitingAssignments",db.count("select count(*)"+FAMILY_FROM+" and (a.available_at is null or a.available_at>?)",child,stamp(now)));
        var counts=db.one("select count(*) as required_items,count(*) filter(where p.status='COMPLETED') as completed_items from assignment_items i left join student_progress p on p.assignment_item_id=i.id and p.student_id=? where i.is_required and i.completion_mode<>'REFERENCE' and i.assignment_id in(select a.id"+FAMILY_FROM+open+interactive+")",child,child,stamp(now));
        result.putAll(counts);result.put("remainingItems",number(counts,"requiredItems")-number(counts,"completedItems"));
        var next=db.rows("select a.id,a.title,c.name as class_name"+FAMILY_FROM+open+interactive+" and exists(select 1 from assignment_items i left join student_progress p on p.assignment_item_id=i.id and p.student_id=r.student_id where i.assignment_id=a.id and i.is_required and i.completion_mode<>'REFERENCE' and (p.status is null or p.status<>'COMPLETED')) order by a.due_at asc nulls last,a.available_at,a.id limit 1",child,stamp(now));
        if(!next.isEmpty())progressSummary(next.getFirst(),child,id(next.getFirst(),"id"));
        result.put("continueAssignment",next.isEmpty()?null:next.getFirst());result.put("recentAssignments",familyList(parent,child,0,3).data());return result;
    }
    private void progressSummary(Map<String,Object> result,UUID child,UUID assignment) {
        long total=db.count("select count(*) from assignment_items where assignment_id=? and is_required and completion_mode<>'REFERENCE'",assignment);
        long completed=db.count("select count(*) from assignment_items i join student_progress p on p.assignment_item_id=i.id where i.assignment_id=? and i.is_required and i.completion_mode<>'REFERENCE' and p.student_id=? and p.status='COMPLETED'",assignment,child);
        result.put("requiredItems",total); result.put("completedItems",completed); result.put("completionPercent",total==0?null:(int)(completed*100/total));
    }
    public Map<String,Object> familyItem(UUID parent,UUID child,UUID item) {
        var access=itemAccess(parent,child,item,false,false);
        var lesson=db.one("select title,summary,parent_guidance,activity_instructions,estimated_minutes from lessons where id=?",access.get("lessonId"));
        lesson.put("blocks",library.blocks(id(access,"lessonId"))); lesson.put("id",item); lesson.put("assignmentId",access.get("assignmentId"));
        lesson.put("completionMode",access.get("completionMode")); lesson.put("isRequired",access.get("isRequired")); lesson.put("canInteract",!"COMPLETED".equals(access.get("classStatus")));
        var progress=db.rows("select p.status,p.first_opened_at,p.last_opened_at,p.parent_confirmed_at,p.teacher_accepted_at,p.completed_at,p.review_cycle,p.version,(select e.reason from submission_events e where e.assignment_item_id=p.assignment_item_id and e.student_id=p.student_id and e.event_type='REOPENED' and e.review_cycle=p.review_cycle order by e.created_at desc,e.id desc limit 1) as reopen_reason from student_progress p where p.assignment_item_id=? and p.student_id=?",item,child);
        lesson.put("progress",progress.isEmpty()?null:progress.getFirst()); return lesson;
    }
    @Transactional public Map<String,Object> interact(UUID parent,UUID child,UUID item,boolean confirm,String trace) {
        var access=itemAccess(parent,child,item,confirm,true);
        if(confirm&&!"PARENT_CONFIRM".equals(access.get("completionMode"))) throw conflict("INVALID_COMPLETION_MODE","Bài này không dùng xác nhận của gia đình.");
        db.update("insert into student_progress(id,assignment_item_id,student_id,status) values(?,?,?,'OPENED') on conflict(assignment_item_id,student_id) do update set last_opened_at=now(),updated_at=now(),version=student_progress.version+1",UUID.randomUUID(),item,child);
        if(confirm) {
            db.update("update student_progress set status='COMPLETED',parent_confirmed_at=now(),confirmed_by=?,completed_at=now(),updated_at=now(),version=version+1 where assignment_item_id=? and student_id=? and status<>'COMPLETED'",parent,item,child);
            db.audit(parent,"PARENT_CONFIRMED","ASSIGNMENT_ITEM",item,Map.of("studentId",child.toString()),null,trace);
        }
        return familyItem(parent,child,item);
    }
    public FileService.Content familyFile(UUID parent,UUID child,UUID item,UUID fileId,boolean download) {
        var access=itemAccess(parent,child,item,false,false);
        db.one("select id from lesson_blocks where lesson_id=? and file_id=?",access.get("lessonId"),fileId);
        UUID teacher=id(access,"teacherId"); var file=files.owned(teacher,fileId);
        if(download&&!file.isLearnerDownloadAllowed()) throw new ApiException(HttpStatus.FORBIDDEN,"DOWNLOAD_NOT_ALLOWED","Giáo viên chỉ cho phép xem tài liệu này trong bài.");
        return files.content(file);
    }
    public Map<String,Object> itemAccess(UUID parent,UUID child,UUID item,boolean mutation,boolean lock) {
        guardians.child(parent,child);
        var result=db.one("select i.id,i.assignment_id,i.lesson_id,i.completion_mode,i.is_required,i.allowed_response_types,a.teacher_id,a.available_at,a.due_at,c.status as class_status from assignment_items i join assignments a on a.id=i.assignment_id join assignment_recipients r on r.assignment_id=a.id join students s on s.id=r.student_id left join classes c on c.id=a.class_id left join class_enrollments e on e.id=r.source_enrollment_id where i.id=? and r.student_id=? and r.revoked_at is null and a.status='PUBLISHED' and s.status='ACTIVE' and (a.target_type='STUDENT' or(c.status in('ACTIVE','COMPLETED') and e.status in('ACTIVE','COMPLETED')))"+(lock?" for update of r":""),item,child);
        if(!available(result)) throw new ApiException(HttpStatus.FORBIDDEN,"CONTENT_NOT_AVAILABLE","Bài học chưa đến giờ mở.");
        if(mutation&&"COMPLETED".equals(result.get("classStatus"))) throw conflict("CLASS_COMPLETED","Lớp đã kết thúc; bạn có thể xem lại nhưng không xác nhận/nộp mới.");
        return result;
    }
    private boolean available(Map<String,Object> row) { Object value=row.get("availableAt"); return value instanceof Instant instant&&!instant.isAfter(Instant.now()); }
    private void validateMode(String mode,boolean required,List<String> responses) {
        if("REFERENCE".equals(mode)&&required) throw problem("REFERENCE_IS_OPTIONAL","Nội dung tham khảo không thể bắt buộc.");
        if("TEACHER_REVIEW".equals(mode)&&responses.isEmpty()) throw problem("RESPONSE_TYPES_REQUIRED","Chọn loại sản phẩm cho bài cần giáo viên duyệt.");
        if(new HashSet<>(responses).size()!=responses.size()) throw problem("DUPLICATE_RESPONSE_TYPE","Loại sản phẩm bị trùng.");
    }
    private void validateDates(Instant available,Instant due) { if(available!=null&&due!=null&&due.isBefore(available)) throw problem("INVALID_DATE_RANGE","Hạn hoàn thành phải sau thời điểm mở."); }
    private Object stamp(Instant value) { return value==null?null:java.sql.Timestamp.from(value); }
    private String hash(String value) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8))); } catch(NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); } }
}

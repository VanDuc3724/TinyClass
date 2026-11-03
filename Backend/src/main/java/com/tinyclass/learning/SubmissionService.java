package com.tinyclass.learning;

import com.tinyclass.common.api.*;
import com.tinyclass.common.persistence.DomainStore;
import com.tinyclass.family.GuardianService;
import com.tinyclass.learning.SubmissionDtos.*;
import com.tinyclass.storage.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.time.Instant;
import java.util.*;
import static com.tinyclass.common.persistence.DomainStore.*;

@Service
@Transactional(readOnly=true)
public class SubmissionService {
    private static final String JOINS=" from submissions x join assignment_items i on i.id=x.assignment_item_id join assignments a on a.id=i.assignment_id join lessons l on l.id=i.lesson_id join students s on s.id=x.student_id left join classes c on c.id=a.class_id join users u on u.id=x.submitted_by left join users reviewer on reviewer.id=x.reviewed_by left join student_progress p on p.assignment_item_id=i.id and p.student_id=x.student_id ";
    private static final String SELECT="select x.id,x.assignment_item_id,x.student_id,x.attempt_number,x.review_cycle,x.submitted_by,x.text_response,x.status,x.submitted_at,x.reviewed_at,x.feedback_text,x.feedback_audio_file_id,x.version,x.created_at,i.completion_mode,a.id as assignment_id,a.teacher_id,a.title as assignment_title,a.due_at,c.name as class_name,l.title as lesson_title,s.full_name as student_name,u.display_name as submitted_by_name,reviewer.display_name as reviewed_by_name,p.status as progress_status,p.review_cycle as current_cycle,p.version as progress_version,(x.submitted_at is not null and a.due_at is not null and x.submitted_at>a.due_at) as late"+JOINS;
    private final DomainStore db;
    private final AssignmentService assignments;
    private final GuardianService guardians;
    private final FileService files;
    public SubmissionService(DomainStore db,AssignmentService assignments,GuardianService guardians,FileService files) {
        this.db=db; this.assignments=assignments; this.guardians=guardians; this.files=files;
    }

    public Map<String,Object> workspace(UUID parent,UUID child,UUID item,int page,int size) {
        pagination(page,size); historicalContext(parent,child,item);
        var context=context(item,child);
        var progress=progress(item,child);
        boolean writable=canInteract(parent,child,item)&&"TEACHER_REVIEW".equals(context.get("completionMode"));
        long cycle=progress==null?0:number(progress,"reviewCycle");
        var own=db.rows("select id from submissions where assignment_item_id=? and student_id=? and submitted_by=? and review_cycle=? and status='DRAFT'",item,child,parent,cycle);
        var result=new LinkedHashMap<String,Object>();
        result.put("allowedResponseTypes",context.get("allowedResponseTypes")); result.put("reviewCycle",cycle); result.put("progress",progress);
        result.put("canEdit",writable&&(progress==null||!"COMPLETED".equals(progress.get("status"))));
        result.put("canCreate",writable&&(progress==null||!Set.of("COMPLETED","SUBMITTED").contains(progress.get("status"))));
        result.put("ownDraft",own.isEmpty()?null:familyDetail(parent,child,id(own.getFirst(),"id")));
        result.put("submissions",familyList(parent,child,item,page,size));
        result.put("events",events(item,child)); return result;
    }

    @Transactional public Map<String,Object> create(UUID parent,UUID child,UUID item,String trace) {
        var access=familyWriteAccess(parent,child,item); requireReview(access);
        var progress=lockProgress(item,child); requireNew(progress);
        var own=db.rows("select id from submissions where assignment_item_id=? and student_id=? and submitted_by=? and review_cycle=? and status='DRAFT'",item,child,parent,number(progress,"reviewCycle"));
        if(!own.isEmpty()) return familyDetail(parent,child,id(own.getFirst(),"id"));
        int attempt=(int)db.count("select coalesce(max(attempt_number),0)+1 from submissions where assignment_item_id=? and student_id=?",item,child);
        UUID submission=UUID.randomUUID();
        db.update("insert into submissions(id,assignment_item_id,student_id,attempt_number,review_cycle,submitted_by,status) values(?,?,?,?,?,?,'DRAFT')",submission,item,child,attempt,number(progress,"reviewCycle"),parent);
        db.audit(parent,"SUBMISSION_DRAFT_CREATED","SUBMISSION",submission,Map.of("studentId",child,"attemptNumber",attempt),null,trace);
        return familyDetail(parent,child,submission);
    }

    @Transactional public Map<String,Object> save(UUID parent,UUID submission,DraftInput input,String trace) {
        var ref=reference(submission); UUID child=id(ref,"studentId"),item=id(ref,"assignmentItemId");
        var access=familyWriteAccess(parent,child,item); requireReview(access);
        var progress=lockProgress(item,child); var row=locked(submission); editable(parent,row,progress); version(row,input.version());
        validateResponse(parent,child,item,input.textResponse(),input.fileIds(),responseTypes(access),false);
        db.update("update submissions set text_response=?,version=version+1,updated_at=now() where id=?",clean(input.textResponse()),submission);
        db.update("delete from submission_attachments where submission_id=?",submission);
        int position=0; for(UUID file:input.fileIds()) db.update("insert into submission_attachments(submission_id,file_id,position) values(?,?,?)",submission,file,position++);
        db.audit(parent,"SUBMISSION_DRAFT_SAVED","SUBMISSION",submission,Map.of("attachmentCount",input.fileIds().size()),null,trace);
        return familyDetail(parent,child,submission);
    }

    @Transactional public Map<String,Object> submit(UUID parent,UUID submission,VersionInput input,String trace) {
        var ref=reference(submission); UUID child=id(ref,"studentId"),item=id(ref,"assignmentItemId");
        var access=familyWriteAccess(parent,child,item); requireReview(access);
        var progress=lockProgress(item,child); var row=locked(submission); author(parent,row);
        if("SUBMITTED".equals(row.get("status"))&&number(row,"reviewCycle")==number(progress,"reviewCycle")) return familyDetail(parent,child,submission);
        editable(parent,row,progress); version(row,input.version()); requireNew(progress);
        var attached=db.rows("select file_id from submission_attachments where submission_id=? order by position",submission).stream().map(f->id(f,"fileId")).toList();
        validateResponse(parent,child,item,text(row,"textResponse"),attached,responseTypes(access),true);
        db.update("update submissions set status='SUBMITTED',submitted_at=now(),version=version+1,updated_at=now() where id=?",submission);
        db.update("update student_progress set status='SUBMITTED',updated_at=now(),version=version+1 where id=?",progress.get("id"));
        event(parent,item,child,submission,"SUBMITTED",number(progress,"reviewCycle"),null,progress);
        db.audit(parent,"SUBMISSION_SUBMITTED","SUBMISSION",submission,Map.of("attemptNumber",number(row,"attemptNumber")),null,trace);
        return familyDetail(parent,child,submission);
    }

    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public FileDtos.FileView upload(UUID parent,UUID child,UUID submission,MultipartFile part,String trace) {
        guardians.child(parent,child);
        var row=reference(submission); if(!child.equals(id(row,"studentId"))) throw missing();
        UUID item=id(row,"assignmentItemId"); var access=assignments.itemAccess(parent,child,item,true,false); requireReview(access);
        var progress=progress(item,child); if(progress==null) throw missing(); editable(parent,row,progress);
        return files.uploadSubmission(parent,id(access,"teacherId"),child,item,part,responseTypes(access),trace);
    }

    public PageResponse<Map<String,Object>> familyList(UUID parent,UUID child,UUID item,int page,int size) {
        guardians.child(parent,child); pagination(page,size);
        if(item!=null) historicalContext(parent,child,item);
        String filter=" where x.student_id=?"+(item==null?"":" and x.assignment_item_id=?");
        var args=new ArrayList<Object>(); args.add(child); if(item!=null) args.add(item);
        long total=db.count("select count(*)"+JOINS+filter,args.toArray());
        args.add(size); args.add((long)page*size);
        String order=item==null?"coalesce(x.submitted_at,x.created_at) desc,x.id desc":"x.attempt_number desc,x.created_at desc,x.id desc";
        var rows=db.rows(SELECT+filter+" order by "+order+" limit ? offset ?",args.toArray());
        rows.forEach(r->r.remove("teacherId")); return db.page(rows,total,page,size);
    }

    public Map<String,Object> familyDetail(UUID parent,UUID child,UUID submission) {
        guardians.child(parent,child);
        var row=db.one(SELECT+" where x.id=? and x.student_id=?",submission,child);
        return decorate(row);
    }

    public PageResponse<Map<String,Object>> teacherList(UUID teacher,String status,UUID classId,UUID child,UUID lessonId,int page,int size) {
        pagination(page,size);
        if(status!=null&&!status.isBlank()&&!Set.of("SUBMITTED","ACCEPTED","CHANGES_REQUESTED").contains(status)) throw problem("INVALID_STATUS","Trạng thái sản phẩm chưa hợp lệ.");
        if(classId!=null) db.one("select id from classes where id=? and teacher_id=?",classId,teacher);
        if(child!=null) db.one("select id from students where id=? and teacher_id=?",child,teacher);
        if(lessonId!=null) db.one("select id from lessons where id=? and teacher_id=?",lessonId,teacher);
        var args=new ArrayList<Object>(); args.add(teacher); String filter=" where a.teacher_id=? and x.status<>'DRAFT'";
        if(status!=null&&!status.isBlank()) {filter+=" and x.status=?";args.add(status);}
        if(classId!=null) {filter+=" and a.class_id=?";args.add(classId);}
        if(child!=null) {filter+=" and x.student_id=?";args.add(child);}
        if(lessonId!=null) {filter+=" and i.lesson_id=?";args.add(lessonId);}
        long total=db.count("select count(*)"+JOINS+filter,args.toArray()); args.add(size);args.add((long)page*size);
        var rows=db.rows(SELECT+filter+" order by x.submitted_at desc,x.id desc limit ? offset ?",args.toArray());
        rows.forEach(r->r.remove("teacherId")); return db.page(rows,total,page,size);
    }

    public Map<String,Object> teacherDetail(UUID teacher,UUID submission) {
        var row=db.one(SELECT+" where x.id=? and a.teacher_id=? and x.status<>'DRAFT'",submission,teacher);
        return decorate(row);
    }

    @Transactional public Map<String,Object> review(UUID teacher,UUID submission,ReviewInput input,String trace) {
        var ref=owned(teacher,submission); UUID child=id(ref,"studentId"),item=id(ref,"assignmentItemId");
        var progress=lockProgress(item,child); var row=locked(submission); version(row,input.version());
        if(!"SUBMITTED".equals(row.get("status"))||number(row,"reviewCycle")!=number(progress,"reviewCycle")) throw conflict("INVALID_STATE","Lượt này không còn chờ duyệt trong vòng hiện tại. Tải lại sản phẩm.");
        String feedback=clean(input.feedbackText());
        if("CHANGES_REQUESTED".equals(input.outcome())&&feedback==null) throw problem("FEEDBACK_REQUIRED","Ghi nhận xét để gia đình biết cần bổ sung điều gì.");
        if(input.feedbackAudioFileId()!=null) {
            var audio=files.owned(teacher,input.feedbackAudioFileId());
            if(!"READY".equals(audio.getStatus())||!"REVIEW_ASSET".equals(audio.getPurpose())||!audio.getMimeType().startsWith("audio/")) throw problem("INVALID_FEEDBACK_AUDIO","Phản hồi âm thanh cần tệp âm thanh sẵn sàng của giáo viên.");
        }
        db.update("update submissions set status=?,reviewed_by=?,reviewed_at=now(),feedback_text=?,feedback_audio_file_id=?,version=version+1,updated_at=now() where id=?",input.outcome(),teacher,feedback,input.feedbackAudioFileId(),submission);
        if("ACCEPTED".equals(input.outcome())) db.update("update student_progress set status='COMPLETED',teacher_accepted_at=now(),completed_at=now(),updated_at=now(),version=version+1 where id=?",progress.get("id"));
        else db.update("update student_progress set status='NEEDS_REVISION',teacher_accepted_at=null,completed_at=null,updated_at=now(),version=version+1 where id=?",progress.get("id"));
        event(teacher,item,child,submission,input.outcome(),number(progress,"reviewCycle"),feedback,progress);
        db.audit(teacher,"SUBMISSION_"+input.outcome(),"SUBMISSION",submission,Map.of("studentId",child),feedback,trace);
        return teacherDetail(teacher,submission);
    }

    @Transactional public Map<String,Object> reopen(UUID teacher,UUID item,UUID child,ReopenInput input,String trace) {
        db.one("select i.id from assignment_items i join assignments a on a.id=i.assignment_id where i.id=? and a.teacher_id=?",item,teacher);
        var live=liveRecipient(item,child,true);
        if(!live) throw conflict("CONTENT_NOT_AVAILABLE","Chỉ mở lại khi bé còn quyền trong lần giao và lớp đang dạy.");
        var progress=lockProgress(item,child); version(progress,input.version());
        if(!"COMPLETED".equals(progress.get("status"))) throw conflict("INVALID_STATE","Chỉ mở lại yêu cầu đã hoàn thành.");
        db.update("update student_progress set status='OPENED',review_cycle=review_cycle+1,parent_confirmed_at=null,confirmed_by=null,teacher_accepted_at=null,completed_at=null,reopened_at=now(),updated_at=now(),version=version+1 where id=?",progress.get("id"));
        event(teacher,item,child,null,"REOPENED",number(progress,"reviewCycle")+1,input.reason().strip(),progress);
        db.audit(teacher,"ASSIGNMENT_ITEM_REOPENED","ASSIGNMENT_ITEM",item,Map.of("studentId",child,"reviewCycle",number(progress,"reviewCycle")+1),input.reason().strip(),trace);
        return progress(item,child);
    }

    public Map<String,Object> teacherProgress(UUID teacher,UUID assignment,UUID child) {
        var result=db.one("select a.id,a.title,s.full_name as student_name from assignments a join assignment_recipients r on r.assignment_id=a.id join students s on s.id=r.student_id where a.id=? and a.teacher_id=? and r.student_id=?",assignment,teacher,child);
        var items=db.rows("select i.id,i.completion_mode,i.is_required,l.title from assignment_items i join lessons l on l.id=i.lesson_id where i.assignment_id=? order by i.position",assignment);
        for(var item:items) { UUID id=id(item,"id");var progress=progress(id,child); item.put("progress",progress);item.put("canReopen",progress!=null&&"COMPLETED".equals(progress.get("status"))&&liveRecipient(id,child,false)); }
        result.put("items",items); return result;
    }

    public FileService.Content familyFile(UUID parent,UUID child,UUID submission,UUID file) {
        guardians.child(parent,child);var row=db.one(SELECT+" where x.id=? and x.student_id=?",submission,child); return fileContent(row,file);
    }
    public FileService.Content teacherFile(UUID teacher,UUID submission,UUID file) {return fileContent(owned(teacher,submission),file);}
    private FileService.Content fileContent(Map<String,Object> row,UUID file) {
        if(file.equals(id(row,"feedbackAudioFileId"))) return files.content(files.owned(id(row,"teacherId"),file));
        db.one("select file_id from submission_attachments where submission_id=? and file_id=?",row.get("id"),file);
        return files.content(files.submissionAsset(file,id(row,"studentId"),id(row,"assignmentItemId")));
    }

    private Map<String,Object> decorate(Map<String,Object> row) {
        UUID item=id(row,"assignmentItemId"),child=id(row,"studentId"),submission=id(row,"id");
        row.remove("teacherId"); row.put("attachments",db.rows("select f.id,f.original_name,f.mime_type,f.size_bytes,f.status from submission_attachments t join files f on f.id=t.file_id where t.submission_id=? order by t.position",submission));
        row.put("events",events(item,child)); row.put("progress",progress(item,child)); return row;
    }
    private List<Map<String,Object>> events(UUID item,UUID child) { return db.rows("select e.id,e.event_type,e.review_cycle,e.reason,e.created_at,u.display_name as actor_name from submission_events e join users u on u.id=e.actor_id where e.assignment_item_id=? and e.student_id=? order by e.review_cycle desc,e.created_at desc,e.id desc",item,child); }
    private void event(UUID actor,UUID item,UUID child,UUID submission,String type,long cycle,String reason,Map<String,Object> before) {
        db.update("insert into submission_events(id,assignment_item_id,student_id,submission_id,actor_id,event_type,review_cycle,reason,before_state) values(?,?,?,?,?,?,?,?,?::jsonb)",UUID.randomUUID(),item,child,submission,actor,type,cycle,reason,db.json(before));
    }
    private Map<String,Object> reference(UUID submission) {return db.one("select id,assignment_item_id,student_id,submitted_by,status,review_cycle,version from submissions where id=?",submission);}
    private Map<String,Object> locked(UUID submission) {return db.one("select * from submissions where id=? for update",submission);}
    private Map<String,Object> owned(UUID teacher,UUID submission) {return db.one(SELECT+" where x.id=? and a.teacher_id=? and x.status<>'DRAFT'",submission,teacher);}
    private Map<String,Object> context(UUID item,UUID child) {return db.one("select i.completion_mode,i.allowed_response_types from assignment_items i join assignment_recipients r on r.assignment_id=i.assignment_id where i.id=? and r.student_id=?",item,child);}
    private void historicalContext(UUID parent,UUID child,UUID item) {guardians.child(parent,child);context(item,child);}
    private Map<String,Object> familyWriteAccess(UUID parent,UUID child,UUID item) {
        guardians.child(parent,child);
        db.one("select id from student_guardians where guardian_user_id=? and student_id=? and status='ACTIVE' for share",parent,child);
        return assignments.itemAccess(parent,child,item,true,true);
    }
    private boolean canInteract(UUID parent,UUID child,UUID item) {try {assignments.itemAccess(parent,child,item,true,false);return true;}catch(ApiException denied){return false;}}
    private Map<String,Object> progress(UUID item,UUID child) {var rows=db.rows("select id,status,review_cycle,parent_confirmed_at,teacher_accepted_at,completed_at,reopened_at,version from student_progress where assignment_item_id=? and student_id=?",item,child);return rows.isEmpty()?null:rows.getFirst();}
    private Map<String,Object> lockProgress(UUID item,UUID child) {
        db.update("insert into student_progress(id,assignment_item_id,student_id,status) values(?,?,?,'OPENED') on conflict(assignment_item_id,student_id) do nothing",UUID.randomUUID(),item,child);
        return db.one("select * from student_progress where assignment_item_id=? and student_id=? for update",item,child);
    }
    private boolean liveRecipient(UUID item,UUID child,boolean lock) {
        return !db.rows("select r.id from assignment_items i join assignments a on a.id=i.assignment_id join assignment_recipients r on r.assignment_id=a.id join students s on s.id=r.student_id left join classes c on c.id=a.class_id left join class_enrollments e on e.id=r.source_enrollment_id where i.id=? and r.student_id=? and r.revoked_at is null and a.status='PUBLISHED' and s.status='ACTIVE' and a.available_at<=now() and (a.target_type='STUDENT' or(c.status='ACTIVE' and e.status='ACTIVE'))"+(lock?" for update of r":""),item,child).isEmpty();
    }
    private void author(UUID parent,Map<String,Object> row) {if(!parent.equals(id(row,"submittedBy")))throw missing();}
    private void editable(UUID parent,Map<String,Object> row,Map<String,Object> progress) {
        author(parent,row);
        if(!"DRAFT".equals(row.get("status"))||number(row,"reviewCycle")!=number(progress,"reviewCycle")||"COMPLETED".equals(progress.get("status"))) throw conflict("SUBMISSION_READ_ONLY","Lượt đã gửi hoặc thuộc vòng cũ chỉ được xem lại. Tạo nháp trong vòng hiện tại.");
    }
    private void requireNew(Map<String,Object> progress) {if(Set.of("SUBMITTED","COMPLETED").contains(progress.get("status")))throw conflict("SUBMISSION_NOT_OPEN","Bài đang chờ duyệt hoặc đã hoàn thành; không gửi thêm lúc này.");}
    private void requireReview(Map<String,Object> access) {if(!"TEACHER_REVIEW".equals(access.get("completionMode")))throw conflict("INVALID_COMPLETION_MODE","Bài này không yêu cầu nộp sản phẩm để giáo viên duyệt.");}
    private Set<String> responseTypes(Map<String,Object> access) {
        var result=new HashSet<String>(); if(access.get("allowedResponseTypes") instanceof List<?> values) values.forEach(v->result.add(v.toString()));return result;
    }
    private void validateResponse(UUID parent,UUID child,UUID item,String text,List<UUID> attached,Set<String> types,boolean sending) {
        if(attached.size()>5||new HashSet<>(attached).size()!=attached.size())throw problem("INVALID_ATTACHMENTS","Chọn tối đa 5 tệp riêng biệt.");
        if(clean(text)!=null&&!types.contains("TEXT"))throw problem("RESPONSE_TYPE_NOT_ALLOWED","Bài này chưa cho phép trả lời bằng chữ.");
        long total=0;
        for(UUID fileId:attached) {
            var file=files.submissionAsset(fileId,child,item); if(!parent.equals(file.getUploadedBy()))throw missing();
            if(!types.contains(FileService.responseType(file.getMimeType())))throw problem("RESPONSE_TYPE_NOT_ALLOWED","Tệp không đúng loại sản phẩm cô yêu cầu.");
            total+=file.getSizeBytes();
        }
        if(total>250L*1024*1024)throw problem("SUBMISSION_TOO_LARGE","Tổng dung lượng sản phẩm tối đa 250 MB.");
        if(sending&&clean(text)==null&&attached.isEmpty())throw problem("SUBMISSION_EMPTY","Thêm nội dung chữ hoặc tệp sản phẩm trước khi gửi.");
    }
}

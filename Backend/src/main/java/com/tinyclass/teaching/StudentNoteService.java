package com.tinyclass.teaching;

import com.tinyclass.common.api.*;
import com.tinyclass.common.persistence.DomainStore;
import com.tinyclass.family.GuardianService;
import com.tinyclass.storage.FileService;
import com.tinyclass.teaching.StudentNoteDtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import static com.tinyclass.common.persistence.DomainStore.*;

/** Family projections are built only after filtering visibility and the exact guardian/child relationship. */
@Service
@Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
public class StudentNoteService {
    private static final ZoneId ZONE=ZoneId.of("Asia/Ho_Chi_Minh");
    private static final String SELECT="select n.id,n.student_id,st.full_name as student_name,n.class_id,c.name as class_name,n.session_id,s.title as session_title,s.status as session_status,s.starts_at,s.ends_at,n.title,n.body,n.observed_on,n.visibility,n.shared_at,n.archived_at,n.created_at,n.updated_at,n.version,u.display_name as author_name from student_notes n join students st on st.id=n.student_id join users u on u.id=n.teacher_id left join classes c on c.id=n.class_id left join class_sessions s on s.id=n.session_id ";
    private static final String VISIBLE=" and n.visibility='SHARED' and n.archived_at is null";
    private final DomainStore db;
    private final GuardianService guardians;
    private final FileService files;
    private record Data(String title,String body,LocalDate observedOn,String visibility,UUID classId,UUID sessionId,List<UUID> fileIds) {}
    public StudentNoteService(DomainStore db,GuardianService guardians,FileService files) { this.db=db;this.guardians=guardians;this.files=files; }

    public Map<String,Object> teacherDetail(UUID teacher,UUID note) { return decorate(db.one(SELECT+"where n.id=? and n.teacher_id=?",note,teacher),false); }
    public Map<String,Object> familyDetail(UUID parent,UUID child,UUID note) {
        guardians.child(parent,child);
        return decorate(db.one(SELECT+"where n.id=? and n.student_id=?"+VISIBLE,note,child),true);
    }
    public PageResponse<Map<String,Object>> teacherList(UUID teacher,UUID child,String visibility,boolean archived,int page,int size) {
        child(teacher,child,false);pagination(page,size);
        if(clean(visibility)!=null && !Set.of("PRIVATE","SHARED").contains(visibility))throw problem("INVALID_VISIBILITY","Chọn nhận xét riêng hoặc chia sẻ.");
        var args=new ArrayList<Object>(List.of(child,teacher));
        String where="where n.student_id=? and n.teacher_id=?"+(archived?"":" and n.archived_at is null");
        if(clean(visibility)!=null){where+=" and n.visibility=?";args.add(visibility);}
        return notePage(where,args,page,size,false);
    }
    public PageResponse<Map<String,Object>> familyList(UUID parent,UUID child,int page,int size) {
        guardians.child(parent,child);pagination(page,size);
        return notePage("where n.student_id=?"+VISIBLE,new ArrayList<>(List.of(child)),page,size,true);
    }
    private PageResponse<Map<String,Object>> notePage(String where,List<Object> args,int page,int size,boolean family) {
        long total=db.count("select count(*) from student_notes n "+where,args.toArray());args.add(size);args.add((long)page*size);
        return db.page(db.rows(SELECT+where+" order by n.observed_on desc,n.created_at desc,n.id desc limit ? offset ?",args.toArray()).stream().map(row->decorate(row,family)).toList(),total,page,size);
    }

    @Transactional
    public Map<String,Object> create(UUID teacher,UUID child,CreateInput input,String trace) {
        var student=child(teacher,child,true);
        var data=data(input.title(),input.body(),input.observedOn(),input.visibility(),input.classId(),input.sessionId(),input.fileIds());
        String hash=hash(db.json(Arrays.asList(child,data.title(),data.body(),data.observedOn(),data.visibility(),data.classId(),data.sessionId(),data.fileIds())));
        var retried=db.rows("select id,create_hash from student_notes where teacher_id=? and client_request_id=?",teacher,input.clientRequestId());
        if(!retried.isEmpty()) {var found=retried.getFirst();if(!hash.equals(found.get("createHash")))throw conflict("REQUEST_REUSED","Mã lưu đã dùng cho nội dung khác. Tạo nhận xét mới nếu cần.");return teacherDetail(teacher,id(found,"id"));}
        if(!"ACTIVE".equals(student.get("status")))throw conflict("STUDENT_ARCHIVED","Khôi phục hồ sơ bé trước khi thêm nhận xét mới.");
        context(teacher,child,data);UUID id=UUID.randomUUID();validateFiles(teacher,id,data.fileIds());
        db.update("insert into student_notes(id,teacher_id,student_id,class_id,session_id,title,body,observed_on,visibility,shared_at,client_request_id,create_hash) values(?,?,?,?,?,?,?,?,?,case when ?='SHARED' then clock_timestamp() else null end,?,?)",id,teacher,child,data.classId(),data.sessionId(),data.title(),data.body(),data.observedOn(),data.visibility(),data.visibility(),input.clientRequestId(),hash);
        attach(id,data.fileIds());var after=teacherDetail(teacher,id);audit(teacher,id,"CREATED",Map.of(),after,null,trace);return after;
    }
    @Transactional
    public Map<String,Object> update(UUID teacher,UUID note,UpdateInput input,String trace) {
        var locked=lock(teacher,note);version(locked,input.version());if(locked.get("archivedAt")!=null)throw conflict("NOTE_ARCHIVED","Khôi phục nhận xét trước khi chỉnh sửa.");
        var before=teacherDetail(teacher,note);var data=data(input.title(),input.body(),input.observedOn(),input.visibility(),input.classId(),input.sessionId(),input.fileIds());
        context(teacher,id(before,"studentId"),data);validateFiles(teacher,note,data.fileIds());
        if(same(before,data))return before;
        db.update("update student_notes set title=?,body=?,observed_on=?,class_id=?,session_id=?,visibility=?,shared_at=case when ?='PRIVATE' then null when visibility='SHARED' then shared_at else clock_timestamp() end,updated_at=clock_timestamp(),version=version+1 where id=?",data.title(),data.body(),data.observedOn(),data.classId(),data.sessionId(),data.visibility(),data.visibility(),note);
        attach(note,data.fileIds());var after=teacherDetail(teacher,note);audit(teacher,note,"UPDATED",before,after,input.reason().strip(),trace);return after;
    }
    @Transactional
    public Map<String,Object> state(UUID teacher,UUID note,StateInput input,boolean archive,String trace) {
        var locked=lock(teacher,note);version(locked,input.version());var before=teacherDetail(teacher,note);
        if((locked.get("archivedAt")!=null)==archive)return before;
        db.update("update student_notes set archived_at="+(archive?"clock_timestamp()":"null")+",shared_at=case when visibility='PRIVATE' then null when ? then shared_at else clock_timestamp() end,updated_at=clock_timestamp(),version=version+1 where id=?",archive,note);
        var after=teacherDetail(teacher,note);audit(teacher,note,archive?"ARCHIVED":"RESTORED",before,after,input.reason().strip(),trace);return after;
    }
    public PageResponse<Map<String,Object>> history(UUID teacher,UUID note,int page,int size) {
        teacherDetail(teacher,note);pagination(page,size);
        long total=db.count("select count(*) from audit_events where entity_type='STUDENT_NOTE' and entity_id=?",note);
        return db.page(db.rows("select a.id,a.action,a.changed_fields,a.reason,a.created_at,u.display_name as actor_name from audit_events a join users u on u.id=a.actor_id where a.entity_type='STUDENT_NOTE' and a.entity_id=? order by a.created_at desc,a.id desc limit ? offset ?",note,size,(long)page*size),total,page,size);
    }
    public FileService.Content teacherFile(UUID teacher,UUID note,UUID file) {teacherDetail(teacher,note);return content(note,file,teacher);}
    public FileService.Content familyFile(UUID parent,UUID child,UUID note,UUID file) {familyDetail(parent,child,note);return content(note,file,null);}
    private FileService.Content content(UUID note,UUID file,UUID teacher) {
        var attached=db.one("select f.uploaded_by from student_note_attachments t join files f on f.id=t.file_id where t.student_note_id=? and t.file_id=? and f.context_student_note_id=? and f.purpose='NOTE_ASSET' and f.status='READY'",note,file,note);
        return files.content(files.owned(teacher==null?id(attached,"uploadedBy"):teacher,file));
    }

    public Map<String,Object> contexts(UUID teacher,UUID child,UUID classId,LocalDate on) {
        child(teacher,child,false);date(on);
        var result=new LinkedHashMap<String,Object>();
        result.put("classes",db.rows("select c.id,c.name,c.status as class_status,e.status as enrollment_status from class_enrollments e join classes c on c.id=e.class_id where e.student_id=? and c.teacher_id=? order by c.name,c.id",child,teacher));
        if(classId==null){result.put("sessions",List.of());return result;}
        db.one("select e.id from class_enrollments e join classes c on c.id=e.class_id where e.student_id=? and e.class_id=? and c.teacher_id=?",child,classId,teacher);
        result.put("sessions",db.rows("select s.id,s.title,s.starts_at,s.ends_at,s.status from class_sessions s where s.class_id=? and s.starts_at>=? and s.starts_at<? and s.starts_at<=clock_timestamp() and (exists(select 1 from class_enrollments e where e.class_id=s.class_id and e.student_id=? and e.joined_at<s.ends_at and (e.ended_at is null or e.ended_at>=s.starts_at)) or exists(select 1 from attendance_records a where a.session_id=s.id and a.student_id=? and a.is_active)) order by s.starts_at,s.id limit 100",classId,stamp(on.atStartOfDay(ZONE).toInstant()),stamp(on.plusDays(1).atStartOfDay(ZONE).toInstant()),child,child));return result;
    }
    public Map<String,Object> teacherProgress(UUID teacher,UUID child,String type,boolean archived,int page,int size) {var student=child(teacher,child,false);return progress(student,child,type,archived,page,size,false);}
    public Map<String,Object> familyProgress(UUID parent,UUID child,String type,int page,int size) {guardians.child(parent,child);var student=db.one("select id,full_name,status from students where id=?",child);return progress(student,child,type,false,page,size,true);}
    private Map<String,Object> progress(Map<String,Object> student,UUID child,String type,boolean archived,int page,int size,boolean family) {
        pagination(page,size);if(!Set.of("ALL","NOTE","SUBMISSION").contains(type))throw problem("INVALID_TYPE","Chọn tất cả, nhận xét hoặc sản phẩm.");
        var counts=new LinkedHashMap<String,Object>();
        counts.put("sharedNotes",db.count("select count(*) from student_notes where student_id=? and visibility='SHARED' and archived_at is null",child));
        if(!family)counts.put("privateNotes",db.count("select count(*) from student_notes where student_id=? and visibility='PRIVATE' and archived_at is null",child));
        counts.put("submittedProducts",db.count("select count(*) from submissions where student_id=? and status<>'DRAFT' and submitted_at is not null",child));
        counts.put("acceptedProducts",db.count("select count(*) from submissions where student_id=? and status='ACCEPTED'",child));
        String note="select n.id,'NOTE' as type,(n.observed_on::timestamp at time zone 'Asia/Ho_Chi_Minh') as occurred_at,n.created_at as tie_at from student_notes n where n.student_id=?"+(family?VISIBLE:archived?"":" and n.archived_at is null");
        String submission="select x.id,'SUBMISSION' as type,x.submitted_at as occurred_at,x.created_at as tie_at from submissions x where x.student_id=? and x.status<>'DRAFT' and x.submitted_at is not null";
        String combined=type.equals("NOTE")?note:type.equals("SUBMISSION")?submission:note+" union all "+submission;
        var args=new ArrayList<Object>();args.add(child);if(type.equals("ALL"))args.add(child);
        long total=db.count("select count(*) from ("+combined+") timeline",args.toArray());args.add(size);args.add((long)page*size);
        var rows=db.rows("select * from ("+combined+") timeline order by occurred_at desc,tie_at desc,type,id desc limit ? offset ?",args.toArray());
        for(var row:rows){row.remove("tieAt");UUID id=id(row,"id");if("NOTE".equals(row.get("type"))){var value=db.one(SELECT+"where n.id=?",id);row.put("note",decorate(value,family));}else row.put("submission",submissionSummary(id));}
        return Map.of("student",student,"counts",counts,"timeline",db.page(rows,total,page,size));
    }
    private Map<String,Object> submissionSummary(UUID id) {
        return db.one("select x.id,x.status,x.attempt_number,x.review_cycle,x.text_response,x.feedback_text,x.submitted_at,x.reviewed_at,u.display_name as submitted_by_name,r.display_name as reviewed_by_name,a.id as assignment_id,a.title as assignment_title,l.title as lesson_title,c.name as class_name,(select count(*) from submission_attachments t where t.submission_id=x.id) as attachment_count from submissions x join assignment_items i on i.id=x.assignment_item_id join assignments a on a.id=i.assignment_id join lessons l on l.id=i.lesson_id join users u on u.id=x.submitted_by left join users r on r.id=x.reviewed_by left join classes c on c.id=a.class_id where x.id=? and x.status<>'DRAFT'",id);
    }

    private Map<String,Object> decorate(Map<String,Object> row,boolean family) {
        row.put("attachments",db.rows("select f.id,f.original_name,f.mime_type,f.size_bytes,f.status from student_note_attachments t join files f on f.id=t.file_id where t.student_note_id=? order by t.position",id(row,"id")));
        if(!family)return row;
        var result=new LinkedHashMap<String,Object>();for(String key:List.of("id","title","body","observedOn","classId","className","sessionId","sessionTitle","sessionStatus","startsAt","endsAt","sharedAt","updatedAt","authorName","attachments"))result.put(key,row.get(key));return result;
    }
    private Map<String,Object> child(UUID teacher,UUID id,boolean lock) {return db.one("select id,full_name,status from students where id=? and teacher_id=?"+(lock?" for update":""),id,teacher);}
    private Map<String,Object> lock(UUID teacher,UUID note) {var ref=db.one("select student_id from student_notes where id=? and teacher_id=?",note,teacher);child(teacher,id(ref,"studentId"),true);return db.one("select id,version,archived_at from student_notes where id=? and teacher_id=? for update",note,teacher);}
    private Data data(String title,String body,LocalDate on,String visibility,UUID classId,UUID sessionId,List<UUID> attached) {date(on);return new Data(clean(title)==null?"Nhận xét của cô":title.strip(),body.strip(),on,visibility==null?"PRIVATE":visibility,classId,sessionId,attached);}
    private void date(LocalDate on) {if(on==null || on.getYear()<1900 || on.isAfter(LocalDate.now(ZONE)))throw problem("INVALID_NOTE_DATE","Ngày ghi nhận phải từ năm 1900 đến hôm nay theo giờ Việt Nam.");}
    private void context(UUID teacher,UUID child,Data data) {
        if(data.sessionId()!=null && data.classId()==null)throw problem("NOTE_CLASS_REQUIRED","Chọn lớp trước khi gắn nhận xét với một buổi học.");
        if(data.classId()==null)return;
        var membership=db.one("select e.joined_at,e.ended_at from class_enrollments e join classes c on c.id=e.class_id where e.student_id=? and e.class_id=? and c.teacher_id=?",child,data.classId(),teacher);
        if(data.sessionId()!=null) {
            var session=db.one("select s.starts_at,s.ends_at from class_sessions s join classes c on c.id=s.class_id where s.id=? and s.class_id=? and c.teacher_id=?",data.sessionId(),data.classId(),teacher);
            Instant start=(Instant)session.get("startsAt"),end=(Instant)session.get("endsAt");
            boolean roster=db.count("select count(*) from attendance_records where session_id=? and student_id=? and is_active",data.sessionId(),child)>0;
            boolean member=((Instant)membership.get("joinedAt")).isBefore(end) && (membership.get("endedAt")==null || !((Instant)membership.get("endedAt")).isBefore(start));
            if(start.isAfter(Instant.now()) || !data.observedOn().equals(start.atZone(ZONE).toLocalDate()) || !(member||roster))throw problem("NOTE_SESSION_CONTEXT","Chọn buổi đã bắt đầu, đúng ngày ghi nhận và phù hợp thời gian bé tham gia.");
        } else {
            LocalDate joined=((Instant)membership.get("joinedAt")).atZone(ZONE).toLocalDate(),ended=membership.get("endedAt")==null?null:((Instant)membership.get("endedAt")).atZone(ZONE).toLocalDate();
            if(data.observedOn().isBefore(joined) || ended!=null&&data.observedOn().isAfter(ended))throw problem("NOTE_ENROLLMENT_CONTEXT","Ngày ghi nhận cần nằm trong thời gian bé tham gia lớp; có thể bỏ lớp để ghi nhận xét chung.");
        }
    }
    private void validateFiles(UUID teacher,UUID note,List<UUID> attached) {
        if(attached.size()>5 || new HashSet<>(attached).size()!=attached.size())throw problem("INVALID_ATTACHMENTS","Chọn tối đa 5 tệp riêng biệt.");
        long total=0;for(UUID file:attached.stream().sorted().toList()) {
            var row=db.one("select id,purpose,status,size_bytes,context_student_note_id from files where id=? and uploaded_by=? for update",file,teacher);
            if(!"NOTE_ASSET".equals(row.get("purpose")) || !"READY".equals(row.get("status")))throw problem("INVALID_NOTE_FILE","Chỉ gắn tệp nhận xét sẵn sàng do cô tải lên.");
            if(row.get("contextStudentNoteId")!=null && !note.equals(id(row,"contextStudentNoteId")))throw conflict("NOTE_FILE_ALREADY_BOUND","Tệp này đã thuộc một nhận xét khác. Tải một bản mới cho nhận xét đang viết.");
            total+=number(row,"sizeBytes");
        }
        if(total>250L*1024*1024)throw problem("NOTE_FILES_TOO_LARGE","Tổng tệp của một nhận xét tối đa 250 MB.");
    }
    private void attach(UUID note,List<UUID> attached) {db.update("delete from student_note_attachments where student_note_id=?",note);int position=0;for(UUID file:attached){db.update("update files set context_student_note_id=? where id=?",note,file);db.update("insert into student_note_attachments(student_note_id,file_id,position) values(?,?,?)",note,file,position++);}}
    private boolean same(Map<String,Object> before,Data data) {return Objects.equals(before.get("title"),data.title()) && Objects.equals(before.get("body"),data.body()) && Objects.equals(before.get("observedOn"),data.observedOn()) && Objects.equals(before.get("visibility"),data.visibility()) && Objects.equals(id(before,"classId"),data.classId()) && Objects.equals(id(before,"sessionId"),data.sessionId()) && db.rows("select file_id from student_note_attachments where student_note_id=? order by position",id(before,"id")).stream().map(r->id(r,"fileId")).toList().equals(data.fileIds());}
    private void audit(UUID teacher,UUID note,String action,Map<String,Object> before,Map<String,Object> after,String reason,String trace) {db.audit(teacher,"STUDENT_NOTE_"+action,"STUDENT_NOTE",note,Map.of("before",before,"after",after),reason,trace);}
    private static Timestamp stamp(Instant instant) {return Timestamp.from(instant);}
    private static String hash(String value) {try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException failure){throw new IllegalStateException(failure);}}
}

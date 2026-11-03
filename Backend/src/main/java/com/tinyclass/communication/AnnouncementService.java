package com.tinyclass.communication;

import com.tinyclass.common.api.*;
import com.tinyclass.common.persistence.DomainStore;
import com.tinyclass.family.GuardianService;
import com.tinyclass.communication.AnnouncementDtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import static com.tinyclass.common.persistence.DomainStore.*;

@Service
@Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
public class AnnouncementService {
    private static final String TEACHER="select a.id,a.class_id,c.name as class_name,c.status as class_status,a.title,a.body,a.status,a.publication_revision as revision,a.published_at,a.archived_at,a.created_at,a.updated_at,a.version from class_announcements a join classes c on c.id=a.class_id ";
    private static final String PUBLIC="select a.id,a.class_id,c.name as class_name,a.title,substring(a.body from 1 for 200) as excerpt,a.published_at,a.updated_at,a.publication_revision as revision,(coalesce(r.publication_revision,0)=a.publication_revision) as is_read ";
    private static final String PUBLIC_FROM=" from class_announcements a join classes c on c.id=a.class_id left join announcement_reads r on r.announcement_id=a.id and r.user_id=? where a.status='PUBLISHED' and c.status in('ACTIVE','COMPLETED') and exists(select 1 from class_enrollments e join students s on s.id=e.student_id where e.class_id=a.class_id and e.student_id=? and s.status='ACTIVE' and e.status in('ACTIVE','COMPLETED'))";
    private final DomainStore db;
    private final GuardianService guardians;
    public AnnouncementService(DomainStore db,GuardianService guardians){this.db=db;this.guardians=guardians;}

    @Transactional
    public Map<String,Object> create(UUID teacher,CreateInput input,String trace){
        var classroom=lockClass(teacher,input.classId());
        String hash=hash(db.json(Arrays.asList(input.classId(),input.title().strip(),input.body().strip())));
        var previous=db.rows("select id,request_hash from class_announcements where teacher_id=? and client_request_id=?",teacher,input.clientRequestId());
        if(!previous.isEmpty()){
            if(!hash.equals(previous.getFirst().get("requestHash")))throw conflict("ANNOUNCEMENT_REQUEST_REUSED","Mã gửi đã dùng cho nội dung khác. Đối chiếu thông báo đã lưu trước khi tạo mới.");
            return detail(teacher,id(previous.getFirst(),"id"));
        }
        if(!Set.of("DRAFT","ACTIVE").contains(classroom.get("status")))throw conflict("CLASS_READ_ONLY","Chỉ tạo nháp cho lớp đang chuẩn bị hoặc đang dạy.");
        UUID id=UUID.randomUUID();db.update("insert into class_announcements(id,teacher_id,class_id,title,body,client_request_id,request_hash) values(?,?,?,?,?,?,?)",id,teacher,input.classId(),input.title().strip(),input.body().strip(),input.clientRequestId(),hash);
        var after=detail(teacher,id);audit(teacher,"CREATED",id,Map.of(),after,null,trace);return after;
    }
    @Transactional
    public Map<String,Object> update(UUID teacher,UUID id,UpdateInput input,String trace){
        lock(teacher,id);var before=detail(teacher,id);version(before,input.version());
        if(!Boolean.TRUE.equals(before.get("canEdit")))throw conflict("ANNOUNCEMENT_READ_ONLY","Thông báo hoặc lớp đang ở chế độ chỉ xem.");
        db.update("update class_announcements set title=?,body=?,publication_revision=publication_revision+case when status='PUBLISHED' then 1 else 0 end,version=version+1,updated_at=clock_timestamp() where id=?",input.title().strip(),input.body().strip(),id);
        var after=detail(teacher,id);audit(teacher,"UPDATED",id,before,after,input.reason().strip(),trace);return after;
    }
    @Transactional
    public Map<String,Object> action(UUID teacher,UUID id,String action,ActionInput input,String trace){
        lock(teacher,id);var before=detail(teacher,id);
        if("publish".equals(action)&&"PUBLISHED".equals(before.get("status"))||"archive".equals(action)&&"ARCHIVED".equals(before.get("status")))return before;
        version(before,input.version());
        if("publish".equals(action)){
            if(!Boolean.TRUE.equals(before.get("canPublish")))throw conflict("ANNOUNCEMENT_NOT_PUBLISHABLE","Chỉ đăng thông báo nháp của lớp đang dạy.");
            db.update("update class_announcements set status='PUBLISHED',published_at=clock_timestamp(),publication_revision=1,updated_at=clock_timestamp(),version=version+1 where id=?",id);
        }else if("archive".equals(action)){
            if(clean(input.reason())==null)throw problem("REASON_REQUIRED","Nhập lý do lưu trữ thông báo.");
            db.update("update class_announcements set status='ARCHIVED',archived_at=clock_timestamp(),updated_at=clock_timestamp(),version=version+1 where id=?",id);
        }else throw missing();
        var after=detail(teacher,id);audit(teacher,"publish".equals(action)?"PUBLISHED":"ARCHIVED",id,before,after,clean(input.reason()),trace);return after;
    }
    public Map<String,Object> detail(UUID teacher,UUID id){
        var row=db.one(TEACHER+"where a.id=? and a.teacher_id=?",id,teacher);
        boolean editable=!"ARCHIVED".equals(row.get("status"))&&Set.of("DRAFT","ACTIVE","COMPLETED").contains(row.get("classStatus"));
        row.put("canEdit",editable);row.put("canPublish","DRAFT".equals(row.get("status"))&&"ACTIVE".equals(row.get("classStatus")));row.put("canArchive",!"ARCHIVED".equals(row.get("status")));return row;
    }
    public PageResponse<Map<String,Object>> list(UUID teacher,UUID classroom,String status,String q,int page,int size){
        pagination(page,size);if(classroom!=null)db.one("select id from classes where id=? and teacher_id=?",classroom,teacher);
        if(clean(status)!=null&&!Set.of("DRAFT","PUBLISHED","ARCHIVED").contains(status))throw problem("INVALID_STATUS","Trạng thái thông báo chưa hợp lệ.");
        String where="where a.teacher_id=? and lower(a.title) like ? escape '\\'";var args=new ArrayList<Object>(List.of(teacher,search(q)));
        if(classroom!=null){where+=" and a.class_id=?";args.add(classroom);}if(clean(status)!=null){where+=" and a.status=?";args.add(status);}
        long total=db.count("select count(*) from class_announcements a "+where,args.toArray());args.add(size);args.add((long)page*size);
        var rows=db.rows(TEACHER+where+" order by a.updated_at desc,a.id desc limit ? offset ?",args.toArray());rows.forEach(r->r.remove("body"));return db.page(rows,total,page,size);
    }
    public PageResponse<Map<String,Object>> history(UUID teacher,UUID id,int page,int size){
        detail(teacher,id);pagination(page,size);long total=db.count("select count(*) from audit_events where entity_type='ANNOUNCEMENT' and entity_id=?",id);
        return db.page(db.rows("select a.id,a.action,a.reason,a.changed_fields,a.created_at,u.display_name as actor_name from audit_events a join users u on u.id=a.actor_id where a.entity_type='ANNOUNCEMENT' and a.entity_id=? order by a.created_at desc,a.id desc limit ? offset ?",id,size,(long)page*size),total,page,size);
    }
    public PageResponse<Map<String,Object>> familyList(UUID parent,UUID child,UUID classroom,int page,int size){
        guardians.child(parent,child);pagination(page,size);var args=new ArrayList<Object>(List.of(parent,child));String filter="";
        if(classroom!=null){
            db.one("select c.id from classes c join class_enrollments e on e.class_id=c.id join students s on s.id=e.student_id where c.id=? and e.student_id=? and s.status='ACTIVE' and e.status in('ACTIVE','COMPLETED') and c.status in('ACTIVE','COMPLETED')",classroom,child);
            filter=" and a.class_id=?";args.add(classroom);
        }
        long total=db.count("select count(*)"+PUBLIC_FROM+filter,args.toArray());args.add(size);args.add((long)page*size);
        return db.page(db.rows(PUBLIC+PUBLIC_FROM+filter+" order by a.published_at desc,a.id desc limit ? offset ?",args.toArray()),total,page,size);
    }
    public Map<String,Object> familyOverview(UUID parent,UUID child){
        guardians.child(parent,child);
        return Map.of("unreadCount",db.count("select count(*)"+PUBLIC_FROM+" and coalesce(r.publication_revision,0)<a.publication_revision",parent,child),"recent",familyList(parent,child,null,0,3).data());
    }
    public Map<String,Object> familyDetail(UUID parent,UUID child,UUID id){
        guardians.child(parent,child);return db.one(PUBLIC+",a.body "+PUBLIC_FROM+" and a.id=?",parent,child,id);
    }
    @Transactional
    public Map<String,Object> read(UUID parent,UUID child,UUID id,ReadInput input){
        // Same class-first lock order as teacher edits. The client acknowledges the revision it saw.
        guardians.child(parent,child);
        var reference=db.one("select class_id from class_announcements where id=?",id);
        db.one("select id from classes where id=? for update",reference.get("classId"));
        var row=familyDetail(parent,child,id);
        if(number(row,"revision")!=input.revision())throw conflict("ANNOUNCEMENT_CHANGED","Thông báo đã được cập nhật. Đọc lại trước khi xác nhận.");
        db.update("insert into announcement_reads(announcement_id,user_id,publication_revision) values(?,?,?) on conflict(announcement_id,user_id) do update set publication_revision=excluded.publication_revision,read_at=case when announcement_reads.publication_revision=excluded.publication_revision then announcement_reads.read_at else clock_timestamp() end",id,parent,input.revision());return familyDetail(parent,child,id);
    }
    private Map<String,Object> lockClass(UUID teacher,UUID id){return db.one("select id,status from classes where id=? and teacher_id=? for update",id,teacher);}
    private void lock(UUID teacher,UUID id){var row=db.one("select class_id from class_announcements where id=? and teacher_id=?",id,teacher);lockClass(teacher,id(row,"classId"));db.one("select id from class_announcements where id=? for update",id);}
    private void audit(UUID teacher,String action,UUID id,Map<String,Object> before,Map<String,Object> after,String reason,String trace){db.audit(teacher,"ANNOUNCEMENT_"+action,"ANNOUNCEMENT",id,Map.of("before",before,"after",after),reason,trace);}
    private static String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
}

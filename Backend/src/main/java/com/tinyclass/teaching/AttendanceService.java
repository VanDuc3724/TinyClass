package com.tinyclass.teaching;

import com.tinyclass.common.api.*;
import com.tinyclass.common.persistence.DomainStore;
import com.tinyclass.family.GuardianService;
import com.tinyclass.teaching.AttendanceDtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.sql.Timestamp;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import static com.tinyclass.common.persistence.DomainStore.*;

@Service @Transactional(readOnly=true)
public class AttendanceService {
    private static final Set<String> PRESENT=Set.of("PRESENT","LATE");
    private static final String SS="select s.id,s.class_id,c.name as class_name,c.status as class_status,c.capacity,s.title,s.starts_at,s.ends_at,s.location,s.status,s.version,s.roster_created_at,s.completed_at,s.cancellation_reason from class_sessions s join classes c on c.id=s.class_id ";
    private static final String ROW="select a.id,a.session_id,a.student_id,a.enrollment_id,a.student_name_snapshot as student_name,a.is_active,a.status,a.note,a.family_note,a.marked_at,a.version,s.class_id,c.name as class_name,c.status as class_status,s.title as session_title,s.starts_at,s.ends_at,s.status as session_status,s.cancellation_reason,st.status as student_status,e.status as enrollment_status from attendance_records a join class_sessions s on s.id=a.session_id join classes c on c.id=s.class_id join students st on st.id=a.student_id join class_enrollments e on e.id=a.enrollment_id ";
    private final DomainStore db;
    private final GuardianService guardians;
    private final TeachingLocks locks;
    public AttendanceService(DomainStore db,GuardianService guardians,TeachingLocks locks) {this.db=db;this.guardians=guardians;this.locks=locks;}

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> workspace(UUID teacher,UUID session) {
        var s=session(teacher,session);var rows=db.rows(ROW+"where a.session_id=? order by a.student_name_snapshot,a.id",session);
        var active=rows.stream().filter(r->Boolean.TRUE.equals(r.get("isActive"))).toList();
        boolean cancelled="CANCELLED".equals(s.get("status")), editable=editable(s);
        var counts=new LinkedHashMap<String,Object>();counts.put("total",active.size());counts.put("effectiveTotal",cancelled?0:active.size());
        for(String state:List.of("UNMARKED","PRESENT","LATE","ABSENT_EXCUSED","ABSENT_UNEXCUSED")) counts.put(state,cancelled?0:active.stream().filter(r->state.equals(r.get("status"))).count());
        var result=new LinkedHashMap<String,Object>();result.put("session",s);result.put("rows",rows);result.put("counts",counts);result.put("hasRoster",s.get("rosterCreatedAt")!=null);
        result.put("canEdit",editable);result.put("canMarkPresent",editable && !instant(s,"startsAt").isAfter(Instant.now()));
        result.put("canComplete",editable && "SCHEDULED".equals(s.get("status")) && s.get("rosterCreatedAt")!=null && !instant(s,"endsAt").isAfter(Instant.now()) && active.stream().noneMatch(r->"UNMARKED".equals(r.get("status"))));
        result.put("eligibleMembers",editable?memberChoices(s).stream().filter(m->active.stream().noneMatch(r->id(r,"studentId").equals(id(m,"studentId")))).toList():List.of());
        result.put("billingReferences",db.rows("select distinct i.id,i.invoice_code,i.status from session_charge_entries ce join invoices i on i.id=ce.invoice_id join attendance_records r on r.id=ce.root_attendance_id where r.session_id=? and ce.status in ('RESERVED','CHARGED') order by i.invoice_code",session));
        return result;
    }

    @Transactional
    public Map<String,Object> createRoster(UUID teacher,UUID session,RosterInput input,String trace) {
        lockSession(teacher,session);var s=session(teacher,session);
        if(s.get("rosterCreatedAt")!=null) return workspace(teacher,session);
        version(s,input.sessionVersion());requireEditable(s);var members=members(s);
        if(members.size()>500) throw problem("ROSTER_TOO_LARGE","Tối đa 500 bé trong một danh sách điểm danh.");
        for(var member:members) insertMember(teacher,s,member,trace,"CREATED",null);
        db.update("update class_sessions set roster_created_at=clock_timestamp(),updated_at=clock_timestamp(),version=version+1 where id=?",session);
        db.audit(teacher,"SESSION_ROSTER_CREATED","SESSION",session,Map.of("count",members.size()),null,trace);
        return workspace(teacher,session);
    }

    @Transactional
    public Map<String,Object> save(UUID teacher,UUID session,BatchInput input,String trace) {
        lockSession(teacher,session);var s=session(teacher,session);requireEditable(s);version(s,input.sessionVersion());requireRoster(s);
        var seen=new HashSet<UUID>();var changed=new ArrayList<Map.Entry<Map<String,Object>,RowInput>>();
        for(var item:input.rows()) {
            if(!seen.add(item.id())) throw problem("DUPLICATE_ATTENDANCE","Một dòng điểm danh xuất hiện nhiều lần.");
            var before=ownedRow(teacher,item.id());
            if(!session.equals(id(before,"sessionId")) || !Boolean.TRUE.equals(before.get("isActive"))) throw missing();
            version(before,item.version());if(!hasChanges(before,item))continue;
            if(PRESENT.contains(item.status()) && instant(s,"startsAt").isAfter(Instant.now())) throw conflict("SESSION_NOT_STARTED","Chỉ ghi có mặt/đi muộn sau giờ bắt đầu buổi học.");
            if(!"UNMARKED".equals(before.get("status")) && clean(input.reason())==null) throw problem("CORRECTION_REASON_REQUIRED","Nhập lý do khi chỉnh điểm danh đã ghi.");
            changed.add(Map.entry(before,item));
        }
        for(var entry:changed) {
            var before=entry.getKey();var item=entry.getValue();boolean marked=!"UNMARKED".equals(item.status());
            db.update("update attendance_records set status=?,note=?,family_note=?,marked_by=?,marked_at=?,updated_at=clock_timestamp(),version=version+1 where id=?",item.status(),clean(item.note()),clean(item.familyNote()),marked?teacher:null,marked?stamp(Instant.now()):null,item.id());
            rowEvent(teacher,before,ownedRow(teacher,item.id()),"UPDATED",clean(input.reason()),trace);
        }
        if(!changed.isEmpty())bumpSession(teacher,session,clean(input.reason()),trace);
        return workspace(teacher,session);
    }

    @Transactional
    public Map<String,Object> adjustMember(UUID teacher,UUID session,MemberInput input,String trace) {
        lockSession(teacher,session);var s=session(teacher,session);requireEditable(s);requireRoster(s);version(s,input.sessionVersion());
        var found=db.rows(ROW+"where a.session_id=? and a.student_id=?",session,input.studentId());Map<String,Object> before=found.isEmpty()?null:found.getFirst();
        if("REMOVE".equals(input.action())) {
            if(before==null || !Boolean.TRUE.equals(before.get("isActive")))throw missing();
            db.update("update attendance_records set is_active=false,updated_at=clock_timestamp(),version=version+1 where id=?",id(before,"id"));
            rowEvent(teacher,before,ownedRow(teacher,id(before,"id")),"REMOVED",clean(input.reason()),trace);
        } else {
            if(before!=null && Boolean.TRUE.equals(before.get("isActive")))throw conflict("ALREADY_ON_ROSTER","Bé đã có trong danh sách của buổi.");
            var member=db.one("select e.id,e.student_id,st.full_name from class_enrollments e join students st on st.id=e.student_id where e.class_id=? and e.student_id=? and st.teacher_id=? and e.joined_at<? and ((e.status='ACTIVE' and st.status='ACTIVE') or (?<=clock_timestamp() and (e.ended_at is null or e.ended_at>=?)))",id(s,"classId"),input.studentId(),teacher,stamp(instant(s,"endsAt")),stamp(instant(s,"startsAt")),stamp(instant(s,"startsAt")));
            if(db.count("select count(*) from attendance_records where session_id=? and is_active",session)>=500)throw conflict("ROSTER_TOO_LARGE","Tối đa 500 bé trong một danh sách điểm danh.");
            if(s.get("capacity")!=null && db.count("select count(*) from attendance_records where session_id=? and is_active",session)>=number(s,"capacity"))throw conflict("SESSION_CAPACITY","Danh sách đã đủ số bé theo sĩ số lớp.");
            if(before==null)insertMember(teacher,s,member,trace,"ADDED",clean(input.reason()));
            else {
                db.update("update attendance_records set is_active=true,updated_at=clock_timestamp(),version=version+1 where id=?",id(before,"id"));
                rowEvent(teacher,before,ownedRow(teacher,id(before,"id")),"ADDED",clean(input.reason()),trace);
            }
        }
        bumpSession(teacher,session,clean(input.reason()),trace);return workspace(teacher,session);
    }

    @Transactional
    public Map<String,Object> complete(UUID teacher,UUID session,CompleteInput input,String trace) {
        lockSession(teacher,session);var s=session(teacher,session);
        if("COMPLETED".equals(s.get("status")))return workspace(teacher,session);
        requireEditable(s);requireRoster(s);version(s,input.version());
        if(instant(s,"endsAt").isAfter(Instant.now()))throw conflict("SESSION_NOT_ENDED","Chỉ kết thúc buổi sau giờ kết thúc trong lịch.");
        if(db.count("select count(*) from attendance_records where session_id=? and is_active and status='UNMARKED'",session)>0)throw conflict("ATTENDANCE_UNMARKED","Còn bé chưa được đánh dấu; chưa kết thúc buổi.");
        if(db.count("select count(*) from attendance_records where session_id=? and is_active",session)==0 && clean(input.reason())==null)throw problem("EMPTY_SESSION_REASON","Nhập lý do kết thúc buổi không có bé trong danh sách.");
        db.update("update class_sessions set status='COMPLETED',completed_at=clock_timestamp(),completed_by=?,updated_at=clock_timestamp(),version=version+1 where id=?",teacher,session);
        db.audit(teacher,"SESSION_COMPLETED","SESSION",session,Map.of("before",s,"after",session(teacher,session)),clean(input.reason()),trace);return workspace(teacher,session);
    }

    public PageResponse<Map<String,Object>> entries(UUID teacher,LocalDate from,LocalDate to,UUID classId,UUID studentId,String status,int page,int size) {
        range(from,to);pagination(page,size);
        if(classId!=null)db.one("select id from classes where id=? and teacher_id=?",classId,teacher);
        if(studentId!=null)db.one("select id from students where id=? and teacher_id=?",studentId,teacher);
        var args=new ArrayList<Object>(List.of(teacher,stamp(from.atStartOfDay(ScheduleService.ZONE).toInstant()),stamp(to.plusDays(1).atStartOfDay(ScheduleService.ZONE).toInstant())));
        String where="where c.teacher_id=? and s.starts_at>=? and s.starts_at<?";
        if(classId!=null){where+=" and s.class_id=?";args.add(classId);}if(studentId!=null){where+=" and a.student_id=?";args.add(studentId);}
        if(clean(status)!=null){validateStatus(status);where+=" and a.status=?";args.add(status);}
        long total=db.count("select count(*) from ("+ROW+where+") matched",args.toArray());args.add(size);args.add((long)page*size);
        return db.page(db.rows(ROW+where+" order by s.starts_at desc,a.id desc limit ? offset ?",args.toArray()),total,page,size);
    }

    public PageResponse<Map<String,Object>> familyEntries(UUID parent,UUID child,LocalDate from,LocalDate to,int page,int size) {
        guardians.child(parent,child);range(from,to);pagination(page,size);
        var args=new ArrayList<Object>(List.of(child,stamp(from.atStartOfDay(ScheduleService.ZONE).toInstant()),stamp(to.plusDays(1).atStartOfDay(ScheduleService.ZONE).toInstant())));
        String where="where a.student_id=? and s.starts_at>=? and s.starts_at<? and (s.starts_at<=clock_timestamp() or a.marked_at is not null or s.status='CANCELLED')";
        long total=db.count("select count(*) from ("+ROW+where+") matched",args.toArray());args.add(size);args.add((long)page*size);
        return db.page(db.rows(ROW+where+" order by s.starts_at desc,a.id desc limit ? offset ?",args.toArray()).stream().map(this::publicRow).toList(),total,page,size);
    }

    public PageResponse<Map<String,Object>> rowHistory(UUID actor,UUID child,UUID attendance,int page,int size) {
        if(child!=null){guardians.child(actor,child);if(db.count("select count(*) from attendance_records where id=? and student_id=?",attendance,child)==0)throw missing();}else ownedRow(actor,attendance);
        pagination(page,size);String columns="e.id,e.event_type,e.status_before,e.status_after,e.family_note,e.created_at,u.display_name as actor_name"+(child==null?",e.reason":"");
        long total=db.count("select count(*) from attendance_events where attendance_id=?",attendance);
        return db.page(db.rows("select "+columns+" from attendance_events e join users u on u.id=e.actor_id where e.attendance_id=? order by e.created_at desc,e.id desc limit ? offset ?",attendance,size,(long)page*size),total,page,size);
    }

    private List<Map<String,Object>> members(Map<String,Object> s) {
        return db.rows("select e.id,e.student_id,st.full_name from class_enrollments e join students st on st.id=e.student_id where e.class_id=? and e.joined_at<? and ((e.status='ACTIVE' and st.status='ACTIVE') or (?='COMPLETED' and e.status='COMPLETED' and e.ended_at>=?)) order by st.full_name,e.id",id(s,"classId"),stamp(instant(s,"endsAt")),text(s,"classStatus"),stamp(instant(s,"startsAt")));
    }
    private List<Map<String,Object>> memberChoices(Map<String,Object> s) {
        return db.rows("select e.id,e.student_id,st.full_name,e.status as enrollment_status,st.status as student_status from class_enrollments e join students st on st.id=e.student_id where e.class_id=? and e.joined_at<? and ((e.status='ACTIVE' and st.status='ACTIVE') or (?<=clock_timestamp() and (e.ended_at is null or e.ended_at>=?))) order by st.full_name,e.id limit 501",id(s,"classId"),stamp(instant(s,"endsAt")),stamp(instant(s,"startsAt")),stamp(instant(s,"startsAt")));
    }
    private void insertMember(UUID teacher,Map<String,Object> s,Map<String,Object> member,String trace,String event,String reason) {
        UUID id=UUID.randomUUID();db.update("insert into attendance_records(id,session_id,student_id,enrollment_id,student_name_snapshot) values(?,?,?,?,?)",id,id(s,"id"),id(member,"studentId"),id(member,"id"),text(member,"fullName"));
        rowEvent(teacher,null,ownedRow(teacher,id),event,reason,trace);
    }
    private void bumpSession(UUID teacher,UUID session,String reason,String trace) {
        var before=session(teacher,session);boolean reopen="COMPLETED".equals(before.get("status")) && db.count("select count(*) from attendance_records where session_id=? and is_active and status='UNMARKED'",session)>0;
        if(reopen){db.update("update class_sessions set status='SCHEDULED',completed_at=null,completed_by=null,updated_at=clock_timestamp(),version=version+1 where id=?",session);db.audit(teacher,"SESSION_ATTENDANCE_REOPENED","SESSION",session,Map.of("before",before,"after",session(teacher,session)),reason,trace);}
        else db.update("update class_sessions set updated_at=clock_timestamp(),version=version+1 where id=?",session);
    }
    private void rowEvent(UUID teacher,Map<String,Object> before,Map<String,Object> after,String event,String reason,String trace) {
        db.update("insert into attendance_events(id,attendance_id,actor_id,event_type,status_before,status_after,family_note,reason) values(?,?,?,?,?,?,?,?)",UUID.randomUUID(),id(after,"id"),teacher,event,before==null?null:before.get("status"),after.get("status"),after.get("familyNote"),reason);
        db.audit(teacher,"ATTENDANCE_"+event,"ATTENDANCE",id(after,"id"),Map.of("before",before==null?Map.of():before,"after",after),reason,trace);
    }
    private Map<String,Object> publicRow(Map<String,Object> row) {
        var result=new LinkedHashMap<String,Object>();for(String key:List.of("id","studentName","sessionId","classId","className","sessionTitle","startsAt","endsAt","sessionStatus","cancellationReason","isActive","status","familyNote","markedAt"))result.put(key,row.get(key));
        result.put("effective",Boolean.TRUE.equals(row.get("isActive")) && !"CANCELLED".equals(row.get("sessionStatus")));return result;
    }
    private Map<String,Object> ownedRow(UUID teacher,UUID id){return db.one(ROW+"where a.id=? and c.teacher_id=?",id,teacher);}
    private Map<String,Object> session(UUID teacher,UUID id){return db.one(SS+"where s.id=? and c.teacher_id=?",id,teacher);}
    private void lockSession(UUID teacher,UUID id){locks.teacher(teacher);var s=session(teacher,id);db.one("select id from classes where id=? and teacher_id=? for update",id(s,"classId"),teacher);db.one("select id from class_sessions where id=? for update",id);}
    private boolean editable(Map<String,Object> s){return !Set.of("DRAFT","ARCHIVED").contains(s.get("classStatus")) && !"CANCELLED".equals(s.get("status")) && !("COMPLETED".equals(s.get("classStatus")) && instant(s,"startsAt").isAfter(Instant.now()));}
    private void requireEditable(Map<String,Object> s){if(!editable(s))throw conflict("ATTENDANCE_READ_ONLY","Buổi bị hủy/lớp lưu trữ hoặc lớp đã kết thúc; chỉ xem lại điểm danh.");}
    private void requireRoster(Map<String,Object> s){if(s.get("rosterCreatedAt")==null)throw conflict("ROSTER_REQUIRED","Chốt danh sách của buổi trước khi điểm danh.");}
    private boolean hasChanges(Map<String,Object> r,RowInput i){return !Objects.equals(r.get("status"),i.status()) || !Objects.equals(r.get("note"),clean(i.note())) || !Objects.equals(r.get("familyNote"),clean(i.familyNote()));}
    private void range(LocalDate from,LocalDate to){if(from==null || to==null || to.isBefore(from) || ChronoUnit.DAYS.between(from,to)>92 || from.getYear()<1900 || to.getYear()>2200)throw problem("INVALID_DATE_RANGE","Chọn khoảng ngày hợp lệ, tối đa 93 ngày.");}
    private void validateStatus(String status){if(!Set.of("UNMARKED","PRESENT","LATE","ABSENT_EXCUSED","ABSENT_UNEXCUSED").contains(status))throw problem("INVALID_STATUS","Trạng thái điểm danh chưa hợp lệ.");}
    private static Instant instant(Map<String,Object> r,String key){return (Instant)r.get(key);}
    private static Timestamp stamp(Instant value){return Timestamp.from(value);}
}

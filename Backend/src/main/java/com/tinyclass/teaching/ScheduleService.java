package com.tinyclass.teaching;

import com.tinyclass.common.api.*;
import com.tinyclass.common.persistence.DomainStore;
import com.tinyclass.family.GuardianService;
import com.tinyclass.teaching.ScheduleDtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import static com.tinyclass.common.persistence.DomainStore.*;

@Service
@Transactional(readOnly=true)
public class ScheduleService {
    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final String RULE = "select r.id,r.class_id,r.weekday,to_char(r.start_time,'HH24:MI') as start_time,to_char(r.end_time,'HH24:MI') as end_time,r.timezone,r.effective_from,r.effective_to,r.location,r.is_active,r.version from class_schedule_rules r ";
    private static final String SESSION = "select s.id,s.class_id,c.name as class_name,c.status as class_status,s.schedule_rule_id,s.occurrence_week,s.starts_at,s.ends_at,s.title,s.location,s.lesson_plan,s.status,s.is_manual_override,s.roster_created_at,s.cancellation_reason,s.cancelled_at,s.version from class_sessions s join classes c on c.id=s.class_id ";
    private static final String FAMILY = "select s.id,s.class_id,c.name as class_name,s.starts_at,s.ends_at,s.title,s.location,s.status,s.cancellation_reason from class_sessions s join classes c on c.id=s.class_id join students st on st.id=? and st.teacher_id=c.teacher_id ";
    private static final String FAMILY_RIGHTS = " and st.status='ACTIVE' and exists(select 1 from class_enrollments e where e.class_id=c.id and e.student_id=st.id and s.ends_at>e.joined_at and ((e.status='ACTIVE' and c.status='ACTIVE') or (e.status='COMPLETED' and c.status='COMPLETED' and s.starts_at<=e.ended_at)))";
    private final DomainStore db;
    private final GuardianService guardians;
    private final TeachingLocks locks;
    public ScheduleService(DomainStore db, GuardianService guardians,TeachingLocks locks) { this.db=db; this.guardians=guardians;this.locks=locks; }

    public List<Map<String,Object>> rules(UUID teacher, UUID classId) {
        ownedClass(teacher,classId,false);
        return db.rows(RULE+"where r.class_id=? order by r.weekday,r.start_time,r.id",classId);
    }

    @Transactional
    public Map<String,Object> createRule(UUID teacher, UUID classId, RuleInput input, String trace) {
        serialize(teacher);
        var classroom=ownedClass(teacher,classId,true);
        requirePlanning(classroom);
        validateRule(input);
        if(db.count("select count(*) from class_schedule_rules where class_id=?",classId)>=50)
            throw conflict("RULE_LIMIT","Mỗi lớp tối đa 50 quy tắc lịch tuần.");
        UUID id=UUID.randomUUID();
        db.update("insert into class_schedule_rules(id,class_id,weekday,start_time,end_time,timezone,effective_from,effective_to,location,is_active) values(?,?,?,?::time,?::time,?,?,?,?,?)",
                id,classId,input.weekday(),input.startTime().toString(),input.endTime().toString(),ZONE.getId(),input.effectiveFrom(),input.effectiveTo(),clean(input.location()),input.isActive());
        var rule=rule(teacher,id);
        db.audit(teacher,"SCHEDULE_RULE_CREATED","SCHEDULE_RULE",id,rule,null,trace);
        return rule;
    }

    @Transactional
    public Map<String,Object> changeRule(UUID teacher, UUID id, RuleInput input, String trace) {
        serialize(teacher);
        var before=rule(teacher,id);
        var classroom=ownedClass(teacher,id(before,"classId"),true);
        requirePlanning(classroom);
        version(before,input.version()); validateRule(input);
        var changes=new ArrayList<Change>();
        int skipped=0;
        var existing=db.rows(SESSION+"where s.schedule_rule_id=? and s.starts_at>=? order by s.id for update of s",id,stamp(input.effectiveFrom().atStartOfDay(ZONE).toInstant()));
        Instant now=Instant.now();
        for(var row:existing) {
            if(!"SCHEDULED".equals(row.get("status")) || Boolean.TRUE.equals(row.get("isManualOverride")) || row.get("rosterCreatedAt")!=null || !instant(row,"startsAt").isAfter(now)) { skipped++; continue; }
            LocalDate day=((LocalDate)row.get("occurrenceWeek")).plusDays(input.weekday()-1);
            Instant start=day.atTime(input.startTime()).atZone(ZONE).toInstant(), end=day.atTime(input.endTime()).atZone(ZONE).toInstant();
            boolean valid=input.isActive() && !day.isBefore(input.effectiveFrom()) && (input.effectiveTo()==null || !day.isAfter(input.effectiveTo())) && insideClass(classroom,day) && start.isAfter(now);
            String location=clean(input.location());
            if(valid && start.equals(row.get("startsAt")) && end.equals(row.get("endsAt")) && Objects.equals(location,row.get("location"))) { skipped++; continue; }
            changes.add(new Change(valid?"UPDATE":"CANCEL",id(row,"id"),id(row,"classId"),text(row,"className"),id,(LocalDate)row.get("occurrenceWeek"),valid?start:instant(row,"startsAt"),valid?end:instant(row,"endsAt"),text(row,"title"),location,(String)row.get("lessonPlan"),number(row,"version"),false));
        }
        var result=plan(teacher,changes,skipped,input.preview(),input.allowConflicts(),input.conflictKey());
        if(!input.preview()) {
            db.update("update class_schedule_rules set weekday=?,start_time=?::time,end_time=?::time,effective_from=?,effective_to=?,location=?,is_active=?,updated_at=now(),version=version+1 where id=?",
                    input.weekday(),input.startTime().toString(),input.endTime().toString(),input.effectiveFrom(),input.effectiveTo(),clean(input.location()),input.isActive(),id);
            apply(teacher,changes,"Cập nhật lịch tuần từ "+input.effectiveFrom(),trace);
            recordOverride(teacher,id,result,trace);
            db.audit(teacher,"SCHEDULE_RULE_UPDATED","SCHEDULE_RULE",id,Map.of("before",before,"after",rule(teacher,id),"effects",counts(changes)),null,trace);
        }
        result.put("rule",input.preview()?before:rule(teacher,id));
        return result;
    }

    @Transactional
    public Map<String,Object> generate(UUID teacher, UUID classId, GenerateInput input, String trace) {
        serialize(teacher);
        var classroom=ownedClass(teacher,classId,true); requireActive(classroom);
        range(input.from(),input.to(),true);
        var changes=new ArrayList<Change>();
        int skipped=0;
        Instant now=Instant.now();
        for(var rule:rules(teacher,classId)) {
            if(!Boolean.TRUE.equals(rule.get("isActive"))) continue;
            LocalDate first=(LocalDate)rule.get("effectiveFrom"), last=(LocalDate)rule.get("effectiveTo");
            var occupied=new HashSet<>(db.rows("select occurrence_week from class_sessions where schedule_rule_id=?",id(rule,"id")).stream().map(r->(LocalDate)r.get("occurrenceWeek")).toList());
            for(LocalDate day=input.from();!day.isAfter(input.to());day=day.plusDays(1)) {
                if(day.getDayOfWeek().getValue()!=number(rule,"weekday") || day.isBefore(first) || (last!=null && day.isAfter(last))) continue;
                LocalDate week=day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                Instant start=day.atTime(LocalTime.parse(text(rule,"startTime"))).atZone(ZONE).toInstant(), end=day.atTime(LocalTime.parse(text(rule,"endTime"))).atZone(ZONE).toInstant();
                if(occupied.contains(week) || !start.isAfter(now) || !insideClass(classroom,day)) {skipped++; continue;}
                changes.add(new Change("CREATE",UUID.randomUUID(),classId,text(classroom,"name"),id(rule,"id"),week,start,end,text(classroom,"name"),clean((String)rule.get("location")),null,0,false));
            }
        }
        var result=plan(teacher,changes,skipped,input.preview(),input.allowConflicts(),input.conflictKey());
        if(!input.preview()) {
            apply(teacher,changes,null,trace);
            recordOverride(teacher,classId,result,trace);
            db.audit(teacher,"SESSIONS_GENERATED","CLASS",classId,Map.of("from",input.from(),"to",input.to(),"effects",counts(changes),"conflictCount",result.get("conflictCount")),null,trace);
        }
        return result;
    }

    @Transactional
    public Map<String,Object> createSession(UUID teacher, SessionInput input, String trace) {
        serialize(teacher);
        var classroom=ownedClass(teacher,input.classId(),true); requireActive(classroom);
        if(input.clientRequestId()==null) throw problem("REQUEST_ID_REQUIRED","Thiếu mã yêu cầu tạo buổi học.");
        String hash=hash(db.json(Arrays.asList(input.classId(),input.startsAt(),input.endsAt(),clean(input.title()),clean(input.location()),clean(input.lessonPlan()))));
        var retried=db.rows("select id,request_hash from class_sessions where class_id=? and client_request_id=?",input.classId(),input.clientRequestId());
        if(!retried.isEmpty()) {
            var found=retried.getFirst();
            if(!hash.equals(found.get("requestHash"))) throw conflict("REQUEST_REUSED","Mã yêu cầu đã được dùng với nội dung khác.");
            var result=plan(teacher,List.of(),1,input.preview(),false,null); result.put("session",detail(teacher,id(found,"id"))); return result;
        }
        validateSession(classroom,input);
        UUID id=UUID.randomUUID();
        var change=manual(id,classroom,input,0,"CREATE");
        var result=plan(teacher,List.of(change),0,input.preview(),input.allowConflicts(),input.conflictKey());
        if(!input.preview()) {
            apply(teacher,List.of(change),null,trace);
            recordOverride(teacher,id,result,trace);
            db.update("update class_sessions set client_request_id=?,request_hash=? where id=?",input.clientRequestId(),hash,id);
            result.put("session",detail(teacher,id));
        }
        return result;
    }

    @Transactional
    public Map<String,Object> changeSession(UUID teacher, UUID id, SessionInput input, String trace) {
        serialize(teacher);
        var before=detail(teacher,id);
        if(!input.classId().equals(id(before,"classId"))) throw problem("IMMUTABLE_CLASS","Không chuyển buổi sang lớp khác; hãy tạo buổi riêng ở lớp đích.");
        var classroom=ownedClass(teacher,input.classId(),true); requireActive(classroom);
        version(before,input.version());
        if(!Boolean.TRUE.equals(before.get("canEdit"))) throw conflict("SESSION_LOCKED","Buổi đã bắt đầu, bị hủy hoặc đã có danh sách điểm danh; giữ lịch sử hiện có.");
        if(clean(input.reason())==null) throw problem("REASON_REQUIRED","Nhập lý do đổi buổi; lý do được lưu trong lịch sử quản lý.");
        validateSession(classroom,input);
        var change=manual(id,classroom,input,number(before,"version"),"UPDATE");
        var result=plan(teacher,List.of(change),0,input.preview(),input.allowConflicts(),input.conflictKey());
        if(!input.preview()) { apply(teacher,List.of(change),clean(input.reason()),trace); recordOverride(teacher,id,result,trace); result.put("session",detail(teacher,id)); }
        return result;
    }

    @Transactional
    public Map<String,Object> cancel(UUID teacher, UUID id, CancelInput input, String trace) {
        serialize(teacher);
        var before=detail(teacher,id); var classroom=ownedClass(teacher,id(before,"classId"),true);
        if("ARCHIVED".equals(classroom.get("status"))) throw conflict("CLASS_READ_ONLY","Khôi phục lớp trước khi hủy buổi.");
        if("CANCELLED".equals(before.get("status"))) return before;
        version(before,input.version());
        db.update("update class_sessions set status='CANCELLED',cancellation_reason=?,cancelled_at=now(),is_manual_override=true,updated_at=now(),version=version+1 where id=?",clean(input.reason()),id);
        db.audit(teacher,"SESSION_CANCELLED","SESSION",id,Map.of("before",before),clean(input.reason()),trace);
        return detail(teacher,id);
    }

    public Map<String,Object> detail(UUID teacher, UUID id) {
        var result=db.one(SESSION+"where s.id=? and c.teacher_id=?",id,teacher);
        result.put("canEdit","SCHEDULED".equals(result.get("status")) && instant(result,"startsAt").isAfter(Instant.now()) && result.get("rosterCreatedAt")==null && "ACTIVE".equals(result.get("classStatus")));
        result.put("canCancel",!"CANCELLED".equals(result.get("status")) && !"ARCHIVED".equals(result.get("classStatus")));
        return result;
    }

    public PageResponse<Map<String,Object>> history(UUID teacher, UUID id, int page, int size) {
        detail(teacher,id); pagination(page,size);
        long total=db.count("select count(*) from audit_events where entity_type='SESSION' and entity_id=?",id);
        return db.page(db.rows("select id,action,reason,changed_fields,created_at from audit_events where entity_type='SESSION' and entity_id=? order by created_at desc,id desc limit ? offset ?",id,size,(long)page*size),total,page,size);
    }

    public PageResponse<Map<String,Object>> list(UUID teacher, LocalDate from, LocalDate to, UUID classId, String status, int page, int size) {
        range(from,to,false); pagination(page,size); validateStatus(status);
        if(classId!=null) ownedClass(teacher,classId,false);
        var args=new ArrayList<Object>(List.of(teacher,stamp(from.atStartOfDay(ZONE).toInstant()),stamp(to.plusDays(1).atStartOfDay(ZONE).toInstant())));
        String where="where c.teacher_id=? and s.starts_at>=? and s.starts_at<?";
        if(classId!=null) {where+=" and s.class_id=?";args.add(classId);}
        if(clean(status)!=null) {where+=" and s.status=?";args.add(status);}
        long total=db.count("select count(*) from class_sessions s join classes c on c.id=s.class_id "+where,args.toArray());
        args.add(size);args.add((long)page*size);
        return db.page(db.rows(SESSION+where+" order by s.starts_at,s.id limit ? offset ?",args.toArray()),total,page,size);
    }

    public PageResponse<Map<String,Object>> familyList(UUID parent, UUID child, LocalDate from, LocalDate to, UUID classId, int page, int size) {
        guardians.child(parent,child); range(from,to,false); pagination(page,size);
        if(classId!=null && db.count("select count(*) from class_enrollments e join classes c on c.id=e.class_id where e.student_id=? and e.class_id=? and ((e.status='ACTIVE' and c.status='ACTIVE') or (e.status='COMPLETED' and c.status='COMPLETED'))",child,classId)==0) throw missing();
        var args=new ArrayList<Object>(List.of(child,stamp(from.atStartOfDay(ZONE).toInstant()),stamp(to.plusDays(1).atStartOfDay(ZONE).toInstant())));
        String where="where s.starts_at>=? and s.starts_at<?"+FAMILY_RIGHTS;
        if(classId!=null) {where+=" and s.class_id=?";args.add(classId);}
        String sql=FAMILY+where;
        long total=db.count("select count(*) from ("+sql+") visible",args.toArray());
        args.add(size);args.add((long)page*size);
        return db.page(db.rows(sql+" order by s.starts_at,s.id limit ? offset ?",args.toArray()),total,page,size);
    }


    public Map<String,Object> familyOverview(UUID parent,UUID child,LocalDate today,Instant now){
        guardians.child(parent,child);
        String visible="where s.status in('SCHEDULED','COMPLETED')"+FAMILY_RIGHTS;
        long count=db.count("select count(*) from ("+FAMILY+visible+" and s.starts_at>=? and s.starts_at<?) visible",child,stamp(today.atStartOfDay(ZONE).toInstant()),stamp(today.plusDays(1).atStartOfDay(ZONE).toInstant()));
        var upcoming=db.rows(FAMILY+visible+" and s.status='SCHEDULED' and s.starts_at>=? and s.starts_at<? order by s.starts_at,s.id limit 3",child,stamp(now),stamp(today.plusDays(8).atStartOfDay(ZONE).toInstant()));
        return Map.of("todaySessionCount",count,"upcoming",upcoming);
    }

    private record Change(String action, UUID id, UUID classId, String className, UUID ruleId, LocalDate week,
            Instant start, Instant end, String title, String location, String lessonPlan, long version, boolean manual) {
        Map<String,Object> view() {
            var view=new LinkedHashMap<String,Object>();view.put("action",action);view.put("className",className);view.put("title",title);view.put("startsAt",start);view.put("endsAt",end);return view;
        }
    }
    private Change manual(UUID id, Map<String,Object> classroom, SessionInput input, long version,String action) {
        return new Change(action,id,input.classId(),text(classroom,"name"),null,null,input.startsAt(),input.endsAt(),Objects.requireNonNullElse(clean(input.title()),text(classroom,"name")),clean(input.location()),clean(input.lessonPlan()),version,true);
    }
    private Map<String,Object> plan(UUID teacher, List<Change> changes, int skipped, boolean preview, boolean allow, String expectedKey) {
        if(changes.size()>1000) throw problem("BATCH_TOO_LARGE","Tối đa 1.000 buổi mỗi thao tác; chọn khoảng ngắn hơn.");
        var scheduled=changes.stream().filter(c->!"CANCEL".equals(c.action())).toList();
        var excluded=new HashSet<>(changes.stream().filter(c->!"CREATE".equals(c.action())).map(Change::id).toList());
        var collisions=new ArrayList<Map<String,Object>>();var signatures=new ArrayList<String>();
        if(!scheduled.isEmpty()) {
            Instant from=scheduled.stream().map(Change::start).min(Comparator.naturalOrder()).orElseThrow(), to=scheduled.stream().map(Change::end).max(Comparator.naturalOrder()).orElseThrow();
            var others=db.rows(SESSION+"where c.teacher_id=? and s.status='SCHEDULED' and s.starts_at<? and s.ends_at>? order by s.id",teacher,stamp(to),stamp(from));
            for(var candidate:scheduled) for(var other:others) {
                if(!excluded.contains(id(other,"id")) && overlaps(candidate.start(),candidate.end(),instant(other,"startsAt"),instant(other,"endsAt")))
                    collision(collisions,signatures,candidate,text(other,"title"),text(other,"className"),instant(other,"startsAt"),instant(other,"endsAt"),text(other,"id")+":"+number(other,"version"));
            }
            for(int i=0;i<scheduled.size();i++) for(int j=i+1;j<scheduled.size();j++) {
                var a=scheduled.get(i);var b=scheduled.get(j);
                if(overlaps(a.start(),a.end(),b.start(),b.end())) collision(collisions,signatures,a,b.title(),b.className(),b.start(),b.end(),b.classId()+":"+b.ruleId()+":"+b.week());
            }
        }
        Collections.sort(signatures);
        String key=hash(teacher+"|"+String.join("|",signatures));
        if(!preview && !signatures.isEmpty() && (!allow || !key.equals(expectedKey)))
            throw conflict("SCHEDULE_CONFLICT", "Có "+signatures.size()+" cặp buổi trùng giờ. Xem trước lại và xác nhận ngoại lệ trước khi lưu.");
        var result=new LinkedHashMap<String,Object>(); result.put("preview",preview);result.putAll(counts(changes));result.put("skipped",skipped);
        result.put("candidates",changes.stream().limit(100).map(Change::view).toList());result.put("conflicts",collisions);result.put("conflictCount",signatures.size());result.put("conflictKey",key);
        return result;
    }
    private void collision(List<Map<String,Object>> collisions,List<String> signatures,Change candidate,String title,String className,Instant start,Instant end,String identity) {
        signatures.add(candidate.classId()+":"+candidate.ruleId()+":"+candidate.week()+":"+candidate.start()+":"+candidate.end()+":"+identity+":"+start+":"+end);
        if(collisions.size()<100) collisions.add(Map.of("candidateTitle",candidate.title(),"candidateStartsAt",candidate.start(),"otherTitle",title,"otherClassName",className,"otherStartsAt",start,"otherEndsAt",end));
    }
    private Map<String,Object> counts(List<Change> changes) {
        return Map.of("created",changes.stream().filter(c->"CREATE".equals(c.action())).count(),"updated",changes.stream().filter(c->"UPDATE".equals(c.action())).count(),"cancelled",changes.stream().filter(c->"CANCEL".equals(c.action())).count());
    }
    private void apply(UUID teacher,List<Change> changes,String reason,String trace) {
        for(var change:changes) {
            Map<String,Object> before="CREATE".equals(change.action())?Map.of():detail(teacher,change.id());
            switch(change.action()) {
                case "CREATE" -> db.update("insert into class_sessions(id,class_id,schedule_rule_id,occurrence_week,starts_at,ends_at,title,location,lesson_plan,is_manual_override) values(?,?,?,?,?,?,?,?,?,?)",
                        change.id(),change.classId(),change.ruleId(),change.week(),stamp(change.start()),stamp(change.end()),change.title(),change.location(),change.lessonPlan(),change.manual());
                case "UPDATE" -> {
                    if(db.update("update class_sessions set starts_at=?,ends_at=?,title=?,location=?,lesson_plan=?,is_manual_override=?,updated_at=now(),version=version+1 where id=? and version=? and status='SCHEDULED' and roster_created_at is null",
                            stamp(change.start()),stamp(change.end()),change.title(),change.location(),change.lessonPlan(),change.manual(),change.id(),change.version())!=1) throw conflict("VERSION_CONFLICT","Buổi đã thay đổi; xem trước lại trước khi lưu.");
                }
                case "CANCEL" -> db.update("update class_sessions set status='CANCELLED',cancellation_reason=?,cancelled_at=now(),updated_at=now(),version=version+1 where id=?",reason,change.id());
                default -> throw new IllegalStateException("Unknown schedule action");
            }
            db.audit(teacher,"SESSION_"+("CREATE".equals(change.action())?"CREATED":"UPDATE".equals(change.action())?"UPDATED":"CANCELLED"),"SESSION",change.id(),Map.of("before",before,"after",detail(teacher,change.id())),reason,trace);
        }
    }
    private void serialize(UUID teacher) { locks.teacher(teacher); }
    private void recordOverride(UUID teacher,UUID id,Map<String,Object> result,String trace) {
        if(number(result,"conflictCount")>0) db.audit(teacher,"SCHEDULE_CONFLICT_CONFIRMED","SCHEDULE",id,Map.of("conflictCount",result.get("conflictCount"),"conflictKey",result.get("conflictKey"),"conflicts",result.get("conflicts")),"Giáo viên xác nhận ngoại lệ trùng giờ sau xem trước.",trace);
    }
    private Map<String,Object> ownedClass(UUID teacher,UUID id,boolean lock) { return db.one("select id,name,status,start_date,end_date,location from classes where id=? and teacher_id=?"+(lock?" for update":""),id,teacher); }
    private Map<String,Object> rule(UUID teacher,UUID id) { return db.one(RULE+"join classes c on c.id=r.class_id where r.id=? and c.teacher_id=?",id,teacher); }
    private void requirePlanning(Map<String,Object> classroom) {if(!Set.of("DRAFT","ACTIVE").contains(classroom.get("status"))) throw conflict("CLASS_READ_ONLY","Lớp đã kết thúc hoặc lưu trữ; chỉ xem lại lịch.");}
    private void requireActive(Map<String,Object> classroom) {if(!"ACTIVE".equals(classroom.get("status"))) throw conflict("CLASS_NOT_ACTIVE","Mở lớp trước khi tạo hoặc đổi buổi học.");}
    private boolean insideClass(Map<String,Object> classroom,LocalDate day) { var start=(LocalDate)classroom.get("startDate");var end=(LocalDate)classroom.get("endDate");return (start==null || !day.isBefore(start)) && (end==null || !day.isAfter(end)); }
    private void validateRule(RuleInput input) {
        if(!ZONE.getId().equals(input.timezone())) throw problem("INVALID_TIMEZONE","Lịch TinyClass dùng múi giờ Asia/Ho_Chi_Minh.");
        LocalDate today=LocalDate.now(ZONE);
        if(input.effectiveFrom().isBefore(today) || input.effectiveFrom().isAfter(today.plusDays(366)) || (input.effectiveTo()!=null && input.effectiveTo().isBefore(input.effectiveFrom()))) throw problem("INVALID_EFFECTIVE_RANGE","Ngày áp dụng phải từ hôm nay, trong 366 ngày tới; ngày kết thúc không trước ngày bắt đầu.");
        if(!input.endTime().isAfter(input.startTime()) || Duration.between(input.startTime(),input.endTime()).toMinutes()>720 || input.startTime().getSecond()!=0 || input.endTime().getSecond()!=0 || input.startTime().getNano()!=0 || input.endTime().getNano()!=0) throw problem("INVALID_TIME_RANGE","Giờ kết thúc phải sau giờ bắt đầu, cùng ngày, tối đa 12 giờ và chính xác đến phút.");
    }
    private void validateSession(Map<String,Object> classroom,SessionInput input) {
        Instant now=Instant.now();
        if(!input.startsAt().isAfter(now) || input.startsAt().isAfter(LocalDate.now(ZONE).plusDays(367).atStartOfDay(ZONE).toInstant()) || !input.endsAt().isAfter(input.startsAt()) || Duration.between(input.startsAt(),input.endsAt()).compareTo(Duration.ofHours(12))>0) throw problem("INVALID_TIME_RANGE","Buổi mới/đổi phải ở tương lai trong 366 ngày tới, kết thúc sau bắt đầu và dài tối đa 12 giờ.");
        if(!insideClass(classroom,input.startsAt().atZone(ZONE).toLocalDate()) || !insideClass(classroom,input.endsAt().minusNanos(1).atZone(ZONE).toLocalDate())) throw problem("OUTSIDE_CLASS_DATES","Buổi nằm ngoài ngày bắt đầu/kết thúc của lớp.");
    }
    private void range(LocalDate from,LocalDate to,boolean future) {
        if(from==null || to==null || to.isBefore(from) || ChronoUnit.DAYS.between(from,to)>92) throw problem("INVALID_DATE_RANGE","Chọn khoảng ngày hợp lệ, tối đa 93 ngày.");
        LocalDate today=LocalDate.now(ZONE);
        if(future && (from.isBefore(today) || to.isAfter(today.plusDays(366)))) throw problem("INVALID_DATE_RANGE","Chỉ sinh lịch từ hôm nay trong 366 ngày tới.");
    }
    private void validateStatus(String status) {if(clean(status)!=null && !Set.of("SCHEDULED","COMPLETED","CANCELLED").contains(status)) throw problem("INVALID_STATUS","Trạng thái buổi học chưa hợp lệ.");}
    private static boolean overlaps(Instant a,Instant b,Instant c,Instant d) {return a.isBefore(d) && c.isBefore(b);}
    private static Instant instant(Map<String,Object> row,String key) {return (Instant)row.get(key);}
    private static Timestamp stamp(Instant instant) {return Timestamp.from(instant);}
    private static String hash(String value) {
        try {return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}
        catch(java.security.NoSuchAlgorithmException impossible) {throw new IllegalStateException(impossible);}
    }
}

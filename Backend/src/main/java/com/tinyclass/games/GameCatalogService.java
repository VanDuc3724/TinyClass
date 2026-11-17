package com.tinyclass.games;

import com.tinyclass.common.api.*;
import com.tinyclass.common.persistence.DomainStore;
import com.tinyclass.family.GuardianService;
import com.tinyclass.learning.AssignmentService;
import com.tinyclass.storage.FileService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import tools.jackson.databind.json.JsonMapper;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import static com.tinyclass.common.persistence.DomainStore.*;

@Service
@Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
public class GameCatalogService {
    static final String FAMILY_FROM=" from game_assignments ga join game_recipients r on r.game_assignment_id=ga.id join students s on s.id=r.student_id left join classes c on c.id=ga.class_id left join class_enrollments e on e.id=r.source_enrollment_id where r.student_id=? and s.status='ACTIVE' and ga.status='ACTIVE' and r.revoked_at is null and (ga.target_type='STUDENT' or(c.status='ACTIVE' and e.status='ACTIVE'))";
    private static final String ASSIGNMENT="select ga.id,ga.game_id,ga.title,ga.target_type,ga.class_id,ga.student_id,c.name as class_name,s.full_name as student_name,ga.available_at,ga.due_at,ga.status,ga.version,ga.linked_lesson_id,ga.linked_course_id,ga.created_at,ga.snapshot->>'gameType' as game_type,ga.snapshot->>'contentRevision' as content_revision from game_assignments ga left join classes c on c.id=ga.class_id left join students s on s.id=ga.student_id ";
    private final DomainStore db;
    private final JsonMapper json;
    private final GameRules rules;
    private final GuardianService guardians;
    private final AssignmentService learning;
    private final FileService files;
    public GameCatalogService(DomainStore db,JsonMapper json,GameRules rules,GuardianService guardians,AssignmentService learning,FileService files){this.db=db;this.json=json;this.rules=rules;this.guardians=guardians;this.learning=learning;this.files=files;}

    public PageResponse<Map<String,Object>> list(UUID actor,String q,String status,String type,int page,int size){
        pagination(page,size);status(status,Set.of("DRAFT","PUBLISHED","ARCHIVED"));status(type,Set.of("CHOICE","MATCH","MEMORY"));
        var args=new ArrayList<Object>(List.of(actor,search(q)));String where=" where teacher_id=? and lower(title) like ? escape '\\'";
        if(clean(status)!=null){where+=" and status=?";args.add(status);}if(clean(type)!=null){where+=" and game_type=?";args.add(type);}
        long count=db.count("select count(*) from learning_games"+where,args.toArray());args.add(size);args.add((long)page*size);
        return db.page(db.rows("select id,title,game_type,instructions,min_age_months,max_age_months,status,content_revision,version,created_at,updated_at from learning_games"+where+" order by updated_at desc,id desc limit ? offset ?",args.toArray()),count,page,size);
    }
    public Map<String,Object> game(UUID actor,UUID id){var g=ownedGame(actor,id,false);g.remove("requestHash");g.remove("clientRequestId");return g;}
    Map<String,Object> ownedGame(UUID actor,UUID id,boolean lock){return db.one("select * from learning_games where id=? and teacher_id=?"+(lock?" for update":""),id,actor);}
    @Transactional
    public Map<String,Object> save(UUID actor,UUID id,GameDtos.Save input,String trace){
        rules.validate(actor,input,false);
        if(id==null){
            if(input.version()!=null||input.clientRequestId()==null)throw problem("INVALID_GAME_CREATE","Tạo trò chơi cần mã yêu cầu mới, không dùng version cũ.");
            db.one("select id from users where id=? and role='TEACHER' and status='ACTIVE' for update",actor);
            String fingerprint=hash(db.json(input));var previous=db.rows("select id,request_hash from learning_games where teacher_id=? and client_request_id=?",actor,input.clientRequestId());
            if(!previous.isEmpty()){if(!fingerprint.equals(previous.getFirst().get("requestHash")))throw conflict("GAME_REQUEST_REUSED","Mã lưu đã dùng cho nội dung khác.");return game(actor,id(previous.getFirst(),"id"));}
            UUID created=UUID.randomUUID();db.update("insert into learning_games(id,teacher_id,title,game_type,instructions,min_age_months,max_age_months,content,client_request_id,request_hash) values(?,?,?,?,?,?,?,?::jsonb,?,?)",created,actor,input.title().strip(),input.gameType(),clean(input.instructions()),age(input.minAgeMonths(),36),age(input.maxAgeMonths(),72),db.json(input.content()),input.clientRequestId(),fingerprint);
            var after=game(actor,created);audit(actor,"GAME_CREATED","GAME",created,Map.of(),after,null,trace);return after;
        }
        var before=ownedGame(actor,id,true);version(before,input.version());
        if("ARCHIVED".equals(before.get("status")))throw conflict("GAME_ARCHIVED","Khôi phục trò chơi trước khi chỉnh sửa.");
        if("PUBLISHED".equals(before.get("status"))){rules.validate(actor,input,true);reason(input.reason());}
        db.update("update learning_games set title=?,game_type=?,instructions=?,min_age_months=?,max_age_months=?,content=?::jsonb,content_revision=content_revision+1,version=version+1,updated_at=clock_timestamp() where id=?",input.title().strip(),input.gameType(),clean(input.instructions()),age(input.minAgeMonths(),36),age(input.maxAgeMonths(),72),db.json(input.content()),id);
        var after=game(actor,id);audit(actor,"GAME_UPDATED","GAME",id,cleanGame(before),after,clean(input.reason()),trace);return after;
    }
    @Transactional
    public Map<String,Object> action(UUID actor,UUID id,String action,GameDtos.Action input,String trace){
        var before=ownedGame(actor,id,true);version(before,input.version());String current=text(before,"status");
        switch(action){
            case "publish"->{if(!"DRAFT".equals(current))throw conflict("INVALID_STATE","Chỉ xuất bản trò chơi đang soạn.");rules.validate(actor,input(before),true);db.update("update learning_games set status='PUBLISHED',version=version+1,updated_at=clock_timestamp() where id=?",id);}
            case "archive"->{if("ARCHIVED".equals(current))throw conflict("INVALID_STATE","Trò chơi đã được lưu trữ.");reason(input.reason());db.update("update learning_games set status='ARCHIVED',archived_from=?,version=version+1,updated_at=clock_timestamp() where id=?",current,id);}
            case "restore"->{if(!"ARCHIVED".equals(current))throw conflict("INVALID_STATE","Trò chơi chưa được lưu trữ.");db.update("update learning_games set status=archived_from,archived_from=null,version=version+1,updated_at=clock_timestamp() where id=?",id);}
            default->throw missing();
        }
        var after=game(actor,id);audit(actor,"GAME_"+action.toUpperCase(Locale.ROOT),"GAME",id,cleanGame(before),after,clean(input.reason()),trace);return after;
    }
    GameDtos.Save input(Map<String,Object> game){return new GameDtos.Save(text(game,"title"),text(game,"gameType"),(String)game.get("instructions"),((Number)game.get("minAgeMonths")).intValue(),((Number)game.get("maxAgeMonths")).intValue(),json.convertValue(game.get("content"),GameDtos.Content.class),number(game,"version"),null,null);}
    Map<String,Object> snapshot(Map<String,Object> game){var result=new LinkedHashMap<String,Object>();for(String key:List.of("title","gameType","instructions","minAgeMonths","maxAgeMonths","contentRevision","content"))result.put(key,game.get(key));return result;}

    @Transactional
    public Map<String,Object> assign(UUID actor,GameDtos.Assign input,String trace){
        db.one("select id from users where id=? and role='TEACHER' and status='ACTIVE' for update",actor);
        String fingerprint=hash(db.json(input));var previous=db.rows("select id,request_hash from game_assignments where teacher_id=? and client_request_id=?",actor,input.clientRequestId());
        if(!previous.isEmpty()){if(!fingerprint.equals(previous.getFirst().get("requestHash")))throw conflict("GAME_REQUEST_REUSED","Mã giao đã dùng cho nội dung khác.");return assignment(actor,id(previous.getFirst(),"id"));}
        var game=ownedGame(actor,input.gameId(),true);if(!"PUBLISHED".equals(game.get("status")))throw conflict("GAME_NOT_PUBLISHED","Xuất bản trò chơi trước khi giao.");rules.validate(actor,input(game),true);
        if(input.availableAt().atZone(ZoneId.of("Asia/Ho_Chi_Minh")).getYear()<1900||input.availableAt().atZone(ZoneId.of("Asia/Ho_Chi_Minh")).getYear()>2200||input.dueAt()!=null&&input.dueAt().isBefore(input.availableAt()))throw problem("INVALID_GAME_DATES","Ngày mở/hạn gợi ý chưa hợp lệ.");
        boolean classroom="CLASS".equals(input.targetType());
        if(classroom?(input.classId()==null||input.studentId()!=null):(input.studentId()==null||input.classId()!=null))throw problem("INVALID_GAME_TARGET","Chọn một lớp hoặc một bé.");
        if(classroom)db.one("select id from classes where id=? and teacher_id=? and status='ACTIVE' for update",input.classId(),actor);
        else db.one("select id from students where id=? and teacher_id=? and status='ACTIVE' for update",input.studentId(),actor);
        if(input.linkedLessonId()!=null&&input.linkedCourseId()!=null)throw problem("INVALID_GAME_CONTEXT","Liên kết một bài học hoặc một khóa học.");
        if(input.linkedLessonId()!=null)db.one("select id from lessons where id=? and teacher_id=? and status='PUBLISHED'",input.linkedLessonId(),actor);
        if(input.linkedCourseId()!=null)db.one("select id from courses where id=? and teacher_id=? and status='PUBLISHED'",input.linkedCourseId(),actor);
        UUID id=UUID.randomUUID();db.update("insert into game_assignments(id,teacher_id,game_id,title,target_type,class_id,student_id,linked_lesson_id,linked_course_id,snapshot,available_at,due_at,client_request_id,request_hash) values(?,?,?,?,?,?,?,?,?,?::jsonb,?,?,?,?)",id,actor,input.gameId(),input.title().strip(),input.targetType(),input.classId(),input.studentId(),input.linkedLessonId(),input.linkedCourseId(),db.json(snapshot(game)),stamp(input.availableAt()),stamp(input.dueAt()),input.clientRequestId(),fingerprint);
        if(classroom)db.update("insert into game_recipients(game_assignment_id,student_id,source_enrollment_id) select ?,e.student_id,e.id from class_enrollments e join students s on s.id=e.student_id where e.class_id=? and e.status='ACTIVE' and s.status='ACTIVE'",id,input.classId());
        else db.update("insert into game_recipients(game_assignment_id,student_id) values(?,?)",id,input.studentId());
        var after=assignment(actor,id);audit(actor,"GAME_ASSIGNED","GAME_ASSIGNMENT",id,Map.of(),after,null,trace);return after;
    }
    public Map<String,Object> assignment(UUID actor,UUID id){
        var result=db.one(ASSIGNMENT+"where ga.id=? and ga.teacher_id=?",id,actor);
        result.put("snapshot",db.one("select snapshot from game_assignments where id=?",id).get("snapshot"));
        result.put("recipientCount",db.count("select count(*) from game_recipients where game_assignment_id=?",id));
        result.put("revokedCount",db.count("select count(*) from game_recipients where game_assignment_id=? and revoked_at is not null",id));return result;
    }
    Map<String,Object> ownedAssignment(UUID actor,UUID id,boolean lock){return db.one("select * from game_assignments where id=? and teacher_id=?"+(lock?" for update":""),id,actor);}
    public PageResponse<Map<String,Object>> assignments(UUID actor,UUID gameId,UUID classId,int page,int size){
        pagination(page,size);var args=new ArrayList<Object>(List.of(actor));String where="where ga.teacher_id=?";
        if(gameId!=null){where+=" and ga.game_id=?";args.add(gameId);}if(classId!=null){db.one("select id from classes where id=? and teacher_id=?",classId,actor);where+=" and ga.class_id=?";args.add(classId);}
        long count=db.count("select count(*) from game_assignments ga "+where,args.toArray());args.add(size);args.add((long)page*size);
        return db.page(db.rows(ASSIGNMENT+where+" order by ga.created_at desc,ga.id desc limit ? offset ?",args.toArray()),count,page,size);
    }
    @Transactional
    public Map<String,Object> revoke(UUID actor,UUID id,GameDtos.Action input,String trace){var before=ownedAssignment(actor,id,true);version(before,input.version());reason(input.reason());if(!"ACTIVE".equals(before.get("status")))throw conflict("INVALID_STATE","Lần giao đã được thu hồi.");db.update("update game_assignments set status='REVOKED',revoke_reason=?,version=version+1,updated_at=clock_timestamp() where id=?",input.reason().strip(),id);var after=assignment(actor,id);audit(actor,"GAME_ASSIGNMENT_REVOKED","GAME_ASSIGNMENT",id,assignmentSummary(before),after,input.reason().strip(),trace);return after;}
    @Transactional
    public Map<String,Object> grant(UUID actor,UUID id,GameDtos.Grant input,String trace){
        // Membership changes lock class/child first. Use the same order so a concurrent
        // withdrawal/archive cannot be followed by a grant based on stale eligibility.
        var reference=ownedAssignment(actor,id,false);
        if("CLASS".equals(reference.get("targetType")))db.one("select id from classes where id=? and teacher_id=? and status='ACTIVE' for update",reference.get("classId"),actor);
        else db.one("select id from students where id=? and teacher_id=? and status='ACTIVE' for update",reference.get("studentId"),actor);
        var row=ownedAssignment(actor,id,true);version(row,input.version());if(!"ACTIVE".equals(row.get("status")))throw conflict("INVALID_STATE","Lần giao đã thu hồi không cấp lại được.");
        var seen=new HashSet<UUID>();for(UUID child:input.studentIds()){
            if(!seen.add(child))throw problem("DUPLICATE_RECIPIENT","Mỗi bé chỉ chọn một lần.");
            UUID enrollment=null;if("CLASS".equals(row.get("targetType"))){var e=db.one("select e.id from class_enrollments e join students s on s.id=e.student_id join classes c on c.id=e.class_id where e.class_id=? and e.student_id=? and c.teacher_id=? and c.status='ACTIVE' and s.status='ACTIVE' and e.status='ACTIVE'",row.get("classId"),child,actor);enrollment=id(e,"id");}else{if(!child.equals(row.get("studentId")))throw missing();db.one("select id from students where id=? and teacher_id=? and status='ACTIVE'",child,actor);}
            db.update("insert into game_recipients(game_assignment_id,student_id,source_enrollment_id) values(?,?,?) on conflict(game_assignment_id,student_id) do update set source_enrollment_id=excluded.source_enrollment_id,granted_at=clock_timestamp(),revoked_at=null,revoke_reason=null",id,child,enrollment);
        }
        db.update("update game_assignments set version=version+1,updated_at=clock_timestamp() where id=?",id);var after=assignment(actor,id);audit(actor,"GAME_RECIPIENTS_GRANTED","GAME_ASSIGNMENT",id,Map.of(),Map.of("studentIds",input.studentIds()),input.reason().strip(),trace);return after;
    }
    public PageResponse<Map<String,Object>> results(UUID actor,UUID assignment,int page,int size){
        ownedAssignment(actor,assignment,false);pagination(page,size);
        long count=db.count("select count(*) from game_recipients where game_assignment_id=?",assignment);
        String stats="select a.student_id,count(*) as attempts,count(*) filter(where a.status='COMPLETED') as completed_attempts,max(a.stars) as best_stars,max(a.completed_at) as last_completed_at from game_attempts a where a.game_assignment_id=? and not a.is_preview group by a.student_id";
        var rows=db.rows("select r.student_id,s.full_name as student_name,r.revoked_at,r.revoke_reason,coalesce(t.attempts,0) as attempts,coalesce(t.completed_attempts,0) as completed_attempts,coalesce(t.best_stars,0) as best_stars,t.last_completed_at from game_recipients r join students s on s.id=r.student_id left join ("+stats+") t on t.student_id=r.student_id where r.game_assignment_id=? order by s.full_name,r.student_id limit ? offset ?",assignment,assignment,size,(long)page*size);
        return db.page(rows,count,page,size);
    }
    public PageResponse<Map<String,Object>> studentResults(UUID actor,UUID assignment,UUID child,int page,int size){ownedAssignment(actor,assignment,false);db.one("select student_id from game_recipients where game_assignment_id=? and student_id=?",assignment,child);return attemptHistory("a.game_assignment_id=? and a.student_id=?",new ArrayList<>(List.of(assignment,child)),page,size,false);}

    public PageResponse<Map<String,Object>> familyList(UUID parent,UUID child,int page,int size){return familyList(parent,child,"",List.of(),page,size);}
    private PageResponse<Map<String,Object>> familyList(UUID parent,UUID child,String context,List<Object> contextArgs,int page,int size){
        guardians.child(parent,child);pagination(page,size);var args=new ArrayList<Object>(List.of(child));String from=FAMILY_FROM;
        from+=context;args.addAll(contextArgs);
        long count=db.count("select count(*)"+from,args.toArray());var values=new ArrayList<Object>();values.add(parent);values.addAll(args);values.add(size);values.add((long)page*size);
        String columns="select ga.id,ga.title,ga.snapshot->>'gameType' as game_type,ga.available_at,ga.due_at,c.name as class_name,ga.available_at>clock_timestamp() as locked,coalesce((select max(a.stars) from game_attempts a where a.game_assignment_id=ga.id and a.student_id=r.student_id and a.status='COMPLETED' and not a.is_preview),0) as best_stars,(select a.id from game_attempts a where a.game_assignment_id=ga.id and a.student_id=r.student_id and a.created_by=? and a.status='IN_PROGRESS' and not a.is_preview) as active_attempt_id";
        return db.page(db.rows(columns+from+" order by ga.available_at desc,ga.id desc limit ? offset ?",values.toArray()),count,page,size);
    }
    public Map<String,Object> familyAssignment(UUID parent,UUID child,UUID assignment){var row=access(parent,child,assignment,false,false);var result=new LinkedHashMap<String,Object>();for(String key:List.of("id","title","availableAt","dueAt","className"))result.put(key,row.get(key));var snap=GameEngine.object(row,"snapshot");for(String key:List.of("gameType","instructions","minAgeMonths","maxAgeMonths"))result.put(key,snap.get(key));result.put("locked",((Instant)row.get("availableAt")).isAfter(Instant.now()));return result;}
    Map<String,Object> access(UUID parent,UUID child,UUID assignment,boolean open,boolean lock){
        guardians.child(parent,child);
        if(lock){db.one("select id from users where id=? and role='PARENT' and status='ACTIVE' for update",parent);db.one("select id from student_guardians where guardian_user_id=? and student_id=? and status='ACTIVE' for update",parent,child);db.one("select id from game_assignments where id=? for update",assignment);}
        var result=db.one("select ga.*,c.name as class_name"+FAMILY_FROM+" and ga.id=?"+(lock?" for update of r":""),child,assignment);
        if(open&&((Instant)result.get("availableAt")).isAfter(Instant.now()))throw new ApiException(org.springframework.http.HttpStatus.FORBIDDEN,"GAME_NOT_AVAILABLE","Trò chơi chưa đến giờ mở.");return result;
    }
    public Map<String,Object> collection(UUID parent,UUID child){guardians.child(parent,child);var summary=db.one("select count(*) as completed_assignments,coalesce(sum(best),0) as total_stars from (select max(stars) as best from game_attempts where student_id=? and not is_preview and status='COMPLETED' group by game_assignment_id) t",child);long n=number(summary,"completedAssignments");var badges=new ArrayList<Map<String,Object>>();if(n>=1)badges.add(Map.of("code","FIRST_GAME","label","Khám phá đầu tiên"));if(n>=3)badges.add(Map.of("code","THREE_GAMES","label","Nhà khám phá nhỏ"));if(n>=5)badges.add(Map.of("code","FIVE_GAMES","label","Chăm chỉ mỗi ngày"));summary.put("badges",badges);return summary;}
    public PageResponse<Map<String,Object>> history(UUID parent,UUID child,int page,int size){guardians.child(parent,child);return attemptHistory("a.student_id=? and a.status='COMPLETED'",new ArrayList<>(List.of(child)),page,size,true);}
    private PageResponse<Map<String,Object>> attemptHistory(String where,ArrayList<Object> args,int page,int size,boolean family){
        pagination(page,size);where+=" and not a.is_preview";long count=db.count("select count(*) from game_attempts a where "+where,args.toArray());args.add(size);args.add((long)page*size);
        var data=db.rows("select a.id,a.game_assignment_id,ga.title,a.snapshot->>'gameType' as game_type,c.name as class_name,a.status,a.total_steps,a.correct_count,a.wrong_count,a.move_count,a.hint_count,a.stars,a.started_at,a.completed_at,extract(epoch from(coalesce(a.completed_at,a.updated_at)-a.started_at))::bigint as duration_seconds from game_attempts a join game_assignments ga on ga.id=a.game_assignment_id left join classes c on c.id=ga.class_id where "+where+" order by a.started_at desc,a.id desc limit ? offset ?",args.toArray());return db.page(data,count,page,size);
    }
    public FileService.Content familyFile(UUID parent,UUID child,UUID assignment,UUID file,boolean download){var a=access(parent,child,assignment,true,false);if(!GameRules.assetIds(GameEngine.object(a,"snapshot")).contains(file))throw missing();var owned=files.owned(id(a,"teacherId"),file);if(download&&!owned.isLearnerDownloadAllowed())throw new ApiException(org.springframework.http.HttpStatus.FORBIDDEN,"DOWNLOAD_NOT_ALLOWED","Cô chỉ cho phép xem/nghe tài liệu này trong trò chơi.");return files.content(owned);}
    public List<Map<String,Object>> linked(UUID parent,UUID child,UUID assignment,UUID item){
        Map<String,Object> source;if(item!=null){source=learning.itemAccess(parent,child,item,false,false);return familyList(parent,child," and ga.linked_lesson_id=?",List.of(id(source,"lessonId")),0,100).data();}
        source=learning.familyAssignment(parent,child,assignment);if(Boolean.TRUE.equals(source.get("locked")))return List.of();
        return familyList(parent,child," and (ga.linked_course_id=(select course_id from assignments where id=?) or ga.linked_lesson_id in(select lesson_id from assignment_items where assignment_id=?))",List.of(assignment,assignment),0,100).data();
    }
    private Map<String,Object> cleanGame(Map<String,Object> row){var result=new LinkedHashMap<>(row);result.remove("requestHash");result.remove("clientRequestId");return result;}
    private Map<String,Object> assignmentSummary(Map<String,Object> row){var result=new LinkedHashMap<>(row);result.remove("requestHash");result.remove("clientRequestId");result.remove("snapshot");return result;}
    private void audit(UUID actor,String action,String type,UUID id,Map<String,Object> before,Map<String,Object> after,String reason,String trace){db.audit(actor,action,type,id,Map.of("before",before,"after",after),reason,trace);}
    private static int age(Integer value,int fallback){return value==null?fallback:value;}
    private static void status(String value,Set<String> allowed){if(clean(value)!=null&&!allowed.contains(value))throw problem("INVALID_GAME_FILTER","Bộ lọc trò chơi chưa hợp lệ.");}
    static void reason(String value){if(clean(value)==null)throw problem("REASON_REQUIRED","Nhập lý do cho thay đổi này.");}
    static Timestamp stamp(Instant value){return value==null?null:Timestamp.from(value);}
    static String hash(String text){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException impossible){throw new IllegalStateException(impossible);}}
}

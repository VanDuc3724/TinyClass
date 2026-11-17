package com.tinyclass.games;

import com.tinyclass.common.persistence.DomainStore;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.time.*;
import java.util.*;
import static com.tinyclass.common.persistence.DomainStore.*;

@Service
@Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
public class GamePlayService {
    private final DomainStore db;
    private final GameCatalogService catalog;
    private final GameRules rules;
    public GamePlayService(DomainStore db,GameCatalogService catalog,GameRules rules){this.db=db;this.catalog=catalog;this.rules=rules;}

    @Transactional
    public Map<String,Object> preview(UUID actor,UUID game,GameDtos.Start input,String trace){
        db.one("select id from users where id=? and role='TEACHER' and status='ACTIVE' for update",actor);
        var source=catalog.ownedGame(actor,game,true);String fingerprint=GameCatalogService.hash(db.json(List.of("PREVIEW",game)));
        var previous=started(actor,input.clientRequestId(),fingerprint);if(previous!=null)return view(previous);
        if("ARCHIVED".equals(source.get("status")))throw conflict("GAME_ARCHIVED","Khôi phục trò chơi trước khi bắt đầu chơi thử mới.");
        rules.validate(actor,catalog.input(source),true);
        UUID attempt=create(actor,game,null,null,true,catalog.snapshot(source),input.clientRequestId());rememberStart(actor,input.clientRequestId(),attempt,fingerprint);
        return view(row(attempt));
    }
    @Transactional
    public Map<String,Object> start(UUID actor,UUID child,UUID assignment,GameDtos.Start input,String trace){
        var source=catalog.access(actor,child,assignment,true,true);
        String fingerprint=GameCatalogService.hash(db.json(List.of("FAMILY",child,assignment)));
        var previous=started(actor,input.clientRequestId(),fingerprint);if(previous!=null)return view(previous);
        var active=db.rows("select id from game_attempts where created_by=? and game_assignment_id=? and student_id=? and status='IN_PROGRESS' and not is_preview",actor,assignment,child);
        UUID attempt=active.isEmpty()?create(actor,id(source,"gameId"),assignment,child,false,GameEngine.object(source,"snapshot"),input.clientRequestId()):id(active.getFirst(),"id");
        rememberStart(actor,input.clientRequestId(),attempt,fingerprint);return view(row(attempt));
    }
    private Map<String,Object> started(UUID actor,UUID request,String fingerprint){var found=db.rows("select attempt_id,request_hash from game_attempt_starts where created_by=? and client_request_id=?",actor,request);if(found.isEmpty())return null;if(!fingerprint.equals(found.getFirst().get("requestHash")))throw conflict("GAME_START_REUSED","Mã bắt đầu đã dùng cho trò chơi hoặc bé khác.");return row(id(found.getFirst(),"attemptId"));}
    private void rememberStart(UUID actor,UUID request,UUID attempt,String fingerprint){db.update("insert into game_attempt_starts(created_by,client_request_id,attempt_id,request_hash) values(?,?,?,?)",actor,request,attempt,fingerprint);}
    private UUID create(UUID actor,UUID game,UUID assignment,UUID child,boolean preview,Map<String,Object> snapshot,UUID request){
        UUID id=UUID.randomUUID();var state=GameEngine.fresh(snapshot);db.update("insert into game_attempts(id,game_id,game_assignment_id,student_id,created_by,is_preview,snapshot,state,total_steps,client_request_id) values(?,?,?,?,?,?,?::jsonb,?::jsonb,?,?)",id,game,assignment,child,actor,preview,db.json(snapshot),db.json(state),GameEngine.total(snapshot),request);return id;
    }
    public Map<String,Object> get(UUID actor,UUID attempt){var row=owned(actor,attempt);check(actor,row,false);return view(row);}
    @Transactional
    public Map<String,Object> move(UUID actor,UUID attempt,GameDtos.Move input,String trace){
        var reference=owned(actor,attempt);check(actor,reference,true);var row=db.one("select * from game_attempts where id=? and created_by=? for update",attempt,actor);
        String fingerprint=GameCatalogService.hash(db.json(input));var previous=db.rows("select request_hash,result_version,result from game_moves where attempt_id=? and client_request_id=?",attempt,input.clientRequestId());
        if(!previous.isEmpty()){
            var p=previous.getFirst();if(!fingerprint.equals(p.get("requestHash")))throw conflict("GAME_MOVE_REUSED","Mã lựa chọn đã dùng cho nội dung khác.");
            return number(p,"resultVersion")==number(row,"version")?GameEngine.object(p,"result"):view(row);
        }
        version(row,input.version());if(!"IN_PROGRESS".equals(row.get("status")))throw conflict("GAME_FINISHED","Lượt này đã dừng hoặc hoàn thành. Gia đình có thể mở lượt mới.");
        if(db.count("select count(*) from game_moves where attempt_id=?",attempt)>=1000)throw conflict("GAME_MOVE_LIMIT","Lượt chơi đã dài. Gia đình có thể bắt đầu lượt mới.");
        var snapshot=GameEngine.object(row,"snapshot");var state=GameEngine.object(row,"state");
        GameEngine.move(snapshot,state,input);boolean finished=GameEngine.finished(snapshot,state);var publicState=GameEngine.view(snapshot,state);
        db.update("update game_attempts set state=?::jsonb,status=?,correct_count=?,wrong_count=?,move_count=?,hint_count=?,stars=?,completed_at=case when ? then clock_timestamp() else null end,version=version+1,updated_at=clock_timestamp() where id=?",db.json(state),finished?"COMPLETED":"IN_PROGRESS",publicState.get("correctCount"),publicState.get("wrongCount"),publicState.get("moveCount"),publicState.get("hintCount"),publicState.get("stars"),finished,attempt);
        var after=row(attempt);var result=view(after);db.update("insert into game_moves(attempt_id,client_request_id,request_hash,result_version,result) values(?,?,?,?,?::jsonb)",attempt,input.clientRequestId(),fingerprint,number(after,"version"),db.json(result));
        if(finished&&!Boolean.TRUE.equals(after.get("isPreview")))db.audit(actor,"GAME_ATTEMPT_COMPLETED","GAME_ATTEMPT",attempt,Map.of("studentId",after.get("studentId"),"assignmentId",after.get("gameAssignmentId"),"stars",after.get("stars"),"correctCount",after.get("correctCount"),"wrongCount",after.get("wrongCount")),null,trace);
        return result;
    }
    @Transactional
    public Map<String,Object> abandon(UUID actor,UUID attempt,GameDtos.Action input,String trace){
        var reference=owned(actor,attempt);check(actor,reference,true);var row=db.one("select * from game_attempts where id=? and created_by=? for update",attempt,actor);
        if("ABANDONED".equals(row.get("status")))return view(row);version(row,input.version());
        if(!"IN_PROGRESS".equals(row.get("status")))throw conflict("GAME_FINISHED","Lượt đã hoàn thành; chọn chơi lại để mở lượt mới.");
        db.update("update game_attempts set status='ABANDONED',version=version+1,updated_at=clock_timestamp() where id=?",attempt);return view(row(attempt));
    }
    private void check(UUID actor,Map<String,Object> row,boolean lock){
        if(Boolean.TRUE.equals(row.get("isPreview"))){if(lock)db.one("select id from users where id=? and role='TEACHER' and status='ACTIVE' for update",actor);catalog.ownedGame(actor,id(row,"gameId"),lock);}
        else catalog.access(actor,id(row,"studentId"),id(row,"gameAssignmentId"),true,lock);
    }
    private Map<String,Object> owned(UUID actor,UUID attempt){return db.one("select * from game_attempts where id=? and created_by=?",attempt,actor);}
    private Map<String,Object> row(UUID attempt){return db.one("select * from game_attempts where id=?",attempt);}
    private Map<String,Object> view(Map<String,Object> row){
        var result=GameEngine.view(GameEngine.object(row,"snapshot"),GameEngine.object(row,"state"));
        for(String key:List.of("id","status","version","isPreview","studentId","gameAssignmentId","startedAt","completedAt"))result.put(key,row.get(key));
        Instant end=row.get("completedAt") instanceof Instant completed?completed:"ABANDONED".equals(row.get("status"))?(Instant)row.get("updatedAt"):Instant.now();
        result.put("durationSeconds",Math.max(0,Duration.between((Instant)row.get("startedAt"),end).toSeconds()));
        long answered=number(row,"correctCount")+number(row,"wrongCount");result.put("accuracyPercent",answered==0?null:Math.round(100.0*number(row,"correctCount")/answered));return result;
    }
}

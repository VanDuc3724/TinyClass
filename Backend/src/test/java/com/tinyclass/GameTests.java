package com.tinyclass;

import com.tinyclass.auth.*;
import com.tinyclass.support.ApiBrowser;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import static org.awaitility.Awaitility.await;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties="tinyclass.auth.attempt-limit=1000")
@ActiveProfiles("test")
class GameTests {
    static final String TEACHER="games-teacher@example.test",PARENT="games-parent@example.test",OTHER="games-other@example.test",UNVERIFIED="games-unverified@example.test",PASSWORD="Synthetic-games-password-2026";
    @Autowired Environment env;@Autowired JdbcTemplate jdbc;@Autowired JsonMapper json;@Autowired UserAccountRepository users;@Autowired PasswordEncoder passwords;
    @Autowired PlatformTransactionManager transactions;
    UUID teacherId,parentId;String classroom,child,enrollment;
    @BeforeEach void prepare()throws Exception{
        assertThat(jdbc.queryForObject("select current_database()",String.class)).isEqualTo("tinyclass_test");jdbc.execute("TRUNCATE users,audit_events CASCADE");
        teacherId=users.saveAndFlush(new UserAccount(TEACHER,passwords.encode(PASSWORD),"Game teacher","TEACHER")).getId();parentId=parent(PARENT,true);parent(OTHER,true);parent(UNVERIFIED,false);
        try(var t=login(TEACHER)){
            classroom=ok(t.post("/classes",Map.of("name","Lớp chơi","capacity",5)),201).path("id").stringValue();ok(t.post("/classes/"+classroom+"/activate",Map.of("version",0)),200);
            child=ok(t.post("/students",Map.of("fullName","Bé khám phá")),201).path("id").stringValue();enrollment=ok(t.post("/classes/"+classroom+"/enrollments",Map.of("studentId",child)),201).path("id").stringValue();
        }
        jdbc.update("insert into student_guardians(id,student_id,guardian_user_id,status,linked_at,created_at,updated_at) values(?,?,?,'ACTIVE',now(),now(),now())",UUID.randomUUID(),UUID.fromString(child),parentId);
    }
    UUID parent(String email,boolean verified){var u=new UserAccount(email,passwords.encode(PASSWORD),"Game parent","PARENT");if(verified)u.verifyEmail();return users.saveAndFlush(u).getId();}
    ApiBrowser login(String email)throws Exception{var b=new ApiBrowser("http://127.0.0.1:"+env.getProperty("local.server.port"),json);ok(b.post("/auth/login",Map.of("email",email,"password",PASSWORD)),200);return b;}
    JsonNode ok(ApiBrowser.Result r,int expected){assertThat(r.status()).as("%s",r.body()).isEqualTo(expected);return r.data();}
    Map<String,Object> face(String label){return Map.of("label",label);}
    Map<String,Object> content(String type){
        if(type.equals("CHOICE")){UUID a=UUID.randomUUID(),b=UUID.randomUUID();return Map.of("questions",List.of(Map.of("id",UUID.randomUUID(),"prompt","Chọn màu đỏ","hint","Nhìn màu của quả cà chua","options",List.of(Map.of("id",a,"label","Đỏ"),Map.of("id",b,"label","Xanh")),"correctOptionId",a)),"pairs",List.of());}
        var pairs=new ArrayList<Map<String,Object>>();for(int i=0;i<2;i++)pairs.add(Map.of("id",UUID.randomUUID(),"left",face("Hình "+i),"right",face(type.equals("MEMORY")?"Hình "+i:"Bạn "+i)));
        return Map.of("questions",List.of(),"pairs",pairs);
    }
    JsonNode game(ApiBrowser t,String type)throws Exception{return game(t,type,content(type));}
    JsonNode game(ApiBrowser t,String type,Map<String,Object> content)throws Exception{
        var g=ok(t.post("/games",Map.of("clientRequestId",UUID.randomUUID(),"title","Trò "+type,"gameType",type,"content",content)),201);
        return ok(t.post("/games/"+g.path("id").stringValue()+"/publish",Map.of("version",0)),200);
    }
    JsonNode assign(ApiBrowser t,JsonNode g,Instant opens)throws Exception{return ok(t.post("/game-assignments",Map.of("clientRequestId",UUID.randomUUID(),"gameId",g.path("id").stringValue(),"title","Bé cùng chơi "+g.path("gameType").stringValue(),"targetType","CLASS","classId",classroom,"availableAt",opens.toString())),201);}
    String family(String assignment){return "/family/children/"+child+"/game-assignments/"+assignment;}
    JsonNode start(ApiBrowser p,JsonNode assignment)throws Exception{return ok(p.post(family(assignment.path("id").stringValue())+"/attempts",Map.of("clientRequestId",UUID.randomUUID())),200);}
    JsonNode move(ApiBrowser p,JsonNode a,String action,String...values)throws Exception{var input=new LinkedHashMap<String,Object>();input.put("clientRequestId",UUID.randomUUID());input.put("version",a.path("version").longValue());input.put("action",action);for(int i=0;i<values.length;i+=2)input.put(values[i],values[i+1]);return ok(p.post("/game-attempts/"+a.path("id").stringValue()+"/moves",input),200);}
    String answer(JsonNode game){return game.path("content").path("questions").get(0).path("correctOptionId").stringValue();}
    JsonNode collect(ApiBrowser p)throws Exception{return ok(p.get("/family/children/"+child+"/games/collection"),200);}

    @Test void choiceRetryAndVersionDoNotDoubleCountOrLeakAnswer()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT)){
            var g=game(t,"CHOICE");var a=start(p,assign(t,g,Instant.now().minusSeconds(60)));String path="/game-attempts/"+a.path("id").stringValue()+"/moves";
            assertThat(a.toString()).doesNotContain("correctOptionId","pairId","snapshot","requestHash");
            var body=Map.of("clientRequestId",UUID.randomUUID(),"version",0,"action","ANSWER","optionId",answer(g));var done=ok(p.post(path,body),200);var retry=ok(p.post(path,body),200);
            assertThat(done.path("status").stringValue()).isEqualTo("COMPLETED");assertThat(retry).isEqualTo(done);assertThat(done.path("moveCount").longValue()).isEqualTo(1);assertThat(done.path("stars").longValue()).isEqualTo(3);
            assertThat(p.post(path,Map.of("clientRequestId",UUID.randomUUID(),"version",0,"action","HINT")).status()).isEqualTo(409);
            var changed=new LinkedHashMap<String,Object>(body);changed.put("action","HINT");assertThat(p.post(path,changed).status()).isEqualTo(409);
            assertThat(jdbc.queryForObject("select count(*) from game_moves",Long.class)).isEqualTo(1);
        }
    }
    @Test void wrongAnswerHintsAndReplayUseBestStarsOnce()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT)){
            var g=game(t,"CHOICE");var assignment=assign(t,g,Instant.now().minusSeconds(60));var a=start(p,assignment);
            a=move(p,a,"HINT");a=move(p,a,"HINT");assertThat(a.path("hintCount").longValue()).isEqualTo(1);
            String wrong=g.path("content").path("questions").get(0).path("options").get(1).path("id").stringValue();a=move(p,a,"ANSWER","optionId",wrong);a=move(p,a,"ANSWER","optionId",answer(g));assertThat(a.path("stars").longValue()).isEqualTo(2);
            a=move(p,start(p,assignment),"ANSWER","optionId",answer(g));assertThat(a.path("stars").longValue()).isEqualTo(3);
            a=move(p,start(p,assignment),"ANSWER","optionId",answer(g));assertThat(collect(p).path("totalStars").longValue()).isEqualTo(3);assertThat(collect(p).path("completedAssignments").longValue()).isEqualTo(1);
            var report=ok(t.get("/game-assignments/"+assignment.path("id").stringValue()+"/results"),200);assertThat(report.get(0).path("completedAttempts").longValue()).isEqualTo(3);
        }
    }
    @Test void matchKeepsPairKeysPrivateAndCountsOnlyUnsolvedCards()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT)){
            var a=start(p,assign(t,game(t,"MATCH"),Instant.now().minusSeconds(60)));assertThat(a.toString()).doesNotContain("pairId");
            for(int i=0;i<2;i++){String left=null,right=null;for(var c:a.path("left"))if(c.path("label").stringValue().equals("Hình "+i))left=c.path("id").stringValue();for(var c:a.path("right"))if(c.path("label").stringValue().equals("Bạn "+i))right=c.path("id").stringValue();a=move(p,a,"MATCH","leftId",left,"rightId",right);}
            assertThat(a.path("status").stringValue()).isEqualTo("COMPLETED");assertThat(a.path("stars").longValue()).isEqualTo(3);
        }
    }
    @Test void memoryNeverSendsHiddenFacesAndRestoresMismatches()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT)){
            var a=start(p,assign(t,game(t,"MEMORY"),Instant.now().minusSeconds(60)));assertThat(a.toString()).doesNotContain("pairId","Hình","imageFileId");
            var state=json.readTree(jdbc.queryForObject("select state::text from game_attempts where id=?",String.class,UUID.fromString(a.path("id").stringValue())));var pairs=new LinkedHashMap<String,List<String>>();for(var c:state.path("cards"))pairs.computeIfAbsent(c.path("pairId").stringValue(),k->new ArrayList<>()).add(c.path("id").stringValue());var ids=new ArrayList<>(pairs.values());
            a=move(p,a,"FLIP","cardId",ids.get(0).get(0));assertThat(a.path("cards").valueStream().filter(c->c.has("face")).count()).isEqualTo(1);
            a=move(p,a,"FLIP","cardId",ids.get(1).get(0));assertThat(a.path("mismatch").booleanValue()).isTrue();assertThat(a.path("wrongCount").longValue()).isEqualTo(1);
            a=ok(p.get("/game-attempts/"+a.path("id").stringValue()),200);assertThat(a.path("mismatch").booleanValue()).isTrue();
            for(var pair:ids){a=move(p,a,"FLIP","cardId",pair.get(0));a=move(p,a,"FLIP","cardId",pair.get(1));}
            assertThat(a.path("status").stringValue()).isEqualTo("COMPLETED");assertThat(a.path("stars").longValue()).isEqualTo(2);
        }
    }
    @Test void previewDoesNotContributeToChildResults()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT)){
            var g=game(t,"CHOICE");var a=ok(t.post("/games/"+g.path("id").stringValue()+"/preview-attempts",Map.of("clientRequestId",UUID.randomUUID())),200);a=move(t,a,"ANSWER","optionId",answer(g));assertThat(a.path("isPreview").booleanValue()).isTrue();assertThat(collect(p).path("totalStars").longValue()).isZero();assertThat(p.get("/game-attempts/"+a.path("id").stringValue()).status()).isEqualTo(404);
        }
    }
    @Test void startAliasesResumeEvenWhenTheirAttemptHasCompletedAndAbandonAllowsRestart()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT)){
            var g=game(t,"CHOICE");var assigned=assign(t,g,Instant.now().minusSeconds(60));String path=family(assigned.path("id").stringValue())+"/attempts";UUID aKey=UUID.randomUUID(),bKey=UUID.randomUUID();
            var a=ok(p.post(path,Map.of("clientRequestId",aKey)),200);var b=ok(p.post(path,Map.of("clientRequestId",bKey)),200);assertThat(a.path("id")).isEqualTo(b.path("id"));a=move(p,a,"ANSWER","optionId",answer(g));
            assertThat(ok(p.post(path,Map.of("clientRequestId",bKey)),200).path("id")).isEqualTo(a.path("id"));
            var c=start(p,assigned);assertThat(c.path("id")).isNotEqualTo(a.path("id"));ok(p.post("/game-attempts/"+c.path("id").stringValue()+"/abandon",Map.of("version",0)),200);var d=start(p,assigned);assertThat(d.path("id")).isNotEqualTo(c.path("id"));
        }
    }
    @Test void livePermissionsBlockFutureForeignAndUnverifiedParents()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT);var o=login(OTHER);var u=login(UNVERIFIED)){
            var assigned=assign(t,game(t,"CHOICE"),Instant.now().plusSeconds(3600));String a=assigned.path("id").stringValue();var list=ok(p.get("/family/children/"+child+"/games"),200);assertThat(list.get(0).path("locked").booleanValue()).isTrue();assertThat(list.toString()).doesNotContain("content","snapshot");
            assertThat(p.post(family(a)+"/attempts",Map.of("clientRequestId",UUID.randomUUID())).status()).isEqualTo(403);assertThat(o.get(family(a)).status()).isEqualTo(404);assertThat(u.get("/family/children/"+child+"/games").status()).isEqualTo(403);assertThat(p.get("/games").status()).isEqualTo(403);
        }
    }
    @Test void withdrawalBlocksAttemptsFilesAndRejoinNeedsExplicitGrantButKeepsHistory()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT)){
            var g=game(t,"CHOICE");var assigned=assign(t,g,Instant.now().minusSeconds(60));var completed=move(p,start(p,assigned),"ANSWER","optionId",answer(g));var active=start(p,assigned);
            ok(t.patch("/enrollments/"+enrollment,Map.of("version",0,"status","WITHDRAWN","reason","Gia đình nghỉ")),200);
            assertThat(p.get("/game-attempts/"+active.path("id").stringValue()).status()).isEqualTo(404);assertThat(p.post("/game-attempts/"+active.path("id").stringValue()+"/moves",Map.of("clientRequestId",UUID.randomUUID(),"version",0,"action","ANSWER","optionId",answer(g))).status()).isEqualTo(404);
            assertThat(collect(p).path("totalStars").longValue()).isEqualTo(3);assertThat(ok(p.get("/family/children/"+child+"/games/history"),200).get(0).path("id")).isEqualTo(completed.path("id"));
            ok(t.patch("/enrollments/"+enrollment,Map.of("version",1,"status","ACTIVE","reason","Bé quay lại")),200);assertThat(ok(p.get("/family/children/"+child+"/games"),200).size()).isZero();
            ok(t.post("/game-assignments/"+assigned.path("id").stringValue()+"/recipients",Map.of("version",0,"studentIds",List.of(child),"reason","Cô mở lại trò chơi")),200);assertThat(ok(p.get("/game-attempts/"+active.path("id").stringValue()),200).path("id")).isEqualTo(active.path("id"));
            jdbc.update("update student_guardians set status='REVOKED' where guardian_user_id=?",parentId);assertThat(p.get("/family/children/"+child+"/games/history").status()).isEqualTo(404);
        }
    }
    @Test void assignmentSnapshotSurvivesPublishedEditsAndTemplateArchive()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT)){
            var g=game(t,"CHOICE");var assigned=assign(t,g,Instant.now().minusSeconds(60));String id=g.path("id").stringValue();var update=Map.of("version",1,"reason","Bổ sung câu hỏi mới","title","Mẫu thay đổi","gameType","CHOICE","content",content("CHOICE"));var edited=ok(t.put("/games/"+id,update),200);ok(t.post("/games/"+id+"/archive",Map.of("version",edited.path("version").longValue(),"reason","Cô lưu mẫu")),200);
            var a=start(p,assigned);assertThat(a.path("title").stringValue()).isEqualTo(g.path("title").stringValue());a=move(p,a,"ANSWER","optionId",answer(g));assertThat(a.path("status").stringValue()).isEqualTo("COMPLETED");
            ok(t.post("/game-assignments/"+assigned.path("id").stringValue()+"/revoke",Map.of("version",0,"reason","Kết thúc hoạt động")),200);assertThat(p.get("/game-attempts/"+a.path("id").stringValue()).status()).isEqualTo(404);assertThat(collect(p).path("totalStars").longValue()).isEqualTo(3);
        }
    }
    @Test void gameAssetsEnforceContextReadyMimeDownloadAndWithdrawal()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT)){
            byte[] png=Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a+3sAAAAASUVORK5CYII=");var f=ok(t.multipart("/files","game.png","image/png",png,Map.of("purpose","LESSON_ASSET","learnerDownloadAllowed","false"),true),201);String file=f.path("id").stringValue();
            var c=content("CHOICE");var tree=json.valueToTree(c);((tools.jackson.databind.node.ObjectNode)tree.path("questions").get(0)).put("imageFileId",file);@SuppressWarnings("unchecked")var data=(Map<String,Object>)json.convertValue(tree,Map.class);
            var assigned=assign(t,game(t,"CHOICE",data),Instant.now().minusSeconds(60));String base=family(assigned.path("id").stringValue())+"/files/"+file;
            assertThat(p.binaryGet(base+"/content",Map.of("Range","bytes=0-7")).statusCode()).isEqualTo(206);assertThat(p.get(base+"/download").status()).isEqualTo(403);
            var unrelated=assign(t,game(t,"CHOICE"),Instant.now().minusSeconds(60));assertThat(p.get(family(unrelated.path("id").stringValue())+"/files/"+file+"/content").status()).isEqualTo(404);
            ok(t.patch("/enrollments/"+enrollment,Map.of("version",0,"status","WITHDRAWN","reason","Bé nghỉ")),200);assertThat(p.get(base+"/content").status()).isEqualTo(404);
        }
    }
    @Test void invalidContentCannotPublishOrPreviewAndFiltersApplyBeforePaging()throws Exception{
        try(var t=login(TEACHER)){
            var draft=ok(t.post("/games",Map.of("clientRequestId",UUID.randomUUID(),"title","Chưa soạn","gameType","MEMORY","content",Map.of("questions",List.of(),"pairs",List.of()))),201);String id=draft.path("id").stringValue();assertThat(t.post("/games/"+id+"/publish",Map.of("version",0)).status()).isEqualTo(400);assertThat(t.post("/games/"+id+"/preview-attempts",Map.of("clientRequestId",UUID.randomUUID())).status()).isEqualTo(400);
            game(t,"MATCH");game(t,"CHOICE");var r=t.get("/games?status=PUBLISHED&gameType=MATCH&size=1");assertThat(r.body().path("meta").path("totalElements").longValue()).isEqualTo(1);assertThat(r.data().get(0).path("gameType").stringValue()).isEqualTo("MATCH");
            var bad=content("MATCH");var tree=json.valueToTree(bad);((tools.jackson.databind.node.ObjectNode)tree.path("pairs").get(1)).set("left",tree.path("pairs").get(0).path("left"));var g=ok(t.post("/games",Map.of("clientRequestId",UUID.randomUUID(),"title","Thẻ trùng","gameType","MATCH","content",tree)),201);assertThat(t.post("/games/"+g.path("id").stringValue()+"/publish",Map.of("version",0)).status()).isEqualTo(400);
        }
    }
    @Test void concurrentWithdrawalCannotBeUndoneByAStaleGrant()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT);var worker=Executors.newSingleThreadExecutor()){
            var assigned=assign(t,game(t,"CHOICE"),Instant.now().minusSeconds(60));UUID a=UUID.fromString(assigned.path("id").stringValue());var pending=new AtomicReference<Future<ApiBrowser.Result>>();
            new TransactionTemplate(transactions).executeWithoutResult(tx->{
                jdbc.queryForObject("select id from classes where id=? for update",UUID.class,UUID.fromString(classroom));
                pending.set(worker.submit(()->t.post("/game-assignments/"+a+"/recipients",Map.of("version",0,"studentIds",List.of(child),"reason","Concurrent grant"))));
                await().atMost(java.time.Duration.ofSeconds(5)).until(()->jdbc.queryForObject("select count(*) from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like 'select id from classes where id=%'",Long.class)>0);
                jdbc.update("update class_enrollments set status='WITHDRAWN',ended_at=now(),status_changed_at=now(),version=version+1 where id=?",UUID.fromString(enrollment));
                jdbc.update("update game_recipients set revoked_at=now(),revoke_reason='Concurrent withdrawal' where game_assignment_id=?",a);
            });
            assertThat(pending.get().get(10,TimeUnit.SECONDS).status()).isEqualTo(404);
            ok(t.patch("/enrollments/"+enrollment,Map.of("version",1,"status","ACTIVE","reason","Return")),200);
            assertThat(ok(p.get("/family/children/"+child+"/games"),200).size()).isZero();
        }
    }

    @Test void classCompletionRevokesGameRightsAndRetainsCompletedCollection()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT)){
            var g=game(t,"CHOICE");var assigned=assign(t,g,Instant.now().minusSeconds(60));move(p,start(p,assigned),"ANSWER","optionId",answer(g));
            var c=ok(t.get("/classes/"+classroom),200);ok(t.post("/classes/"+classroom+"/complete",Map.of("version",c.path("version").longValue(),"reason","Xong khóa")),200);assertThat(ok(p.get("/family/children/"+child+"/games"),200).size()).isZero();assertThat(collect(p).path("totalStars").longValue()).isEqualTo(3);
        }
    }
}

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
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties="tinyclass.auth.attempt-limit=1000")
@ActiveProfiles("test")
class SubmissionTests {
    static final String TEACHER="submission-teacher@example.test",FIRST="submission-parent@example.test",SECOND="submission-second@example.test",PASSWORD="Synthetic-submission-password-2026";
    static final byte[] PNG=Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGdoAAAAASUVORK5CYII=");
    @Autowired Environment env; @Autowired JdbcTemplate jdbc; @Autowired JsonMapper json;
    @Autowired UserAccountRepository users; @Autowired PasswordEncoder passwords;
    UUID parentId,secondId;
    record Scenario(String child,String item,String assignment,String classroom) {}
    @BeforeEach void prepare() {
        assertThat(jdbc.queryForObject("select current_database()",String.class)).isEqualTo("tinyclass_test");
        jdbc.execute("TRUNCATE users,audit_events CASCADE");
        users.saveAndFlush(new UserAccount(TEACHER,passwords.encode(PASSWORD),"Submission teacher","TEACHER"));
        var first=new UserAccount(FIRST,passwords.encode(PASSWORD),"First guardian","PARENT"); first.verifyEmail();parentId=users.saveAndFlush(first).getId();
        var second=new UserAccount(SECOND,passwords.encode(PASSWORD),"Second guardian","PARENT");second.verifyEmail();secondId=users.saveAndFlush(second).getId();
    }
    ApiBrowser browser() {return new ApiBrowser("http://127.0.0.1:"+env.getProperty("local.server.port"),json);}
    ApiBrowser login(String email) throws Exception {var b=browser();assertThat(b.post("/auth/login",Map.of("email",email,"password",PASSWORD)).status()).isEqualTo(200);return b;}
    Scenario scenario(ApiBrowser t,String mode,List<String> types,boolean classroom,Instant available) throws Exception {
        var lesson=t.post("/lessons",Map.of("title","Sản phẩm thử nghiệm","defaultCompletionMode",mode,"defaultResponseTypes",types,"topicIds",List.of(),"blocks",List.of(Map.of("type","TEXT","textContent","Synthetic activity"))));
        assertThat(lesson.status()).isEqualTo(201);String l=lesson.data().path("id").stringValue();assertThat(t.post("/lessons/"+l+"/publish",Map.of("version",0)).status()).isEqualTo(200);
        String child=t.post("/students",Map.of("fullName","Synthetic child","internalNote","Private teacher-only note")).data().path("id").stringValue();
        for(UUID parent:List.of(parentId,secondId))jdbc.update("insert into student_guardians(id,student_id,guardian_user_id,status,linked_at,created_at,updated_at) values(?,?,?,'ACTIVE',now(),now(),now())",UUID.randomUUID(),UUID.fromString(child),parent);
        String c=null;
        if(classroom) {c=t.post("/classes",Map.of("name","Submission class","capacity",10)).data().path("id").stringValue(); t.post("/classes/"+c+"/activate",Map.of("version",0));assertThat(t.post("/classes/"+c+"/enrollments",Map.of("studentId",child)).status()).isEqualTo(201);}
        var body=new LinkedHashMap<String,Object>();body.put("title","Lần giao sản phẩm");body.put("sourceType","LESSON");body.put("lessonId",l);body.put("targetType",classroom?"CLASS":"STUDENT");body.put(classroom?"classId":"studentId",classroom?c:child);body.put("availableAt",available.toString());body.put("dueAt",available.plusSeconds(1).toString());body.put("clientRequestId",UUID.randomUUID());
        var a=t.post("/assignments",body);assertThat(a.status()).isEqualTo(201);String assignment=a.data().path("id").stringValue(),item=a.data().path("items").get(0).path("id").stringValue();assertThat(t.post("/assignments/"+assignment+"/publish",Map.of("version",0)).status()).isEqualTo(200);
        return new Scenario(child,item,assignment,c);
    }
    Scenario scenario(ApiBrowser t) throws Exception {return scenario(t,"TEACHER_REVIEW",List.of("TEXT","IMAGE","AUDIO","VIDEO"),false,Instant.now().minusSeconds(100));}
    String itemPath(Scenario s) {return "/family/children/"+s.child()+"/assignment-items/"+s.item();}
    JsonNode draft(ApiBrowser p,Scenario s) throws Exception {var r=p.post(itemPath(s)+"/submissions",Map.of());assertThat(r.status()).isEqualTo(201);return r.data();}
    JsonNode save(ApiBrowser p,JsonNode draft,String text,List<String> files) throws Exception {var r=p.patch("/submissions/"+draft.path("id").stringValue(),Map.of("version",draft.path("version").longValue(),"textResponse",text,"fileIds",files));assertThat(r.status()).isEqualTo(200);return r.data();}
    JsonNode send(ApiBrowser p,JsonNode draft) throws Exception {var r=p.post("/submissions/"+draft.path("id").stringValue()+"/submit",Map.of("version",draft.path("version").longValue()));assertThat(r.status()).isEqualTo(200);return r.data();}
    JsonNode review(ApiBrowser t,JsonNode submission,String outcome,String feedback) throws Exception {var r=t.post("/submissions/"+submission.path("id").stringValue()+"/review",Map.of("version",submission.path("version").longValue(),"outcome",outcome,"feedbackText",feedback));assertThat(r.status()).isEqualTo(200);return r.data();}
    String uploadPath(Scenario s,JsonNode d) {return "/family/children/"+s.child()+"/submissions/"+d.path("id").stringValue()+"/files";}
    String upload(ApiBrowser p,Scenario s,JsonNode d) throws Exception {var r=p.multipart(uploadPath(s,d),"product.png","image/png",PNG,Map.of(),true);assertThat(r.status()).isEqualTo(201);assertThat(r.data().path("purpose").stringValue()).isEqualTo("SUBMISSION_ASSET");return r.data().path("id").stringValue();}
    String familyFile(Scenario s,JsonNode d,String file) {return uploadPath(s,d)+"/"+file+"/content";}

    @Test void submitChangesAndAcceptanceHaveIndependentHistoryAndOnlyAcceptanceCompletes() throws Exception {
        try(var t=login(TEACHER);var p=login(FIRST)) {
            var s=scenario(t);var original=draft(p,s);var saved=save(p,original,"Bé đã thực hiện hoạt động",List.of());
            assertThat(p.patch("/submissions/"+saved.path("id").stringValue(),Map.of("version",0,"textResponse","stale","fileIds",List.of())).status()).isEqualTo(409);
            var pending=send(p,saved); assertThat(pending.path("progress").path("status").stringValue()).isEqualTo("SUBMITTED");assertThat(pending.path("late").booleanValue()).isTrue();
            assertThat(p.post("/submissions/"+saved.path("id").stringValue()+"/submit",Map.of("version",saved.path("version").longValue())).status()).isEqualTo(200);
            assertThat(p.get("/family/children/"+s.child()+"/assignments/"+s.assignment()).data().path("completionPercent").intValue()).isZero();
            assertThat(t.post("/submissions/"+pending.path("id").stringValue()+"/review",Map.of("version",pending.path("version").longValue(),"outcome","CHANGES_REQUESTED")).status()).isEqualTo(400);
            var revised=review(t,pending,"CHANGES_REQUESTED","Gia đình bổ sung ảnh của bé nhé.");assertThat(revised.path("progress").path("status").stringValue()).isEqualTo("NEEDS_REVISION");
            assertThat(p.patch("/submissions/"+pending.path("id").stringValue(),Map.of("version",revised.path("version").longValue(),"textResponse","Cannot change sent attempt","fileIds",List.of())).status()).isEqualTo(409);
            var next=draft(p,s);assertThat(next.path("attemptNumber").intValue()).isEqualTo(2);
            var accepted=review(t,send(p,save(p,next,"Đã bổ sung theo nhận xét",List.of())),"ACCEPTED","Cô đã xem, bé làm tốt!");
            assertThat(accepted.path("progress").path("status").stringValue()).isEqualTo("COMPLETED");assertThat(accepted.path("progress").path("teacherAcceptedAt").isNull()).isFalse();
            assertThat(p.get("/family/children/"+s.child()+"/assignments/"+s.assignment()).data().path("completionPercent").intValue()).isEqualTo(100);
            assertThat(p.get(itemPath(s)+"/submissions").data().path("submissions").path("data").size()).isEqualTo(2);
            assertThat(p.post(itemPath(s)+"/confirm",Map.of()).status()).isEqualTo(409);
            assertThat(p.post(itemPath(s)+"/submissions",Map.of()).status()).isEqualTo(409);
        }
    }

    @Test void reopenStartsANewCycleAndKeepsTheAcceptedAttemptAndPreviousProgress() throws Exception {
        try(var t=login(TEACHER);var p=login(FIRST)) {
            var s=scenario(t);var accepted=review(t,send(p,save(p,draft(p,s),"First cycle",List.of())),"ACCEPTED","Đạt");
            String path="/assignment-items/"+s.item()+"/students/"+s.child()+"/reopen";
            long version=accepted.path("progress").path("version").longValue();
            assertThat(t.post(path,Map.of("version",version,"reason"," ")).status()).isEqualTo(400);
            assertThat(t.post(path,Map.of("version",version+20,"reason","Làm lại")).status()).isEqualTo(409);
            var reopened=t.post(path,Map.of("version",version,"reason","Cùng luyện tập thêm một lần"));assertThat(reopened.status()).isEqualTo(200);
            assertThat(reopened.data().path("status").stringValue()).isEqualTo("OPENED");assertThat(reopened.data().path("reviewCycle").intValue()).isEqualTo(1);assertThat(reopened.data().path("completedAt").isNull()).isTrue();
            assertThat(p.post(itemPath(s)+"/open",Map.of()).data().path("progress").path("status").stringValue()).isEqualTo("OPENED");
            assertThat(p.get("/family/children/"+s.child()+"/assignments/"+s.assignment()).data().path("completionPercent").intValue()).isZero();
            assertThat(p.get("/family/children/"+s.child()+"/submissions/"+accepted.path("id").stringValue()).data().path("status").stringValue()).isEqualTo("ACCEPTED");
            assertThat(jdbc.queryForObject("select before_state->>'status' from submission_events where event_type='REOPENED'",String.class)).isEqualTo("COMPLETED");
            var next=draft(p,s);assertThat(next.path("reviewCycle").intValue()).isEqualTo(1);assertThat(next.path("attemptNumber").intValue()).isEqualTo(2);
            assertThat(review(t,send(p,save(p,next,"Second cycle",List.of())),"ACCEPTED","Hoàn thành vòng mới").path("progress").path("status").stringValue()).isEqualTo("COMPLETED");
        }
    }

    @Test void twoGuardiansCannotEditEachOthersDraftOrCreateTwoPendingAttemptsConcurrently() throws Exception {
        try(var t=login(TEACHER);var first=login(FIRST);var second=login(SECOND);var pool=Executors.newFixedThreadPool(2)) {
            var s=scenario(t);var a=save(first,draft(first,s),"First guardian's draft",List.of());var b=save(second,draft(second,s),"Second guardian's draft",List.of());
            assertThat(first.post(itemPath(s)+"/submissions",Map.of()).data().path("id").stringValue()).isEqualTo(a.path("id").stringValue());
            assertThat(second.patch("/submissions/"+a.path("id").stringValue(),Map.of("version",a.path("version").longValue(),"textResponse","forged","fileIds",List.of())).status()).isEqualTo(404);
            assertThat(second.get("/family/children/"+s.child()+"/submissions/"+a.path("id").stringValue()).status()).isEqualTo(200);
            var gate=new CountDownLatch(1);
            var f=pool.submit(()->{gate.await();return first.post("/submissions/"+a.path("id").stringValue()+"/submit",Map.of("version",a.path("version").longValue())).status();});
            var g=pool.submit(()->{gate.await();return second.post("/submissions/"+b.path("id").stringValue()+"/submit",Map.of("version",b.path("version").longValue())).status();});
            gate.countDown();assertThat(List.of(f.get(15,TimeUnit.SECONDS),g.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
            assertThat(jdbc.queryForObject("select count(*) from submissions where status='SUBMITTED'",Integer.class)).isEqualTo(1);
            assertThat(jdbc.queryForObject("select count(*) from submissions where status='DRAFT'",Integer.class)).isEqualTo(1);
        }
    }

    @Test void attachmentsAreBoundToUploaderChildAndItemAndCountAgainstTeacherStorage() throws Exception {
        try(var t=login(TEACHER);var p=login(FIRST);var other=login(SECOND)) {
            var s=scenario(t);var d=draft(p,s);String file=upload(p,s,d);
            assertThat(p.binaryGet(familyFile(s,d,file),Map.of()).statusCode()).isEqualTo(404);
            var foreign=scenario(t);var f=draft(p,foreign);
            assertThat(p.patch("/submissions/"+f.path("id").stringValue(),Map.of("version",0,"textResponse","Wrong context","fileIds",List.of(file))).status()).isEqualTo(404);
            var their=draft(other,s);
            assertThat(other.patch("/submissions/"+their.path("id").stringValue(),Map.of("version",0,"textResponse","Wrong author","fileIds",List.of(file))).status()).isEqualTo(404);
            String teacherFile=t.multipart("/files","lesson.png","image/png",PNG,Map.of(),true).data().path("id").stringValue();
            assertThat(p.patch("/submissions/"+d.path("id").stringValue(),Map.of("version",0,"textResponse","Not a product","fileIds",List.of(teacherFile))).status()).isEqualTo(404);
            var saved=save(p,d,"Ảnh của bé",List.of(file));
            assertThat(p.binaryGet(familyFile(s,saved,file),Map.of("Range","bytes=0-7")).statusCode()).isEqualTo(206);
            assertThat(other.binaryGet(familyFile(s,saved,file),Map.of()).statusCode()).isEqualTo(200);
            assertThat(t.get("/storage-connections").data().get(0).path("usedBytes").longValue()).isEqualTo(PNG.length*2L);
            assertThat(p.get("/files/"+file).status()).isEqualTo(403);
            assertThat(p.get("/family/children/"+foreign.child()+"/submissions/"+saved.path("id").stringValue()).status()).isEqualTo(404);
            assertThat(t.get("/submissions/"+d.path("id").stringValue()).status()).isEqualTo(404);
        }
    }

    @Test void typeSizeDuplicateAndEmptyValidationKeepTheDraftRecoverable() throws Exception {
        try(var t=login(TEACHER);var p=login(FIRST)) {
            var s=scenario(t,"TEACHER_REVIEW",List.of("IMAGE"),false,Instant.now().minusSeconds(20));var d=draft(p,s);String id=d.path("id").stringValue();
            assertThat(p.post("/submissions/"+id+"/submit",Map.of("version",0)).status()).isEqualTo(400);
            assertThat(p.patch("/submissions/"+id,Map.of("version",0,"textResponse","Disallowed text","fileIds",List.of())).status()).isEqualTo(400);
            assertThat(p.multipart(uploadPath(s,d),"fake.jpg","image/jpeg",PNG,Map.of(),true).status()).isEqualTo(400);
            assertThat(p.multipart(uploadPath(s,d),"response.pdf","application/pdf","%PDF-1.4\nSynthetic\n%%EOF".getBytes(StandardCharsets.UTF_8),Map.of(),true).status()).isEqualTo(400);
            var files=new ArrayList<String>();for(int i=0;i<6;i++) files.add(upload(p,s,d));
            assertThat(p.patch("/submissions/"+id,Map.of("version",0,"textResponse","","fileIds",files)).status()).isEqualTo(400);
            assertThat(p.patch("/submissions/"+id,Map.of("version",0,"textResponse","","fileIds",List.of(files.getFirst(),files.getFirst()))).status()).isEqualTo(400);
            for(String file:files.subList(0,5))jdbc.update("update files set size_bytes=? where id=?",60L*1024*1024,UUID.fromString(file));
            var oversized=p.patch("/submissions/"+id,Map.of("version",0,"textResponse","","fileIds",files.subList(0,5)));assertThat(oversized.body().path("code").stringValue()).isEqualTo("SUBMISSION_TOO_LARGE");
            assertThat(p.get("/family/children/"+s.child()+"/submissions/"+id).data().path("version").longValue()).isZero();
            assertThat(send(p,save(p,d,"",List.of(files.get(5)))).path("status").stringValue()).isEqualTo("SUBMITTED");
        }
    }

    @Test void withdrawalPreservesProductHistoryButRevokingGuardianBlocksItAndItsFiles() throws Exception {
        try(var t=login(TEACHER);var p=login(FIRST)) {
            var s=scenario(t,"TEACHER_REVIEW",List.of("TEXT","IMAGE"),true,Instant.now().minusSeconds(20));var d=draft(p,s);String file=upload(p,s,d);var pending=send(p,save(p,d,"Keep history",List.of(file)));
            String enrollment=t.get("/classes/"+s.classroom()+"/enrollments").data().get(0).path("id").stringValue();
            long v=t.get("/classes/"+s.classroom()+"/enrollments").data().get(0).path("version").longValue();
            assertThat(t.patch("/enrollments/"+enrollment,Map.of("version",v,"status","WITHDRAWN","reason","Tạm nghỉ")).status()).isEqualTo(200);
            assertThat(p.get(itemPath(s)).status()).isEqualTo(404);
            assertThat(p.post(itemPath(s)+"/submissions",Map.of()).status()).isEqualTo(404);
            assertThat(p.get("/family/children/"+s.child()+"/submissions").data().size()).isEqualTo(1);
            assertThat(p.binaryGet(familyFile(s,pending,file),Map.of()).statusCode()).isEqualTo(200);
            var accepted=review(t,pending,"ACCEPTED","Cô đã xem sản phẩm trước khi bé nghỉ.");
            assertThat(t.post("/assignment-items/"+s.item()+"/students/"+s.child()+"/reopen",Map.of("version",accepted.path("progress").path("version").longValue(),"reason","Không có quyền mới")).status()).isEqualTo(409);
            jdbc.update("update student_guardians set status='REVOKED' where guardian_user_id=? and student_id=?",parentId,UUID.fromString(s.child()));
            assertThat(p.get("/family/children/"+s.child()+"/submissions").status()).isEqualTo(404);
            assertThat(p.binaryGet(familyFile(s,pending,file),Map.of()).statusCode()).isEqualTo(404);
        }
    }

    @Test void completedClassesAreReadOnlyForFamilyWhileTeacherCanReviewAnExistingSubmission() throws Exception {
        try(var t=login(TEACHER);var p=login(FIRST)) {
            var s=scenario(t,"TEACHER_REVIEW",List.of("TEXT"),true,Instant.now().minusSeconds(20));var pending=send(p,save(p,draft(p,s),"Before class completion",List.of()));
            long version=t.get("/classes/"+s.classroom()).data().path("version").longValue();assertThat(t.post("/classes/"+s.classroom()+"/complete",Map.of("version",version)).status()).isEqualTo(200);
            assertThat(p.post(itemPath(s)+"/submissions",Map.of()).status()).isEqualTo(409);
            assertThat(review(t,pending,"ACCEPTED","Đã ghi nhận").path("progress").path("status").stringValue()).isEqualTo("COMPLETED");
            assertThat(t.get("/assignments/"+s.assignment()+"/students/"+s.child()+"/progress").data().path("items").get(0).path("canReopen").booleanValue()).isFalse();
        }
    }

    @Test void roleCsrfFutureAndWrongItemChecksApplyToEverySubmissionEntryPoint() throws Exception {
        try(var t=login(TEACHER);var p=login(FIRST);var anonymous=browser()) {
            var s=scenario(t);var d=draft(p,s);String id=d.path("id").stringValue();
            assertThat(anonymous.get("/submissions").status()).isEqualTo(401);
            assertThat(p.get("/submissions").status()).isEqualTo(403);
            assertThat(p.post("/submissions/"+id+"/review",Map.of("version",0,"outcome","ACCEPTED")).status()).isEqualTo(403);
            assertThat(t.patch("/submissions/"+id,Map.of("version",0,"textResponse","teacher cannot author","fileIds",List.of())).status()).isEqualTo(403);
            assertThat(p.write("PATCH","/submissions/"+id,Map.of("version",0,"textResponse","csrf","fileIds",List.of()),false).status()).isEqualTo(403);
            assertThat(p.get("/family/children/"+s.child()+"/assignment-items/"+UUID.randomUUID()+"/submissions").status()).isEqualTo(404);
            var future=scenario(t,"TEACHER_REVIEW",List.of("TEXT"),false,Instant.now().plusSeconds(3600));assertThat(p.post(itemPath(future)+"/submissions",Map.of()).status()).isEqualTo(403);
            assertThat(t.get("/submissions?status=INVALID").status()).isEqualTo(400);
            assertThat(t.get("/submissions?classId="+UUID.randomUUID()).status()).isEqualTo(404);
            assertThat(t.get("/submissions?page=-1").status()).isEqualTo(400);
        }
    }

    @Test void parentConfirmationCanBeReopenedButReferenceItemsDoNotAcceptProducts() throws Exception {
        try(var t=login(TEACHER);var p=login(FIRST)) {
            var s=scenario(t,"PARENT_CONFIRM",List.of(),false,Instant.now().minusSeconds(10));
            assertThat(p.post(itemPath(s)+"/submissions",Map.of()).status()).isEqualTo(409);
            assertThat(p.post(itemPath(s)+"/confirm",Map.of()).status()).isEqualTo(200);
            var item=t.get("/assignments/"+s.assignment()+"/students/"+s.child()+"/progress").data().path("items").get(0);
            var opened=t.post("/assignment-items/"+s.item()+"/students/"+s.child()+"/reopen",Map.of("version",item.path("progress").path("version").longValue(),"reason","Gia đình cùng làm lại"));
            assertThat(opened.status()).isEqualTo(200);assertThat(opened.data().path("parentConfirmedAt").isNull()).isTrue();
            assertThat(p.get(itemPath(s)).data().path("progress").path("reopenReason").stringValue()).isEqualTo("Gia đình cùng làm lại");
            assertThat(p.post(itemPath(s)+"/confirm",Map.of()).data().path("progress").path("status").stringValue()).isEqualTo("COMPLETED");
            var reference=scenario(t,"REFERENCE",List.of(),false,Instant.now().minusSeconds(10));assertThat(p.post(itemPath(reference)+"/submissions",Map.of()).status()).isEqualTo(409);
        }
    }

    @Test void audioFeedbackUsesPrivateSubmissionAccessAndReviewRetriesCannotOverwriteHistory() throws Exception {
        try(var t=login(TEACHER);var p=login(FIRST)) {
            var s=scenario(t);var sent=send(p,save(p,draft(p,s),"Ready for audio feedback",List.of()));
            var wave=ByteBuffer.allocate(60).order(ByteOrder.LITTLE_ENDIAN);wave.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(52).put("WAVEfmt ".getBytes(StandardCharsets.US_ASCII)).putInt(16).putShort((short)1).putShort((short)1).putInt(8000).putInt(16000).putShort((short)2).putShort((short)16).put("data".getBytes(StandardCharsets.US_ASCII)).putInt(16);
            var upload=t.multipart("/files","feedback.wav","audio/wav",wave.array(),Map.of("purpose","REVIEW_ASSET"),true);assertThat(upload.status()).isEqualTo(201);String audio=upload.data().path("id").stringValue();
            String path="/submissions/"+sent.path("id").stringValue()+"/review";
            var body=Map.of("version",sent.path("version").longValue(),"outcome","ACCEPTED","feedbackText","Phản hồi có âm thanh","feedbackAudioFileId",audio);
            assertThat(t.post(path,body).status()).isEqualTo(200);assertThat(t.post(path,body).status()).isEqualTo(409);
            assertThat(p.binaryGet(familyFile(s,sent,audio),Map.of()).statusCode()).isEqualTo(200);
            assertThat(p.get("/family/children/"+s.child()+"/submissions/"+sent.path("id").stringValue()).body().toString()).doesNotContain("storageKey","Private teacher-only note","passwordHash");
            assertThat(jdbc.queryForObject("select count(*) from submission_events where event_type='ACCEPTED'",Integer.class)).isEqualTo(1);
        }
    }
}

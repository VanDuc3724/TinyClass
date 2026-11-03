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
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties="tinyclass.auth.attempt-limit=1000")
@ActiveProfiles("test")
class StudentNoteTests {
    static final String TEACHER="notes-teacher@example.test",OTHER="notes-other@example.test",PARENT="notes-parent@example.test",UNVERIFIED="notes-unverified@example.test",PASSWORD="Synthetic-student-note-password-2026";
    static final byte[] PNG=Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGdoAAAAASUVORK5CYII=");
    @Autowired Environment env;@Autowired JdbcTemplate jdbc;@Autowired JsonMapper json;@Autowired UserAccountRepository users;@Autowired PasswordEncoder passwords;
    UUID teacherId,parentId;String child,second,classId;
    String today(){return LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).toString();}
    @BeforeEach void prepare()throws Exception {
        assertThat(jdbc.queryForObject("select current_database()",String.class)).isEqualTo("tinyclass_test");jdbc.execute("TRUNCATE users,audit_events CASCADE");
        teacherId=users.saveAndFlush(new UserAccount(TEACHER,passwords.encode(PASSWORD),"Notes teacher","TEACHER")).getId();users.saveAndFlush(new UserAccount(OTHER,passwords.encode(PASSWORD),"Other account","PARENT"));
        var parent=new UserAccount(PARENT,passwords.encode(PASSWORD),"Notes parent","PARENT");parent.verifyEmail();parentId=users.saveAndFlush(parent).getId();
        var unverified=users.saveAndFlush(new UserAccount(UNVERIFIED,passwords.encode(PASSWORD),"Unverified parent","PARENT"));
        try(var t=login(TEACHER)) {
            child=t.post("/students",Map.of("fullName","Bé nhận xét","internalNote","Private profile note")).data().path("id").stringValue();
            second=t.post("/students",Map.of("fullName","Bé khác")).data().path("id").stringValue();
            classId=t.post("/classes",Map.of("name","Lớp nhận xét","capacity",8)).data().path("id").stringValue();t.post("/classes/"+classId+"/activate",Map.of("version",0));
            assertThat(t.post("/classes/"+classId+"/enrollments",Map.of("studentId",child)).status()).isEqualTo(201);
            jdbc.update("update class_enrollments set joined_at=now()-interval '7 days' where student_id=?",UUID.fromString(child));
        }
        for(UUID parentUser:List.of(parentId,unverified.getId()))jdbc.update("insert into student_guardians(id,student_id,guardian_user_id,status,linked_at,created_at,updated_at) values(?,?,?,'ACTIVE',now(),now(),now())",UUID.randomUUID(),UUID.fromString(child),parentUser);
    }
    ApiBrowser browser(){return new ApiBrowser("http://127.0.0.1:"+env.getProperty("local.server.port"),json);}
    ApiBrowser login(String email)throws Exception{var b=browser();assertThat(b.post("/auth/login",Map.of("email",email,"password",PASSWORD)).status()).isEqualTo(200);return b;}
    Map<String,Object> input(String body,String visibility,List<String> files){var value=new LinkedHashMap<String,Object>();value.put("clientRequestId",UUID.randomUUID());value.put("title","Ghi nhận của cô");value.put("body",body);value.put("visibility",visibility);value.put("observedOn",today());value.put("fileIds",files);return value;}
    JsonNode create(ApiBrowser t,String body,String visibility,List<String> files)throws Exception{var r=t.post("/students/"+child+"/notes",input(body,visibility,files));assertThat(r.status()).as("note create: %s",r.body()).isEqualTo(201);return r.data();}
    String id(JsonNode note){return note.path("id").stringValue();}
    String path(JsonNode note){return "/student-notes/"+id(note);}
    String family(JsonNode note){return "/family/children/"+child+"/notes/"+id(note);}
    Map<String,Object> edit(JsonNode note,String body,String visibility){var value=new LinkedHashMap<String,Object>();value.put("version",note.path("version").longValue());value.put("title",note.path("title").stringValue());value.put("body",body);value.put("visibility",visibility);value.put("observedOn",note.path("observedOn").stringValue());value.put("classId",note.path("classId").isNull()?null:note.path("classId").stringValue());value.put("sessionId",note.path("sessionId").isNull()?null:note.path("sessionId").stringValue());var attached=new ArrayList<String>();for(var f:note.path("attachments"))attached.add(f.path("id").stringValue());value.put("fileIds",attached);value.put("reason","Cô điều chỉnh theo quan sát mới.");return value;}
    JsonNode update(ApiBrowser t,JsonNode note,String body,String visibility)throws Exception{var r=t.patch(path(note),edit(note,body,visibility));assertThat(r.status()).as("note update: %s",r.body()).isEqualTo(200);return r.data();}
    String upload(ApiBrowser t,String purpose)throws Exception{var r=t.multipart("/files","observation.png","image/png",PNG,Map.of("purpose",purpose),true);assertThat(r.status()).as("upload: %s",r.body()).isEqualTo(201);return r.data().path("id").stringValue();}
    String session(String classroom,long from,long to){UUID id=UUID.randomUUID();jdbc.update("insert into class_sessions(id,class_id,title,starts_at,ends_at) values(?,?,'Buổi ghi nhận',?,?)",id,UUID.fromString(classroom),Timestamp.from(Instant.now().plusSeconds(from)),Timestamp.from(Instant.now().plusSeconds(to)));return id.toString();}

    @Test void privateNotesNeverAppearInFamilyListsCountsDetailsOrFiles()throws Exception {
        try(var t=login(TEACHER);var p=login(PARENT)) {
            String file=upload(t,"NOTE_ASSET");var hidden=create(t,"Private observation must stay private","PRIVATE",List.of(file));
            var publicNote=create(t,"Con đã biết xếp khối.","SHARED",List.of());
            var list=p.get("/family/children/"+child+"/notes?size=1");assertThat(list.status()).isEqualTo(200);assertThat(list.body().path("meta").path("totalElements").intValue()).isEqualTo(1);assertThat(id(list.data().get(0))).isEqualTo(id(publicNote));
            assertThat(p.get(family(hidden)).status()).isEqualTo(404);assertThat(p.binaryGet(family(hidden)+"/files/"+file+"/content",Map.of()).statusCode()).isEqualTo(404);
            var feed=p.get("/family/children/"+child+"/progress");assertThat(feed.status()).isEqualTo(200);assertThat(feed.data().path("counts").path("sharedNotes").intValue()).isEqualTo(1);
            assertThat(feed.body().toString()).doesNotContain("Private observation","privateNotes","version","archivedAt","createHash","clientRequestId","Private profile note",file);
        }
    }
    @Test void sharedAttachmentsRequireTheCurrentExactChildNoteAndSupportRange()throws Exception {
        try(var t=login(TEACHER);var p=login(PARENT)) {
            String file=upload(t,"NOTE_ASSET");var note=create(t,"Con cầm bút tiến bộ.","SHARED",List.of(file));String url=family(note)+"/files/"+file;
            var ranged=p.binaryGet(url+"/content",Map.of("Range","bytes=0-7"));assertThat(ranged.statusCode()).isEqualTo(206);assertThat(ranged.body()).hasSize(8);assertThat(ranged.headers().firstValue("cache-control").orElse("")).contains("no-store");
            var download=p.binaryGet(url+"/download",Map.of());assertThat(download.statusCode()).isEqualTo(200);assertThat(download.headers().firstValue("content-disposition").orElse("")).contains("attachment");
            assertThat(p.binaryGet("/files/"+file+"/content",Map.of()).statusCode()).isEqualTo(403);
            assertThat(p.binaryGet("/family/children/"+second+"/notes/"+id(note)+"/files/"+file+"/content",Map.of()).statusCode()).isEqualTo(404);
            assertThat(p.binaryGet(family(note)+"/files/"+UUID.randomUUID()+"/content",Map.of()).statusCode()).isEqualTo(404);
            assertThat(t.binaryGet(path(note)+"/files/"+file+"/content",Map.of()).statusCode()).isEqualTo(200);
        }
    }
    @Test void switchingToPrivateAndBackDoesNotExposePrivateVersionsOrOldFileLinks()throws Exception {
        try(var t=login(TEACHER);var p=login(PARENT)) {
            String file=upload(t,"NOTE_ASSET");var original=create(t,"Shared first version","SHARED",List.of(file));String url=family(original)+"/files/"+file+"/content";
            var hidden=update(t,original,"Private correction not for family","PRIVATE");assertThat(hidden.path("sharedAt").isNull()).isTrue();assertThat(p.get(family(hidden)).status()).isEqualTo(404);assertThat(p.binaryGet(url,Map.of()).statusCode()).isEqualTo(404);
            var shared=update(t,hidden,"Safe current shared version","SHARED");assertThat(shared.path("sharedAt").isNull()).isFalse();assertThat(p.get(family(shared)).data().path("body").stringValue()).isEqualTo("Safe current shared version");
            assertThat(p.get("/family/children/"+child+"/progress").body().toString()).doesNotContain("Private correction","changedFields","reason");
            assertThat(p.get(path(shared)+"/history").status()).isEqualTo(403);assertThat(t.get(path(shared)+"/history").data().size()).isEqualTo(3);
            assertThat(t.get(path(shared)+"/history").body().toString()).contains("Private correction","STUDENT_NOTE_UPDATED");
        }
    }
    @Test void archiveRestoreAndRemovingAttachmentsImmediatelyRecheckFamilyAccess()throws Exception {
        try(var t=login(TEACHER);var p=login(PARENT)) {
            String file=upload(t,"NOTE_ASSET");var note=create(t,"Shared archived observation","SHARED",List.of(file));String url=family(note)+"/files/"+file+"/content";
            var archived=t.post(path(note)+"/archive",Map.of("version",0,"reason","Cô cần kiểm tra lại."));assertThat(archived.status()).isEqualTo(200);
            assertThat(p.get(family(note)).status()).isEqualTo(404);assertThat(p.binaryGet(url,Map.of()).statusCode()).isEqualTo(404);assertThat(t.patch(path(note),edit(archived.data(),"Cannot edit archived","SHARED")).status()).isEqualTo(409);
            assertThat(t.get("/students/"+child+"/notes").data().size()).isZero();assertThat(t.get("/students/"+child+"/notes?archived=true").data().size()).isEqualTo(1);
            var restored=t.post(path(note)+"/restore",Map.of("version",1,"reason","Cô đã kiểm tra xong."));assertThat(restored.status()).isEqualTo(200);assertThat(p.binaryGet(url,Map.of()).statusCode()).isEqualTo(200);
            var input=edit(restored.data(),"Shared without attachment","SHARED");input.put("fileIds",List.of());var changed=t.patch(path(note),input);assertThat(changed.status()).isEqualTo(200);assertThat(p.binaryGet(url,Map.of()).statusCode()).isEqualTo(404);
            var other=t.post("/students/"+second+"/notes",input("Do not reuse removed private file","SHARED",List.of(file)));assertThat(other.status()).isEqualTo(409);
            assertThat(t.get(path(note)+"/history").data().size()).isEqualTo(4);
        }
    }
    @Test void creatingAgainUsesTheOriginalRequestAndRejectsDifferentPayloads()throws Exception {
        try(var t=login(TEACHER)) {
            var request=input("Only one saved note","PRIVATE",List.of());var a=t.post("/students/"+child+"/notes",request);var b=t.post("/students/"+child+"/notes",request);
            assertThat(a.status()).isEqualTo(201);assertThat(b.status()).isEqualTo(201);assertThat(id(a.data())).isEqualTo(id(b.data()));assertThat(t.get(path(a.data())+"/history").data().size()).isEqualTo(1);
            request.put("body","Different content with same request id");assertThat(t.post("/students/"+child+"/notes",request).status()).isEqualTo(409);
            assertThat(t.get("/students/"+child+"/notes").data().size()).isEqualTo(1);
        }
    }
    @Test void invalidFilesAndStaleVersionsNeverPartiallyUpdateOrBindAnotherFile()throws Exception {
        try(var t=login(TEACHER)) {
            String asset=upload(t,"NOTE_ASSET"),lesson=upload(t,"LESSON_ASSET"),foreign=upload(t,"NOTE_ASSET");
            jdbc.update("update files set uploaded_by=? where id=?",parentId,UUID.fromString(foreign));
            var note=create(t,"Original private body","PRIVATE",List.of());
            var body=edit(note,"Must not be saved","SHARED");body.put("fileIds",List.of(asset,foreign));assertThat(t.patch(path(note),body).status()).isEqualTo(404);
            assertThat(t.get(path(note)).data().path("body").stringValue()).isEqualTo("Original private body");assertThat(jdbc.queryForObject("select context_student_note_id is null from files where id=?",Boolean.class,UUID.fromString(asset))).isTrue();
            body.put("fileIds",List.of(lesson));assertThat(t.patch(path(note),body).status()).isEqualTo(400);
            body.put("fileIds",List.of(asset,asset));assertThat(t.patch(path(note),body).status()).isEqualTo(400);
            var changed=update(t,note,"Legitimate current version","PRIVATE");assertThat(t.patch(path(note),edit(note,"Stale edit","SHARED")).status()).isEqualTo(409);
            assertThat(changed.path("version").longValue()).isEqualTo(1);assertThat(t.get(path(note)+"/history").data().size()).isEqualTo(2);
        }
    }
    @Test void classroomSessionAndObservedDatesMustMatchThisChildAndTeacher()throws Exception {
        try(var t=login(TEACHER);var other=login(OTHER)) {
            String s=session(classId,-300,-60);var body=input("Correct session context","SHARED",List.of());body.put("classId",classId);body.put("sessionId",s);
            var good=t.post("/students/"+child+"/notes",body);assertThat(good.status()).isEqualTo(201);assertThat(good.data().path("sessionId").stringValue()).isEqualTo(s);
            body.put("clientRequestId",UUID.randomUUID());body.remove("classId");assertThat(t.post("/students/"+child+"/notes",body).status()).isEqualTo(400);
            body.put("classId",classId);assertThat(t.post("/students/"+second+"/notes",body).status()).isEqualTo(404);
            body.put("sessionId",session(classId,300,600));assertThat(t.post("/students/"+child+"/notes",body).status()).isEqualTo(400);
            body.remove("sessionId");body.put("observedOn",LocalDate.parse(today()).minusDays(8).toString());assertThat(t.post("/students/"+child+"/notes",body).status()).isEqualTo(400);
            body.remove("classId");body.put("observedOn",LocalDate.parse(today()).plusDays(1).toString());assertThat(t.post("/students/"+child+"/notes",body).status()).isEqualTo(400);
            assertThat(other.get("/students/"+child+"/note-contexts?on="+today()).status()).isEqualTo(403);
            assertThat(t.get("/students/"+UUID.randomUUID()+"/note-contexts?on="+today()).status()).isEqualTo(404);
            assertThat(t.get("/students/"+child+"/note-contexts?on="+today()+"&classId="+classId).data().path("sessions").size()).isEqualTo(1);
        }
    }
    @Test void withdrawalAndArchivedProfilesKeepSharedHistoryButRevocationEndsIt()throws Exception {
        try(var t=login(TEACHER);var p=login(PARENT)) {
            String file=upload(t,"NOTE_ASSET");var note=create(t,"Shared historical observation","SHARED",List.of(file));String url=family(note)+"/files/"+file+"/content";
            String enrollment=jdbc.queryForObject("select id::text from class_enrollments where student_id=?",String.class,UUID.fromString(child));
            assertThat(t.patch("/enrollments/"+enrollment,Map.of("version",0,"status","WITHDRAWN","reason","Gia đình dừng lớp.")).status()).isEqualTo(200);
            assertThat(t.post("/students/"+child+"/archive",Map.of("version",0,"reason","Lưu hồ sơ cũ.")).status()).isEqualTo(200);
            assertThat(p.get(family(note)).status()).isEqualTo(200);assertThat(p.binaryGet(url,Map.of()).statusCode()).isEqualTo(200);assertThat(t.post("/students/"+child+"/notes",input("No new archived observation","PRIVATE",List.of())).status()).isEqualTo(409);
            String link=jdbc.queryForObject("select id::text from student_guardians where student_id=? and guardian_user_id=?",String.class,UUID.fromString(child),parentId);
            assertThat(t.post("/student-guardians/"+link+"/revoke",Map.of("version",0,"reason","Thu hồi liên kết cũ.")).status()).isEqualTo(200);
            assertThat(p.get(family(note)).status()).isEqualTo(404);assertThat(p.get("/family/children/"+child+"/progress").status()).isEqualTo(404);assertThat(p.binaryGet(url,Map.of()).statusCode()).isEqualTo(404);
        }
    }
    @Test void rolesOwnershipCsrfUnverifiedAccountsAndValidationAreEnforced()throws Exception {
        try(var t=login(TEACHER);var p=login(PARENT);var other=login(OTHER);var unverified=login(UNVERIFIED)) {
            var note=create(t,"Private guarded note","PRIVATE",List.of());assertThat(p.get(path(note)).status()).isEqualTo(403);assertThat(other.get(path(note)).status()).isEqualTo(403);
            assertThat(other.patch(path(note),edit(note,"Foreign edit","SHARED")).status()).isEqualTo(403);assertThat(t.get("/student-notes/"+UUID.randomUUID()).status()).isEqualTo(404);assertThat(p.post("/students/"+child+"/notes",input("Wrong role","SHARED",List.of())).status()).isEqualTo(403);
            assertThat(t.write("PATCH",path(note),edit(note,"Without CSRF","SHARED"),false).status()).isEqualTo(403);
            assertThat(unverified.get("/family/children/"+child+"/notes").status()).isEqualTo(403);assertThat(unverified.get("/family/children/"+child+"/progress").status()).isEqualTo(403);
            var empty=edit(note," ","PRIVATE");assertThat(t.patch(path(note),empty).status()).isEqualTo(400);empty=edit(note,"Valid body","PRIVATE");empty.put("reason"," ");assertThat(t.patch(path(note),empty).status()).isEqualTo(400);
            assertThat(t.post("/students/"+child+"/notes",input("x".repeat(10001),"PRIVATE",List.of())).status()).isEqualTo(400);
            assertThat(t.get("/students/"+child+"/progress?type=WRONG").status()).isEqualTo(400);assertThat(t.get("/students/"+child+"/notes?page=-1").status()).isEqualTo(400);assertThat(p.get("/family/children/"+child+"/progress?size=101").status()).isEqualTo(400);
        }
    }
    @Test void concurrentCreatesAndEditsCannotDuplicateOrOverwriteNotes()throws Exception {
        try(var t=login(TEACHER);var a=login(TEACHER);var b=login(TEACHER);var pool=Executors.newFixedThreadPool(2)) {
            var request=input("Concurrent initial note","PRIVATE",List.of());var gate=new CountDownLatch(1);
            var one=pool.submit(()->{gate.await();return a.post("/students/"+child+"/notes",request);});var two=pool.submit(()->{gate.await();return b.post("/students/"+child+"/notes",request);});gate.countDown();
            var first=one.get(15,TimeUnit.SECONDS);var second=two.get(15,TimeUnit.SECONDS);assertThat(first.status()).isEqualTo(201);assertThat(second.status()).isEqualTo(201);assertThat(id(first.data())).isEqualTo(id(second.data()));
            var edits=new CountDownLatch(1);var x=pool.submit(()->{edits.await();return a.patch(path(first.data()),edit(first.data(),"First concurrent edit","SHARED")).status();});var y=pool.submit(()->{edits.await();return b.patch(path(first.data()),edit(first.data(),"Second concurrent edit","PRIVATE")).status();});edits.countDown();
            assertThat(List.of(x.get(15,TimeUnit.SECONDS),y.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);assertThat(t.get(path(first.data())+"/history").data().size()).isEqualTo(2);
        }
    }
    @Test void aFileCannotBeAttachedToAnotherNoteOrStudentEvenAfterPrivateArchive()throws Exception {
        try(var t=login(TEACHER)) {
            String file=upload(t,"NOTE_ASSET");var note=create(t,"Private observation with bound file","PRIVATE",List.of(file));
            assertThat(t.post("/students/"+child+"/notes",input("Accidental shared duplicate","SHARED",List.of(file))).status()).isEqualTo(409);
            assertThat(t.post(path(note)+"/archive",Map.of("version",0,"reason","Keep private history.")).status()).isEqualTo(200);
            assertThat(t.post("/students/"+second+"/notes",input("Other child must use new copy","SHARED",List.of(file))).status()).isEqualTo(409);
            assertThat(jdbc.queryForObject("select count(*) from student_notes",Integer.class)).isEqualTo(1);
        }
    }
    @Test void progressCombinesSharedNotesAndSentProductsWithStablePagingButNeverDrafts()throws Exception {
        try(var t=login(TEACHER);var p=login(PARENT)) {
            create(t,"Private progress observation","PRIVATE",List.of());create(t,"Shared today observation","SHARED",List.of());var earlier=input("Shared earlier observation","SHARED",List.of());earlier.put("observedOn",LocalDate.parse(today()).minusDays(1).toString());assertThat(t.post("/students/"+child+"/notes",earlier).status()).isEqualTo(201);
            String lesson=t.post("/lessons",Map.of("title","Progress product lesson","defaultCompletionMode","TEACHER_REVIEW","defaultResponseTypes",List.of("TEXT"),"topicIds",List.of(),"blocks",List.of(Map.of("type","TEXT","textContent","Synthetic activity")))).data().path("id").stringValue();assertThat(t.post("/lessons/"+lesson+"/publish",Map.of("version",0)).status()).isEqualTo(200);
            var assignment=t.post("/assignments",Map.of("title","Progress product assignment","sourceType","LESSON","lessonId",lesson,"targetType","STUDENT","studentId",child,"availableAt",Instant.now().minusSeconds(60).toString(),"clientRequestId",UUID.randomUUID()));assertThat(assignment.status()).isEqualTo(201);String assignmentId=id(assignment.data()),item=assignment.data().path("items").get(0).path("id").stringValue();t.post("/assignments/"+assignmentId+"/publish",Map.of("version",0));
            String itemPath="/family/children/"+child+"/assignment-items/"+item+"/submissions";var draft=p.post(itemPath,Map.of()).data();var saved=p.patch("/submissions/"+id(draft),Map.of("version",0,"textResponse","Sent product for progress","fileIds",List.of())).data();var sent=p.post("/submissions/"+id(draft)+"/submit",Map.of("version",saved.path("version").longValue())).data();
            var accepted=t.post("/submissions/"+id(draft)+"/review",Map.of("version",sent.path("version").longValue(),"outcome","ACCEPTED","feedbackText","Con thực hiện tốt."));assertThat(accepted.status()).isEqualTo(200);
            assertThat(t.post("/assignment-items/"+item+"/students/"+child+"/reopen",Map.of("version",accepted.data().path("progress").path("version").longValue(),"reason","Thử lượt mới.")).status()).isEqualTo(200);
            var privateDraft=p.post(itemPath,Map.of()).data();assertThat(p.patch("/submissions/"+id(privateDraft),Map.of("version",0,"textResponse","Unsent family draft must not appear","fileIds",List.of())).status()).isEqualTo(200);
            var feed=p.get("/family/children/"+child+"/progress?size=1");assertThat(feed.status()).isEqualTo(200);assertThat(feed.data().path("timeline").path("meta").path("totalElements").intValue()).isEqualTo(3);assertThat(feed.data().path("timeline").path("data").get(0).path("type").stringValue()).isEqualTo("SUBMISSION");assertThat(feed.data().path("counts").path("acceptedProducts").intValue()).isEqualTo(1);
            var next=p.get("/family/children/"+child+"/progress?size=1&page=1");assertThat(next.data().path("timeline").path("data").get(0).path("type").stringValue()).isEqualTo("NOTE");
            assertThat(p.get("/family/children/"+child+"/progress").body().toString()).doesNotContain("Unsent family draft","Private progress","version","privateNotes");
            assertThat(p.get("/family/children/"+child+"/progress?type=NOTE").data().path("timeline").path("meta").path("totalElements").intValue()).isEqualTo(2);
            assertThat(t.get("/students/"+child+"/progress").data().path("timeline").path("meta").path("totalElements").intValue()).isEqualTo(4);
        }
    }
}

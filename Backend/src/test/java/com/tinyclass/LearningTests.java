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
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties="tinyclass.auth.attempt-limit=1000") @ActiveProfiles("test")
class LearningTests {
    static final String TEACHER="learning-teacher@example.test",PARENT="learning-parent@example.test",PASSWORD="Synthetic-learning-password-2026";
    @Autowired Environment env; @Autowired JdbcTemplate jdbc; @Autowired JsonMapper json;
    @Autowired UserAccountRepository users; @Autowired PasswordEncoder passwords;
    UUID parentId;
    @BeforeEach void prepare() {
        assertThat(jdbc.queryForObject("select current_database()",String.class)).isEqualTo("tinyclass_test"); jdbc.execute("TRUNCATE users,audit_events CASCADE");
        users.saveAndFlush(new UserAccount(TEACHER,passwords.encode(PASSWORD),"Learning teacher","TEACHER"));
        var parent=new UserAccount(PARENT,passwords.encode(PASSWORD),"Learning parent","PARENT"); parent.verifyEmail(); parentId=users.saveAndFlush(parent).getId();
    }
    ApiBrowser browser() { return new ApiBrowser("http://127.0.0.1:"+env.getProperty("local.server.port"),json); }
    ApiBrowser login(String email) throws Exception { var b=browser(); assertThat(b.post("/auth/login",Map.of("email",email,"password",PASSWORD)).status()).isEqualTo(200); return b; }
    Map<String,Object> lessonBody(String title) { var body=new LinkedHashMap<String,Object>(); body.put("title",title); body.put("defaultCompletionMode","PARENT_CONFIRM"); body.put("defaultResponseTypes",List.of("TEXT","IMAGE")); body.put("topicIds",List.of()); body.put("blocks",List.of(Map.of("type","TEXT","textContent","Synthetic lesson content"))); return body; }
    String lesson(ApiBrowser t,String title) throws Exception { var r=t.post("/lessons",lessonBody(title)); assertThat(r.status()).isEqualTo(201); String id=r.data().path("id").stringValue(); assertThat(t.post("/lessons/"+id+"/publish",Map.of("version",0)).status()).isEqualTo(200); return id; }
    String child(ApiBrowser t,String title) throws Exception { var r=t.post("/students",Map.of("fullName",title,"internalNote","Private teacher note")); assertThat(r.status()).isEqualTo(201); String id=r.data().path("id").stringValue(); jdbc.update("insert into student_guardians(id,student_id,guardian_user_id,status,linked_at,created_at,updated_at) values(?,?,?,'ACTIVE',now(),now(),now())",UUID.randomUUID(),UUID.fromString(id),parentId); return id; }
    String classroom(ApiBrowser t,String child) throws Exception { var c=t.post("/classes",Map.of("name","Learning class","capacity",10)).data().path("id").stringValue(); assertThat(t.post("/classes/"+c+"/activate",Map.of("version",0)).status()).isEqualTo(200); assertThat(t.post("/classes/"+c+"/enrollments",Map.of("studentId",child)).status()).isEqualTo(201); return c; }
    Map<String,Object> assignmentBody(String source,String id,String target,String targetId,Instant available) {
        var body=new LinkedHashMap<String,Object>(); body.put("title","Cùng con khám phá"); body.put("sourceType",source); body.put(source.equals("LESSON")?"lessonId":"courseId",id); body.put("targetType",target); body.put(target.equals("CLASS")?"classId":"studentId",targetId); body.put("availableAt",available.toString()); body.put("clientRequestId",UUID.randomUUID().toString()); return body;
    }
    JsonNode assignment(ApiBrowser t,String lesson,String child,boolean publish) throws Exception { var r=t.post("/assignments",assignmentBody("LESSON",lesson,"STUDENT",child,Instant.now().minusSeconds(10))); assertThat(r.status()).isEqualTo(201); if(!publish) return r.data(); var published=t.post("/assignments/"+r.data().path("id").stringValue()+"/publish",Map.of("version",0)); assertThat(published.status()).isEqualTo(200); return published.data(); }
    String familyItem(String child,String item) { return "/family/children/"+child+"/assignment-items/"+item; }
    @Test void dashboardCountsDistinctEnrolledChildrenAndRespectsClassScopeAndRoles() throws Exception {
        try(var t=login(TEACHER);var p=login(PARENT);var anonymous=browser()) {
            String child=child(t,"Child in two classes"); child(t,"Profile without enrollment");
            String first=classroom(t,child),second=classroom(t,child),l=lesson(t,"Shared lesson");
            for(int i=0;i<2;i++) {
                var a=t.post("/assignments",assignmentBody("LESSON",l,"CLASS",first,Instant.now().minusSeconds(1))).data();
                assertThat(t.post("/assignments/"+a.path("id").stringValue()+"/publish",Map.of("version",0)).status()).isEqualTo(200);
            }
            var all=t.get("/dashboard"); assertThat(all.status()).isEqualTo(200);
            assertThat(all.data().path("students").intValue()).isEqualTo(1);
            assertThat(all.data().path("activeClasses").intValue()).isEqualTo(2);
            assertThat(all.data().path("publishedAssignments").intValue()).isEqualTo(2);
            var scoped=t.get("/dashboard?classId="+first).data();
            assertThat(scoped.path("students").intValue()).isEqualTo(1);
            assertThat(scoped.path("activeClasses").intValue()).isEqualTo(1);
            assertThat(scoped.path("publishedLessons").intValue()).isEqualTo(1);
            var other=t.get("/dashboard?classId="+second).data();
            assertThat(other.path("publishedAssignments").intValue()).isZero();
            assertThat(other.path("publishedLessons").intValue()).isZero();
            assertThat(other.path("activity").size()).isZero();
            assertThat(t.get("/dashboard?classId="+UUID.randomUUID()).status()).isEqualTo(404);
            assertThat(t.get("/dashboard?classId=invalid").status()).isEqualTo(400);
            assertThat(p.get("/dashboard").status()).isEqualTo(403);
            assertThat(anonymous.get("/dashboard").status()).isEqualTo(401);
        }
    }
    @Test void dashboardTodayUsesVietnamBusinessDayBoundaries() throws Exception {
        try(var t=login(TEACHER)) {
            String l=lesson(t,"Today lesson"),child=child(t,"Today child");
            var a=assignment(t,l,child,true);
            var zone=java.time.ZoneId.of("Asia/Ho_Chi_Minh");
            var start=java.time.LocalDate.now(zone).atStartOfDay(zone).toInstant();
            jdbc.update("update assignments set published_at=? where id=?",java.sql.Timestamp.from(start.minusSeconds(1)),UUID.fromString(a.path("id").stringValue()));
            jdbc.update("update lessons set published_at=? where id=?",java.sql.Timestamp.from(start),UUID.fromString(l));
            var data=t.get("/dashboard").data();
            assertThat(data.path("businessDate").stringValue()).isEqualTo(java.time.LocalDate.now(zone).toString());
            assertThat(data.path("activity").size()).isEqualTo(1);
            assertThat(data.path("activity").get(0).path("type").stringValue()).isEqualTo("LESSON");
        }
    }
    @Test void libraryEnforcesPublishPayloadsVersionsSharedUpdatesAndCourseRules() throws Exception {
        try(var t=login(TEACHER);var p=login(PARENT)) {
            var topic=t.post("/topics",Map.of("name","Màu sắc")); assertThat(topic.status()).isEqualTo(201);
            assertThat(t.post("/topics",Map.of("name","MÀU SẮC")).status()).isEqualTo(409);
            var empty=lessonBody("Empty draft"); empty.put("blocks",List.of());
            String draft=t.post("/lessons",empty).data().path("id").stringValue(); assertThat(t.post("/lessons/"+draft+"/publish",Map.of("version",0)).status()).isEqualTo(409);
            String published=lesson(t,"Original published lesson"); var edit=lessonBody("Changed shared lesson"); edit.put("version",1);
            assertThat(t.write("PUT","/lessons/"+published,edit,true).status()).isEqualTo(409); edit.put("acknowledgeSharedUpdate",true);
            assertThat(t.write("PUT","/lessons/"+published,edit,true).status()).isEqualTo(200);
            assertThat(t.write("PUT","/lessons/"+published,edit,true).body().path("code").stringValue()).isEqualTo("VERSION_CONFLICT");
            var course=Map.of("title","Course draft","lessons",List.of()); String c=t.post("/courses",course).data().path("id").stringValue();
            assertThat(t.post("/courses/"+c+"/publish",Map.of("version",0)).status()).isEqualTo(409);
            assertThat(t.post("/courses",Map.of("title","Duplicate","lessons",List.of(Map.of("lessonId",published,"isRequired",true),Map.of("lessonId",published,"isRequired",false)))).status()).isEqualTo(400);
            assertThat(t.post("/courses",Map.of("title","Invalid ages","minAgeMonths",60,"maxAgeMonths",30,"lessons",List.of())).status()).isEqualTo(400);
            assertThat(p.get("/lessons").status()).isEqualTo(403); assertThat(p.get("/topics").status()).isEqualTo(403);
        }
    }
    @Test void draftPublishRetriesFamilyOpenAndConfirmHaveSeparateEffects() throws Exception {
        try(var t=login(TEACHER);var p=login(PARENT)) {
            String l=lesson(t,"Published activity"),child=child(t,"Invited child"); var body=assignmentBody("LESSON",l,"STUDENT",child,Instant.now().minusSeconds(10));
            var created=t.post("/assignments",body); assertThat(created.status()).isEqualTo(201); String a=created.data().path("id").stringValue(),item=created.data().path("items").get(0).path("id").stringValue();
            assertThat(t.post("/assignments",body).data().path("id").stringValue()).isEqualTo(a);
            body.put("title","Changed request"); assertThat(t.post("/assignments",body).status()).isEqualTo(409);
            assertThat(p.get("/family/children/"+child+"/assignments").data().size()).isZero();
            assertThat(p.get(familyItem(child,item)).status()).isEqualTo(404);
            assertThat(t.post("/assignments/"+a+"/publish",Map.of("version",0)).status()).isEqualTo(200);
            assertThat(t.post("/assignments/"+a+"/publish",Map.of("version",0)).status()).isEqualTo(200);
            assertThat(jdbc.queryForObject("select count(*) from assignment_recipients where assignment_id=?",Integer.class,UUID.fromString(a))).isEqualTo(1);
            assertThat(p.get(familyItem(child,item)).body().toString()).doesNotContain("teacherId","Private teacher note","requestHash");
            assertThat(p.post(familyItem(child,item)+"/open",Map.of()).data().path("progress").path("status").stringValue()).isEqualTo("OPENED");
            assertThat(p.get("/family/children/"+child+"/assignments/"+a).data().path("completionPercent").intValue()).isZero();
            assertThat(p.post(familyItem(child,item)+"/confirm",Map.of()).data().path("progress").path("status").stringValue()).isEqualTo("COMPLETED");
            assertThat(p.post(familyItem(child,item)+"/confirm",Map.of()).status()).isEqualTo(200);
            assertThat(p.get("/family/children/"+child+"/assignments/"+a).data().path("completionPercent").intValue()).isEqualTo(100);
            assertThat(jdbc.queryForObject("select count(*) from student_progress",Integer.class)).isEqualTo(1);
        }
    }
    @Test void futureAndWrongChildCannotReadLessonOrFileEvenWithDownloadAllowed() throws Exception {
        try(var t=login(TEACHER);var p=login(PARENT)) {
            byte[] png=Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6sy8AAAAASUVORK5CYII=");
            var f=t.multipart("/files","learning.png","image/png",png,Map.of("learnerDownloadAllowed","true"),true); assertThat(f.status()).isEqualTo(201); String file=f.data().path("id").stringValue();
            var lessonBody=lessonBody("Secret future title"); lessonBody.put("blocks",List.of(Map.of("type","IMAGE","fileId",file)));
            var l=t.post("/lessons",lessonBody).data().path("id").stringValue(); t.post("/lessons/"+l+"/publish",Map.of("version",0));
            String child=child(t,"Child A"),wrong=child(t,"Child B");
            var a=t.post("/assignments",assignmentBody("LESSON",l,"STUDENT",child,Instant.now().plusSeconds(3600))).data();
            String assignment=a.path("id").stringValue(),item=a.path("items").get(0).path("id").stringValue(); t.post("/assignments/"+assignment+"/publish",Map.of("version",0));
            var future=p.get("/family/children/"+child+"/assignments/"+assignment); assertThat(future.status()).isEqualTo(200);
            assertThat(future.data().path("locked").booleanValue()).isTrue(); assertThat(future.data().path("items").size()).isZero(); assertThat(future.body().toString()).doesNotContain("Secret future title",file);
            assertThat(p.get(familyItem(child,item)).status()).isEqualTo(403);
            assertThat(p.binaryGet(familyItem(child,item)+"/files/"+file+"/download",Map.of()).statusCode()).isEqualTo(403);
            assertThat(p.get(familyItem(wrong,item)).status()).isEqualTo(404);
        }
    }
    @Test void currentFilePolicyAndWithdrawalAreEnforcedOnEveryByteRequest() throws Exception {
        try(var t=login(TEACHER);var p=login(PARENT)) {
            byte[] pdf="%PDF-1.4\nSynthetic PDF\n%%EOF".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            String file=t.multipart("/files","sample.pdf","application/pdf",pdf,Map.of(),true).data().path("id").stringValue();
            var content=lessonBody("File lesson"); content.put("blocks",List.of(Map.of("type","PDF","fileId",file)));
            String l=t.post("/lessons",content).data().path("id").stringValue(); t.post("/lessons/"+l+"/publish",Map.of("version",0));
            String child=child(t,"Class child"),c=classroom(t,child);
            var created=t.post("/assignments",assignmentBody("LESSON",l,"CLASS",c,Instant.now().minusSeconds(1))).data(); String a=created.path("id").stringValue(),item=created.path("items").get(0).path("id").stringValue(); t.post("/assignments/"+a+"/publish",Map.of("version",0));
            String path=familyItem(child,item)+"/files/"+file;
            assertThat(p.binaryGet(path+"/content",Map.of("Range","bytes=0-3")).statusCode()).isEqualTo(206);
            assertThat(p.binaryGet(path+"/download",Map.of()).statusCode()).isEqualTo(403);
            long fv=t.get("/files/"+file).data().path("version").longValue(); t.patch("/files/"+file+"/policy",Map.of("version",fv,"learnerDownloadAllowed",true));
            assertThat(p.binaryGet(path+"/download",Map.of()).statusCode()).isEqualTo(200);
            var direct=assignment(t,l,child,true); String directItem=direct.path("items").get(0).path("id").stringValue();
            var enrollment=t.get("/classes/"+c+"/enrollments").data().get(0); String enrollmentId=enrollment.path("id").stringValue();
            assertThat(t.patch("/enrollments/"+enrollmentId,Map.of("version",enrollment.path("version").longValue(),"status","WITHDRAWN","reason","Test withdrawal")).status()).isEqualTo(200);
            assertThat(p.binaryGet(path+"/content",Map.of()).statusCode()).isEqualTo(404);
            assertThat(p.get(familyItem(child,directItem)).status()).isEqualTo(200);
            var withdrawn=t.get("/classes/"+c+"/enrollments").data().get(0);
            t.patch("/enrollments/"+enrollmentId,Map.of("version",withdrawn.path("version").longValue(),"status","ACTIVE","reason","Return"));
            assertThat(p.get(familyItem(child,item)).status()).isEqualTo(404);
            var published=t.get("/assignments/"+a).data(); assertThat(t.post("/assignments/"+a+"/recipients",Map.of("version",published.path("version").longValue(),"studentIds",List.of(child),"reason","Explicitly share old assignment")).status()).isEqualTo(200);
            assertThat(p.get(familyItem(child,item)).status()).isEqualTo(200);
        }
    }
    @Test void courseSnapshotsAndRepeatedLessonsHaveIndependentProgress() throws Exception {
        try(var t=login(TEACHER);var p=login(PARENT)) {
            String l=lesson(t,"First"),l2=lesson(t,"Second"),child=child(t,"Child");
            var course=t.post("/courses",Map.of("title","Course","lessons",List.of(Map.of("lessonId",l,"isRequired",true)))).data(); String c=course.path("id").stringValue(); t.post("/courses/"+c+"/publish",Map.of("version",0));
            var a=t.post("/assignments",assignmentBody("COURSE",c,"STUDENT",child,Instant.now().minusSeconds(1))).data();
            assertThat(t.write("PUT","/courses/"+c,Map.of("title","Updated course","lessons",List.of(Map.of("lessonId",l,"isRequired",true),Map.of("lessonId",l2,"isRequired",true)),"version",1,"acknowledgeSharedUpdate",true),true).status()).isEqualTo(200);
            assertThat(t.get("/assignments/"+a.path("id").stringValue()).data().path("items").size()).isEqualTo(1);
            t.post("/assignments/"+a.path("id").stringValue()+"/publish",Map.of("version",0));
            String item=a.path("items").get(0).path("id").stringValue(); p.post(familyItem(child,item)+"/confirm",Map.of());
            var fresh=assignment(t,l,child,true); String freshItem=fresh.path("items").get(0).path("id").stringValue();
            assertThat(p.get(familyItem(child,freshItem)).data().path("progress").isNull()).isTrue();
            var reference=assignment(t,l2,child,false); String refId=reference.path("id").stringValue();
            var changed=t.write("PUT","/assignments/"+refId,Map.of("version",0,"title","Reference only","availableAt",Instant.now().minusSeconds(1).toString(),"items",List.of(Map.of("id",reference.path("items").get(0).path("id").stringValue(),"completionMode","REFERENCE","isRequired",false,"allowedResponseTypes",List.of()))),true); assertThat(changed.status()).isEqualTo(200);
            t.post("/assignments/"+refId+"/publish",Map.of("version",1));
            assertThat(p.get("/family/children/"+child+"/assignments/"+refId).data().path("completionPercent").isNull()).isTrue();
        }
    }
    @Test void progressSummariesStayScopedAcrossAssignmentsRecipientsAndOptionalItems() throws Exception {
        try(var t=login(TEACHER);var p=login(PARENT)) {
            String first=child(t,"First progress child"),second=child(t,"Second progress child"),c=classroom(t,first);
            assertThat(t.post("/classes/"+c+"/enrollments",Map.of("studentId",second)).status()).isEqualTo(201);
            String required=lesson(t,"Required one"),requiredTwo=lesson(t,"Required two"),optional=lesson(t,"Optional activity");
            var referenceBody=lessonBody("Reference activity");referenceBody.put("defaultCompletionMode","REFERENCE");
            String reference=t.post("/lessons",referenceBody).data().path("id").stringValue();
            assertThat(t.post("/lessons/"+reference+"/publish",Map.of("version",0)).status()).isEqualTo(200);
            var course=t.post("/courses",Map.of("title","Mixed requirements","lessons",List.of(
                    Map.of("lessonId",required,"isRequired",true),Map.of("lessonId",requiredTwo,"isRequired",true),
                    Map.of("lessonId",optional,"isRequired",false),Map.of("lessonId",reference,"isRequired",false))));
            assertThat(course.status()).isEqualTo(201);String courseId=course.data().path("id").stringValue();
            assertThat(t.post("/courses/"+courseId+"/publish",Map.of("version",0)).status()).isEqualTo(200);
            var draft=t.post("/assignments",assignmentBody("COURSE",courseId,"CLASS",c,Instant.now().minusSeconds(1)));
            assertThat(draft.status()).isEqualTo(201);String shared=draft.data().path("id").stringValue();
            var published=t.post("/assignments/"+shared+"/publish",Map.of("version",0));assertThat(published.status()).isEqualTo(200);
            for(var recipient:published.data().path("recipients"))assertProgress(recipient,2,0,0);
            var items=published.data().path("items");
            for(int i=0;i<3;i++)assertThat(p.post(familyItem(second,items.get(i).path("id").stringValue())+"/confirm",Map.of()).status()).isEqualTo(200);
            for(int i:List.of(0,2))assertThat(p.post(familyItem(first,items.get(i).path("id").stringValue())+"/confirm",Map.of()).status()).isEqualTo(200);
            String repeated=assignment(t,required,first,true).path("id").stringValue();
            String referenceOnly=assignment(t,reference,first,true).path("id").stringValue();
            String otherAssignment=assignment(t,required,second,true).path("id").stringValue();

            var listed=p.get("/family/children/"+first+"/assignments");assertThat(listed.status()).isEqualTo(200);
            assertThat(listed.data().size()).isEqualTo(3);assertThat(listed.body().toString()).doesNotContain(otherAssignment,second);
            var byAssignment=new HashMap<String,JsonNode>();for(var row:listed.data())byAssignment.put(row.path("id").stringValue(),row);
            assertProgress(byAssignment.get(shared),2,1,50);assertProgress(byAssignment.get(repeated),1,0,0);
            assertProgress(byAssignment.get(referenceOnly),0,0,null);
            var recipients=t.get("/assignments/"+shared).data().path("recipients");
            var byChild=new HashMap<String,JsonNode>();for(var row:recipients)byChild.put(row.path("studentId").stringValue(),row);
            assertProgress(byChild.get(first),2,1,50);assertProgress(byChild.get(second),2,2,100);
            assertProgress(t.get("/assignments/"+referenceOnly).data().path("recipients").get(0),0,0,null);

            var page=p.get("/family/children/"+first+"/assignments?size=1&page=0");assertThat(page.data().size()).isEqualTo(1);
            assertThat(page.body().path("meta").path("totalElements").intValue()).isEqualTo(3);
            assertThat(p.get("/family/children/"+first+"/assignments?size=1&page=3").data().size()).isZero();
            jdbc.update("update student_guardians set status='REVOKED' where student_id=? and guardian_user_id=?",UUID.fromString(second),parentId);
            assertThat(p.get("/family/children/"+second+"/assignments").status()).isEqualTo(404);
            assertThat(p.get("/family/children/"+first+"/assignments").data().size()).isEqualTo(3);
            jdbc.update("update assignment_recipients set revoked_at=now(),revoke_reason='Synthetic revocation' where assignment_id=? and student_id=?",UUID.fromString(shared),UUID.fromString(second));
            var history=t.get("/assignments/"+shared).data().path("recipients");assertThat(history.size()).isEqualTo(2);
            for(var recipient:history)if(second.equals(recipient.path("studentId").stringValue()))assertProgress(recipient,2,2,100);
        }
    }
    private void assertProgress(JsonNode row,int required,int completed,Integer percent) {
        assertThat(row).isNotNull();assertThat(row.path("requiredItems").intValue()).isEqualTo(required);
        assertThat(row.path("completedItems").intValue()).isEqualTo(completed);
        if(percent==null)assertThat(row.path("completionPercent").isNull()).isTrue();
        else assertThat(row.path("completionPercent").intValue()).isEqualTo(percent);
    }
    @Test void completedClassRemainsReadableButCannotConfirmAndRevocationDeniesNewRequests() throws Exception {
        try(var t=login(TEACHER);var p=login(PARENT)) {
            String l=lesson(t,"Activity"),child=child(t,"Child"),c=classroom(t,child);
            var a=t.post("/assignments",assignmentBody("LESSON",l,"CLASS",c,Instant.now().minusSeconds(1))).data(); String aid=a.path("id").stringValue(),item=a.path("items").get(0).path("id").stringValue(); t.post("/assignments/"+aid+"/publish",Map.of("version",0));
            var cv=t.get("/classes/"+c).data().path("version").longValue(); assertThat(t.post("/classes/"+c+"/complete",Map.of("version",cv)).status()).isEqualTo(200);
            assertThat(p.get(familyItem(child,item)).status()).isEqualTo(200); assertThat(p.post(familyItem(child,item)+"/confirm",Map.of()).status()).isEqualTo(409);
            assertThat(t.post("/assignments/"+aid+"/revoke",Map.of("version",1,"reason","Stop sharing")).status()).isEqualTo(200);
            assertThat(p.get(familyItem(child,item)).status()).isEqualTo(404);
        }
    }
    @Test void publicationRejectsUnreadyMediaAndCoursesContainingDraftLessonsWithoutPartialChanges() throws Exception {
        try(var t=login(TEACHER)) {
            byte[] pdf="%PDF-1.4\nSynthetic fixture\n%%EOF".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            var uploaded=t.multipart("/files","not-ready.pdf","application/pdf",pdf,Map.of(),true);
            assertThat(uploaded.status()).isEqualTo(201); String file=uploaded.data().path("id").stringValue();
            var body=lessonBody("Media draft"); body.put("blocks",List.of(Map.of("type","IMAGE","fileId",file)));
            assertThat(t.post("/lessons",body).body().path("code").stringValue()).isEqualTo("FILE_TYPE_MISMATCH");
            body.put("blocks",List.of(Map.of("type","PDF","fileId",file))); var draft=t.post("/lessons",body);
            assertThat(draft.status()).isEqualTo(201); String lesson=draft.data().path("id").stringValue();
            var course=t.post("/courses",Map.of("title","Course with draft","lessons",List.of(Map.of("lessonId",lesson,"isRequired",true))));
            assertThat(course.status()).isEqualTo(201);
            assertThat(t.post("/courses/"+course.data().path("id").stringValue()+"/publish",Map.of("version",0)).body().path("code").stringValue()).isEqualTo("LESSON_NOT_PUBLISHED");
            jdbc.update("update files set status='FAILED' where id=?",UUID.fromString(file));
            assertThat(t.post("/lessons/"+lesson+"/publish",Map.of("version",0)).body().path("code").stringValue()).isEqualTo("FILE_NOT_READY");
            assertThat(t.get("/lessons/"+lesson).data().path("status").stringValue()).isEqualTo("DRAFT");
        }
    }
}

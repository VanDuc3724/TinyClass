package com.tinyclass;

import com.tinyclass.auth.*;
import com.tinyclass.common.persistence.DomainStore;
import com.tinyclass.communication.*;
import com.tinyclass.support.ApiBrowser;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties="tinyclass.auth.attempt-limit=1000")
@ActiveProfiles("test")
class CommunicationTests {
    static final String TEACHER="communication-teacher@example.test",PARENT="communication-parent@example.test",OUTSIDER="communication-other@example.test",UNVERIFIED="communication-unverified@example.test",PASSWORD="Synthetic-communication-password-2026";
    @Autowired Environment env;@Autowired JdbcTemplate jdbc;@Autowired JsonMapper json;@Autowired UserAccountRepository users;@Autowired PasswordEncoder passwords;@Autowired DomainStore db;@Autowired PlatformTransactionManager transactions;@Autowired AnnouncementService announcements;
    UUID teacherId,parentId,outsiderId;String classroom,otherClass,child,other,enrollment;
    @BeforeEach void prepare()throws Exception{
        assertThat(jdbc.queryForObject("select current_database()",String.class)).isEqualTo("tinyclass_test");jdbc.execute("TRUNCATE users,audit_events CASCADE");
        teacherId=users.saveAndFlush(new UserAccount(TEACHER,passwords.encode(PASSWORD),"Communication teacher","TEACHER")).getId();
        parentId=parent(PARENT,true);outsiderId=parent(OUTSIDER,true);parent(UNVERIFIED,false);
        try(var t=login(TEACHER)){
            classroom=t.post("/classes",Map.of("name","Lớp bảng tin","capacity",5)).data().path("id").stringValue();t.post("/classes/"+classroom+"/activate",Map.of("version",0));
            otherClass=t.post("/classes",Map.of("name","Lớp khác")).data().path("id").stringValue();t.post("/classes/"+otherClass+"/activate",Map.of("version",0));
            child=t.post("/students",Map.of("fullName","Bé bảng tin","internalNote","Private child memo")).data().path("id").stringValue();other=t.post("/students",Map.of("fullName","Bé lớp khác")).data().path("id").stringValue();
            enrollment=t.post("/classes/"+classroom+"/enrollments",Map.of("studentId",child)).data().path("id").stringValue();t.post("/classes/"+otherClass+"/enrollments",Map.of("studentId",other));
        }
        link(child,parentId);link(other,parentId);link(other,outsiderId);
    }
    UUID parent(String email,boolean verified){var u=new UserAccount(email,passwords.encode(PASSWORD),"Synthetic parent","PARENT");if(verified)u.verifyEmail();return users.saveAndFlush(u).getId();}
    void link(String child,UUID parent){jdbc.update("insert into student_guardians(id,student_id,guardian_user_id,status,linked_at,created_at,updated_at) values(?,?,?,'ACTIVE',now(),now(),now())",UUID.randomUUID(),UUID.fromString(child),parent);}
    ApiBrowser login(String email)throws Exception{var b=new ApiBrowser("http://127.0.0.1:"+env.getProperty("local.server.port"),json);assertThat(b.post("/auth/login",Map.of("email",email,"password",PASSWORD)).status()).isEqualTo(200);return b;}
    Map<String,Object> input(UUID request){return Map.of("clientRequestId",request,"classId",classroom,"title","Chuẩn bị hoạt động cuối tuần","body","Gia đình mang bình nước.\nNội dung chia sẻ công khai.");}
    JsonNode draft(ApiBrowser t)throws Exception{var r=t.post("/announcements",input(UUID.randomUUID()));assertThat(r.status()).as("%s",r.body()).isEqualTo(201);return r.data();}
    String path(JsonNode row){return "/announcements/"+row.path("id").stringValue();}
    String family(JsonNode row){return "/family/children/"+child+path(row);}
    JsonNode publish(ApiBrowser t,JsonNode row)throws Exception{var r=t.post(path(row)+"/publish",Map.of("version",row.path("version").longValue()));assertThat(r.status()).as("%s",r.body()).isEqualTo(200);return r.data();}
    JsonNode edit(ApiBrowser t,JsonNode row,String title)throws Exception{var r=t.put(path(row),Map.of("version",row.path("version").longValue(),"title",title,"body","Nội dung mới cho gia đình.","reason","Private correction reason"));assertThat(r.status()).as("%s",r.body()).isEqualTo(200);return r.data();}
    long unread(ApiBrowser p)throws Exception{var r=p.get("/notifications/unread-count");assertThat(r.status()).as("%s",r.body()).isEqualTo(200);return r.data().path("unreadCount").longValue();}
    void withdraw(){jdbc.update("update class_enrollments set status='WITHDRAWN',ended_at=now(),status_changed_at=now() where id=?",UUID.fromString(enrollment));}

    @Test void draftIsPrivateAndPublishCreatesOneScopedUpdate()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT);var o=login(OUTSIDER)){
            var a=draft(t);assertThat(p.get(family(a)).status()).isEqualTo(404);assertThat(p.get("/family/children/"+child+"/announcements").data().size()).isZero();assertThat(unread(p)).isZero();
            var published=publish(t,a);assertThat(published.path("revision").longValue()).isEqualTo(1);publish(t,a);
            var r=p.get(family(a));assertThat(r.status()).isEqualTo(200);assertThat(r.body().toString()).doesNotContain("version","teacherId","clientRequestId","requestHash","reason","internalNote","canEdit");assertThat(unread(p)).isEqualTo(1);assertThat(unread(o)).isZero();assertThat(o.get(family(a)).status()).isEqualTo(404);
            assertThat(p.get("/family/children/"+other+path(a)).status()).isEqualTo(404);assertThat(t.get(path(a)+"/history").data().size()).isEqualTo(2);
        }
    }
    @Test void creationRetryAndConcurrentPublishDoNotDuplicate()throws Exception{
        try(var t=login(TEACHER);var second=login(TEACHER);var pool=Executors.newFixedThreadPool(2)){
            var body=input(UUID.randomUUID());var gate=new CountDownLatch(1);
            var x=pool.submit(()->{gate.await();return t.post("/announcements",body);});var y=pool.submit(()->{gate.await();return second.post("/announcements",body);});gate.countDown();var first=x.get(20,TimeUnit.SECONDS);var retry=y.get(20,TimeUnit.SECONDS);
            assertThat(first.status()).isEqualTo(201);assertThat(retry.status()).isEqualTo(201);assertThat(first.data().path("id").stringValue()).isEqualTo(retry.data().path("id").stringValue());
            var a=first.data();var start=new CountDownLatch(1);var p1=pool.submit(()->{start.await();return t.post(path(a)+"/publish",Map.of("version",0));});var p2=pool.submit(()->{start.await();return second.post(path(a)+"/publish",Map.of("version",0));});start.countDown();assertThat(p1.get(20,TimeUnit.SECONDS).status()).isEqualTo(200);assertThat(p2.get(20,TimeUnit.SECONDS).status()).isEqualTo(200);
            assertThat(jdbc.queryForObject("select count(*) from class_announcements",Long.class)).isEqualTo(1);assertThat(jdbc.queryForObject("select count(*) from notifications",Long.class)).isEqualTo(1);
            var changed=new HashMap<>(body);changed.put("body","Different request payload");assertThat(t.post("/announcements",changed).status()).isEqualTo(409);
        }
    }
    @Test void readAcknowledgesExactRevisionAndEditingRequiresReread()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT)){
            var a=publish(t,draft(t));assertThat(p.post(family(a)+"/read",Map.of("revision",1)).data().path("isRead").booleanValue()).isTrue();p.post(family(a)+"/read",Map.of("revision",1));
            assertThat(jdbc.queryForObject("select count(*) from announcement_reads",Long.class)).isEqualTo(1);a=edit(t,a,"Cập nhật đồ dùng");assertThat(a.path("revision").longValue()).isEqualTo(2);assertThat(p.get(family(a)).data().path("isRead").booleanValue()).isFalse();
            assertThat(p.post(family(a)+"/read",Map.of("revision",1)).status()).isEqualTo(409);assertThat(p.post(family(a)+"/read",Map.of("revision",2)).data().path("isRead").booleanValue()).isTrue();assertThat(unread(p)).isEqualTo(2);
            assertThat(p.get(family(a)).body().toString()).doesNotContain("Private correction reason");assertThat(t.get(path(a)+"/history").body().toString()).contains("Private correction reason");
        }
    }
    @Test void staleEditsBlankInputsAndIllegalTransitionsAreAtomic()throws Exception{
        try(var t=login(TEACHER)){
            var a=publish(t,draft(t));edit(t,a,"Bản mới");long count=jdbc.queryForObject("select count(*) from notifications",Long.class);
            assertThat(t.put(path(a),Map.of("version",1,"title","Stale","body","Kept locally","reason","Old version")).status()).isEqualTo(409);
            var bad=new HashMap<>(input(UUID.randomUUID()));bad.put("title"," ");assertThat(t.post("/announcements",bad).status()).isEqualTo(400);bad.put("title","Title");bad.put("body","x".repeat(10001));assertThat(t.post("/announcements",bad).status()).isEqualTo(400);
            assertThat(t.post(path(a)+"/archive",Map.of("version",2,"reason"," ")).status()).isEqualTo(400);assertThat(t.get(path(a)).data().path("title").stringValue()).isEqualTo("Bản mới");assertThat(jdbc.queryForObject("select count(*) from notifications",Long.class)).isEqualTo(count);
        }
    }
    @Test void archiveHidesAllPublicProjectionsAndOldNotificationIds()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT)){
            var a=publish(t,draft(t));String note=p.get("/notifications").data().get(0).path("id").stringValue();
            assertThat(t.post(path(a)+"/archive",Map.of("version",1,"reason","Private archive reason")).status()).isEqualTo(200);
            assertThat(p.get(family(a)).status()).isEqualTo(404);assertThat(p.post(family(a)+"/read",Map.of("revision",1)).status()).isEqualTo(404);assertThat(p.get("/family/children/"+child+"/announcements").body().path("meta").path("totalElements").longValue()).isZero();
            assertThat(p.get("/notifications/"+note).status()).isEqualTo(404);assertThat(p.post("/notifications/"+note+"/read",Map.of()).status()).isEqualTo(404);assertThat(unread(p)).isZero();assertThat(t.get(path(a)).data().path("status").stringValue()).isEqualTo("ARCHIVED");assertThat(t.post(path(a)+"/publish",Map.of("version",2)).status()).isEqualTo(409);
        }
    }
    @Test void withdrawalAndGuardianRevokeFilterBeforeCountAndPage()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT)){
            var a=publish(t,draft(t));withdraw();assertThat(p.get(family(a)).status()).isEqualTo(404);assertThat(unread(p)).isZero();assertThat(p.get("/notifications?size=1").body().path("meta").path("totalElements").longValue()).isZero();
            jdbc.update("update class_enrollments set status='ACTIVE',ended_at=null where id=?",UUID.fromString(enrollment));assertThat(unread(p)).isEqualTo(1);
            jdbc.update("update student_guardians set status='REVOKED' where guardian_user_id=? and student_id=?",parentId,UUID.fromString(child));assertThat(p.get(family(a)).status()).isEqualTo(404);assertThat(unread(p)).isZero();
            assertThat(p.get("/family/children/"+other+"/announcements").status()).isEqualTo(200);
        }
    }
    @Test void archivedChildOrClassHideAnnouncementAndBadge()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT)){
            var a=publish(t,draft(t));jdbc.update("update students set status='ARCHIVED' where id=?",UUID.fromString(child));assertThat(p.get(family(a)).status()).isEqualTo(404);assertThat(unread(p)).isZero();
            jdbc.update("update students set status='ACTIVE' where id=?",UUID.fromString(child));jdbc.update("update classes set status='ARCHIVED' where id=?",UUID.fromString(classroom));assertThat(p.get(family(a)).status()).isEqualTo(404);assertThat(unread(p)).isZero();
            assertThat(t.put(path(a),Map.of("version",1,"title","Edit","body","Unavailable","reason","Private")).status()).isEqualTo(409);
        }
    }
    @Test void draftClassCanPrepareButCannotPublishUntilActive()throws Exception{
        try(var t=login(TEACHER)){
            var c=t.post("/classes",Map.of("name","Lớp chuẩn bị")).data();var body=new HashMap<>(input(UUID.randomUUID()));body.put("classId",c.path("id").stringValue());var a=t.post("/announcements",body).data();assertThat(t.post(path(a)+"/publish",Map.of("version",0)).status()).isEqualTo(409);t.post("/classes/"+c.path("id").stringValue()+"/activate",Map.of("version",0));publish(t,a);
        }
    }
    @Test void notificationReadIsPersonalIdempotentAndValidatesCurrentSource()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT);var otherParent=login(OUTSIDER)){
            publish(t,draft(t));var n=p.get("/notifications").data().get(0);String path="/notifications/"+n.path("id").stringValue();assertThat(otherParent.get(path).status()).isEqualTo(404);assertThat(t.get(path).status()).isEqualTo(404);
            var r=p.post(path+"/read",Map.of());assertThat(r.status()).isEqualTo(200);assertThat(r.data().path("targetPath").stringValue()).contains("/family/children/"+child+"/announcements/");String time=r.data().path("readAt").stringValue();assertThat(p.post(path+"/read",Map.of()).data().path("readAt").stringValue()).isEqualTo(time);assertThat(unread(p)).isZero();assertThat(p.get("/notifications?status=READ").data().size()).isEqualTo(1);assertThat(p.get("/notifications?status=UNREAD").data().size()).isZero();
            assertThat(r.body().toString()).doesNotContain("dedupeKey","recipientUserId","sourceId","requestHash","Private");
        }
    }
    @Test void roleCsrfVerificationFiltersAndUnknownIdsAreEnforced()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT);var u=login(UNVERIFIED)){
            var a=draft(t);assertThat(p.post("/announcements",input(UUID.randomUUID())).status()).isEqualTo(403);assertThat(p.get(path(a)+"/history").status()).isEqualTo(403);
            assertThat(t.write("POST",path(a)+"/publish",Map.of("version",0),false).status()).isEqualTo(403);assertThat(u.get("/notifications").status()).isEqualTo(403);assertThat(u.get("/notifications/unread-count").status()).isEqualTo(403);assertThat(u.get(family(a)).status()).isEqualTo(403);
            assertThat(t.get("/announcements?size=101").status()).isEqualTo(400);assertThat(t.get("/announcements?status=HIDDEN").status()).isEqualTo(400);assertThat(p.get("/notifications?page=-1").status()).isEqualTo(400);assertThat(p.get("/notifications?status=HIDDEN").status()).isEqualTo(400);assertThat(p.get("/notifications/"+UUID.randomUUID()).status()).isEqualTo(404);
            assertThat(p.get("/family/children/"+child+"/announcements?classId="+otherClass).status()).isEqualTo(404);assertThat(t.get("/announcements?classId="+UUID.randomUUID()).status()).isEqualTo(404);
        }
    }
    @Test void beforeCommitDeliveryRollsBackWithSourceAndDedupeKeepsOne()throws Exception{
        var tx=new TransactionTemplate(transactions);
        tx.executeWithoutResult(status->{var a=announcements.create(teacherId,new AnnouncementDtos.CreateInput(UUID.randomUUID(),UUID.fromString(classroom),"Rollback","Body"),"synthetic");announcements.action(teacherId,(UUID)a.get("id"),"publish",new AnnouncementDtos.ActionInput(0L,null),"synthetic");assertThat(db.count("select count(*) from notifications")).isZero();status.setRollbackOnly();});
        assertThat(db.count("select count(*) from class_announcements")).isZero();assertThat(db.count("select count(*) from notifications")).isZero();
        try(var t=login(TEACHER)){var a=publish(t,draft(t));tx.executeWithoutResult(status->{for(int i=0;i<2;i++)db.audit(teacherId,"ANNOUNCEMENT_PUBLISHED","ANNOUNCEMENT",UUID.fromString(a.path("id").stringValue()),Map.of(),null,"synthetic retry");});assertThat(db.count("select count(*) from notifications")).isEqualTo(1);}
    }
    @Test void sessionEventsAreAutomaticAndVisibilityFollowsCalendarRights()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT)){
            Instant start=Instant.now().plusSeconds(7200);var body=Map.of("clientRequestId",UUID.randomUUID(),"classId",classroom,"title","Hoạt động chung","startsAt",start.toString(),"endsAt",start.plusSeconds(3600).toString(),"preview",false,"allowConflicts",false);
            var r=t.post("/sessions",body);assertThat(r.status()).as("%s",r.body()).isEqualTo(201);var session=r.data().path("session");assertThat(unread(p)).isEqualTo(1);assertThat(p.get("/notifications").data().get(0).path("type").stringValue()).isEqualTo("SESSION_CHANGED");
            var cancel=t.post("/sessions/"+session.path("id").stringValue()+"/cancel",Map.of("version",session.path("version").longValue(),"reason","Cô nghỉ dạy hôm đó"));assertThat(cancel.status()).as("%s",cancel.body()).isEqualTo(200);assertThat(unread(p)).isEqualTo(2);withdraw();assertThat(unread(p)).isZero();
        }
    }
    @Test void assignmentsAndSubmissionUpdatesUseLiveAndHistoricalRights()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT)){
            var lesson=t.post("/lessons",Map.of("title","Bài phản hồi","defaultCompletionMode","TEACHER_REVIEW","defaultResponseTypes",List.of("TEXT"),"topicIds",List.of(),"blocks",List.of(Map.of("type","TEXT","textContent","Cùng làm hoạt động.")))).data();
            assertThat(t.post("/lessons/"+lesson.path("id").stringValue()+"/publish",Map.of("version",0)).status()).isEqualTo(200);
            var a=t.post("/assignments",Map.of("title","Bài được giao","sourceType","LESSON","lessonId",lesson.path("id").stringValue(),"targetType","CLASS","classId",classroom,"availableAt",Instant.now().minusSeconds(60).toString(),"clientRequestId",UUID.randomUUID())).data();
            var published=t.post("/assignments/"+a.path("id").stringValue()+"/publish",Map.of("version",0));assertThat(published.status()).as("%s",published.body()).isEqualTo(200);assertThat(unread(p)).isEqualTo(1);
            String item=published.data().path("items").get(0).path("id").stringValue();var draft=p.post("/family/children/"+child+"/assignment-items/"+item+"/submissions",Map.of()).data();String id=draft.path("id").stringValue();
            assertThat(p.patch("/submissions/"+id,Map.of("version",0,"textResponse","Gia đình gửi hoạt động.","fileIds",List.of())).status()).isEqualTo(200);
            assertThat(p.post("/submissions/"+id+"/submit",Map.of("version",1)).status()).isEqualTo(200);assertThat(unread(t)).isEqualTo(1);
            assertThat(t.post("/submissions/"+id+"/review",Map.of("version",2,"outcome","ACCEPTED","feedbackText","Nội dung chia sẻ với gia đình")).status()).isEqualTo(200);assertThat(unread(p)).isEqualTo(2);
            withdraw();assertThat(unread(p)).isEqualTo(1);assertThat(p.get("/notifications").data().get(0).path("type").stringValue()).isEqualTo("SUBMISSION_REVIEWED");assertThat(unread(t)).isEqualTo(1);
            jdbc.update("update student_guardians set status='REVOKED' where guardian_user_id=? and student_id=?",parentId,UUID.fromString(child));assertThat(unread(p)).isZero();
        }
    }
    @Test void invoiceAndPaymentUpdatesKeepHistoryAfterWithdrawalAndHideOnRevoke()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT)){
            String today=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).toString();
            var agreement=t.post("/enrollments/"+enrollment+"/tuition-agreements",Map.of("clientRequestId",UUID.randomUUID(),"source","CUSTOM","terms",Map.of("pricingMode","PER_SESSION","collectionTiming","UPFRONT","sessionUnitPriceVnd",100000,"chargeExcusedAbsence",false,"chargeUnexcusedAbsence",true),"effectiveFrom",today)).data();
            var preview=t.post("/billing/previews",Map.of("agreementId",agreement.path("id").stringValue(),"periodStart",today,"periodEnd",today)).data();
            var invoice=t.post("/invoices",Map.of("clientRequestId",UUID.randomUUID(),"agreementId",agreement.path("id").stringValue(),"periodStart",today,"periodEnd",today,"previewKey",preview.path("previewKey").stringValue(),"lines",List.of(Map.of("description","Khoản học phí","pricingBasis","OTHER","quantity",1,"unitPriceVnd",800000,"discountVnd",0)),"adjustmentReason","Private invoice reason")).data();String invoicePath="/invoices/"+invoice.path("id").stringValue();
            assertThat(t.post(invoicePath+"/issue",Map.of("version",0,"reviewKey",invoice.path("reviewKey").stringValue())).status()).isEqualTo(200);assertThat(unread(p)).isEqualTo(1);
            var received=t.write("POST",invoicePath+"/payments",Map.of("invoiceVersion",1,"amountVnd",500000,"method","CASH","paidAt",Instant.now().minusSeconds(10).toString(),"internalNote","Private payment note"),true,Map.of("Idempotency-Key",UUID.randomUUID().toString()));assertThat(received.status()).as("%s",received.body()).isEqualTo(201);assertThat(unread(p)).isEqualTo(2);
            var payment=received.data().path("payment");assertThat(t.post("/payments/"+payment.path("id").stringValue()+"/void",Map.of("version",0,"invoiceVersion",2,"reason","Private entry correction")).status()).isEqualTo(200);assertThat(unread(p)).isEqualTo(3);
            withdraw();assertThat(unread(p)).isEqualTo(3);assertThat(p.get("/notifications").body().toString()).doesNotContain("Private payment","Private entry","Private invoice");
            jdbc.update("update student_guardians set status='REVOKED' where guardian_user_id=? and student_id=?",parentId,UUID.fromString(child));assertThat(unread(p)).isZero();
        }
    }
    @Test void teacherFiltersSearchAndPagesStaySeparateFromFamily()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT)){
            var a=publish(t,draft(t));draft(t);assertThat(t.get("/announcements?status=DRAFT").data().size()).isEqualTo(1);assertThat(t.get("/announcements?q=khôngkhớp").data().size()).isZero();assertThat(t.get("/announcements?q=%25").data().size()).isZero();
            var r=p.get("/family/children/"+child+"/announcements?size=1");assertThat(r.body().path("meta").path("totalElements").longValue()).isEqualTo(1);assertThat(r.data().get(0).path("id").stringValue()).isEqualTo(a.path("id").stringValue());
        }
    }
}

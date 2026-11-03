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
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties="tinyclass.auth.attempt-limit=1000")
@ActiveProfiles("test")
class ScheduleTests {
    static final String TEACHER="calendar-teacher@example.test",PARENT="calendar-parent@example.test",UNVERIFIED="calendar-unverified@example.test",PASSWORD="Synthetic-calendar-password-2026";
    static final ZoneId ZONE=ZoneId.of("Asia/Ho_Chi_Minh");
    @Autowired Environment env; @Autowired JdbcTemplate jdbc; @Autowired JsonMapper json;
    @Autowired UserAccountRepository users; @Autowired PasswordEncoder passwords;
    UUID parentId,unverifiedId;
    LocalDate monday;
    @BeforeEach void prepare() {
        assertThat(jdbc.queryForObject("select current_database()",String.class)).isEqualTo("tinyclass_test");
        jdbc.execute("TRUNCATE users,audit_events CASCADE");
        users.saveAndFlush(new UserAccount(TEACHER,passwords.encode(PASSWORD),"Calendar teacher","TEACHER"));
        var parent=new UserAccount(PARENT,passwords.encode(PASSWORD),"Calendar parent","PARENT");parent.verifyEmail();parentId=users.saveAndFlush(parent).getId();
        unverifiedId=users.saveAndFlush(new UserAccount(UNVERIFIED,passwords.encode(PASSWORD),"Unverified parent","PARENT")).getId();
        monday=LocalDate.now(ZONE).with(TemporalAdjusters.next(DayOfWeek.MONDAY));
    }
    ApiBrowser browser() {return new ApiBrowser("http://127.0.0.1:"+env.getProperty("local.server.port"),json);}
    ApiBrowser login(String email) throws Exception {var b=browser();assertThat(b.post("/auth/login",Map.of("email",email,"password",PASSWORD)).status()).isEqualTo(200);return b;}
    String classroom(ApiBrowser t) throws Exception {return classroom(t,"Lớp lịch thử nghiệm");}
    String classroom(ApiBrowser t,String name) throws Exception {
        var r=t.post("/classes",Map.of("name",name,"location","Phòng học của cô"));assertThat(r.status()).isEqualTo(201);
        String id=r.data().path("id").stringValue();assertThat(t.post("/classes/"+id+"/activate",Map.of("version",0)).status()).isEqualTo(200);return id;
    }
    Map<String,Object> ruleBody(LocalDate day,String start,String end) {
        var body=new LinkedHashMap<String,Object>();body.put("weekday",day.getDayOfWeek().getValue());body.put("startTime",start);body.put("endTime",end);body.put("timezone",ZONE.getId());body.put("effectiveFrom",day.toString());body.put("isActive",true);body.put("location","Phòng nhỏ");return body;
    }
    JsonNode rule(ApiBrowser t,String c) throws Exception {var r=t.post("/classes/"+c+"/schedule-rules",ruleBody(monday,"09:00","10:00"));assertThat(r.status()).as("rule response: %s",r.body()).isEqualTo(201);return r.data();}
    Map<String,Object> generation(LocalDate from,LocalDate to,boolean preview) {return new LinkedHashMap<>(Map.of("from",from.toString(),"to",to.toString(),"preview",preview));}
    JsonNode generate(ApiBrowser t,String c,LocalDate from,LocalDate to) throws Exception {var r=t.post("/classes/"+c+"/sessions/generate",generation(from,to,false));assertThat(r.status()).isEqualTo(200);return r.data();}
    String dateQuery(LocalDate from,LocalDate to) {return "?from="+from+"&to="+to;}
    JsonNode sessions(ApiBrowser t,String c) throws Exception {return t.get("/sessions"+dateQuery(monday,monday.plusDays(35))+"&classId="+c+"&size=100").body().path("data");}
    String instant(LocalDate day,int hour) {return day.atTime(hour,0).atZone(ZONE).toInstant().toString();}
    Map<String,Object> manual(String c,LocalDate day,int hour) {
        return new LinkedHashMap<>(Map.of("classId",c,"clientRequestId",UUID.randomUUID().toString(),"startsAt",instant(day,hour),"endsAt",instant(day,hour+1),"title","Buổi riêng","lessonPlan","Kế hoạch riêng không gửi gia đình","location","Phòng học tại nhà"));
    }
    JsonNode create(ApiBrowser t,Map<String,Object> body) throws Exception {var r=t.post("/sessions",body);assertThat(r.status()).as("session response: %s",r.body()).isEqualTo(201);return r.data().path("session");}
    String child(ApiBrowser t,String c) throws Exception {
        String id=t.post("/students",Map.of("fullName","Bé lịch thử nghiệm")).data().path("id").stringValue();
        for(UUID guardian:List.of(parentId,unverifiedId)) jdbc.update("insert into student_guardians(id,student_id,guardian_user_id,status,linked_at,created_at,updated_at) values(?,?,?,'ACTIVE',now(),now(),now())",UUID.randomUUID(),UUID.fromString(id),guardian);
        assertThat(t.post("/classes/"+c+"/enrollments",Map.of("studentId",id)).status()).isEqualTo(201);return id;
    }

    @Test void previewIsReadOnlyAndIsoRulesProduceUtcSessionsWithoutDuplicates() throws Exception {
        try(var t=login(TEACHER)) {
            String c=classroom(t);var r=rule(t,c);long audits=jdbc.queryForObject("select count(*) from audit_events",Long.class);
            var preview=t.post("/classes/"+c+"/sessions/generate",generation(monday,monday.plusDays(27),true));
            assertThat(preview.status()).isEqualTo(200);assertThat(preview.data().path("created").intValue()).isEqualTo(4);
            assertThat(jdbc.queryForObject("select count(*) from class_sessions",Integer.class)).isZero();assertThat(jdbc.queryForObject("select count(*) from audit_events",Long.class)).isEqualTo(audits);
            assertThat(generate(t,c,monday,monday.plusDays(27)).path("created").intValue()).isEqualTo(4);
            var rows=sessions(t,c);assertThat(rows.size()).isEqualTo(4);assertThat(rows.get(0).path("startsAt").stringValue()).isEqualTo(instant(monday,9));
            assertThat(rows.get(0).path("endsAt").stringValue()).isEqualTo(instant(monday,10));
            assertThat(rows.get(0).path("occurrenceWeek").stringValue()).isEqualTo(monday.toString());
            var retry=generate(t,c,monday,monday.plusDays(27));assertThat(retry.path("created").intValue()).isZero();assertThat(retry.path("skipped").intValue()).isEqualTo(4);
            var sunday=ruleBody(monday.plusDays(6),"08:30","09:30");assertThat(t.post("/classes/"+c+"/schedule-rules",sunday).status()).isEqualTo(201);
            assertThat(generate(t,c,monday,monday.plusDays(6)).path("created").intValue()).isEqualTo(1);
            assertThat(t.get("/classes/"+c+"/schedule-rules").data().get(0).path("id").stringValue()).isEqualTo(r.path("id").stringValue());
        }
    }

    @Test void movingOneOccurrenceAcrossWeeksAndCancellingAnotherNeverRegeneratesTheirOriginalSlots() throws Exception {
        try(var t=login(TEACHER)) {
            String c=classroom(t);rule(t,c);generate(t,c,monday,monday.plusDays(27));var rows=sessions(t,c);
            var first=rows.get(0);var input=manual(c,monday.plusDays(8),14);input.put("version",first.path("version").longValue());input.put("reason","Gia đình đổi giờ");
            var moved=t.patch("/sessions/"+first.path("id").stringValue(),input);assertThat(moved.status()).isEqualTo(200);
            assertThat(moved.data().path("session").path("occurrenceWeek").stringValue()).isEqualTo(monday.toString());
            assertThat(t.post("/sessions/"+rows.get(1).path("id").stringValue()+"/cancel",Map.of("version",0,"reason","Cô nghỉ")).status()).isEqualTo(200);
            var retry=generate(t,c,monday,monday.plusDays(27));assertThat(retry.path("created").intValue()).isZero();assertThat(sessions(t,c).size()).isEqualTo(4);
            assertThat(jdbc.queryForObject("select count(*) from class_sessions where is_manual_override=true",Integer.class)).isEqualTo(2);
        }
    }

    @Test void changingRuleKeepsPastEarlierFutureManualCancelledAndRosterProtectedSessions() throws Exception {
        try(var t=login(TEACHER)) {
            String c=classroom(t);var r=rule(t,c);generate(t,c,monday,monday.plusDays(34));var rows=sessions(t,c);
            String manual=rows.get(1).path("id").stringValue(),roster=rows.get(2).path("id").stringValue(),cancelled=rows.get(3).path("id").stringValue();
            jdbc.update("update class_sessions set is_manual_override=true where id=?",UUID.fromString(manual));
            jdbc.update("update class_sessions set roster_created_at=now() where id=?",UUID.fromString(roster));
            t.post("/sessions/"+cancelled+"/cancel",Map.of("version",0,"reason","Hủy trước"));
            UUID past=UUID.randomUUID();LocalDate pastDay=monday.minusDays(14);
            jdbc.update("insert into class_sessions(id,class_id,schedule_rule_id,occurrence_week,starts_at,ends_at,title) values(?,?,?,?,?,?,'Buổi đã qua')",past,UUID.fromString(c),UUID.fromString(r.path("id").stringValue()),pastDay,Timestamp.from(pastDay.atTime(9,0).atZone(ZONE).toInstant()),Timestamp.from(pastDay.atTime(10,0).atZone(ZONE).toInstant()));
            var input=ruleBody(monday.plusDays(7),"11:00","12:00");input.put("version",0);input.put("preview",true);
            var preview=t.patch("/schedule-rules/"+r.path("id").stringValue(),input);assertThat(preview.status()).isEqualTo(200);assertThat(preview.data().path("updated").intValue()).isEqualTo(1);
            assertThat(jdbc.queryForObject("select version from class_schedule_rules where id=?",Long.class,UUID.fromString(r.path("id").stringValue()))).isZero();
            input.put("preview",false);var changed=t.patch("/schedule-rules/"+r.path("id").stringValue(),input);assertThat(changed.status()).isEqualTo(200);
            var after=sessions(t,c);assertThat(after.get(0).path("startsAt").stringValue()).isEqualTo(instant(monday,9));
            assertThat(after.get(1).path("startsAt").stringValue()).isEqualTo(instant(monday.plusDays(7),9));
            assertThat(after.get(2).path("startsAt").stringValue()).isEqualTo(instant(monday.plusDays(14),9));
            assertThat(after.get(3).path("status").stringValue()).isEqualTo("CANCELLED");
            assertThat(after.get(4).path("startsAt").stringValue()).isEqualTo(instant(monday.plusDays(28),11));
            assertThat(jdbc.queryForObject("select version from class_sessions where id=?",Long.class,past)).isZero();
            assertThat(t.patch("/schedule-rules/"+r.path("id").stringValue(),input).status()).isEqualTo(409);
        }
    }

    @Test void ruleWeekdayChangeAndPauseKeepIdentityAndCancelOnlyUntouchedFutureOccurrences() throws Exception {
        try(var t=login(TEACHER)) {
            String c=classroom(t);var r=rule(t,c);generate(t,c,monday,monday.plusDays(13));
            var input=ruleBody(monday.plusDays(2),"10:00","11:00");input.put("effectiveFrom",monday.toString());input.put("version",0);
            assertThat(t.patch("/schedule-rules/"+r.path("id").stringValue(),input).status()).isEqualTo(200);
            assertThat(sessions(t,c).get(0).path("startsAt").stringValue()).isEqualTo(instant(monday.plusDays(2),10));
            assertThat(generate(t,c,monday,monday.plusDays(13)).path("created").intValue()).isZero();
            input.put("version",1);input.put("isActive",false);
            assertThat(t.patch("/schedule-rules/"+r.path("id").stringValue(),input).data().path("cancelled").intValue()).isEqualTo(2);
            assertThat(generate(t,c,monday,monday.plusDays(20)).path("created").intValue()).isZero();
            assertThat(jdbc.queryForObject("select count(*) from class_sessions where status='CANCELLED' and cancellation_reason is not null",Integer.class)).isEqualTo(2);
        }
    }

    @Test void overlapNeedsExplicitConfirmationAndChangedConflictSetInvalidatesPreview() throws Exception {
        try(var t=login(TEACHER)) {
            String first=classroom(t,"Lớp thứ nhất"),second=classroom(t,"Lớp thứ hai");create(t,manual(first,monday,9));
            var input=manual(second,monday,9);input.put("preview",true);var preview=t.post("/sessions",input);assertThat(preview.status()).isEqualTo(200);assertThat(preview.data().path("conflictCount").intValue()).isEqualTo(1);
            input.put("preview",false);assertThat(t.post("/sessions",input).status()).isEqualTo(409);assertThat(jdbc.queryForObject("select count(*) from class_sessions",Integer.class)).isEqualTo(1);
            create(t,manual(first,monday,10));
            input.put("allowConflicts",true);input.put("conflictKey",preview.data().path("conflictKey").stringValue());assertThat(t.post("/sessions",input).status()).isEqualTo(201);
            // An adjacent 10:00 session is not a conflict with [09:00,10:00).
            var stale=manual(second,monday,9);stale.put("preview",true);var oldPreview=t.post("/sessions",stale).data();
            var extra=manual(first,monday,9);extra.put("preview",true);var extraPreview=t.post("/sessions",extra).data();extra.put("preview",false);extra.put("allowConflicts",true);extra.put("conflictKey",extraPreview.path("conflictKey").stringValue());create(t,extra);
            stale.put("preview",false);stale.put("allowConflicts",true);stale.put("conflictKey",oldPreview.path("conflictKey").stringValue());assertThat(t.post("/sessions",stale).status()).isEqualTo(409);
            assertThat(jdbc.queryForObject("select count(*) from audit_events where action='SCHEDULE_CONFLICT_CONFIRMED'",Integer.class)).isEqualTo(2);
        }
    }

    @Test void generatedBatchChecksConflictsBetweenNewRulesAndStoresNothingBeforeConfirmation() throws Exception {
        try(var t=login(TEACHER)) {
            String c=classroom(t);rule(t,c);rule(t,c);
            var input=generation(monday,monday.plusDays(13),true);var preview=t.post("/classes/"+c+"/sessions/generate",input).data();
            assertThat(preview.path("created").intValue()).isEqualTo(4);assertThat(preview.path("conflictCount").intValue()).isEqualTo(2);
            input.put("preview",false);assertThat(t.post("/classes/"+c+"/sessions/generate",input).status()).isEqualTo(409);
            assertThat(jdbc.queryForObject("select count(*) from class_sessions",Integer.class)).isZero();
            input.put("allowConflicts",true);input.put("conflictKey",preview.path("conflictKey").stringValue());assertThat(t.post("/classes/"+c+"/sessions/generate",input).status()).isEqualTo(200);
            assertThat(generate(t,c,monday,monday.plusDays(13)).path("created").intValue()).isZero();
        }
    }

    @Test void concurrentWritersCannotBypassOverlapChecksOrDuplicateGeneratedOccurrences() throws Exception {
        try(var t=login(TEACHER);var a=login(TEACHER);var b=login(TEACHER);var pool=Executors.newFixedThreadPool(2)) {
            String c=classroom(t);rule(t,c);var gate=new CountDownLatch(1);
            var first=pool.submit(()->{gate.await();return a.post("/classes/"+c+"/sessions/generate",generation(monday,monday.plusDays(13),false));});
            var second=pool.submit(()->{gate.await();return b.post("/classes/"+c+"/sessions/generate",generation(monday,monday.plusDays(13),false));});
            gate.countDown();var x=first.get(15,TimeUnit.SECONDS);var y=second.get(15,TimeUnit.SECONDS);
            assertThat(x.status()).isEqualTo(200);assertThat(y.status()).isEqualTo(200);assertThat(x.data().path("created").intValue()+y.data().path("created").intValue()).isEqualTo(2);
            var ready=new CountDownLatch(1);
            var ma=pool.submit(()->{ready.await();return a.post("/sessions",manual(c,monday,14)).status();});
            var mb=pool.submit(()->{ready.await();return b.post("/sessions",manual(c,monday,14)).status();});ready.countDown();
            assertThat(List.of(ma.get(15,TimeUnit.SECONDS),mb.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(201,409);
        }
    }

    @Test void manualRetryVersionsHistoryAndCancellationPreserveOriginalScheduleData() throws Exception {
        try(var t=login(TEACHER)) {
            String c=classroom(t);var input=manual(c,monday,9);var first=create(t,input);String id=first.path("id").stringValue();
            assertThat(create(t,input).path("id").stringValue()).isEqualTo(id);input.put("title","Different retry");assertThat(t.post("/sessions",input).status()).isEqualTo(409);
            var edit=manual(c,monday,11);edit.put("version",0);assertThat(t.patch("/sessions/"+id,edit).status()).isEqualTo(400);
            edit.put("reason","Chuyển giờ cho bé");assertThat(t.patch("/sessions/"+id,edit).status()).isEqualTo(200);assertThat(t.patch("/sessions/"+id,edit).status()).isEqualTo(409);
            assertThat(t.post("/sessions/"+id+"/cancel",Map.of("version",1,"reason"," ")).status()).isEqualTo(400);
            var cancelled=t.post("/sessions/"+id+"/cancel",Map.of("version",1,"reason","Gia đình báo nghỉ buổi"));assertThat(cancelled.status()).isEqualTo(200);
            assertThat(cancelled.data().path("startsAt").stringValue()).isEqualTo(instant(monday,11));assertThat(cancelled.data().path("lessonPlan").stringValue()).contains("riêng");
            assertThat(t.post("/sessions/"+id+"/cancel",Map.of("version",1,"reason","retry")).data().path("cancellationReason").stringValue()).isEqualTo("Gia đình báo nghỉ buổi");
            assertThat(t.get("/sessions/"+id+"/history").body().path("meta").path("totalElements").intValue()).isEqualTo(3);
            edit.put("version",2);assertThat(t.patch("/sessions/"+id,edit).status()).isEqualTo(409);
        }
    }

    @Test void familySeesOnlyEligibleClassDatesAndPublicFieldsAndLosesAccessAfterWithdrawalOrGuardianRevocation() throws Exception {
        try(var t=login(TEACHER);var p=login(PARENT);var unverified=login(UNVERIFIED);var anonymous=browser()) {
            String c=classroom(t),other=classroom(t,"Lớp không tham gia"),child=child(t,c);create(t,manual(c,monday,9));create(t,manual(other,monday,11));
            String path="/family/children/"+child+"/sessions"+dateQuery(monday,monday.plusDays(6));
            var result=p.get(path);assertThat(result.status()).isEqualTo(200);assertThat(result.body().path("meta").path("totalElements").intValue()).isEqualTo(1);
            assertThat(result.body().toString()).doesNotContain("lessonPlan","scheduleRuleId","requestHash","rosterCreatedAt","version","riêng không");
            assertThat(p.get(path+"&classId="+other).status()).isEqualTo(404);assertThat(p.get(path.replace(child,UUID.randomUUID().toString())).status()).isEqualTo(404);
            assertThat(unverified.get(path).status()).isEqualTo(403);assertThat(t.get(path).status()).isEqualTo(403);assertThat(anonymous.get(path).status()).isEqualTo(401);
            jdbc.update("update class_enrollments set status='WITHDRAWN',ended_at=now() where class_id=?",UUID.fromString(c));assertThat(p.get(path).body().path("meta").path("totalElements").intValue()).isZero();
            assertThat(p.get(path+"&classId="+c).status()).isEqualTo(404);
            jdbc.update("update student_guardians set status='REVOKED' where student_id=? and guardian_user_id=?",UUID.fromString(child),parentId);assertThat(p.get(path).status()).isEqualTo(404);
        }
    }

    @Test void completedClassShowsOnlyOldEligibleSessionsAndPastRecordsCannotBeRescheduled() throws Exception {
        try(var t=login(TEACHER);var p=login(PARENT)) {
            String c=classroom(t),child=child(t,c);var future=create(t,manual(c,monday,9));String id=future.path("id").stringValue();
            var start=LocalDate.now(ZONE).minusDays(1).atTime(9,0).atZone(ZONE).toInstant();
            UUID past=UUID.randomUUID();jdbc.update("insert into class_sessions(id,class_id,starts_at,ends_at,title) values(?,?,?,?,'Buổi cũ')",past,UUID.fromString(c),Timestamp.from(start),Timestamp.from(start.plusSeconds(3600)));
            jdbc.update("update class_enrollments set joined_at=now()-interval '3 days' where student_id=?",UUID.fromString(child));
            assertThat(t.post("/classes/"+c+"/complete",Map.of("version",1)).status()).isEqualTo(200);
            var result=p.get("/family/children/"+child+"/sessions"+dateQuery(LocalDate.now(ZONE).minusDays(2),monday));assertThat(result.body().path("data").size()).isEqualTo(1);assertThat(result.body().path("data").get(0).path("id").stringValue()).isEqualTo(past.toString());
            assertThat(t.get("/sessions/"+id).data().path("canEdit").booleanValue()).isFalse();
            assertThat(t.post("/classes/"+c+"/sessions/generate",generation(monday,monday.plusDays(6),false)).status()).isEqualTo(409);
            assertThat(t.patch("/sessions/"+past,manual(c,monday,12)).status()).isEqualTo(409);
        }
    }

    @Test void dashboardUsesVietnamDayBoundariesAndClassScopeAndExcludesCancelledSessions() throws Exception {
        try(var t=login(TEACHER)) {
            String c=classroom(t),other=classroom(t,"Lớp còn lại");
            Instant start=LocalDate.now(ZONE).atStartOfDay(ZONE).toInstant();
            for(int minutes:List.of(-1,0,1439,1440)) jdbc.update("insert into class_sessions(id,class_id,title,starts_at,ends_at,lesson_plan) values(?,?,'Buổi kiểm tra ngày',?,?, 'Private plan')",UUID.randomUUID(),UUID.fromString(c),Timestamp.from(start.plusSeconds(minutes*60L)),Timestamp.from(start.plusSeconds(minutes*60L+60)));
            jdbc.update("insert into class_sessions(id,class_id,title,starts_at,ends_at) values(?,?,'Lớp khác',?,?)",UUID.randomUUID(),UUID.fromString(other),Timestamp.from(start.plusSeconds(36000)),Timestamp.from(start.plusSeconds(39600)));
            jdbc.update("insert into class_sessions(id,class_id,title,starts_at,ends_at,status,cancelled_at,cancellation_reason) values(?,?,'Buổi hủy',?,?,'CANCELLED',now(),'Cô nghỉ')",UUID.randomUUID(),UUID.fromString(c),Timestamp.from(start.plusSeconds(18000)),Timestamp.from(start.plusSeconds(21600)));
            var all=t.get("/dashboard").data();assertThat(all.path("todaySessionCount").intValue()).isEqualTo(3);assertThat(all.path("todaySessions").size()).isEqualTo(3);
            assertThat(all.path("todaySessions").toString()).doesNotContain("lessonPlan","Private plan","Buổi hủy");
            assertThat(t.get("/dashboard?classId="+c).data().path("todaySessionCount").intValue()).isEqualTo(2);
            assertThat(t.get("/dashboard?classId="+other).data().path("todaySessionCount").intValue()).isEqualTo(1);
        }
    }

    @Test void validatesDatesTimesClassStateRolesCsrfAndPaginationBeforeWriting() throws Exception {
        try(var t=login(TEACHER);var p=login(PARENT);var anonymous=browser()) {
            String c=classroom(t);var input=ruleBody(monday,"09:00","08:00");assertThat(t.post("/classes/"+c+"/schedule-rules",input).status()).isEqualTo(400);
            input.put("endTime","10:00");input.put("timezone","UTC");assertThat(t.post("/classes/"+c+"/schedule-rules",input).status()).isEqualTo(400);
            input.put("timezone",ZONE.getId());input.put("weekday",8);assertThat(t.post("/classes/"+c+"/schedule-rules",input).status()).isEqualTo(400);
            input.put("weekday",1);input.put("effectiveFrom",LocalDate.now(ZONE).minusDays(1).toString());assertThat(t.post("/classes/"+c+"/schedule-rules",input).status()).isEqualTo(400);
            String generate="/classes/"+c+"/sessions/generate";
            assertThat(t.post(generate,generation(monday,monday.plusDays(93),false)).status()).isEqualTo(400);
            assertThat(t.post(generate,generation(monday,monday.minusDays(1),false)).status()).isEqualTo(400);
            assertThat(t.get("/sessions").status()).isEqualTo(400);assertThat(t.get("/sessions"+dateQuery(monday,monday)+"&size=101").status()).isEqualTo(400);
            assertThat(t.get("/sessions"+dateQuery(monday,monday)+"&status=UNKNOWN").status()).isEqualTo(400);
            var body=manual(c,monday,9);assertThat(p.post("/sessions",body).status()).isEqualTo(403);assertThat(anonymous.post("/sessions",body).status()).isEqualTo(401);
            assertThat(t.write("POST","/sessions",body,false).status()).isEqualTo(403);
            body.put("startsAt",Instant.now().minusSeconds(3600).toString());body.put("endsAt",Instant.now().minusSeconds(1).toString());assertThat(t.post("/sessions",body).status()).isEqualTo(400);
            assertThat(t.get("/sessions/"+UUID.randomUUID()).status()).isEqualTo(404);
            assertThat(jdbc.queryForObject("select count(*) from class_sessions",Integer.class)).isZero();
        }
    }
}

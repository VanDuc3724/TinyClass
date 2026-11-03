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
class AttendanceTests {
    static final String TEACHER="attendance-teacher@example.test",PARENT="attendance-parent@example.test",UNVERIFIED="attendance-unverified@example.test",PASSWORD="Synthetic-attendance-password-2026";
    @Autowired Environment env;@Autowired JdbcTemplate jdbc;@Autowired JsonMapper json;@Autowired UserAccountRepository users;@Autowired PasswordEncoder passwords;
    UUID teacherId,parentId;String classroom,child,second;
    @BeforeEach void prepare() throws Exception {
        assertThat(jdbc.queryForObject("select current_database()",String.class)).isEqualTo("tinyclass_test");jdbc.execute("TRUNCATE users,audit_events CASCADE");
        teacherId=users.saveAndFlush(new UserAccount(TEACHER,passwords.encode(PASSWORD),"Attendance teacher","TEACHER")).getId();
        var p=new UserAccount(PARENT,passwords.encode(PASSWORD),"Attendance parent","PARENT");p.verifyEmail();parentId=users.saveAndFlush(p).getId();users.saveAndFlush(new UserAccount(UNVERIFIED,passwords.encode(PASSWORD),"Unverified parent","PARENT"));
        try(var t=login(TEACHER)) {classroom=classroom(t,8);child=child(t,"Bé An",classroom);second=child(t,"Bé Bình",classroom);}
        jdbc.update("insert into student_guardians(id,student_id,guardian_user_id,status,linked_at,created_at,updated_at) values(?,?,?,'ACTIVE',now(),now(),now())",UUID.randomUUID(),UUID.fromString(child),parentId);
    }
    ApiBrowser browser(){return new ApiBrowser("http://127.0.0.1:"+env.getProperty("local.server.port"),json);}
    ApiBrowser login(String email)throws Exception{var b=browser();assertThat(b.post("/auth/login",Map.of("email",email,"password",PASSWORD)).status()).isEqualTo(200);return b;}
    String classroom(ApiBrowser t,int capacity)throws Exception{var r=t.post("/classes",Map.of("name","Lớp điểm danh "+UUID.randomUUID().toString().substring(0,4),"capacity",capacity));assertThat(r.status()).isEqualTo(201);String id=r.data().path("id").stringValue();assertThat(t.post("/classes/"+id+"/activate",Map.of("version",0)).status()).isEqualTo(200);return id;}
    String child(ApiBrowser t,String name,String c)throws Exception{String id=t.post("/students",Map.of("fullName",name,"internalNote","Private student note")).data().path("id").stringValue();enroll(t,c,id);return id;}
    void enroll(ApiBrowser t,String c,String id)throws Exception{assertThat(t.post("/classes/"+c+"/enrollments",Map.of("studentId",id)).status()).isEqualTo(201);jdbc.update("update class_enrollments set joined_at=now()-interval '7 days' where class_id=? and student_id=?",UUID.fromString(c),UUID.fromString(id));}
    String session(String c,long startSeconds,long endSeconds){UUID id=UUID.randomUUID();jdbc.update("insert into class_sessions(id,class_id,title,starts_at,ends_at,location,lesson_plan) values(?,?,'Buổi thử nghiệm',?,?,'Phòng học','Private lesson plan')",id,UUID.fromString(c),Timestamp.from(Instant.now().plusSeconds(startSeconds)),Timestamp.from(Instant.now().plusSeconds(endSeconds)));return id.toString();}
    JsonNode workspace(ApiBrowser t,String s)throws Exception{var r=t.get("/sessions/"+s+"/attendance");assertThat(r.status()).as("workspace: %s",r.body()).isEqualTo(200);return r.data();}
    JsonNode roster(ApiBrowser t,String s)throws Exception{var r=t.post("/sessions/"+s+"/attendance-roster",Map.of("sessionVersion",workspace(t,s).path("session").path("version").longValue()));assertThat(r.status()).as("roster: %s",r.body()).isEqualTo(200);return r.data();}
    JsonNode row(JsonNode w,String child){for(var r:w.path("rows"))if(r.path("studentId").stringValue().equals(child))return r;throw new AssertionError("Missing child in roster");}
    Map<String,Object> input(JsonNode row,String state){var m=new LinkedHashMap<String,Object>();m.put("id",row.path("id").stringValue());m.put("version",row.path("version").longValue());m.put("status",state);m.put("note",row.path("note").isNull()?null:row.path("note").stringValue());m.put("familyNote",row.path("familyNote").isNull()?null:row.path("familyNote").stringValue());return m;}
    ApiBrowser.Result save(ApiBrowser t,String s,JsonNode w,List<Map<String,Object>> rows,String reason)throws Exception{return t.write("PUT","/sessions/"+s+"/attendance",Map.of("sessionVersion",w.path("session").path("version").longValue(),"rows",rows,"reason",reason),true);}
    JsonNode mark(ApiBrowser t,String s,String child,String status)throws Exception{var w=workspace(t,s);var r=save(t,s,w,List.of(input(row(w,child),status)),"Điều chỉnh theo xác nhận của cô");assertThat(r.status()).as("mark: %s",r.body()).isEqualTo(200);return r.data();}
    JsonNode absence(ApiBrowser t,String s)throws Exception{return row(mark(t,s,child,"ABSENT_EXCUSED"),child);}
    String dates(){LocalDate d=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));return "?from="+d.minusDays(2)+"&to="+d.plusDays(3);}
    JsonNode cancel(ApiBrowser t,String s)throws Exception{var r=t.post("/sessions/"+s+"/cancel",Map.of("version",t.get("/sessions/"+s).data().path("version").longValue(),"reason","Cô hủy buổi thử nghiệm"));assertThat(r.status()).isEqualTo(200);return r.data();}

    @Test void rosterIsASnapshotAndExplicitAdjustmentsKeepNamesAndHistory()throws Exception{
        try(var t=login(TEACHER)){
            String s=session(classroom,3600,7200);var w=roster(t,s);assertThat(w.path("rows").size()).isEqualTo(2);assertThat(w.path("counts").path("UNMARKED").intValue()).isEqualTo(2);
            jdbc.update("update class_enrollments set status='WITHDRAWN',ended_at=now() where student_id=?",UUID.fromString(child));jdbc.update("update students set full_name='Tên mới' where id=?",UUID.fromString(child));String newcomer=child(t,"Bé Chi",classroom);
            var repeated=t.post("/sessions/"+s+"/attendance-roster",Map.of("sessionVersion",0));assertThat(repeated.status()).isEqualTo(200);assertThat(repeated.data().path("rows").size()).isEqualTo(2);assertThat(row(repeated.data(),child).path("studentName").stringValue()).isEqualTo("Bé An");
            var remove=t.post("/sessions/"+s+"/attendance-roster/members",Map.of("sessionVersion",w.path("session").path("version").longValue(),"studentId",child,"action","REMOVE","reason","Bé rời lớp trước buổi"));assertThat(remove.status()).isEqualTo(200);assertThat(row(remove.data(),child).path("isActive").booleanValue()).isFalse();
            var add=t.post("/sessions/"+s+"/attendance-roster/members",Map.of("sessionVersion",remove.data().path("session").path("version").longValue(),"studentId",newcomer,"action","ADD","reason","Bé mới tham gia"));assertThat(add.status()).isEqualTo(200);assertThat(add.data().path("rows").size()).isEqualTo(3);assertThat(add.data().path("counts").path("total").intValue()).isEqualTo(2);
            assertThat(t.get("/attendance/"+row(w,child).path("id").stringValue()+"/history").body().path("meta").path("totalElements").intValue()).isEqualTo(2);
        }
    }

    @Test void futureUnmarkedDoesNotMeanAbsentAndPresenceCannotBeRecordedBeforeStart()throws Exception{
        try(var t=login(TEACHER)){
            String s=session(classroom,3600,7200);var w=roster(t,s);assertThat(w.path("canMarkPresent").booleanValue()).isFalse();
            assertThat(save(t,s,w,List.of(input(row(w,child),"PRESENT")),"").status()).isEqualTo(409);
            assertThat(save(t,s,w,List.of(input(row(w,child),"ABSENT_EXCUSED")),"").status()).isEqualTo(200);
            var now=workspace(t,s);assertThat(row(now,second).path("status").stringValue()).isEqualTo("UNMARKED");assertThat(now.path("counts").path("ABSENT_UNEXCUSED").intValue()).isZero();
            assertThat(t.post("/sessions/"+s+"/complete",Map.of("version",now.path("session").path("version").longValue())).status()).isEqualTo(409);
        }
    }

    @Test void batchValidationAndVersionsNeverLeavePartialAttendanceWrites()throws Exception{
        try(var t=login(TEACHER)){
            String s=session(classroom,-7200,-3600);var w=roster(t,s);var first=input(row(w,child),"PRESENT");var bad=input(row(w,second),"LATE");bad.put("version",999);
            assertThat(save(t,s,w,List.of(first,bad),"").status()).isEqualTo(409);assertThat(row(workspace(t,s),child).path("status").stringValue()).isEqualTo("UNMARKED");
            assertThat(save(t,s,w,List.of(first,first),"").status()).isEqualTo(400);
            var done=save(t,s,w,List.of(first,input(row(w,second),"LATE")),"");assertThat(done.status()).isEqualTo(200);
            assertThat(save(t,s,w,List.of(first),"").status()).isEqualTo(409);assertThat(done.data().path("counts").path("PRESENT").intValue()).isEqualTo(1);assertThat(done.data().path("counts").path("LATE").intValue()).isEqualTo(1);
        }
    }

    @Test void finishingRequiresMarkedRosterAndCorrectionsCanReopenWithoutLosingOldCompletion()throws Exception{
        try(var t=login(TEACHER)){
            String s=session(classroom,-7200,-3600);var w=roster(t,s);
            assertThat(t.post("/sessions/"+s+"/complete",Map.of("version",w.path("session").path("version").longValue())).status()).isEqualTo(409);
            mark(t,s,child,"PRESENT");w=mark(t,s,second,"ABSENT_UNEXCUSED");var completed=t.post("/sessions/"+s+"/complete",Map.of("version",w.path("session").path("version").longValue()));assertThat(completed.status()).isEqualTo(200);assertThat(completed.data().path("session").path("status").stringValue()).isEqualTo("COMPLETED");assertThat(completed.data().path("session").path("completedAt").isNull()).isFalse();
            assertThat(t.post("/sessions/"+s+"/complete",Map.of("version",0)).status()).isEqualTo(200);
            w=workspace(t,s);assertThat(save(t,s,w,List.of(input(row(w,child),"UNMARKED")),"").status()).isEqualTo(400);
            var reopened=save(t,s,w,List.of(input(row(w,child),"UNMARKED")),"Sửa kết quả nhầm");assertThat(reopened.status()).isEqualTo(200);assertThat(reopened.data().path("session").path("status").stringValue()).isEqualTo("SCHEDULED");assertThat(reopened.data().path("session").path("completedAt").isNull()).isTrue();
            assertThat(jdbc.queryForObject("select count(*) from audit_events where entity_id=? and action='SESSION_ATTENDANCE_REOPENED' and changed_fields->'before'->>'completedAt' is not null",Integer.class,UUID.fromString(s))).isEqualTo(1);
        }
    }

    @Test void familyHistorySurvivesWithdrawalButRevocationWrongChildAndPrivateFieldsAreEnforced()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT);var unverified=login(UNVERIFIED);var anonymous=browser()){
            String s=session(classroom,-7200,-3600);var w=roster(t,s);var body=input(row(w,child),"PRESENT");body.put("note","Private attendance detail");body.put("familyNote","Bé đến lớp vui vẻ.");assertThat(save(t,s,w,List.of(body),"").status()).isEqualTo(200);
            String path="/family/children/"+child+"/attendance"+dates();var family=p.get(path);assertThat(family.status()).isEqualTo(200);assertThat(family.body().path("meta").path("totalElements").intValue()).isEqualTo(1);assertThat(family.body().toString()).contains("Bé đến lớp vui vẻ").doesNotContain("Private","enrollmentId","rootAttendanceId","studentId","version");
            assertThat(p.get(path.replace(child,second)).status()).isEqualTo(404);assertThat(unverified.get(path).status()).isEqualTo(403);assertThat(anonymous.get(path).status()).isEqualTo(401);assertThat(t.get(path).status()).isEqualTo(403);
            jdbc.update("update class_enrollments set status='WITHDRAWN',ended_at=now() where student_id=?",UUID.fromString(child));assertThat(p.get(path).body().path("data").size()).isEqualTo(1);
            String history="/family/children/"+child+"/attendance/"+row(w,child).path("id").stringValue()+"/history";assertThat(p.get(history).body().toString()).doesNotContain("Private","reason");assertThat(p.get(history.replace(row(w,child).path("id").stringValue(),row(w,second).path("id").stringValue())).status()).isEqualTo(404);
            jdbc.update("update student_guardians set status='REVOKED' where student_id=?",UUID.fromString(child));assertThat(p.get(path).status()).isEqualTo(404);assertThat(p.get(history).status()).isEqualTo(404);
        }
    }

    @Test void dashboardCountsActualDistinctPresentChildrenAndKeepsCompletedSessionsButExcludesVoidedResults()throws Exception{
        try(var t=login(TEACHER)){
            String s=session(classroom,-120,-60);var w=roster(t,s);mark(t,s,child,"PRESENT");mark(t,s,second,"LATE");w=workspace(t,s);assertThat(t.post("/sessions/"+s+"/complete",Map.of("version",w.path("session").path("version").longValue())).status()).isEqualTo(200);
            var all=t.get("/dashboard").data();assertThat(all.path("presentToday").intValue()).isEqualTo(2);assertThat(all.path("todaySessionCount").intValue()).isEqualTo(1);
            cancel(t,s);assertThat(t.get("/dashboard").data().path("presentToday").intValue()).isZero();assertThat(t.get("/dashboard").data().path("todaySessionCount").intValue()).isZero();
        }
    }

    @Test void rolesCsrfForeignRowsPaginationAndEmptyCompletionAreValidated()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT);var anonymous=browser()){
            String s=session(classroom,-7200,-3600);var w=roster(t,s);String path="/sessions/"+s+"/attendance";
            assertThat(p.get(path).status()).isEqualTo(403);assertThat(anonymous.get(path).status()).isEqualTo(401);
            var body=Map.of("sessionVersion",w.path("session").path("version").longValue(),"rows",List.of(input(row(w,child),"PRESENT")));assertThat(t.write("PUT",path,body,false).status()).isEqualTo(403);
            String other=session(classroom,-14400,-10800);var otherRoster=roster(t,other);assertThat(save(t,s,w,List.of(input(row(otherRoster,child),"PRESENT")),"").status()).isEqualTo(404);
            assertThat(t.get("/attendance?from=2026-01-01&to=2027-01-01").status()).isEqualTo(400);assertThat(t.get("/attendance"+dates()+"&size=101").status()).isEqualTo(400);
            String empty=session(classroom(t,3),-7200,-3600);var noChildren=roster(t,empty);assertThat(t.post("/sessions/"+empty+"/complete",Map.of("version",noChildren.path("session").path("version").longValue())).status()).isEqualTo(400);assertThat(t.post("/sessions/"+empty+"/complete",Map.of("version",noChildren.path("session").path("version").longValue(),"reason","Không có bé tham gia")).status()).isEqualTo(200);
        }
    }
    @Test void concurrentRosterCreationAndBatchSavesCannotDuplicateOrOverwrite()throws Exception{
        try(var t=login(TEACHER);var a=login(TEACHER);var b=login(TEACHER);var pool=Executors.newFixedThreadPool(2)){
            String s=session(classroom,-7200,-3600);var gate=new CountDownLatch(1);
            var first=pool.submit(()->{gate.await();return a.post("/sessions/"+s+"/attendance-roster",Map.of("sessionVersion",0)).status();});
            var secondCall=pool.submit(()->{gate.await();return b.post("/sessions/"+s+"/attendance-roster",Map.of("sessionVersion",0)).status();});gate.countDown();assertThat(first.get(15,TimeUnit.SECONDS)).isEqualTo(200);assertThat(secondCall.get(15,TimeUnit.SECONDS)).isEqualTo(200);
            assertThat(jdbc.queryForObject("select count(*) from attendance_records where session_id=?",Integer.class,UUID.fromString(s))).isEqualTo(2);
            var w=workspace(t,s);var ready=new CountDownLatch(1);
            var x=pool.submit(()->{ready.await();return save(a,s,w,List.of(input(row(w,child),"PRESENT")),"").status();});
            var y=pool.submit(()->{ready.await();return save(b,s,w,List.of(input(row(w,child),"LATE")),"").status();});ready.countDown();assertThat(List.of(x.get(15,TimeUnit.SECONDS),y.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
            assertThat(t.get("/attendance/"+row(w,child).path("id").stringValue()+"/history").body().path("meta").path("totalElements").intValue()).isEqualTo(2);
        }
    }

    @Test void cancellingSessionKeepsRecordedResultsButStopsEditingAndEffectiveCounts()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT)){
            String s=session(classroom,-7200,-3600);roster(t,s);mark(t,s,child,"PRESENT");cancel(t,s);var w=workspace(t,s);
            assertThat(row(w,child).path("status").stringValue()).isEqualTo("PRESENT");assertThat(w.path("counts").path("PRESENT").intValue()).isZero();assertThat(w.path("counts").path("effectiveTotal").intValue()).isZero();assertThat(w.path("canEdit").booleanValue()).isFalse();
            assertThat(save(t,s,w,List.of(input(row(w,child),"UNMARKED")),"Sửa buổi hủy").status()).isEqualTo(409);
            assertThat(t.post("/sessions/"+s+"/attendance-roster",Map.of("sessionVersion",0)).data().path("rows").size()).isEqualTo(2);
            var family=p.get("/family/children/"+child+"/attendance"+dates()).body().path("data").get(0);assertThat(family.path("status").stringValue()).isEqualTo("PRESENT");assertThat(family.path("effective").booleanValue()).isFalse();
        }
    }

    @Test void archivedClassRetainsOwnChildHistoryButIsReadOnlyForAttendance()throws Exception{
        try(var t=login(TEACHER);var p=login(PARENT)){
            String s=session(classroom,-7200,-3600);roster(t,s);mark(t,s,child,"PRESENT");assertThat(t.post("/classes/"+classroom+"/archive",Map.of("version",1,"reason","Lưu trữ lớp thử nghiệm")).status()).isEqualTo(200);
            var w=workspace(t,s);assertThat(w.path("canEdit").booleanValue()).isFalse();assertThat(save(t,s,w,List.of(input(row(w,child),"LATE")),"Sửa trong lớp lưu trữ").status()).isEqualTo(409);
            assertThat(p.get("/family/children/"+child+"/attendance"+dates()).body().path("meta").path("totalElements").intValue()).isEqualTo(1);
        }
    }
}

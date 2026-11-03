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
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties="tinyclass.auth.attempt-limit=1000")
@ActiveProfiles("test")
class TuitionTests {
    static final String TEACHER="tuition-teacher@example.test",PARENT="tuition-parent@example.test",UNVERIFIED="tuition-unverified@example.test",PASSWORD="Synthetic-tuition-password-2026";
    @Autowired Environment env;@Autowired JdbcTemplate jdbc;@Autowired JsonMapper json;@Autowired UserAccountRepository users;@Autowired PasswordEncoder passwords;
    UUID teacherId,parentId;String classroom,child,other,enrollment,otherEnrollment;
    LocalDate today(){return LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));}
    @BeforeEach void prepare()throws Exception {
        assertThat(jdbc.queryForObject("select current_database()",String.class)).isEqualTo("tinyclass_test");jdbc.execute("TRUNCATE users,audit_events CASCADE");
        teacherId=users.saveAndFlush(new UserAccount(TEACHER,passwords.encode(PASSWORD),"Tuition teacher","TEACHER")).getId();var parent=new UserAccount(PARENT,passwords.encode(PASSWORD),"Tuition parent","PARENT");parent.verifyEmail();parentId=users.saveAndFlush(parent).getId();users.saveAndFlush(new UserAccount(UNVERIFIED,passwords.encode(PASSWORD),"Unverified parent","PARENT"));
        try(var t=login(TEACHER)) {
            classroom=t.post("/classes",Map.of("name","Lớp cấu hình học phí","capacity",8)).data().path("id").stringValue();t.post("/classes/"+classroom+"/activate",Map.of("version",0));
            child=t.post("/students",Map.of("fullName","Bé học phí","internalNote","Private child profile")).data().path("id").stringValue();other=t.post("/students",Map.of("fullName","Bé mức riêng")).data().path("id").stringValue();
            enrollment=t.post("/classes/"+classroom+"/enrollments",Map.of("studentId",child)).data().path("id").stringValue();otherEnrollment=t.post("/classes/"+classroom+"/enrollments",Map.of("studentId",other)).data().path("id").stringValue();
            jdbc.update("update class_enrollments set joined_at=now()-interval '30 days' where class_id=?",UUID.fromString(classroom));
        }
        jdbc.update("insert into student_guardians(id,student_id,guardian_user_id,status,linked_at,created_at,updated_at) values(?,?,?,'ACTIVE',now(),now(),now())",UUID.randomUUID(),UUID.fromString(child),parentId);
    }
    ApiBrowser login(String email)throws Exception{var b=new ApiBrowser("http://127.0.0.1:"+env.getProperty("local.server.port"),json);assertThat(b.post("/auth/login",Map.of("email",email,"password",PASSWORD)).status()).isEqualTo(200);return b;}
    Map<String,Object> terms(String mode,long amount){var value=new LinkedHashMap<String,Object>();value.put("pricingMode",mode);value.put("collectionTiming",mode.equals("FULL_PROGRAM")?"UPFRONT":"AT_PERIOD_END");value.put("publicTerms","Điều kiện chia sẻ cho gia đình.");if(mode.equals("PER_SESSION")){value.put("sessionUnitPriceVnd",amount);value.put("chargeExcusedAbsence",false);value.put("chargeUnexcusedAbsence",true);}else{value.put(mode.equals("MONTHLY_FIXED")?"monthlyAmountVnd":"programTotalVnd",amount);value.put("fixedFeeAbsenceRule","MANUAL_ADJUSTMENT");if(mode.equals("FULL_PROGRAM")){value.put("programLabel","Đợt khám phá mùa thu");value.put("expectedSessions",12);}}return value;}
    JsonNode policy(ApiBrowser t,Map<String,Object> terms,Long version)throws Exception{var body=new LinkedHashMap<String,Object>();body.put("version",version);body.put("terms",terms);body.put("internalNote","Private policy conditions");body.put("reason","Cô điều chỉnh mặc định lớp.");var r=t.write("PUT","/classes/"+classroom+"/tuition-policy",body,true);assertThat(r.status()).as("policy: %s",r.body()).isEqualTo(200);return r.data().path("policy");}
    Map<String,Object> custom(String mode,long amount,LocalDate from,LocalDate to){var body=new LinkedHashMap<String,Object>();body.put("clientRequestId",UUID.randomUUID());body.put("source","CUSTOM");body.put("terms",terms(mode,amount));body.put("effectiveFrom",from.toString());body.put("effectiveTo",to==null?null:to.toString());body.put("internalNote","Private negotiated price");body.put("reason","Private setup reason");return body;}
    Map<String,Object> copied(long version,LocalDate from){var body=new LinkedHashMap<String,Object>();body.put("clientRequestId",UUID.randomUUID());body.put("source","POLICY");body.put("policyVersion",version);body.put("effectiveFrom",from.toString());return body;}
    JsonNode create(ApiBrowser t,String e,Map<String,Object> body)throws Exception{var r=t.post("/enrollments/"+e+"/tuition-agreements",body);assertThat(r.status()).as("create: %s",r.body()).isEqualTo(201);return r.data();}
    String path(JsonNode a){return "/tuition-agreements/"+a.path("id").stringValue();}
    JsonNode detail(ApiBrowser t,JsonNode a)throws Exception{return t.get(path(a)).data();}

    @Test void policySupportsThreeModesZeroAndSeparateExplicitCollectionRules()throws Exception {
        try(var t=login(TEACHER)){var a=policy(t,terms("PER_SESSION",0),null);assertThat(a.path("sessionUnitPriceVnd").longValue()).isZero();assertThat(a.path("chargeExcusedAbsence").booleanValue()).isFalse();
            var monthly=terms("MONTHLY_FIXED",800000);monthly.put("collectionTiming","AT_PERIOD_START");var b=policy(t,monthly,0L);assertThat(b.path("monthlyAmountVnd").longValue()).isEqualTo(800000);assertThat(b.path("sessionUnitPriceVnd").isNull()).isTrue();
            var c=policy(t,terms("FULL_PROGRAM",3000000),1L);assertThat(c.path("programLabel").stringValue()).contains("mùa thu");assertThat(c.path("collectionTiming").stringValue()).isEqualTo("UPFRONT");assertThat(t.get("/classes/"+classroom+"/tuition-policy/history").data().size()).isEqualTo(3);
        }
    }
    @Test void fractionalNegativeHugeOrIncompatibleMoneyCannotBeRoundedOrSaved()throws Exception {
        try(var t=login(TEACHER)){for(Object amount:List.of(new BigDecimal("10.5"),-1L,1000000000001L)){var x=terms("PER_SESSION",1);x.put("sessionUnitPriceVnd",amount);assertThat(t.write("PUT","/classes/"+classroom+"/tuition-policy",Map.of("terms",x),true).status()).isEqualTo(400);}
            var missing=terms("PER_SESSION",100000);missing.remove("chargeExcusedAbsence");assertThat(t.write("PUT","/classes/"+classroom+"/tuition-policy",Map.of("terms",missing),true).status()).isEqualTo(400);
            var incompatible=terms("PER_SESSION",100000);incompatible.put("monthlyAmountVnd",800000);assertThat(t.write("PUT","/classes/"+classroom+"/tuition-policy",Map.of("terms",incompatible),true).status()).isEqualTo(400);
            assertThat(jdbc.queryForObject("select count(*) from class_tuition_policies",Integer.class)).isZero();var max=policy(t,terms("FULL_PROGRAM",1000000000000L),null);assertThat(max.path("programTotalVnd").longValue()).isEqualTo(1000000000000L);
        }
    }
    @Test void classPolicyChangesNeverRewriteCopiedOrIndividualAgreementSnapshots()throws Exception {
        try(var t=login(TEACHER)){policy(t,terms("PER_SESSION",100000),null);var a=create(t,enrollment,copied(0,today()));var b=create(t,otherEnrollment,custom("PER_SESSION",90000,today(),null));policy(t,terms("PER_SESSION",120000),0L);
            assertThat(detail(t,a).path("sessionUnitPriceVnd").longValue()).isEqualTo(100000);assertThat(detail(t,a).path("sourcePolicyVersion").longValue()).isZero();assertThat(detail(t,b).path("sessionUnitPriceVnd").longValue()).isEqualTo(90000);assertThat(detail(t,b).path("sourcePolicyId").isNull()).isTrue();
            assertThat(t.post("/enrollments/"+otherEnrollment+"/tuition-agreements",copied(0,today().plusDays(30))).status()).isEqualTo(409);assertThat(jdbc.queryForObject("select count(*) from enrollment_tuition_agreements",Integer.class)).isEqualTo(2);
        }
    }
    @Test void inclusiveRangesRejectOverlapsAndAcceptAdjacentDaysWithinClassDates()throws Exception {
        try(var t=login(TEACHER)){jdbc.update("update classes set start_date=?,end_date=? where id=?",today().minusDays(5),today().plusDays(30),UUID.fromString(classroom));
            create(t,enrollment,custom("MONTHLY_FIXED",800000,today(),today().plusDays(10)));
            assertThat(t.post("/enrollments/"+enrollment+"/tuition-agreements",custom("PER_SESSION",100000,today().plusDays(10),today().plusDays(20))).status()).isEqualTo(409);
            create(t,enrollment,custom("PER_SESSION",100000,today().plusDays(11),today().plusDays(20)));
            assertThat(t.post("/enrollments/"+otherEnrollment+"/tuition-agreements",custom("FULL_PROGRAM",500000,today(),null)).status()).isEqualTo(400);
            assertThat(t.post("/enrollments/"+otherEnrollment+"/tuition-agreements",custom("FULL_PROGRAM",500000,today().minusDays(6),today().plusDays(2))).status()).isEqualTo(400);
            assertThat(t.post("/enrollments/"+otherEnrollment+"/tuition-agreements",custom("FULL_PROGRAM",500000,today(),today().minusDays(1))).status()).isEqualTo(400);
        }
    }
    @Test void futureReplacementClosesOldRangeAndRetriesEvenAfterThePolicyChanges()throws Exception {
        try(var t=login(TEACHER)){policy(t,terms("PER_SESSION",120000),null);var a=create(t,enrollment,custom("PER_SESSION",100000,today().minusDays(10),null));var request=copied(0,today().plusDays(10));request.put("version",0);request.put("reason","Áp dụng giá mới từ ngày đã chọn.");
            var changed=t.post(path(a)+"/replace",request);assertThat(changed.status()).as("replace: %s",changed.body()).isEqualTo(201);var old=detail(t,a);assertThat(old.path("effectiveTo").stringValue()).isEqualTo(today().plusDays(9).toString());assertThat(old.path("sessionUnitPriceVnd").longValue()).isEqualTo(100000);assertThat(old.path("replacementId").stringValue()).isEqualTo(changed.data().path("id").stringValue());
            policy(t,terms("PER_SESSION",150000),0L);var retry=t.post(path(a)+"/replace",request);assertThat(retry.status()).isEqualTo(201);assertThat(retry.data().path("id")).isEqualTo(changed.data().path("id"));assertThat(retry.data().path("sessionUnitPriceVnd").longValue()).isEqualTo(120000);assertThat(t.get(path(a)+"/history").data().size()).isEqualTo(2);
        }
    }
    @Test void sameDayCorrectionRetainsCancelledOriginalInsteadOfChangingItsPrice()throws Exception {
        try(var t=login(TEACHER)){var a=create(t,enrollment,custom("PER_SESSION",100000,today(),null));var request=custom("PER_SESSION",90000,today(),null);request.put("version",0);var changed=t.post(path(a)+"/replace",request);assertThat(changed.status()).isEqualTo(201);
            var old=detail(t,a);assertThat(old.path("status").stringValue()).isEqualTo("CANCELLED");assertThat(old.path("sessionUnitPriceVnd").longValue()).isEqualTo(100000);assertThat(old.path("cancelledAt").isNull()).isFalse();assertThat(changed.data().path("periodState").stringValue()).isEqualTo("CURRENT");assertThat(changed.data().path("sessionUnitPriceVnd").longValue()).isEqualTo(90000);
            assertThat(t.post(path(a)+"/replace",request).status()).isEqualTo(201);assertThat(jdbc.queryForObject("select count(*) from enrollment_tuition_agreements",Integer.class)).isEqualTo(2);
        }
    }
    @Test void endAndCancelPreservePastDaysAndNeverExtendTerms()throws Exception {
        try(var t=login(TEACHER)){var past=create(t,enrollment,custom("MONTHLY_FIXED",800000,today().minusDays(5),null));assertThat(t.post(path(past)+"/cancel",Map.of("version",0,"reason","Cannot remove used days")).status()).isEqualTo(409);
            assertThat(t.post(path(past)+"/end",Map.of("version",0,"effectiveTo",today().minusDays(1).toString(),"reason","Cannot backdate")).status()).isEqualTo(400);
            var ended=t.post(path(past)+"/end",Map.of("version",0,"effectiveTo",today().plusDays(2).toString(),"reason","Ngừng mức từ sau ngày này."));assertThat(ended.status()).isEqualTo(200);assertThat(ended.data().path("periodState").stringValue()).isEqualTo("CURRENT");
            assertThat(t.post(path(past)+"/end",Map.of("version",1,"effectiveTo",today().plusDays(3).toString(),"reason","Cannot extend")).status()).isEqualTo(400);
            var future=create(t,enrollment,custom("FULL_PROGRAM",3000000,today().plusDays(3),null));assertThat(t.post(path(future)+"/cancel",Map.of("version",0,"reason","Đợt chưa bắt đầu, ghi nhầm.")).status()).isEqualTo(200);assertThat(detail(t,future).path("periodState").stringValue()).isEqualTo("CANCELLED");
        }
    }
    @Test void familySeesOnlyOwnPublicSnapshotsAndLosesAccessWhenGuardianIsRevoked()throws Exception {
        try(var t=login(TEACHER);var p=login(PARENT)){policy(t,terms("PER_SESSION",100000),null);var a=create(t,enrollment,custom("PER_SESSION",90000,today(),null));create(t,otherEnrollment,custom("FULL_PROGRAM",3456789,today(),null));
            var publicData=p.get("/family/children/"+child+"/tuition-agreements");assertThat(publicData.status()).isEqualTo(200);assertThat(publicData.data().path("agreements").path("meta").path("totalElements").intValue()).isEqualTo(1);assertThat(publicData.body().toString()).doesNotContain("internalNote","changeReason","requestHash","clientRequestId","sourcePolicyVersion","version","3456789","Private");
            assertThat(p.get("/classes/"+classroom+"/tuition-policy").status()).isEqualTo(403);assertThat(p.get("/family/children/"+other+"/tuition-agreements/"+a.path("id").stringValue()).status()).isEqualTo(404);
            t.patch("/enrollments/"+enrollment,Map.of("version",0,"status","WITHDRAWN","reason","Rời lớp."));t.post("/students/"+child+"/archive",Map.of("version",0,"reason","Lưu hồ sơ."));assertThat(p.get("/family/children/"+child+"/tuition-agreements").status()).isEqualTo(200);
            String link=jdbc.queryForObject("select id::text from student_guardians where student_id=? and guardian_user_id=?",String.class,UUID.fromString(child),parentId);t.post("/student-guardians/"+link+"/revoke",Map.of("version",0,"reason","Thu hồi liên kết."));assertThat(p.get("/family/children/"+child+"/tuition-agreements").status()).isEqualTo(404);assertThat(p.get("/family/children/"+child+"/tuition-agreements/"+a.path("id").stringValue()).status()).isEqualTo(404);
        }
    }
    @Test void rolesCsrfReasonsVersionsAndUnknownResourcesAreChecked()throws Exception {
        try(var t=login(TEACHER);var p=login(PARENT);var u=login(UNVERIFIED)){var a=create(t,enrollment,custom("PER_SESSION",100000,today(),null));assertThat(p.get(path(a)+"/history").status()).isEqualTo(403);assertThat(t.get("/tuition-agreements/"+UUID.randomUUID()).status()).isEqualTo(404);assertThat(u.get("/family/children/"+child+"/tuition-agreements").status()).isEqualTo(403);
            assertThat(t.write("POST",path(a)+"/cancel",Map.of("version",0,"reason","No CSRF"),false).status()).isEqualTo(403);assertThat(t.post(path(a)+"/cancel",Map.of("version",99,"reason","Old version")).status()).isEqualTo(409);assertThat(t.post(path(a)+"/cancel",Map.of("version",0,"reason"," ")).status()).isEqualTo(400);
            policy(t,terms("PER_SESSION",100000),null);assertThat(t.write("PUT","/classes/"+classroom+"/tuition-policy",Map.of("version",0,"terms",terms("PER_SESSION",120000)),true).status()).isEqualTo(400);assertThat(t.get("/enrollments/"+enrollment+"/tuition-agreements?page=-1").status()).isEqualTo(400);assertThat(p.get("/family/children/"+child+"/tuition-agreements?size=101").status()).isEqualTo(400);
        }
    }
    @Test void initialSaveAndRepeatedCreatesSerializeWithoutDuplicatePoliciesOrAgreements()throws Exception {
        try(var a=login(TEACHER);var b=login(TEACHER);var pool=Executors.newFixedThreadPool(2)){var gate=new CountDownLatch(1);var body=Map.of("terms",terms("PER_SESSION",100000));var one=pool.submit(()->{gate.await();return a.write("PUT","/classes/"+classroom+"/tuition-policy",body,true).status();});var two=pool.submit(()->{gate.await();return b.write("PUT","/classes/"+classroom+"/tuition-policy",body,true).status();});gate.countDown();assertThat(List.of(one.get(15,TimeUnit.SECONDS),two.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
            var request=copied(0,today());var writes=new CountDownLatch(1);var x=pool.submit(()->{writes.await();return a.post("/enrollments/"+enrollment+"/tuition-agreements",request);});var y=pool.submit(()->{writes.await();return b.post("/enrollments/"+enrollment+"/tuition-agreements",request);});writes.countDown();var first=x.get(15,TimeUnit.SECONDS);var second=y.get(15,TimeUnit.SECONDS);assertThat(first.status()).isEqualTo(201);assertThat(second.status()).isEqualTo(201);assertThat(first.data().path("id")).isEqualTo(second.data().path("id"));assertThat(jdbc.queryForObject("select count(*) from enrollment_tuition_agreements",Integer.class)).isEqualTo(1);
        }
    }
    @Test void overlappingConcurrentWritesAndReplacementConflictsNeverLeavePartialState()throws Exception {
        try(var a=login(TEACHER);var b=login(TEACHER);var pool=Executors.newFixedThreadPool(2)){var gate=new CountDownLatch(1);var one=pool.submit(()->{gate.await();return a.post("/enrollments/"+enrollment+"/tuition-agreements",custom("PER_SESSION",100000,today(),null)).status();});var two=pool.submit(()->{gate.await();return b.post("/enrollments/"+enrollment+"/tuition-agreements",custom("PER_SESSION",90000,today(),null)).status();});gate.countDown();assertThat(List.of(one.get(15,TimeUnit.SECONDS),two.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(201,409);
            var rows=a.get("/enrollments/"+enrollment+"/tuition-agreements").data().path("agreements").path("data");var original=rows.get(0);
            assertThat(a.post("/enrollments/"+enrollment+"/tuition-agreements",custom("MONTHLY_FIXED",800000,today().plusDays(50),today().plusDays(60))).status()).isEqualTo(409);
            assertThat(a.post(path(original)+"/end",Map.of("version",0,"effectiveTo",today().plusDays(10).toString(),"reason","Đặt mốc cho kỳ sau.")).status()).isEqualTo(200);
            create(a,enrollment,custom("MONTHLY_FIXED",800000,today().plusDays(11),today().plusDays(20)));
            var invalid=custom("PER_SESSION",70000,today().plusDays(5),today().plusDays(15));invalid.put("version",1);assertThat(a.post(path(original)+"/replace",invalid).status()).isEqualTo(409);assertThat(detail(a,original).path("effectiveTo").stringValue()).isEqualTo(today().plusDays(10).toString());assertThat(detail(a,original).path("version").longValue()).isEqualTo(1);
            var edits=new CountDownLatch(1);var left=custom("PER_SESSION",80000,today().plusDays(5),today().plusDays(10));left.put("version",1);var right=custom("PER_SESSION",85000,today().plusDays(5),today().plusDays(10));right.put("version",1);
            var x=pool.submit(()->{edits.await();return a.post(path(original)+"/replace",left).status();});var y=pool.submit(()->{edits.await();return b.post(path(original)+"/replace",right).status();});edits.countDown();assertThat(List.of(x.get(15,TimeUnit.SECONDS),y.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(201,409);assertThat(jdbc.queryForObject("select count(*) from enrollment_tuition_agreements",Integer.class)).isEqualTo(3);
        }
    }
    @Test void inactiveContextsAreReadOnlyButTheirFutureTermsCanBeClosedWithHistory()throws Exception {
        try(var t=login(TEACHER)){var a=create(t,enrollment,custom("PER_SESSION",100000,today(),null));assertThat(t.post("/classes/"+classroom+"/complete",Map.of("version",1,"reason","Kết thúc lớp.")).status()).isEqualTo(200);assertThat(t.post("/enrollments/"+otherEnrollment+"/tuition-agreements",custom("PER_SESSION",100000,today(),null)).status()).isEqualTo(409);assertThat(t.write("PUT","/classes/"+classroom+"/tuition-policy",Map.of("terms",terms("PER_SESSION",100000)),true).status()).isEqualTo(409);
            assertThat(t.post(path(a)+"/end",Map.of("version",0,"effectiveTo",today().toString(),"reason","Đóng điều kiện khi lớp kết thúc.")).status()).isEqualTo(200);assertThat(t.get(path(a)+"/history").data().size()).isEqualTo(2);
        }
    }
}

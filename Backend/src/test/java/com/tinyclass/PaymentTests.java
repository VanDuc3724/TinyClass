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
class PaymentTests {
    static final String TEACHER="payment-teacher@example.test",PARENT="payment-parent@example.test",UNVERIFIED="payment-unverified@example.test",PASSWORD="Synthetic-payment-password-2026";
    @Autowired Environment env;@Autowired JdbcTemplate jdbc;@Autowired JsonMapper json;@Autowired UserAccountRepository users;@Autowired PasswordEncoder passwords;
    UUID teacherId,parentId;String classroom,child,other,enrollment,agreement;
    LocalDate today(){return LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));}
    @BeforeEach void prepare()throws Exception {
        assertThat(jdbc.queryForObject("select current_database()",String.class)).isEqualTo("tinyclass_test");jdbc.execute("TRUNCATE users,audit_events CASCADE");
        teacherId=users.saveAndFlush(new UserAccount(TEACHER,passwords.encode(PASSWORD),"Payment teacher","TEACHER")).getId();
        var p=new UserAccount(PARENT,passwords.encode(PASSWORD),"Payment parent","PARENT");p.verifyEmail();parentId=users.saveAndFlush(p).getId();users.saveAndFlush(new UserAccount(UNVERIFIED,passwords.encode(PASSWORD),"Unverified parent","PARENT"));
        try(var t=login(TEACHER)){
            classroom=t.post("/classes",Map.of("name","Lớp ghi nhận thanh toán","capacity",4)).data().path("id").stringValue();t.post("/classes/"+classroom+"/activate",Map.of("version",0));
            child=t.post("/students",Map.of("fullName","Bé thanh toán","internalNote","Private child note")).data().path("id").stringValue();other=t.post("/students",Map.of("fullName","Bé không liên kết")).data().path("id").stringValue();enrollment=t.post("/classes/"+classroom+"/enrollments",Map.of("studentId",child)).data().path("id").stringValue();
            var r=t.post("/enrollments/"+enrollment+"/tuition-agreements",Map.of("clientRequestId",UUID.randomUUID(),"source","CUSTOM","terms",Map.of("pricingMode","PER_SESSION","collectionTiming","UPFRONT","sessionUnitPriceVnd",100000,"chargeExcusedAbsence",false,"chargeUnexcusedAbsence",true),"effectiveFrom",today().toString(),"effectiveTo",today().plusDays(30).toString()));assertThat(r.status()).as("%s",r.body()).isEqualTo(201);agreement=r.data().path("id").stringValue();
        }
        jdbc.update("insert into student_guardians(id,student_id,guardian_user_id,status,linked_at,created_at,updated_at) values(?,?,?,'ACTIVE',now(),now(),now())",UUID.randomUUID(),UUID.fromString(child),parentId);
    }
    ApiBrowser login(String email)throws Exception {var browser=new ApiBrowser("http://127.0.0.1:"+env.getProperty("local.server.port"),json);assertThat(browser.post("/auth/login",Map.of("email",email,"password",PASSWORD)).status()).isEqualTo(200);return browser;}
    JsonNode invoice(ApiBrowser t,long amount,boolean issue)throws Exception {
        var p=t.post("/billing/previews",Map.of("agreementId",agreement,"periodStart",today().toString(),"periodEnd",today().toString()));assertThat(p.status()).as("%s",p.body()).isEqualTo(200);
        var r=t.post("/invoices",Map.of("clientRequestId",UUID.randomUUID(),"agreementId",agreement,"periodStart",today().toString(),"periodEnd",today().toString(),"previewKey",p.data().path("previewKey").stringValue(),"lines",List.of(Map.of("description","Khoản đã trao đổi","pricingBasis","OTHER","quantity",1,"unitPriceVnd",amount,"discountVnd",0)),"adjustmentReason","Private invoice setup"));assertThat(r.status()).as("%s",r.body()).isEqualTo(201);var i=r.data();
        if(issue){r=t.post(path(i)+"/issue",Map.of("version",0,"reviewKey",i.path("reviewKey").stringValue()));assertThat(r.status()).as("%s",r.body()).isEqualTo(200);i=r.data();}return i;
    }
    String path(JsonNode invoice){return "/invoices/"+invoice.path("id").stringValue();}
    String publicPath(JsonNode invoice){return "/family/children/"+child+path(invoice);}
    Map<String,Object> payment(long version,Object amount){var body=new LinkedHashMap<String,Object>();body.put("invoiceVersion",version);body.put("amountVnd",amount);body.put("method","CASH");body.put("paidAt",Instant.now().minusSeconds(120).toString());body.put("publicNote","Public payment memo");body.put("internalNote","Private payment memo");return body;}
    ApiBrowser.Result record(ApiBrowser t,JsonNode i,String key,Map<String,Object> body)throws Exception{return t.write("POST",path(i)+"/payments",body,true,key==null?Map.of():Map.of("Idempotency-Key",key));}
    JsonNode paid(ApiBrowser t,JsonNode i,Map<String,Object> body)throws Exception{var r=record(t,i,UUID.randomUUID().toString(),body);assertThat(r.status()).as("%s",r.body()).isEqualTo(201);return r.data();}
    JsonNode detail(ApiBrowser t,JsonNode i)throws Exception{return t.get(path(i)).data();}
    ApiBrowser.Result voidPayment(ApiBrowser t,JsonNode p,long invoiceVersion,String reason)throws Exception{return t.post("/payments/"+p.path("id").stringValue()+"/void",Map.of("version",p.path("version").longValue(),"invoiceVersion",invoiceVersion,"reason",reason));}

    @Test void partialThenFullPaymentsUpdateBothTeacherAndFamilyBalances()throws Exception {
        try(var t=login(TEACHER);var parent=login(PARENT)){
            var i=invoice(t,800000,true);assertThat(i.path("paymentStatus").stringValue()).isEqualTo("UNPAID");
            var one=paid(t,i,payment(1,500000));assertThat(one.path("invoice").path("paidAmountVnd").longValue()).isEqualTo(500000);assertThat(one.path("invoice").path("outstandingAmountVnd").longValue()).isEqualTo(300000);assertThat(one.path("invoice").path("paymentStatus").stringValue()).isEqualTo("PARTIAL");
            var family=parent.get(publicPath(i)).data();assertThat(family.path("paidAmountVnd").longValue()).isEqualTo(500000);assertThat(family.path("outstandingAmountVnd").longValue()).isEqualTo(300000);
            paid(t,i,payment(2,300000));var full=detail(t,i);assertThat(full.path("paymentStatus").stringValue()).isEqualTo("PAID");assertThat(full.path("outstandingAmountVnd").longValue()).isZero();assertThat(full.path("version").longValue()).isEqualTo(3);assertThat(full.path("canRecordPayment").booleanValue()).isFalse();assertThat(full.path("canCancel").booleanValue()).isFalse();
            assertThat(parent.get("/family/children/"+child+"/invoices").data().path("invoices").path("data").get(0).path("paidAmountVnd").longValue()).isEqualTo(800000);assertThat(t.get("/invoices").data().get(0).path("outstandingAmountVnd").longValue()).isZero();
        }
    }
    @Test void fractionalZeroNegativeHugeOrInvalidMethodAndDateCannotWriteMoney()throws Exception {
        try(var t=login(TEACHER)){var i=invoice(t,800000,true);
            for(Object amount:List.of(0,-1,new BigDecimal("1.25"),1000000000001L))assertThat(record(t,i,UUID.randomUUID().toString(),payment(1,amount)).status()).isEqualTo(400);
            var b=payment(1,100000);b.put("method","CARD");assertThat(record(t,i,UUID.randomUUID().toString(),b).status()).isEqualTo(400);b=payment(1,100000);b.put("paidAt",Instant.now().plusSeconds(3600).toString());assertThat(record(t,i,UUID.randomUUID().toString(),b).status()).isEqualTo(400);b.put("paidAt","1899-12-31T12:00:00Z");assertThat(record(t,i,UUID.randomUUID().toString(),b).status()).isEqualTo(400);
            assertThat(jdbc.queryForObject("select count(*) from payments",Integer.class)).isZero();assertThat(detail(t,i).path("version").longValue()).isEqualTo(1);
        }
    }
    @Test void onlyIssuedPositiveBalanceInvoicesAcceptNewPayments()throws Exception {
        try(var t=login(TEACHER)){var draft=invoice(t,800000,false);assertThat(record(t,draft,UUID.randomUUID().toString(),payment(0,100000)).status()).isEqualTo(409);assertThat(draft.path("paymentStatus").isNull()).isTrue();assertThat(draft.path("outstandingAmountVnd").isNull()).isTrue();
            var zero=invoice(t,0,true);assertThat(zero.path("paymentStatus").stringValue()).isEqualTo("NO_PAYMENT_DUE");assertThat(zero.path("canRecordPayment").booleanValue()).isFalse();assertThat(record(t,zero,UUID.randomUUID().toString(),payment(1,1)).status()).isEqualTo(409);
            var cancelled=invoice(t,800000,true);assertThat(t.post(path(cancelled)+"/cancel",Map.of("version",1,"reason","Cancel before payment")).status()).isEqualTo(200);assertThat(record(t,cancelled,UUID.randomUUID().toString(),payment(2,100000)).status()).isEqualTo(409);assertThat(detail(t,cancelled).path("outstandingAmountVnd").isNull()).isTrue();
        }
    }
    @Test void staleInvoiceVersionAndOverpaymentHaveNoPartialWrites()throws Exception {
        try(var t=login(TEACHER)){var i=invoice(t,800000,true);assertThat(record(t,i,UUID.randomUUID().toString(),payment(0,100000)).status()).isEqualTo(409);assertThat(record(t,i,UUID.randomUUID().toString(),payment(1,800001)).status()).isEqualTo(409);paid(t,i,payment(1,500000));assertThat(record(t,i,UUID.randomUUID().toString(),payment(2,300001)).status()).isEqualTo(409);assertThat(jdbc.queryForObject("select count(*) from payments",Integer.class)).isEqualTo(1);assertThat(detail(t,i).path("paidAmountVnd").longValue()).isEqualTo(500000);}
    }
    @Test void retriesReturnOnePaymentEvenAfterFullSettlement()throws Exception {
        try(var t=login(TEACHER)){var i=invoice(t,800000,true);String key=UUID.randomUUID().toString();var b=payment(1,800000);var first=record(t,i,key,b);assertThat(first.status()).isEqualTo(201);var retry=record(t,i,key,b);assertThat(retry.status()).isEqualTo(201);assertThat(retry.data().path("payment").path("id").stringValue()).isEqualTo(first.data().path("payment").path("id").stringValue());assertThat(jdbc.queryForObject("select count(*) from payments",Integer.class)).isEqualTo(1);assertThat(jdbc.queryForObject("select count(*) from audit_events where action='PAYMENT_RECORDED' and entity_type='PAYMENT'",Integer.class)).isEqualTo(1);}
    }
    @Test void reusedKeyWithDifferentPayloadOrInvoiceAndMissingKeysAreRejected()throws Exception {
        try(var t=login(TEACHER)){var i=invoice(t,800000,true);var otherInvoice=invoice(t,800000,true);String key=UUID.randomUUID().toString();var b=payment(1,100000);assertThat(record(t,i,null,b).status()).isEqualTo(400);assertThat(record(t,i,"bad key",b).status()).isEqualTo(400);assertThat(record(t,i,key,b).status()).isEqualTo(201);assertThat(record(t,otherInvoice,key,b).status()).isEqualTo(409);b.put("publicNote","Changed payload");assertThat(record(t,i,key,b).status()).isEqualTo(409);assertThat(jdbc.queryForObject("select count(*) from payments",Integer.class)).isEqualTo(1);}
    }
    @Test void voidKeepsOriginalRecordAndRecalculatesBalancesWithPrivateAudit()throws Exception {
        try(var t=login(TEACHER)){var i=invoice(t,800000,true);var payment=paid(t,i,payment(1,500000)).path("payment");var r=voidPayment(t,payment,2,"Private correction reason");assertThat(r.status()).as("%s",r.body()).isEqualTo(200);assertThat(r.data().path("payment").path("status").stringValue()).isEqualTo("VOIDED");assertThat(r.data().path("payment").path("amountVnd").longValue()).isEqualTo(500000);assertThat(r.data().path("invoice").path("paidAmountVnd").longValue()).isZero();assertThat(r.data().path("invoice").path("outstandingAmountVnd").longValue()).isEqualTo(800000);assertThat(r.data().path("invoice").path("version").longValue()).isEqualTo(3);assertThat(t.get("/payments/"+payment.path("id").stringValue()+"/history").data().size()).isEqualTo(2);assertThat(t.get(path(i)+"/history").data().size()).isEqualTo(4);paid(t,i,payment(3,800000));assertThat(detail(t,i).path("paidAmountVnd").longValue()).isEqualTo(800000);}
    }
    @Test void paidInvoiceCannotCancelButVoidedRecordsAllowCancellation()throws Exception {
        try(var t=login(TEACHER);var parent=login(PARENT)){var i=invoice(t,800000,true);var payment=paid(t,i,payment(1,500000)).path("payment");assertThat(t.post(path(i)+"/cancel",Map.of("version",2,"reason","Cannot cancel received money")).status()).isEqualTo(409);assertThat(voidPayment(t,payment,2,"Private entry correction").status()).isEqualTo(200);assertThat(t.post(path(i)+"/cancel",Map.of("version",3,"reason","Cancel corrected invoice")).status()).isEqualTo(200);var family=parent.get(publicPath(i)).data();assertThat(family.path("status").stringValue()).isEqualTo("CANCELLED");assertThat(family.path("outstandingAmountVnd").isNull()).isTrue();assertThat(parent.get(publicPath(i)+"/payments").data().get(0).path("status").stringValue()).isEqualTo("VOIDED");}
    }
    @Test void retryAfterVoidAndInvoiceCancelNeverReappliesOldPayment()throws Exception {
        try(var t=login(TEACHER)){var i=invoice(t,800000,true);String key=UUID.randomUUID().toString();var b=payment(1,500000);var p=record(t,i,key,b).data().path("payment");voidPayment(t,p,2,"Correction");t.post(path(i)+"/cancel",Map.of("version",3,"reason","Cancel old invoice"));var r=record(t,i,key,b);assertThat(r.status()).isEqualTo(201);assertThat(r.data().path("payment").path("status").stringValue()).isEqualTo("VOIDED");assertThat(r.data().path("invoice").path("paidAmountVnd").longValue()).isZero();assertThat(jdbc.queryForObject("select count(*) from payments",Integer.class)).isEqualTo(1);}
    }
    @Test void voidRequiresCurrentBothVersionsAndNonblankReason()throws Exception {
        try(var t=login(TEACHER)){var i=invoice(t,800000,true);var p=paid(t,i,payment(1,500000)).path("payment");assertThat(voidPayment(t,p,1,"Stale invoice").status()).isEqualTo(409);assertThat(voidPayment(t,p,2," ").status()).isEqualTo(400);var r=voidPayment(t,p,2,"Correct entry");assertThat(r.status()).isEqualTo(200);assertThat(voidPayment(t,p,3,"Stale payment version").status()).isEqualTo(409);assertThat(voidPayment(t,r.data().path("payment"),3,"Current repeated state").status()).isEqualTo(200);assertThat(jdbc.queryForObject("select count(*) from audit_events where entity_type='PAYMENT' and action='PAYMENT_VOIDED'",Integer.class)).isEqualTo(1);}
    }
    @Test void concurrentIdenticalRequestsRecordOnce()throws Exception {
        try(var t=login(TEACHER);var otherBrowser=login(TEACHER);var pool=Executors.newFixedThreadPool(2)){var i=invoice(t,800000,true);var b=payment(1,500000);String key=UUID.randomUUID().toString();var start=new CountDownLatch(1);var a=pool.submit(()->{start.await();return record(t,i,key,b);});var c=pool.submit(()->{start.await();return record(otherBrowser,i,key,b);});start.countDown();var first=a.get(20,TimeUnit.SECONDS);var second=c.get(20,TimeUnit.SECONDS);assertThat(first.status()).isEqualTo(201);assertThat(second.status()).isEqualTo(201);assertThat(first.data().path("payment").path("id").stringValue()).isEqualTo(second.data().path("payment").path("id").stringValue());assertThat(detail(t,i).path("paidAmountVnd").longValue()).isEqualTo(500000);assertThat(jdbc.queryForObject("select count(*) from payments",Integer.class)).isEqualTo(1);}
    }
    @Test void concurrentDifferentPaymentsNeverExceedRemaining()throws Exception {
        try(var t=login(TEACHER);var otherBrowser=login(TEACHER);var pool=Executors.newFixedThreadPool(2)){var i=invoice(t,800000,true);var b1=payment(1,500000);var b2=payment(1,500000);var start=new CountDownLatch(1);var a=pool.submit(()->{start.await();return record(t,i,UUID.randomUUID().toString(),b1);});var c=pool.submit(()->{start.await();return record(otherBrowser,i,UUID.randomUUID().toString(),b2);});start.countDown();assertThat(List.of(a.get(20,TimeUnit.SECONDS).status(),c.get(20,TimeUnit.SECONDS).status())).containsExactlyInAnyOrder(201,409);assertThat(detail(t,i).path("paidAmountVnd").longValue()).isEqualTo(500000);assertThat(detail(t,i).path("outstandingAmountVnd").longValue()).isEqualTo(300000);}
    }
    @Test void paymentAndInvoiceCancelSerializeWithoutReceivingOnCancelledInvoice()throws Exception {
        try(var t=login(TEACHER);var otherBrowser=login(TEACHER);var pool=Executors.newFixedThreadPool(2)){var i=invoice(t,800000,true);var b=payment(1,500000);var start=new CountDownLatch(1);var a=pool.submit(()->{start.await();return record(t,i,UUID.randomUUID().toString(),b);});var c=pool.submit(()->{start.await();return otherBrowser.post(path(i)+"/cancel",Map.of("version",1,"reason","Concurrent cancellation"));});start.countDown();int recorded=a.get(20,TimeUnit.SECONDS).status(),cancelled=c.get(20,TimeUnit.SECONDS).status();assertThat(recorded==201&&cancelled==409||recorded==409&&cancelled==200).isTrue();var row=detail(t,i);if(recorded==201){assertThat(row.path("status").stringValue()).isEqualTo("ISSUED");assertThat(row.path("paidAmountVnd").longValue()).isEqualTo(500000);}else{assertThat(row.path("status").stringValue()).isEqualTo("CANCELLED");assertThat(row.path("paidAmountVnd").longValue()).isZero();}}
    }
    @Test void concurrentVoidAndNewPaymentUseOneInvoiceVersion()throws Exception {
        try(var t=login(TEACHER);var otherBrowser=login(TEACHER);var pool=Executors.newFixedThreadPool(2)){
            var i=invoice(t,800000,true);var p=paid(t,i,payment(1,500000)).path("payment");var b=payment(2,300000);var start=new CountDownLatch(1);
            var a=pool.submit(()->{start.await();return voidPayment(t,p,2,"Concurrent correction");});var c=pool.submit(()->{start.await();return record(otherBrowser,i,UUID.randomUUID().toString(),b);});start.countDown();int voided=a.get(20,TimeUnit.SECONDS).status(),recorded=c.get(20,TimeUnit.SECONDS).status();
            assertThat(voided==200&&recorded==409||voided==409&&recorded==201).isTrue();long expected=voided==200?0:800000;
            assertThat(detail(t,i).path("paidAmountVnd").longValue()).isEqualTo(expected);assertThat(detail(t,i).path("outstandingAmountVnd").longValue()).isEqualTo(800000-expected);
        }
    }
    @Test void familyLedgerExcludesPrivateFieldsSurvivesWithdrawalAndRevokesByExactChild()throws Exception {
        try(var t=login(TEACHER);var parent=login(PARENT)){var i=invoice(t,800000,true);var p=paid(t,i,payment(1,500000)).path("payment");voidPayment(t,p,2,"Private correction reason");paid(t,i,payment(3,300000));var r=parent.get(publicPath(i)+"/payments");assertThat(r.status()).isEqualTo(200);assertThat(r.body().toString()).doesNotContain("Private","internalNote","voidReason","recordedBy","version","idempotencyKey","requestHash","teacherId");assertThat(r.data().size()).isEqualTo(2);assertThat(parent.get("/family/children/"+other+path(i)+"/payments").status()).isEqualTo(404);jdbc.update("update class_enrollments set status='WITHDRAWN',ended_at=now() where id=?",UUID.fromString(enrollment));jdbc.update("update students set status='ARCHIVED' where id=?",UUID.fromString(child));assertThat(parent.get(publicPath(i)+"/payments").status()).isEqualTo(200);assertThat(parent.get(publicPath(i)).data().path("paidAmountVnd").longValue()).isEqualTo(300000);jdbc.update("update student_guardians set status='REVOKED',revoked_at=now() where student_id=?",UUID.fromString(child));assertThat(parent.get(publicPath(i)+"/payments").status()).isEqualTo(404);assertThat(parent.get(publicPath(i)).status()).isEqualTo(404);}
    }
    @Test void historicalUpfrontPaymentAllMethodsAndMaximumAmountRemainExact()throws Exception {
        try(var t=login(TEACHER)){var i=invoice(t,1000000000000L,true);int version=1;for(String method:List.of("CASH","BANK_TRANSFER","OTHER")){var b=payment(version,100000);b.put("method",method);b.put("paidAt",today().minusDays(2).atTime(10,0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant().toString());paid(t,i,b);version++;}paid(t,i,payment(version,999999700000L));assertThat(detail(t,i).path("paidAmountVnd").longValue()).isEqualTo(1000000000000L);assertThat(detail(t,i).path("paymentStatus").stringValue()).isEqualTo("PAID");}
    }
    @Test void rolesCsrfPaginationDraftPrivacyAndSourceChangesAreChecked()throws Exception {
        try(var t=login(TEACHER);var parent=login(PARENT);var unverified=login(UNVERIFIED)){
            var i=invoice(t,800000,true);var b=payment(1,100000);assertThat(parent.write("POST",path(i)+"/payments",b,true,Map.of("Idempotency-Key",UUID.randomUUID().toString())).status()).isEqualTo(403);assertThat(t.write("POST",path(i)+"/payments",b,false,Map.of("Idempotency-Key",UUID.randomUUID().toString())).status()).isEqualTo(403);assertThat(unverified.get(publicPath(i)+"/payments").status()).isEqualTo(403);assertThat(t.get(path(i)+"/payments?page=-1").status()).isEqualTo(400);assertThat(t.get("/payments/"+UUID.randomUUID()).status()).isEqualTo(404);var draft=invoice(t,800000,false);assertThat(parent.get(publicPath(draft)+"/payments").status()).isEqualTo(404);
            jdbc.update("update classes set end_date=? where id=?",today().minusDays(1),UUID.fromString(classroom));assertThat(detail(t,i).path("sourceChanged").booleanValue()).isTrue();paid(t,i,b);assertThat(detail(t,i).path("paidAmountVnd").longValue()).isEqualTo(100000);
        }
    }
}

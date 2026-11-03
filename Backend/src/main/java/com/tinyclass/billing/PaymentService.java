package com.tinyclass.billing;

import com.tinyclass.billing.PaymentDtos.*;
import com.tinyclass.common.api.*;
import com.tinyclass.common.persistence.DomainStore;
import com.tinyclass.family.GuardianService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import static com.tinyclass.common.persistence.DomainStore.*;

@Service
@Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
public class PaymentService {
    private static final String TEACHER_ROW="select p.*,i.teacher_id,i.invoice_code,i.status as invoice_status,u.display_name as recorded_by_name,v.display_name as voided_by_name from payments p join invoices i on i.id=p.invoice_id join users u on u.id=p.recorded_by left join users v on v.id=p.voided_by ";
    private final DomainStore db;private final PaymentLedger ledger;private final GuardianService guardians;
    public PaymentService(DomainStore db,PaymentLedger ledger,GuardianService guardians){this.db=db;this.ledger=ledger;this.guardians=guardians;}

    @Transactional
    public Map<String,Object> record(UUID teacher,UUID invoice,String requestKey,RecordInput input,String trace){
        if(requestKey==null||!requestKey.matches("[A-Za-z0-9][A-Za-z0-9._:-]{7,99}"))throw problem("INVALID_IDEMPOTENCY_KEY","Yêu cầu ghi thu cần mã gửi hợp lệ. Đóng và mở lại biểu mẫu nếu chưa có mã.");
        var row=ledger.lockInvoice(teacher,invoice);String fingerprint=hash(db.json(Arrays.asList(invoice,input.invoiceVersion(),input.amountVnd().longValueExact(),input.method(),input.paidAt(),clean(input.publicNote()),clean(input.internalNote()))));
        var previous=db.rows("select id,request_hash from payments where recorded_by=? and idempotency_key=?",teacher,requestKey);
        if(!previous.isEmpty()){
            if(!fingerprint.equals(previous.getFirst().get("requestHash")))throw conflict("PAYMENT_REQUEST_REUSED","Mã gửi đã dùng cho nội dung hoặc phiếu khác. Đối chiếu khoản thu đã lưu trước khi mở biểu mẫu mới.");
            return result(teacher,id(previous.getFirst(),"id"),row);
        }
        version(row,input.invoiceVersion());requireIssued(row);
        long amount=input.amountVnd().longValueExact();long remaining=number(row,"totalAmountVnd")-ledger.paid(invoice);
        if(remaining<=0)throw conflict("INVOICE_ALREADY_SETTLED","Phiếu không còn số tiền cần thu. Cập nhật để xem các khoản đã ghi nhận.");
        if(amount>remaining)throw conflict("PAYMENT_EXCEEDS_REMAINING","Số tiền vượt phần còn lại của phiếu. Cập nhật số liệu trước khi ghi thu.");
        int year=input.paidAt().atZone(ZoneId.of("Asia/Ho_Chi_Minh")).getYear();
        if(year<1900||year>2200||input.paidAt().isAfter(Instant.now().plusSeconds(60)))throw problem("INVALID_PAYMENT_DATE","Ngày nhận tiền trong năm 1900–2200 và không ở tương lai.");
        var beforeInvoice=ledger.auditSnapshot(row);UUID payment=UUID.randomUUID();
        db.update("insert into payments(id,invoice_id,amount_vnd,method,paid_at,recorded_by,public_note,internal_note,idempotency_key,request_hash) values(?,?,?,?,?,?,?,?,?,?)",payment,invoice,amount,input.method(),Timestamp.from(input.paidAt()),teacher,clean(input.publicNote()),clean(input.internalNote()),requestKey,fingerprint);
        bump(invoice);var afterPayment=detail(teacher,payment);var afterInvoice=ledger.auditSnapshot(ledger.ownedInvoice(teacher,invoice));
        audit(teacher,"PAYMENT_RECORDED","PAYMENT",payment,Map.of(),afterPayment,null,trace);audit(teacher,"PAYMENT_RECORDED","INVOICE",invoice,beforeInvoice,afterInvoice,null,trace);return result(teacher,payment,ledger.ownedInvoice(teacher,invoice));
    }

    @Transactional
    public Map<String,Object> voidPayment(UUID teacher,UUID payment,VoidInput input,String trace){
        var reference=detail(teacher,payment);UUID invoice=id(reference,"invoiceId");var row=ledger.lockInvoice(teacher,invoice);var before=detail(teacher,payment);
        version(row,input.invoiceVersion());version(before,input.version());
        if("VOIDED".equals(before.get("status")))return result(teacher,payment,row);requireIssued(row);
        var beforeInvoice=ledger.auditSnapshot(row);
        db.update("update payments set status='VOIDED',voided_at=clock_timestamp(),voided_by=?,void_reason=?,updated_at=clock_timestamp(),version=version+1 where id=?",teacher,input.reason().strip(),payment);bump(invoice);
        var after=detail(teacher,payment);var afterInvoice=ledger.auditSnapshot(ledger.ownedInvoice(teacher,invoice));
        audit(teacher,"PAYMENT_VOIDED","PAYMENT",payment,before,after,input.reason().strip(),trace);audit(teacher,"PAYMENT_VOIDED","INVOICE",invoice,beforeInvoice,afterInvoice,input.reason().strip(),trace);return result(teacher,payment,ledger.ownedInvoice(teacher,invoice));
    }
    public Map<String,Object> detail(UUID teacher,UUID payment){return teacherRow(db.one(TEACHER_ROW+"where p.id=? and i.teacher_id=?",payment,teacher));}
    public PageResponse<Map<String,Object>> list(UUID teacher,UUID invoice,int page,int size){
        ledger.ownedInvoice(teacher,invoice);pagination(page,size);long total=db.count("select count(*) from payments where invoice_id=?",invoice);
        var rows=db.rows(TEACHER_ROW+"where p.invoice_id=? and i.teacher_id=? order by p.paid_at desc,p.created_at desc,p.id desc limit ? offset ?",invoice,teacher,size,(long)page*size).stream().map(this::teacherRow).toList();return db.page(rows,total,page,size);
    }
    public PageResponse<Map<String,Object>> history(UUID teacher,UUID payment,int page,int size){
        detail(teacher,payment);pagination(page,size);long total=db.count("select count(*) from audit_events where entity_type='PAYMENT' and entity_id=?",payment);
        return db.page(db.rows("select a.id,a.action,a.changed_fields,a.reason,a.created_at,u.display_name as actor_name from audit_events a join users u on u.id=a.actor_id where a.entity_type='PAYMENT' and a.entity_id=? order by a.created_at desc,a.id desc limit ? offset ?",payment,size,(long)page*size),total,page,size);
    }
    public PageResponse<Map<String,Object>> familyList(UUID parent,UUID child,UUID invoice,int page,int size){
        guardians.child(parent,child);db.one("select id from invoices where id=? and student_id=? and issued_at is not null",invoice,child);pagination(page,size);
        long total=db.count("select count(*) from payments where invoice_id=?",invoice);
        return db.page(db.rows("select id,amount_vnd,method,paid_at,status,public_note,created_at,voided_at from payments where invoice_id=? order by paid_at desc,created_at desc,id desc limit ? offset ?",invoice,size,(long)page*size),total,page,size);
    }
    private Map<String,Object> teacherRow(Map<String,Object> row){var r=new LinkedHashMap<>(row);r.remove("idempotencyKey");r.remove("requestHash");r.put("canVoid","RECORDED".equals(r.get("status"))&&"ISSUED".equals(r.get("invoiceStatus")));return r;}
    private Map<String,Object> result(UUID teacher,UUID payment,Map<String,Object> invoice){return Map.of("payment",detail(teacher,payment),"invoice",ledger.balance(invoice));}
    private void bump(UUID invoice){db.update("update invoices set updated_at=clock_timestamp(),version=version+1 where id=?",invoice);}
    private void requireIssued(Map<String,Object> invoice){if(!"ISSUED".equals(invoice.get("status")))throw conflict("PAYMENT_INVOICE_NOT_ISSUED","Chỉ ghi hoặc điều chỉnh khoản thu của phiếu đã phát hành còn hiệu lực.");}
    private void audit(UUID actor,String action,String entity,UUID id,Map<String,Object> before,Map<String,Object> after,String reason,String trace){db.audit(actor,action,entity,id,Map.of("before",before,"after",after),reason,trace);}
    private static String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException failure){throw new IllegalStateException(failure);}}
}

package com.tinyclass.billing;

import com.tinyclass.common.persistence.DomainStore;
import org.springframework.stereotype.Component;
import java.util.*;
import static com.tinyclass.common.persistence.DomainStore.*;

/** Payment totals are derived from the effective ledger, never accepted from a client. */
@Component
public class PaymentLedger {
    private final DomainStore db;
    public PaymentLedger(DomainStore db){this.db=db;}
    public long paid(UUID invoice){return db.count("select coalesce(sum(amount_vnd),0) from payments where invoice_id=? and status='RECORDED'",invoice);}
    public Map<String,Object> decorate(Map<String,Object> invoice){return decorate(invoice,paid(id(invoice,"id")));}
    public Map<String,Object> decorate(Map<String,Object> invoice,long paid){
        boolean issued="ISSUED".equals(invoice.get("status"));long total=number(invoice,"totalAmountVnd");
        invoice.put("paidAmountVnd",paid);invoice.put("outstandingAmountVnd",issued?total-paid:null);
        invoice.put("paymentStatus",!issued?null:total==0?"NO_PAYMENT_DUE":paid==0?"UNPAID":paid<total?"PARTIAL":"PAID");return invoice;
    }
    public Map<String,Object> ownedInvoice(UUID teacher,UUID invoice){return db.one("select * from invoices where id=? and teacher_id=?",invoice,teacher);}
    public Map<String,Object> lockInvoice(UUID teacher,UUID invoice){
        var reference=ownedInvoice(teacher,invoice);
        db.one("select id from classes where id=? and teacher_id=? for update",id(reference,"classId"),teacher);
        db.one("select id from students where id=? and teacher_id=? for update",id(reference,"studentId"),teacher);
        db.one("select id from class_enrollments where id=? for update",id(reference,"enrollmentId"));
        db.one("select id from invoices where id=? and teacher_id=? for update",invoice,teacher);
        return ownedInvoice(teacher,invoice);
    }
    public Map<String,Object> auditSnapshot(Map<String,Object> row){
        var r=new LinkedHashMap<>(row);r.remove("clientRequestId");r.remove("requestHash");
        r.put("studentName",r.remove("studentNameSnapshot"));r.put("className",r.remove("classNameSnapshot"));
        r.put("lines",db.rows("select id,position,description,pricing_basis,quantity,unit_price_vnd,discount_vnd,amount_vnd from invoice_lines where invoice_id=? and is_active order by position",id(row,"id")));return decorate(r);
    }
    public Map<String,Object> balance(Map<String,Object> row){
        var value=decorate(new LinkedHashMap<>(row));var result=new LinkedHashMap<String,Object>();
        for(String key:List.of("id","version","status","totalAmountVnd","paidAmountVnd","outstandingAmountVnd","paymentStatus"))result.put(key,value.get(key));
        result.put("canRecordPayment","ISSUED".equals(value.get("status"))&&number(value,"outstandingAmountVnd")>0);
        result.put("canCancel",!"CANCELLED".equals(value.get("status"))&&number(value,"paidAmountVnd")==0);return result;
    }
}

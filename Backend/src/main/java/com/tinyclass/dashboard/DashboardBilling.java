package com.tinyclass.dashboard;

import com.tinyclass.billing.InvoiceCollection;
import com.tinyclass.common.persistence.DomainStore;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;

/** Aggregate VND uses integer strings so a large sum never loses JavaScript precision. */
@Component
public class DashboardBilling {
    private static final ZoneId ZONE=ZoneId.of("Asia/Ho_Chi_Minh");
    private final DomainStore db;
    public DashboardBilling(DomainStore db){this.db=db;}
    public Map<String,Object> summary(UUID teacher,UUID classroom,UUID child,LocalDate today){
        String where=" where i.teacher_id=?";var args=new ArrayList<Object>();args.add(teacher);
        if(classroom!=null){where+=" and i.class_id=?";args.add(classroom);}if(child!=null){where+=" and i.student_id=?";args.add(child);}
        String source="select i.*,"+InvoiceCollection.paid("i")+" as paid from invoices i"+where+" and i.status='ISSUED'";
        var summaryArgs=new ArrayList<Object>(args);summaryArgs.add(today);
        var totals=db.one("with effective as ("+source+") select count(*) filter(where total_amount_vnd>paid) as open_invoice_count,count(*) filter(where total_amount_vnd>paid and due_on<?) as overdue_invoice_count,coalesce(sum(total_amount_vnd-paid) filter(where total_amount_vnd>paid),0) as outstanding_amount_vnd from effective",summaryArgs.toArray());
        totals.put("outstandingAmountVnd",integer(totals.get("outstandingAmountVnd")));
        var monthArgs=new ArrayList<Object>(args);monthArgs.add(Timestamp.from(today.withDayOfMonth(1).atStartOfDay(ZONE).toInstant()));monthArgs.add(Timestamp.from(today.withDayOfMonth(1).plusMonths(1).atStartOfDay(ZONE).toInstant()));
        var received=db.one("select coalesce(sum(p.amount_vnd),0) as amount from payments p join invoices i on i.id=p.invoice_id"+where+" and i.issued_at is not null and p.status='RECORDED' and p.paid_at>=? and p.paid_at<?",monthArgs.toArray());
        totals.put("receivedThisMonthVnd",integer(received.get("amount")));totals.put("monthStart",today.withDayOfMonth(1));
        var dueArgs=new ArrayList<Object>(args);dueArgs.add(today);
        totals.put("dueInvoices",db.rows("with effective as ("+source+") select id,invoice_code,student_name_snapshot as student_name,class_name_snapshot as class_name,due_on,total_amount_vnd,paid as paid_amount_vnd,(total_amount_vnd-paid) as outstanding_amount_vnd from effective where total_amount_vnd>paid order by (due_on<?) desc nulls last,due_on asc nulls last,issued_at,id limit 4",dueArgs.toArray()));return totals;
    }
    private static String integer(Object value){return new BigDecimal(value.toString()).toBigIntegerExact().toString();}
}

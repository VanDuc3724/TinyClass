package com.tinyclass.billing;

import java.time.LocalDate;
import java.util.List;
import static com.tinyclass.common.persistence.DomainStore.*;

/** Shared definition for dashboard totals and invoice search. */
public final class InvoiceCollection {
    private InvoiceCollection() {}
    public static String paid(String alias){return "(select coalesce(sum(p.amount_vnd),0) from payments p where p.invoice_id="+alias+".id and p.status='RECORDED')";}
    public static String filter(String alias,String collection,List<Object> args,LocalDate today){
        if(clean(collection)==null)return "";
        String issued=" and "+alias+".status='ISSUED'";
        return switch(collection){
            case "OPEN"->issued+" and "+alias+".total_amount_vnd>"+paid(alias);
            case "OVERDUE"->{args.add(today);yield issued+" and "+alias+".total_amount_vnd>"+paid(alias)+" and "+alias+".due_on<?";}
            case "SETTLED"->issued+" and "+alias+".total_amount_vnd="+paid(alias);
            default->throw problem("INVALID_COLLECTION_FILTER","Chọn phiếu còn phải thu, quá hạn hoặc đã đủ/không cần thu.");
        };
    }
}

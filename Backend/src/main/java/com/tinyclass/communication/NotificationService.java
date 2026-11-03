package com.tinyclass.communication;

import com.tinyclass.common.api.*;
import com.tinyclass.common.persistence.DomainStore;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.util.*;
import static com.tinyclass.common.persistence.DomainStore.*;

@Service
@Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
public class NotificationService {
    // The same predicate protects page contents, counts, badges, detail and read/open.
    private static final String VISIBLE="""
         from notifications n join users u on u.id=n.recipient_user_id
         join students st on st.id=n.related_student_id and st.teacher_id=n.teacher_id
         left join classes c on c.id=n.related_class_id and c.teacher_id=n.teacher_id
         left join payments payment on n.source_type='PAYMENT' and payment.id=n.source_id
         where n.recipient_user_id=? and u.status='ACTIVE' and (
          (u.role='TEACHER' and u.id=n.teacher_id and n.type='SUBMISSION_SENT' and n.source_type='SUBMISSION'
           and exists(select 1 from submissions x join assignment_items i on i.id=x.assignment_item_id join assignments a on a.id=i.assignment_id where x.id=n.source_id and x.student_id=st.id and x.status<>'DRAFT' and a.teacher_id=u.id))
          or (u.role='PARENT' and u.email_verified_at is not null
           and exists(select 1 from student_guardians g where g.student_id=st.id and g.guardian_user_id=u.id and g.status='ACTIVE') and (
            (n.source_type='ANNOUNCEMENT' and st.status='ACTIVE' and c.status in('ACTIVE','COMPLETED')
             and exists(select 1 from class_announcements a where a.id=n.source_id and a.class_id=c.id and a.teacher_id=n.teacher_id and a.status='PUBLISHED')
             and exists(select 1 from class_enrollments e where e.student_id=st.id and e.class_id=c.id and e.status in('ACTIVE','COMPLETED')))
            or (n.source_type='ASSIGNMENT' and st.status='ACTIVE'
             and exists(select 1 from assignments a join assignment_recipients r on r.assignment_id=a.id left join class_enrollments e on e.id=r.source_enrollment_id where a.id=n.source_id and a.teacher_id=n.teacher_id and a.status='PUBLISHED' and r.student_id=st.id and r.revoked_at is null and (a.target_type='STUDENT' or (a.class_id=c.id and c.status in('ACTIVE','COMPLETED') and e.status in('ACTIVE','COMPLETED')))))
            or (n.source_type='SUBMISSION' and n.type='SUBMISSION_REVIEWED'
             and exists(select 1 from submissions x join assignment_items i on i.id=x.assignment_item_id join assignments a on a.id=i.assignment_id where x.id=n.source_id and x.student_id=st.id and x.status<>'DRAFT' and x.reviewed_at is not null and a.teacher_id=n.teacher_id))
            or (n.source_type='SESSION' and st.status='ACTIVE'
             and exists(select 1 from class_sessions s join class_enrollments e on e.class_id=s.class_id where s.id=n.source_id and s.class_id=c.id and e.student_id=st.id and s.ends_at>e.joined_at and ((e.status='ACTIVE' and c.status='ACTIVE') or (e.status='COMPLETED' and c.status='COMPLETED' and s.starts_at<=e.ended_at))))
            or (n.source_type='INVOICE' and exists(select 1 from invoices i where i.id=n.source_id and i.student_id=st.id and i.teacher_id=n.teacher_id and i.issued_at is not null))
            or (n.source_type='PAYMENT' and exists(select 1 from invoices i where i.id=payment.invoice_id and i.student_id=st.id and i.teacher_id=n.teacher_id and i.issued_at is not null))
           ))
         )
        """;
    private static final String SELECT="select n.id,n.type,n.source_type,n.source_id,n.related_student_id as student_id,n.related_class_id as class_id,st.full_name as student_name,c.name as class_name,n.created_at,n.read_at,u.role,payment.invoice_id as payment_invoice_id ";
    private static final Map<String,String> TITLES=Map.ofEntries(
        Map.entry("ANNOUNCEMENT_PUBLISHED","Cô vừa đăng thông báo lớp"),Map.entry("ANNOUNCEMENT_UPDATED","Thông báo lớp đã được cập nhật"),
        Map.entry("ASSIGNMENT_PUBLISHED","Có bài học được giao cho bé"),Map.entry("SUBMISSION_SENT","Gia đình vừa gửi sản phẩm"),
        Map.entry("SUBMISSION_REVIEWED","Cô đã phản hồi sản phẩm"),Map.entry("SESSION_CHANGED","Lịch học có cập nhật"),Map.entry("SESSION_CANCELLED","Một buổi học đã được hủy"),
        Map.entry("INVOICE_ISSUED","Có phiếu học phí được phát hành"),Map.entry("PAYMENT_RECORDED","Cô đã ghi nhận khoản thanh toán"),Map.entry("PAYMENT_VOIDED","Một bản ghi thanh toán đã được điều chỉnh"));
    private final DomainStore db;
    public NotificationService(DomainStore db){this.db=db;}
    public PageResponse<Map<String,Object>> list(UUID actor,String status,int page,int size){
        requireAccount(actor);pagination(page,size);String filter=filter(status);
        long total=db.count("select count(*)"+VISIBLE+filter,actor);
        return db.page(db.rows(SELECT+VISIBLE+filter+" order by n.created_at desc,n.id desc limit ? offset ?",actor,size,(long)page*size).stream().map(this::view).toList(),total,page,size);
    }
    public Map<String,Object> unread(UUID actor){requireAccount(actor);return Map.of("unreadCount",db.count("select count(*)"+VISIBLE+" and n.read_at is null",actor));}
    public Map<String,Object> overview(UUID actor,UUID child,UUID classroom){
        requireAccount(actor);String filter="";var args=new ArrayList<Object>();args.add(actor);
        if(child!=null){filter+=" and n.related_student_id=?";args.add(child);}if(classroom!=null){filter+=" and n.related_class_id=?";args.add(classroom);}
        long unread=db.count("select count(*)"+VISIBLE+filter+" and n.read_at is null",args.toArray());
        return Map.of("unreadCount",unread,"recent",db.rows(SELECT+VISIBLE+filter+" order by n.created_at desc,n.id desc limit 3",args.toArray()).stream().map(this::view).toList());
    }
    public Map<String,Object> detail(UUID actor,UUID id){requireAccount(actor);return view(db.one(SELECT+VISIBLE+" and n.id=?",actor,id));}
    @Transactional
    public Map<String,Object> read(UUID actor,UUID id){
        detail(actor,id);db.update("update notifications set read_at=coalesce(read_at,clock_timestamp()) where id=? and recipient_user_id=?",id,actor);return detail(actor,id);
    }
    private void requireAccount(UUID actor){
        var u=db.one("select role,email_verified_at from users where id=? and status='ACTIVE'",actor);
        if("PARENT".equals(u.get("role"))&&u.get("emailVerifiedAt")==null)throw new ApiException(HttpStatus.FORBIDDEN,"EMAIL_VERIFICATION_REQUIRED","Xác minh email trước khi xem cập nhật của bé.");
    }
    private String filter(String status){if(clean(status)==null)return "";return switch(status){case "UNREAD"->" and n.read_at is null";case "READ"->" and n.read_at is not null";default->throw problem("INVALID_STATUS","Chọn cập nhật đã đọc hoặc chưa đọc.");};}
    private Map<String,Object> view(Map<String,Object> original){
        var r=new LinkedHashMap<>(original);String type=text(r,"sourceType"),source=text(r,"sourceId"),child=text(r,"studentId"),root="/family/children/"+child;
        String target="TEACHER".equals(r.get("role"))?"/teacher/reviews/"+source:switch(type){
            case "ANNOUNCEMENT"->root+"/announcements/"+source;case "ASSIGNMENT"->root+"/learning/assignments/"+source;
            case "SUBMISSION"->root+"/submissions/"+source;case "SESSION"->root+"/schedule";
            case "INVOICE"->root+"/invoices/"+source;case "PAYMENT"->root+"/invoices/"+r.get("paymentInvoiceId");default->throw missing();};
        r.put("title",TITLES.get(text(r,"type")));r.put("targetPath",target);
        for(String key:List.of("sourceType","sourceId","paymentInvoiceId","role"))r.remove(key);return r;
    }
}

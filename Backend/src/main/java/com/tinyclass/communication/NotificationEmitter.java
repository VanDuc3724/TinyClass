package com.tinyclass.communication;

import com.tinyclass.common.persistence.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.*;
import java.util.*;
import static com.tinyclass.common.persistence.DomainStore.*;

/** Rows commit with the business change. No email, asynchronous side effect, or private payload. */
@Component
public class NotificationEmitter {
    private final DomainStore db;
    public NotificationEmitter(DomainStore db){this.db=db;}
    @TransactionalEventListener(phase=TransactionPhase.BEFORE_COMMIT)
    public void onChange(BusinessChange event){
        UUID source=event.entityId();String action=event.action();
        if("ANNOUNCEMENT".equals(event.entityType())&&Set.of("ANNOUNCEMENT_PUBLISHED","ANNOUNCEMENT_UPDATED").contains(action)){
            var a=db.one("select * from class_announcements where id=?",source);
            if("PUBLISHED".equals(a.get("status")))for(var child:classChildren(id(a,"classId")))parents(id(a,"teacherId"),id(child,"studentId"),id(a,"classId"),"ANNOUNCEMENT",source,action,number(a,"publicationRevision"));
        }else if("ASSIGNMENT".equals(event.entityType())&&Set.of("ASSIGNMENT_PUBLISH","ASSIGNMENT_RECIPIENTS_GRANTED").contains(action)){
            var a=db.one("select * from assignments where id=?",source);
            if("PUBLISHED".equals(a.get("status")))for(var child:db.rows("select r.student_id from assignment_recipients r join assignments a on a.id=r.assignment_id where r.assignment_id=? and r.revoked_at is null and (? or r.granted_at=a.updated_at)",source,"ASSIGNMENT_PUBLISH".equals(action)))parents(id(a,"teacherId"),id(child,"studentId"),id(a,"classId"),"ASSIGNMENT",source,"ASSIGNMENT_PUBLISHED",number(a,"version"));
        }else if("SUBMISSION".equals(event.entityType())&&Set.of("SUBMISSION_SUBMITTED","SUBMISSION_ACCEPTED","SUBMISSION_CHANGES_REQUESTED").contains(action)){
            var x=db.one("select x.*,a.teacher_id,a.class_id from submissions x join assignment_items i on i.id=x.assignment_item_id join assignments a on a.id=i.assignment_id where x.id=?",source);
            if("SUBMISSION_SUBMITTED".equals(action))insert(id(x,"teacherId"),id(x,"teacherId"),id(x,"studentId"),id(x,"classId"),"SUBMISSION",source,"SUBMISSION_SENT",number(x,"version"));
            else parents(id(x,"teacherId"),id(x,"studentId"),id(x,"classId"),"SUBMISSION",source,"SUBMISSION_REVIEWED",number(x,"version"));
        }else if("SESSION".equals(event.entityType())&&Set.of("SESSION_CREATED","SESSION_UPDATED","SESSION_CANCELLED").contains(action)){
            var s=db.one("select s.*,c.teacher_id from class_sessions s join classes c on c.id=s.class_id where s.id=?",source);
            for(var child:classChildren(id(s,"classId")))parents(id(s,"teacherId"),id(child,"studentId"),id(s,"classId"),"SESSION",source,"SESSION_CANCELLED".equals(action)?"SESSION_CANCELLED":"SESSION_CHANGED",number(s,"version"));
        }else if("INVOICE".equals(event.entityType())&&"INVOICE_ISSUED".equals(action)){
            var i=db.one("select * from invoices where id=?",source);parents(id(i,"teacherId"),id(i,"studentId"),id(i,"classId"),"INVOICE",source,action,number(i,"version"));
        }else if("PAYMENT".equals(event.entityType())&&Set.of("PAYMENT_RECORDED","PAYMENT_VOIDED").contains(action)){
            var p=db.one("select p.version,i.teacher_id,i.student_id,i.class_id from payments p join invoices i on i.id=p.invoice_id where p.id=?",source);parents(id(p,"teacherId"),id(p,"studentId"),id(p,"classId"),"PAYMENT",source,action,number(p,"version"));
        }
    }
    private List<Map<String,Object>> classChildren(UUID classroom){return db.rows("select e.student_id from class_enrollments e join students s on s.id=e.student_id join classes c on c.id=e.class_id where e.class_id=? and e.status in('ACTIVE','COMPLETED') and c.status in('ACTIVE','COMPLETED') and s.status='ACTIVE'",classroom);}
    private void parents(UUID teacher,UUID child,UUID classroom,String sourceType,UUID source,String type,long revision){
        for(var guardian:db.rows("select g.guardian_user_id from student_guardians g join users u on u.id=g.guardian_user_id where g.student_id=? and g.status='ACTIVE' and u.role='PARENT' and u.status='ACTIVE' and u.email_verified_at is not null",child))insert(id(guardian,"guardianUserId"),teacher,child,classroom,sourceType,source,type,revision);
    }
    private void insert(UUID recipient,UUID teacher,UUID child,UUID classroom,String sourceType,UUID source,String type,long revision){
        String key=type+":"+source+":"+revision+":"+child;
        db.update("insert into notifications(id,recipient_user_id,teacher_id,type,source_type,source_id,related_student_id,related_class_id,dedupe_key) values(?,?,?,?,?,?,?,?,?) on conflict(recipient_user_id,dedupe_key) do nothing",UUID.randomUUID(),recipient,teacher,type,sourceType,source,child,classroom,key);
    }
}

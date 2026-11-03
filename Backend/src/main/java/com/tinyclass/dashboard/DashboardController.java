package com.tinyclass.dashboard;

import com.tinyclass.auth.UserPrincipal;
import com.tinyclass.common.api.ApiResponse;
import com.tinyclass.common.persistence.DomainStore;
import com.tinyclass.communication.NotificationService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;

/** A consistent, owner-scoped read model for the teacher dashboard. */
@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {
    private final DomainStore db;
    private final DashboardBilling billing;
    private final NotificationService notifications;
    public DashboardController(DomainStore db,DashboardBilling billing,NotificationService notifications) { this.db = db;this.billing=billing;this.notifications=notifications; }

    @GetMapping
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ApiResponse<Map<String,Object>> summary(@AuthenticationPrincipal UserPrincipal user,
            @RequestParam(required = false) UUID classId) {
        UUID actor = user.id();
        var choices = db.rows("select id,name,status from classes where teacher_id=? order by created_at desc,id desc", actor);
        if (classId != null && choices.stream().noneMatch(c -> classId.equals(c.get("id")))) throw DomainStore.missing();
        String classFilter = classId == null ? "" : " and c.id=?";
        Object[] classArgs = classId == null ? new Object[]{actor} : new Object[]{actor,classId};
        long students = db.count("select count(distinct e.student_id) from class_enrollments e join classes c on c.id=e.class_id join students s on s.id=e.student_id where c.teacher_id=? and c.status='ACTIVE' and e.status='ACTIVE' and s.status='ACTIVE'" + classFilter,classArgs);
        long classes = db.count("select count(*) from classes c where c.teacher_id=? and c.status='ACTIVE'" + classFilter,classArgs);
        String assignmentFilter = classId == null ? "" : " and a.class_id=?";
        long assignments = db.count("select count(*) from assignments a where a.teacher_id=? and a.status='PUBLISHED'" + assignmentFilter,classArgs);
        long pending = db.count("select count(*) from submissions x join assignment_items i on i.id=x.assignment_item_id join assignments a on a.id=i.assignment_id where a.teacher_id=? and x.status='SUBMITTED'"+assignmentFilter,classArgs);
        long lessons = classId == null ? db.count("select count(*) from lessons where teacher_id=? and status='PUBLISHED'",actor) :
                db.count("select count(distinct i.lesson_id) from assignment_items i join assignments a on a.id=i.assignment_id join lessons l on l.id=i.lesson_id where a.teacher_id=? and a.status='PUBLISHED' and l.status='PUBLISHED' and a.class_id=?",actor,classId);
        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        LocalDate today = LocalDate.now(zone);
        Timestamp start = Timestamp.from(today.atStartOfDay(zone).toInstant()), end = Timestamp.from(today.plusDays(1).atStartOfDay(zone).toInstant());
        Object[] sessionArgs=classId==null?new Object[]{actor,start,end}:new Object[]{actor,start,end,classId};
        String sessionWhere=" from class_sessions s join classes c on c.id=s.class_id where c.teacher_id=? and c.status in ('ACTIVE','COMPLETED') and s.status in ('SCHEDULED','COMPLETED') and s.starts_at>=? and s.starts_at<?"+classFilter;
        long todaySessionCount=db.count("select count(*)"+sessionWhere,sessionArgs);
        long presentToday=db.count("select count(distinct ar.student_id) from attendance_records ar join (select s.id"+sessionWhere+") eligible on eligible.id=ar.session_id where ar.is_active and ar.status in ('PRESENT','LATE')",sessionArgs);
        var todaySessions=db.rows("select s.id,s.class_id,c.name as class_name,s.title,s.starts_at,s.ends_at,s.location,s.status,s.cancellation_reason"+sessionWhere+" order by s.starts_at,s.id limit 6",sessionArgs);
        String assignmentSql = "select a.id,a.title,'ASSIGNMENT' as type,a.published_at,c.name as class_name from assignments a left join classes c on c.id=a.class_id where a.teacher_id=? and a.status='PUBLISHED' and a.published_at>=? and a.published_at<?" + assignmentFilter;
        List<Map<String,Object>> activity;
        if (classId != null) activity = db.rows(assignmentSql + " order by published_at desc,id desc limit 6",actor,start,end,classId);
        else activity = db.rows("select * from (" + assignmentSql + " union all select l.id,l.title,'LESSON' as type,l.published_at,null as class_name from lessons l where l.teacher_id=? and l.status='PUBLISHED' and l.published_at>=? and l.published_at<?) activity order by published_at desc,id desc limit 6",actor,start,end,actor,start,end);
        var recentClasses = db.rows("select c.id,c.name,c.status,(select count(*) from class_enrollments e where e.class_id=c.id and e.status='ACTIVE') as active_students from classes c where c.teacher_id=?" + classFilter + " order by c.created_at desc,c.id desc limit 4",classArgs);
        var result = new LinkedHashMap<String,Object>();
        result.put("classOptions",choices); result.put("classId",classId); result.put("businessDate",today);
        result.put("students",students); result.put("activeClasses",classes); result.put("publishedLessons",lessons);
        result.put("publishedAssignments",assignments); result.put("pendingSubmissions",pending); result.put("activity",activity); result.put("recentClasses",recentClasses);
        result.put("todaySessionCount",todaySessionCount);result.put("todaySessions",todaySessions);
        result.put("presentToday",presentToday);
        result.put("billing",billing.summary(actor,classId,null,today));result.put("updates",notifications.overview(actor,null,classId));
        return ApiResponse.of(result);
    }
}

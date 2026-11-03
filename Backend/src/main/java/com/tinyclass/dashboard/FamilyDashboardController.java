package com.tinyclass.dashboard;

import com.tinyclass.auth.UserPrincipal;
import com.tinyclass.common.api.ApiResponse;
import com.tinyclass.common.persistence.DomainStore;
import com.tinyclass.family.GuardianService;
import com.tinyclass.learning.AssignmentService;
import com.tinyclass.teaching.ScheduleService;
import com.tinyclass.communication.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.*;
import org.springframework.web.bind.annotation.*;
import java.time.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1/family")
@Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
public class FamilyDashboardController {
    private static final ZoneId ZONE=ZoneId.of("Asia/Ho_Chi_Minh");
    private final DomainStore db;private final GuardianService guardians;private final AssignmentService assignments;
    private final ScheduleService schedule;private final DashboardBilling billing;private final AnnouncementService announcements;private final NotificationService notifications;
    public FamilyDashboardController(DomainStore db,GuardianService guardians,AssignmentService assignments,ScheduleService schedule,DashboardBilling billing,AnnouncementService announcements,NotificationService notifications){this.db=db;this.guardians=guardians;this.assignments=assignments;this.schedule=schedule;this.billing=billing;this.announcements=announcements;this.notifications=notifications;}
    @GetMapping("/dashboard")
    public ApiResponse<Map<String,Object>> home(@AuthenticationPrincipal UserPrincipal user){
        var updates=notifications.overview(user.id(),null,null);
        return ApiResponse.of(Map.of("businessDate",LocalDate.now(ZONE),"linkedChildren",db.count("select count(*) from student_guardians where guardian_user_id=? and status='ACTIVE'",user.id()),"updates",updates));
    }
    @GetMapping("/children/{child}/dashboard")
    public ApiResponse<Map<String,Object>> child(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child){
        var student=guardians.child(user.id(),child);Instant now=Instant.now();LocalDate today=now.atZone(ZONE).toLocalDate();
        UUID teacher=DomainStore.id(db.one("select teacher_id from students where id=?",child),"teacherId");
        var result=new LinkedHashMap<String,Object>();result.put("student",Map.of("id",student.id(),"fullName",student.fullName()));result.put("businessDate",today);
        result.put("learning",assignments.familyOverview(user.id(),child,now));result.put("schedule",schedule.familyOverview(user.id(),child,today,now));result.put("billing",billing.summary(teacher,null,child,today));
        result.put("announcements",announcements.familyOverview(user.id(),child));result.put("updates",notifications.overview(user.id(),child,null));
        result.put("awaitingReview",db.count("select count(*) from submissions where student_id=? and status='SUBMITTED'",child));
        result.put("recentFeedback",db.rows("select x.id,x.status,x.reviewed_at,l.title as lesson_title,a.title as assignment_title,c.name as class_name from submissions x join assignment_items i on i.id=x.assignment_item_id join lessons l on l.id=i.lesson_id join assignments a on a.id=i.assignment_id left join classes c on c.id=a.class_id where x.student_id=? and x.status in('ACCEPTED','CHANGES_REQUESTED') and x.reviewed_at is not null order by x.reviewed_at desc,x.id desc limit 3",child));
        return ApiResponse.of(result);
    }
}

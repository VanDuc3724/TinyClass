package com.tinyclass.communication;

import com.tinyclass.auth.UserPrincipal;
import com.tinyclass.common.api.*;
import com.tinyclass.common.web.RequestIdFilter;
import com.tinyclass.communication.AnnouncementDtos.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/api/v1")
public class CommunicationController {
    private final AnnouncementService announcements;private final NotificationService notifications;
    public CommunicationController(AnnouncementService announcements,NotificationService notifications){this.announcements=announcements;this.notifications=notifications;}
    @GetMapping("/announcements") PageResponse<Map<String,Object>> list(@AuthenticationPrincipal UserPrincipal u,@RequestParam(required=false) UUID classId,@RequestParam(required=false) String status,@RequestParam(required=false) String q,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="12") int size){return announcements.list(u.id(),classId,status,q,page,size);}
    @PostMapping("/announcements") @ResponseStatus(HttpStatus.CREATED) ApiResponse<Map<String,Object>> create(@AuthenticationPrincipal UserPrincipal u,@Valid @RequestBody CreateInput input,HttpServletRequest r){return ApiResponse.of(announcements.create(u.id(),input,trace(r)));}
    @GetMapping("/announcements/{id}") ApiResponse<Map<String,Object>> detail(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id){return ApiResponse.of(announcements.detail(u.id(),id));}
    @PutMapping("/announcements/{id}") ApiResponse<Map<String,Object>> update(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@Valid @RequestBody UpdateInput input,HttpServletRequest r){return ApiResponse.of(announcements.update(u.id(),id,input,trace(r)));}
    @PostMapping("/announcements/{id}/publish") ApiResponse<Map<String,Object>> publish(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@Valid @RequestBody ActionInput input,HttpServletRequest r){return ApiResponse.of(announcements.action(u.id(),id,"publish",input,trace(r)));}
    @PostMapping("/announcements/{id}/archive") ApiResponse<Map<String,Object>> archive(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@Valid @RequestBody ActionInput input,HttpServletRequest r){return ApiResponse.of(announcements.action(u.id(),id,"archive",input,trace(r)));}
    @GetMapping("/announcements/{id}/history") PageResponse<Map<String,Object>> history(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size){return announcements.history(u.id(),id,page,size);}
    @GetMapping("/family/children/{child}/announcements") PageResponse<Map<String,Object>> familyList(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID child,@RequestParam(required=false) UUID classId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="12") int size){return announcements.familyList(u.id(),child,classId,page,size);}
    @GetMapping("/family/children/{child}/announcements/{id}") ApiResponse<Map<String,Object>> familyDetail(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID child,@PathVariable UUID id){return ApiResponse.of(announcements.familyDetail(u.id(),child,id));}
    @PostMapping("/family/children/{child}/announcements/{id}/read") ApiResponse<Map<String,Object>> readAnnouncement(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID child,@PathVariable UUID id,@Valid @RequestBody ReadInput input){return ApiResponse.of(announcements.read(u.id(),child,id,input));}
    @GetMapping("/notifications") PageResponse<Map<String,Object>> notifications(@AuthenticationPrincipal UserPrincipal u,@RequestParam(required=false) String status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="12") int size){return notifications.list(u.id(),status,page,size);}
    @GetMapping("/notifications/unread-count") ApiResponse<Map<String,Object>> unread(@AuthenticationPrincipal UserPrincipal u){return ApiResponse.of(notifications.unread(u.id()));}
    @GetMapping("/notifications/{id}") ApiResponse<Map<String,Object>> notification(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id){return ApiResponse.of(notifications.detail(u.id(),id));}
    @PostMapping("/notifications/{id}/read") ApiResponse<Map<String,Object>> readNotification(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id){return ApiResponse.of(notifications.read(u.id(),id));}
    private String trace(HttpServletRequest r){return (String)r.getAttribute(RequestIdFilter.ATTRIBUTE);}
}

package com.tinyclass.teaching;

import com.tinyclass.auth.UserPrincipal;
import com.tinyclass.common.api.*;
import com.tinyclass.common.web.RequestIdFilter;
import com.tinyclass.teaching.ScheduleDtos.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class ScheduleController {
    private final ScheduleService service;
    public ScheduleController(ScheduleService service) {this.service=service;}
    @GetMapping("/classes/{classId}/schedule-rules")
    ApiResponse<List<Map<String,Object>>> rules(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID classId) {return ApiResponse.of(service.rules(user.id(),classId));}
    @PostMapping("/classes/{classId}/schedule-rules") @ResponseStatus(HttpStatus.CREATED)
    ApiResponse<Map<String,Object>> createRule(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID classId,@Valid @RequestBody RuleInput input,HttpServletRequest request) {return ApiResponse.of(service.createRule(user.id(),classId,input,trace(request)));}
    @PatchMapping("/schedule-rules/{id}")
    ApiResponse<Map<String,Object>> changeRule(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@Valid @RequestBody RuleInput input,HttpServletRequest request) {return ApiResponse.of(service.changeRule(user.id(),id,input,trace(request)));}
    @PostMapping("/classes/{classId}/sessions/generate")
    ApiResponse<Map<String,Object>> generate(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID classId,@Valid @RequestBody GenerateInput input,HttpServletRequest request) {return ApiResponse.of(service.generate(user.id(),classId,input,trace(request)));}
    @GetMapping("/sessions")
    PageResponse<Map<String,Object>> list(@AuthenticationPrincipal UserPrincipal user,@RequestParam(required=false) LocalDate from,@RequestParam(required=false) LocalDate to,@RequestParam(required=false) UUID classId,@RequestParam(required=false) String status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {return service.list(user.id(),from,to,classId,status,page,size);}
    @PostMapping("/sessions")
    ResponseEntity<ApiResponse<Map<String,Object>>> createSession(@AuthenticationPrincipal UserPrincipal user,@Valid @RequestBody SessionInput input,HttpServletRequest request) {return ResponseEntity.status(input.preview()?HttpStatus.OK:HttpStatus.CREATED).body(ApiResponse.of(service.createSession(user.id(),input,trace(request))));}
    @GetMapping("/sessions/{id}")
    ApiResponse<Map<String,Object>> detail(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id) {return ApiResponse.of(service.detail(user.id(),id));}
    @GetMapping("/sessions/{id}/history")
    PageResponse<Map<String,Object>> history(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size) {return service.history(user.id(),id,page,size);}
    @PatchMapping("/sessions/{id}")
    ApiResponse<Map<String,Object>> changeSession(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@Valid @RequestBody SessionInput input,HttpServletRequest request) {return ApiResponse.of(service.changeSession(user.id(),id,input,trace(request)));}
    @PostMapping("/sessions/{id}/cancel")
    ApiResponse<Map<String,Object>> cancel(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@Valid @RequestBody CancelInput input,HttpServletRequest request) {return ApiResponse.of(service.cancel(user.id(),id,input,trace(request)));}
    @GetMapping("/family/children/{child}/sessions")
    PageResponse<Map<String,Object>> family(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@RequestParam(required=false) LocalDate from,@RequestParam(required=false) LocalDate to,@RequestParam(required=false) UUID classId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {return service.familyList(user.id(),child,from,to,classId,page,size);}
    private String trace(HttpServletRequest request) {return (String)request.getAttribute(RequestIdFilter.ATTRIBUTE);}
}

package com.tinyclass.teaching;

import com.tinyclass.auth.UserPrincipal;
import com.tinyclass.common.api.*;
import com.tinyclass.common.web.RequestIdFilter;
import com.tinyclass.teaching.AttendanceDtos.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.*;

@RestController @RequestMapping("/api/v1")
public class AttendanceController {
    private final AttendanceService service;
    public AttendanceController(AttendanceService service){this.service=service;}
    @GetMapping("/sessions/{id}/attendance") ApiResponse<Map<String,Object>> workspace(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id){return ApiResponse.of(service.workspace(u.id(),id));}
    @PostMapping("/sessions/{id}/attendance-roster") ApiResponse<Map<String,Object>> roster(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@Valid @RequestBody RosterInput input,HttpServletRequest r){return ApiResponse.of(service.createRoster(u.id(),id,input,trace(r)));}
    @PostMapping("/sessions/{id}/attendance-roster/members") ApiResponse<Map<String,Object>> member(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@Valid @RequestBody MemberInput input,HttpServletRequest r){return ApiResponse.of(service.adjustMember(u.id(),id,input,trace(r)));}
    @PutMapping("/sessions/{id}/attendance") ApiResponse<Map<String,Object>> save(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@Valid @RequestBody BatchInput input,HttpServletRequest r){return ApiResponse.of(service.save(u.id(),id,input,trace(r)));}
    @PostMapping("/sessions/{id}/complete") ApiResponse<Map<String,Object>> complete(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@Valid @RequestBody CompleteInput input,HttpServletRequest r){return ApiResponse.of(service.complete(u.id(),id,input,trace(r)));}
    @GetMapping("/attendance") PageResponse<Map<String,Object>> entries(@AuthenticationPrincipal UserPrincipal u,@RequestParam(required=false) LocalDate from,@RequestParam(required=false) LocalDate to,@RequestParam(required=false) UUID classId,@RequestParam(required=false) UUID studentId,@RequestParam(required=false) String status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.entries(u.id(),from,to,classId,studentId,status,page,size);}
    @GetMapping("/attendance/{id}/history") PageResponse<Map<String,Object>> history(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.rowHistory(u.id(),null,id,page,size);}
    @GetMapping("/family/children/{child}/attendance") PageResponse<Map<String,Object>> family(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID child,@RequestParam(required=false) LocalDate from,@RequestParam(required=false) LocalDate to,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.familyEntries(u.id(),child,from,to,page,size);}
    @GetMapping("/family/children/{child}/attendance/{id}/history") PageResponse<Map<String,Object>> familyHistory(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID child,@PathVariable UUID id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.rowHistory(u.id(),child,id,page,size);}
    private String trace(HttpServletRequest r){return (String)r.getAttribute(RequestIdFilter.ATTRIBUTE);}
}

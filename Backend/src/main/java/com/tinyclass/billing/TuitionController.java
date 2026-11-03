package com.tinyclass.billing;

import com.tinyclass.auth.UserPrincipal;
import com.tinyclass.billing.TuitionDtos.*;
import com.tinyclass.common.api.*;
import com.tinyclass.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/api/v1")
public class TuitionController {
    private final TuitionService service;
    public TuitionController(TuitionService service){this.service=service;}
    @GetMapping("/classes/{id}/tuition-policy") ApiResponse<Map<String,Object>> policy(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id){return ApiResponse.of(service.policyWorkspace(u.id(),id));}
    @PutMapping("/classes/{id}/tuition-policy") ApiResponse<Map<String,Object>> savePolicy(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@Valid @RequestBody PolicyInput input,HttpServletRequest r){return ApiResponse.of(service.savePolicy(u.id(),id,input,trace(r)));}
    @GetMapping("/classes/{id}/tuition-policy/history") PageResponse<Map<String,Object>> policyHistory(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size){return service.policyHistory(u.id(),id,page,size);}
    @GetMapping("/enrollments/{id}/tuition-agreements") ApiResponse<Map<String,Object>> enrollment(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return ApiResponse.of(service.enrollmentWorkspace(u.id(),id,page,size));}
    @PostMapping("/enrollments/{id}/tuition-agreements") @ResponseStatus(HttpStatus.CREATED) ApiResponse<Map<String,Object>> create(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@Valid @RequestBody AgreementInput input,HttpServletRequest r){return ApiResponse.of(service.create(u.id(),id,input,trace(r)));}
    @GetMapping("/tuition-agreements/{id}") ApiResponse<Map<String,Object>> detail(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id){return ApiResponse.of(service.teacherDetail(u.id(),id));}
    @PostMapping("/tuition-agreements/{id}/replace") @ResponseStatus(HttpStatus.CREATED) ApiResponse<Map<String,Object>> replace(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@Valid @RequestBody AgreementInput input,HttpServletRequest r){return ApiResponse.of(service.replace(u.id(),id,input,trace(r)));}
    @PostMapping("/tuition-agreements/{id}/end") ApiResponse<Map<String,Object>> end(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@Valid @RequestBody EndInput input,HttpServletRequest r){return ApiResponse.of(service.end(u.id(),id,input,trace(r)));}
    @PostMapping("/tuition-agreements/{id}/cancel") ApiResponse<Map<String,Object>> cancel(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@Valid @RequestBody CancelInput input,HttpServletRequest r){return ApiResponse.of(service.cancel(u.id(),id,input,trace(r)));}
    @GetMapping("/tuition-agreements/{id}/history") PageResponse<Map<String,Object>> history(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size){return service.agreementHistory(u.id(),id,page,size);}
    @GetMapping("/family/children/{child}/tuition-agreements") ApiResponse<Map<String,Object>> family(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID child,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return ApiResponse.of(service.familyWorkspace(u.id(),child,page,size));}
    @GetMapping("/family/children/{child}/tuition-agreements/{id}") ApiResponse<Map<String,Object>> familyDetail(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID child,@PathVariable UUID id){return ApiResponse.of(service.familyDetail(u.id(),child,id));}
    private String trace(HttpServletRequest r){return (String)r.getAttribute(RequestIdFilter.ATTRIBUTE);}
}

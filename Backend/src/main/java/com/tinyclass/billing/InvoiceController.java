package com.tinyclass.billing;

import com.tinyclass.auth.UserPrincipal;
import com.tinyclass.billing.InvoiceDtos.*;
import com.tinyclass.common.api.*;
import com.tinyclass.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/api/v1")
public class InvoiceController {
    private final InvoiceService service;
    public InvoiceController(InvoiceService service){this.service=service;}
    @PostMapping("/billing/previews") ApiResponse<Map<String,Object>> preview(@AuthenticationPrincipal UserPrincipal u,@Valid @RequestBody PreviewInput input){return ApiResponse.of(service.preview(u.id(),input));}
    @GetMapping("/invoices") PageResponse<Map<String,Object>> list(@AuthenticationPrincipal UserPrincipal u,@RequestParam(required=false) String status,@RequestParam(required=false) UUID enrollmentId,@RequestParam(required=false) UUID classId,@RequestParam(required=false) UUID studentId,@RequestParam(required=false) String collection,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.list(u.id(),status,enrollmentId,classId,studentId,collection,page,size);}
    @PostMapping("/invoices") @ResponseStatus(HttpStatus.CREATED) ApiResponse<Map<String,Object>> create(@AuthenticationPrincipal UserPrincipal u,@Valid @RequestBody SaveInput input,HttpServletRequest r){return ApiResponse.of(service.create(u.id(),input,trace(r)));}
    @GetMapping("/invoices/{id}") ApiResponse<Map<String,Object>> detail(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id){return ApiResponse.of(service.detail(u.id(),id));}
    @PutMapping("/invoices/{id}") ApiResponse<Map<String,Object>> update(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@Valid @RequestBody SaveInput input,HttpServletRequest r){return ApiResponse.of(service.update(u.id(),id,input,trace(r)));}
    @PostMapping("/invoices/{id}/issue") ApiResponse<Map<String,Object>> issue(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@Valid @RequestBody IssueInput input,HttpServletRequest r){return ApiResponse.of(service.issue(u.id(),id,input,trace(r)));}
    @PostMapping("/invoices/{id}/cancel") ApiResponse<Map<String,Object>> cancel(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@Valid @RequestBody CancelInput input,HttpServletRequest r){return ApiResponse.of(service.cancel(u.id(),id,input,trace(r)));}
    @GetMapping("/invoices/{id}/history") PageResponse<Map<String,Object>> history(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size){return service.history(u.id(),id,page,size);}
    @GetMapping("/family/children/{child}/invoices") ApiResponse<Map<String,Object>> family(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID child,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return ApiResponse.of(service.familyList(u.id(),child,page,size));}
    @GetMapping("/family/children/{child}/invoices/{id}") ApiResponse<Map<String,Object>> familyDetail(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID child,@PathVariable UUID id){return ApiResponse.of(service.familyDetail(u.id(),child,id));}
    private String trace(HttpServletRequest r){return (String)r.getAttribute(RequestIdFilter.ATTRIBUTE);}
}

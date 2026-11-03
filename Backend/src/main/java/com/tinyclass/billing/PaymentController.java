package com.tinyclass.billing;

import com.tinyclass.auth.UserPrincipal;
import com.tinyclass.billing.PaymentDtos.*;
import com.tinyclass.common.api.*;
import com.tinyclass.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/api/v1")
public class PaymentController {
    private final PaymentService service;
    public PaymentController(PaymentService service){this.service=service;}
    @GetMapping("/invoices/{invoice}/payments") PageResponse<Map<String,Object>> list(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID invoice,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size){return service.list(u.id(),invoice,page,size);}
    @PostMapping("/invoices/{invoice}/payments") @ResponseStatus(HttpStatus.CREATED) ApiResponse<Map<String,Object>> record(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID invoice,@RequestHeader(name="Idempotency-Key",required=false) String requestKey,@Valid @RequestBody RecordInput input,HttpServletRequest r){return ApiResponse.of(service.record(u.id(),invoice,requestKey,input,trace(r)));}
    @GetMapping("/payments/{id}") ApiResponse<Map<String,Object>> detail(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id){return ApiResponse.of(service.detail(u.id(),id));}
    @PostMapping("/payments/{id}/void") ApiResponse<Map<String,Object>> voidPayment(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@Valid @RequestBody VoidInput input,HttpServletRequest r){return ApiResponse.of(service.voidPayment(u.id(),id,input,trace(r)));}
    @GetMapping("/payments/{id}/history") PageResponse<Map<String,Object>> history(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size){return service.history(u.id(),id,page,size);}
    @GetMapping("/family/children/{child}/invoices/{invoice}/payments") PageResponse<Map<String,Object>> family(@AuthenticationPrincipal UserPrincipal u,@PathVariable UUID child,@PathVariable UUID invoice,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size){return service.familyList(u.id(),child,invoice,page,size);}
    private String trace(HttpServletRequest r){return (String)r.getAttribute(RequestIdFilter.ATTRIBUTE);}
}

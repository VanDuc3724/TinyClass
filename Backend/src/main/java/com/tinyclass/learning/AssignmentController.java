package com.tinyclass.learning;

import com.tinyclass.auth.UserPrincipal;
import com.tinyclass.common.api.*;
import com.tinyclass.common.web.RequestIdFilter;
import com.tinyclass.learning.AssignmentDtos.*;
import com.tinyclass.learning.LibraryDtos.ActionInput;
import com.tinyclass.storage.FileController;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/api/v1")
public class AssignmentController {
    private final AssignmentService service;
    public AssignmentController(AssignmentService service) { this.service=service; }
    @GetMapping("/assignments") PageResponse<Map<String,Object>> list(@AuthenticationPrincipal UserPrincipal user,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) { return service.list(user.id(),page,size); }
    @PostMapping("/assignments") @ResponseStatus(HttpStatus.CREATED) ApiResponse<Map<String,Object>> create(@AuthenticationPrincipal UserPrincipal user,@Valid @RequestBody CreateInput input,HttpServletRequest request) { return ApiResponse.of(service.create(user.id(),input,trace(request))); }
    @GetMapping("/assignments/{id}") ApiResponse<Map<String,Object>> detail(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id) { return ApiResponse.of(service.detail(user.id(),id)); }
    @PutMapping("/assignments/{id}") ApiResponse<Map<String,Object>> update(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@Valid @RequestBody DraftInput input,HttpServletRequest request) { return ApiResponse.of(service.update(user.id(),id,input,trace(request))); }
    @PostMapping("/assignments/{id}/{action:publish|revoke}") ApiResponse<Map<String,Object>> action(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@PathVariable String action,@Valid @RequestBody ActionInput input,HttpServletRequest request) { return ApiResponse.of(service.action(user.id(),id,action,input,trace(request))); }
    @PostMapping("/assignments/{id}/recipients") ApiResponse<Map<String,Object>> grant(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@Valid @RequestBody RecipientsInput input,HttpServletRequest request) { return ApiResponse.of(service.grant(user.id(),id,input,trace(request))); }
    @GetMapping("/family/children/{child}/assignments") PageResponse<Map<String,Object>> familyList(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) { return service.familyList(user.id(),child,page,size); }
    @GetMapping("/family/children/{child}/assignments/{id}") ApiResponse<Map<String,Object>> familyAssignment(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@PathVariable UUID id) { return ApiResponse.of(service.familyAssignment(user.id(),child,id)); }
    @GetMapping("/family/children/{child}/assignment-items/{id}") ApiResponse<Map<String,Object>> familyItem(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@PathVariable UUID id) { return ApiResponse.of(service.familyItem(user.id(),child,id)); }
    @PostMapping("/family/children/{child}/assignment-items/{id}/{action:open|confirm}") ApiResponse<Map<String,Object>> interact(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@PathVariable UUID id,@PathVariable String action,HttpServletRequest request) { return ApiResponse.of(service.interact(user.id(),child,id,"confirm".equals(action),trace(request))); }
    @GetMapping("/family/children/{child}/assignment-items/{item}/files/{file}/{action:content|download}") ResponseEntity<Resource> file(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@PathVariable UUID item,@PathVariable UUID file,@PathVariable String action) { return FileController.response(service.familyFile(user.id(),child,item,file,"download".equals(action)),"download".equals(action)); }
    private String trace(HttpServletRequest request) { return (String)request.getAttribute(RequestIdFilter.ATTRIBUTE); }
}

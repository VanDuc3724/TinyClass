package com.tinyclass.learning;

import com.tinyclass.auth.UserPrincipal;
import com.tinyclass.common.api.*;
import com.tinyclass.common.web.RequestIdFilter;
import com.tinyclass.learning.SubmissionDtos.*;
import com.tinyclass.storage.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.*;

@RestController @RequestMapping("/api/v1")
public class SubmissionController {
    private final SubmissionService service;
    public SubmissionController(SubmissionService service) {this.service=service;}
    @GetMapping("/family/children/{child}/assignment-items/{item}/submissions")
    ApiResponse<Map<String,Object>> workspace(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@PathVariable UUID item,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size) {return ApiResponse.of(service.workspace(user.id(),child,item,page,size));}
    @PostMapping("/family/children/{child}/assignment-items/{item}/submissions") @ResponseStatus(HttpStatus.CREATED)
    ApiResponse<Map<String,Object>> create(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@PathVariable UUID item,HttpServletRequest request) {return ApiResponse.of(service.create(user.id(),child,item,trace(request)));}
    @PatchMapping("/submissions/{id}") ApiResponse<Map<String,Object>> save(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@Valid @RequestBody DraftInput input,HttpServletRequest request) {return ApiResponse.of(service.save(user.id(),id,input,trace(request)));}
    @PostMapping("/submissions/{id}/submit") ApiResponse<Map<String,Object>> submit(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@Valid @RequestBody VersionInput input,HttpServletRequest request) {return ApiResponse.of(service.submit(user.id(),id,input,trace(request)));}
    @PostMapping(value="/family/children/{child}/submissions/{id}/files",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @ResponseStatus(HttpStatus.CREATED)
    ApiResponse<FileDtos.FileView> upload(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@PathVariable UUID id,@RequestPart MultipartFile file,HttpServletRequest request) {return ApiResponse.of(service.upload(user.id(),child,id,file,trace(request)));}
    @GetMapping("/family/children/{child}/submissions") PageResponse<Map<String,Object>> history(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size) {return service.familyList(user.id(),child,null,page,size);}
    @GetMapping("/family/children/{child}/submissions/{id}") ApiResponse<Map<String,Object>> familyDetail(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@PathVariable UUID id) {return ApiResponse.of(service.familyDetail(user.id(),child,id));}
    @GetMapping("/submissions") PageResponse<Map<String,Object>> list(@AuthenticationPrincipal UserPrincipal user,@RequestParam(required=false) String status,@RequestParam(required=false) UUID classId,@RequestParam(required=false) UUID studentId,@RequestParam(required=false) UUID lessonId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {return service.teacherList(user.id(),status,classId,studentId,lessonId,page,size);}
    @GetMapping("/submissions/{id}") ApiResponse<Map<String,Object>> detail(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id) {return ApiResponse.of(service.teacherDetail(user.id(),id));}
    @PostMapping("/submissions/{id}/review") ApiResponse<Map<String,Object>> review(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@Valid @RequestBody ReviewInput input,HttpServletRequest request) {return ApiResponse.of(service.review(user.id(),id,input,trace(request)));}
    @PostMapping("/assignment-items/{item}/students/{child}/reopen") ApiResponse<Map<String,Object>> reopen(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID item,@PathVariable UUID child,@Valid @RequestBody ReopenInput input,HttpServletRequest request) {return ApiResponse.of(service.reopen(user.id(),item,child,input,trace(request)));}
    @GetMapping("/assignments/{assignment}/students/{child}/progress") ApiResponse<Map<String,Object>> progress(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID assignment,@PathVariable UUID child) {return ApiResponse.of(service.teacherProgress(user.id(),assignment,child));}
    @GetMapping("/family/children/{child}/submissions/{id}/files/{file}/{action:content|download}") ResponseEntity<Resource> familyFile(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@PathVariable UUID id,@PathVariable UUID file,@PathVariable String action) {return FileController.response(service.familyFile(user.id(),child,id,file),"download".equals(action));}
    @GetMapping("/submissions/{id}/files/{file}/{action:content|download}") ResponseEntity<Resource> teacherFile(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@PathVariable UUID file,@PathVariable String action) {return FileController.response(service.teacherFile(user.id(),id,file),"download".equals(action));}
    private String trace(HttpServletRequest request) {return (String)request.getAttribute(RequestIdFilter.ATTRIBUTE);}
}

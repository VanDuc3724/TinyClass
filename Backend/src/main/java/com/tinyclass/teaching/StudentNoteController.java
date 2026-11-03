package com.tinyclass.teaching;

import com.tinyclass.auth.UserPrincipal;
import com.tinyclass.common.api.*;
import com.tinyclass.common.web.RequestIdFilter;
import com.tinyclass.storage.FileController;
import com.tinyclass.teaching.StudentNoteDtos.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class StudentNoteController {
    private final StudentNoteService service;
    public StudentNoteController(StudentNoteService service) {this.service=service;}
    @GetMapping("/students/{child}/notes")
    PageResponse<Map<String,Object>> teacherList(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@RequestParam(required=false) String visibility,@RequestParam(defaultValue="false") boolean archived,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {return service.teacherList(user.id(),child,visibility,archived,page,size);}
    @PostMapping("/students/{child}/notes") @ResponseStatus(HttpStatus.CREATED)
    ApiResponse<Map<String,Object>> create(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@Valid @RequestBody CreateInput input,HttpServletRequest request) {return ApiResponse.of(service.create(user.id(),child,input,trace(request)));}
    @GetMapping("/students/{child}/note-contexts")
    ApiResponse<Map<String,Object>> contexts(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@RequestParam(required=false) UUID classId,@RequestParam LocalDate on) {return ApiResponse.of(service.contexts(user.id(),child,classId,on));}
    @GetMapping("/students/{child}/progress")
    ApiResponse<Map<String,Object>> teacherProgress(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@RequestParam(defaultValue="ALL") String type,@RequestParam(defaultValue="false") boolean archived,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {return ApiResponse.of(service.teacherProgress(user.id(),child,type,archived,page,size));}
    @GetMapping("/student-notes/{id}")
    ApiResponse<Map<String,Object>> detail(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id) {return ApiResponse.of(service.teacherDetail(user.id(),id));}
    @PatchMapping("/student-notes/{id}")
    ApiResponse<Map<String,Object>> update(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@Valid @RequestBody UpdateInput input,HttpServletRequest request) {return ApiResponse.of(service.update(user.id(),id,input,trace(request)));}
    @PostMapping("/student-notes/{id}/archive")
    ApiResponse<Map<String,Object>> archive(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@Valid @RequestBody StateInput input,HttpServletRequest request) {return ApiResponse.of(service.state(user.id(),id,input,true,trace(request)));}
    @PostMapping("/student-notes/{id}/restore")
    ApiResponse<Map<String,Object>> restore(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@Valid @RequestBody StateInput input,HttpServletRequest request) {return ApiResponse.of(service.state(user.id(),id,input,false,trace(request)));}
    @GetMapping("/student-notes/{id}/history")
    PageResponse<Map<String,Object>> history(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size) {return service.history(user.id(),id,page,size);}
    @GetMapping("/student-notes/{id}/files/{file}/{action:content|download}")
    ResponseEntity<Resource> teacherFile(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@PathVariable UUID file,@PathVariable String action) {return FileController.response(service.teacherFile(user.id(),id,file),"download".equals(action));}
    @GetMapping("/family/children/{child}/notes")
    PageResponse<Map<String,Object>> familyList(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {return service.familyList(user.id(),child,page,size);}
    @GetMapping("/family/children/{child}/notes/{id}")
    ApiResponse<Map<String,Object>> familyDetail(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@PathVariable UUID id) {return ApiResponse.of(service.familyDetail(user.id(),child,id));}
    @GetMapping("/family/children/{child}/notes/{id}/files/{file}/{action:content|download}")
    ResponseEntity<Resource> familyFile(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@PathVariable UUID id,@PathVariable UUID file,@PathVariable String action) {return FileController.response(service.familyFile(user.id(),child,id,file),"download".equals(action));}
    @GetMapping("/family/children/{child}/progress")
    ApiResponse<Map<String,Object>> familyProgress(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@RequestParam(defaultValue="ALL") String type,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {return ApiResponse.of(service.familyProgress(user.id(),child,type,page,size));}
    private String trace(HttpServletRequest request) {return (String)request.getAttribute(RequestIdFilter.ATTRIBUTE);}
}

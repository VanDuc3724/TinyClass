package com.tinyclass.learning;

import com.tinyclass.auth.UserPrincipal;
import com.tinyclass.common.api.*;
import com.tinyclass.common.web.RequestIdFilter;
import com.tinyclass.learning.LibraryDtos.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/api/v1")
public class LibraryController {
    private final LibraryService service;
    public LibraryController(LibraryService service) { this.service=service; }
    @GetMapping("/topics") ApiResponse<List<Map<String,Object>>> topics(@AuthenticationPrincipal UserPrincipal user) { return ApiResponse.of(service.topics(user.id())); }
    @PostMapping("/topics") @ResponseStatus(HttpStatus.CREATED)
    ApiResponse<Map<String,Object>> topic(@AuthenticationPrincipal UserPrincipal user,@Valid @RequestBody TopicInput input,HttpServletRequest request) { return ApiResponse.of(service.topic(user.id(),null,input,trace(request))); }
    @PatchMapping("/topics/{id}") ApiResponse<Map<String,Object>> topicUpdate(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@Valid @RequestBody TopicInput input,HttpServletRequest request) { return ApiResponse.of(service.topic(user.id(),id,input,trace(request))); }
    @GetMapping("/{type:lessons|courses}") PageResponse<Map<String,Object>> list(@AuthenticationPrincipal UserPrincipal user,@PathVariable String type,@RequestParam(required=false) String q,@RequestParam(required=false) String status,
            @RequestParam(required=false) UUID topicId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) { return service.list(user.id(),type,q,status,topicId,page,size); }
    @GetMapping("/{type:lessons|courses}/{id}") ApiResponse<Map<String,Object>> detail(@AuthenticationPrincipal UserPrincipal user,@PathVariable String type,@PathVariable UUID id) { return ApiResponse.of("lessons".equals(type)?service.lesson(user.id(),id):service.course(user.id(),id)); }
    @PostMapping("/lessons") @ResponseStatus(HttpStatus.CREATED) ApiResponse<Map<String,Object>> createLesson(@AuthenticationPrincipal UserPrincipal user,@Valid @RequestBody LessonInput input,HttpServletRequest request) { return ApiResponse.of(service.saveLesson(user.id(),null,input,trace(request))); }
    @PutMapping("/lessons/{id}") ApiResponse<Map<String,Object>> lesson(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@Valid @RequestBody LessonInput input,HttpServletRequest request) { return ApiResponse.of(service.saveLesson(user.id(),id,input,trace(request))); }
    @PostMapping("/courses") @ResponseStatus(HttpStatus.CREATED) ApiResponse<Map<String,Object>> createCourse(@AuthenticationPrincipal UserPrincipal user,@Valid @RequestBody CourseInput input,HttpServletRequest request) { return ApiResponse.of(service.saveCourse(user.id(),null,input,trace(request))); }
    @PutMapping("/courses/{id}") ApiResponse<Map<String,Object>> course(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@Valid @RequestBody CourseInput input,HttpServletRequest request) { return ApiResponse.of(service.saveCourse(user.id(),id,input,trace(request))); }
    @PostMapping("/{type:lessons|courses}/{id}/{action:publish|archive|restore}") ApiResponse<Map<String,Object>> action(@AuthenticationPrincipal UserPrincipal user,@PathVariable String type,@PathVariable UUID id,@PathVariable String action,
            @Valid @RequestBody ActionInput input,HttpServletRequest request) { return ApiResponse.of(service.action(user.id(),type,id,action,input,trace(request))); }
    private String trace(HttpServletRequest request) { return (String)request.getAttribute(RequestIdFilter.ATTRIBUTE); }
}

package com.tinyclass.classes;

import com.tinyclass.auth.UserPrincipal;
import com.tinyclass.classes.ClassDtos.*;
import com.tinyclass.common.api.*;
import com.tinyclass.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class ClassManagementController {
    private final ClassManagementService service;
    public ClassManagementController(ClassManagementService service) { this.service = service; }

    @GetMapping("/classes")
    PageResponse<ClassView> classes(@AuthenticationPrincipal UserPrincipal user,
            @RequestParam(required = false) String q, @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.classes(user.id(), q, status, page, size);
    }
    @PostMapping("/classes") @ResponseStatus(HttpStatus.CREATED)
    ApiResponse<ClassView> createClass(@AuthenticationPrincipal UserPrincipal user,
            @Valid @RequestBody ClassInput input, HttpServletRequest request) {
        return ApiResponse.of(service.createClass(user.id(), input, trace(request)));
    }
    @GetMapping("/classes/{id}")
    ApiResponse<ClassView> classDetail(@AuthenticationPrincipal UserPrincipal user, @PathVariable UUID id) {
        return ApiResponse.of(service.classDetail(user.id(), id));
    }
    @PatchMapping("/classes/{id}")
    ApiResponse<ClassView> updateClass(@AuthenticationPrincipal UserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody ClassInput input, HttpServletRequest request) {
        return ApiResponse.of(service.updateClass(user.id(), id, input, trace(request)));
    }
    @PostMapping("/classes/{id}/{action:activate|complete|archive|restore}")
    ApiResponse<ClassView> classAction(@AuthenticationPrincipal UserPrincipal user, @PathVariable UUID id,
            @PathVariable String action, @Valid @RequestBody VersionInput input, HttpServletRequest request) {
        return ApiResponse.of(service.classAction(user.id(), id, action, input, trace(request)));
    }
    @GetMapping("/students")
    PageResponse<StudentView> students(@AuthenticationPrincipal UserPrincipal user,
            @RequestParam(required = false) String q, @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.students(user.id(), q, status, page, size);
    }
    @PostMapping("/students") @ResponseStatus(HttpStatus.CREATED)
    ApiResponse<StudentView> createStudent(@AuthenticationPrincipal UserPrincipal user,
            @Valid @RequestBody StudentInput input, HttpServletRequest request) {
        return ApiResponse.of(service.createStudent(user.id(), input, trace(request)));
    }
    @GetMapping("/students/{id}")
    ApiResponse<StudentView> studentDetail(@AuthenticationPrincipal UserPrincipal user, @PathVariable UUID id) {
        return ApiResponse.of(service.studentDetail(user.id(), id));
    }
    @PatchMapping("/students/{id}")
    ApiResponse<StudentView> updateStudent(@AuthenticationPrincipal UserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody StudentInput input, HttpServletRequest request) {
        return ApiResponse.of(service.updateStudent(user.id(), id, input, trace(request)));
    }
    @PostMapping("/students/{id}/{action:archive|restore}")
    ApiResponse<StudentView> studentAction(@AuthenticationPrincipal UserPrincipal user, @PathVariable UUID id,
            @PathVariable String action, @Valid @RequestBody VersionInput input, HttpServletRequest request) {
        return ApiResponse.of(service.studentAction(user.id(), id, action, input, trace(request)));
    }
    @GetMapping("/students/{id}/classes")
    ApiResponse<List<StudentClassView>> studentClasses(@AuthenticationPrincipal UserPrincipal user, @PathVariable UUID id) {
        return ApiResponse.of(service.studentClasses(user.id(), id));
    }
    @GetMapping("/classes/{id}/enrollments")
    PageResponse<EnrollmentView> enrollments(@AuthenticationPrincipal UserPrincipal user, @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.enrollments(user.id(), id, page, size);
    }
    @PostMapping("/classes/{id}/enrollments") @ResponseStatus(HttpStatus.CREATED)
    ApiResponse<EnrollmentView> enroll(@AuthenticationPrincipal UserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody EnrollInput input, HttpServletRequest request) {
        return ApiResponse.of(service.enroll(user.id(), id, input, trace(request)));
    }
    @PatchMapping("/enrollments/{id}")
    ApiResponse<EnrollmentView> updateEnrollment(@AuthenticationPrincipal UserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody EnrollmentInput input, HttpServletRequest request) {
        return ApiResponse.of(service.updateEnrollment(user.id(), id, input, trace(request)));
    }
    @GetMapping("/enrollments/{id}/history")
    PageResponse<HistoryView> enrollmentHistory(@AuthenticationPrincipal UserPrincipal user, @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.enrollmentHistory(user.id(), id, page, size);
    }
    private String trace(HttpServletRequest request) { return (String) request.getAttribute(RequestIdFilter.ATTRIBUTE); }
}

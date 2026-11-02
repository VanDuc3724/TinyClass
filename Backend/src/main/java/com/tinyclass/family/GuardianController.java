package com.tinyclass.family;

import com.tinyclass.auth.*;
import com.tinyclass.classes.ClassDtos.VersionInput;
import com.tinyclass.common.api.*;
import com.tinyclass.common.web.RequestIdFilter;
import com.tinyclass.family.FamilyDtos.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class GuardianController {
    private final GuardianService service;
    private final AuthAttemptLimiter limiter;
    public GuardianController(GuardianService service, AuthAttemptLimiter limiter) { this.service = service; this.limiter = limiter; }

    @PostMapping("/students/{id}/guardian-invitations") @ResponseStatus(HttpStatus.CREATED)
    ApiResponse<CreatedInvitation> invite(@AuthenticationPrincipal UserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody InviteInput input, HttpServletRequest request) {
        limiter.check(request.getRemoteAddr()); return ApiResponse.of(service.invite(user.id(), id, input, trace(request)));
    }
    @GetMapping("/students/{id}/guardian-invitations")
    PageResponse<InvitationView> invitations(@AuthenticationPrincipal UserPrincipal user, @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.invitations(user.id(), id, page, size);
    }
    @GetMapping("/students/{id}/guardians")
    PageResponse<GuardianView> guardians(@AuthenticationPrincipal UserPrincipal user, @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.guardians(user.id(), id, page, size);
    }
    @PostMapping("/guardian-invitations/{id}/revoke")
    ApiResponse<InvitationView> revokeInvitation(@AuthenticationPrincipal UserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody VersionInput input, HttpServletRequest request) {
        return ApiResponse.of(service.revokeInvitation(user.id(), id, input, trace(request)));
    }
    @PostMapping("/student-guardians/{id}/revoke")
    ApiResponse<Boolean> revokeGuardian(@AuthenticationPrincipal UserPrincipal user, @PathVariable UUID id,
            @Valid @RequestBody VersionInput input, HttpServletRequest request) {
        return ApiResponse.of(service.revokeGuardian(user.id(), id, input, trace(request)));
    }
    @PostMapping("/auth/invitations/preview")
    ApiResponse<InvitationPreview> preview(@Valid @RequestBody TokenInput input, HttpServletRequest request) {
        limiter.check(request.getRemoteAddr()); return ApiResponse.of(service.preview(input.token()));
    }
    @PostMapping("/guardian-invitations/accept")
    ApiResponse<AcceptedView> accept(@AuthenticationPrincipal UserPrincipal user,
            @Valid @RequestBody AcceptInput input, HttpServletRequest request) {
        limiter.check(request.getRemoteAddr()); return ApiResponse.of(service.accept(user.id(), input, trace(request)));
    }
    @GetMapping("/family/children")
    PageResponse<ChildView> children(@AuthenticationPrincipal UserPrincipal user,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.children(user.id(), page, size);
    }
    @GetMapping("/family/children/{id}")
    ApiResponse<ChildView> child(@AuthenticationPrincipal UserPrincipal user, @PathVariable UUID id) {
        return ApiResponse.of(service.child(user.id(), id));
    }
    @GetMapping("/family/children/{id}/classes")
    PageResponse<ChildClassView> classes(@AuthenticationPrincipal UserPrincipal user, @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.childClasses(user.id(), id, page, size);
    }
    private String trace(HttpServletRequest request) { return (String) request.getAttribute(RequestIdFilter.ATTRIBUTE); }
}

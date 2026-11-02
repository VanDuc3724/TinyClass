package com.tinyclass.auth;

import com.tinyclass.auth.AccountRecoveryService.*;
import com.tinyclass.common.api.ApiResponse;
import com.tinyclass.common.web.RequestIdFilter;
import com.tinyclass.family.FamilyDtos.TokenInput;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AccountRecoveryController {
    private final AccountRecoveryService service;
    private final AuthAttemptLimiter limiter;
    public AccountRecoveryController(AccountRecoveryService service, AuthAttemptLimiter limiter) { this.service = service; this.limiter = limiter; }

    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED)
    ApiResponse<AuthController.AccountView> register(@Valid @RequestBody RegisterInput input, HttpServletRequest request) {
        limit(request); return ApiResponse.of(service.register(input, trace(request)));
    }
    @PostMapping("/email-verifications")
    ApiResponse<Boolean> sendVerification(@AuthenticationPrincipal UserPrincipal user,
            @Valid @RequestBody VerificationInput input, HttpServletRequest request) {
        limit(request); return ApiResponse.of(service.sendVerification(user.id(), input));
    }
    @PostMapping("/email-verifications/confirm")
    ApiResponse<Boolean> verify(@Valid @RequestBody TokenInput input, HttpServletRequest request) {
        limit(request); return ApiResponse.of(service.verify(input.token(), trace(request)));
    }
    @PostMapping("/password-reset-requests") @ResponseStatus(HttpStatus.ACCEPTED)
    ApiResponse<Boolean> requestReset(@Valid @RequestBody EmailInput input, HttpServletRequest request) {
        limit(request); return ApiResponse.of(service.requestReset(input.email()));
    }
    @PostMapping("/password-resets")
    ApiResponse<Boolean> reset(@Valid @RequestBody ResetInput input, HttpServletRequest request) {
        limit(request); return ApiResponse.of(service.reset(input, trace(request)));
    }
    private void limit(HttpServletRequest request) { limiter.check(request.getRemoteAddr()); }
    private String trace(HttpServletRequest request) { return (String) request.getAttribute(RequestIdFilter.ATTRIBUTE); }
}

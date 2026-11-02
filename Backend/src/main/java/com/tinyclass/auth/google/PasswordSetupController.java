package com.tinyclass.auth.google;

import com.tinyclass.auth.*;
import com.tinyclass.common.api.ApiResponse;
import com.tinyclass.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class PasswordSetupController {
    private final PasswordSetupService service; private final GoogleAccountService accounts;
    private final RecentAuthentication recent; private final AuthAttemptLimiter limiter;
    public PasswordSetupController(PasswordSetupService service, GoogleAccountService accounts, RecentAuthentication recent, AuthAttemptLimiter limiter) {
        this.service = service; this.accounts = accounts; this.recent = recent; this.limiter = limiter;
    }
    @PostMapping("/password-setup-requests")
    ApiResponse<Boolean> request(@AuthenticationPrincipal UserPrincipal actor, HttpServletRequest request) {
        limiter.check(request.getRemoteAddr());
        return ApiResponse.of(service.request(actor.id(), recent.consume(request.getSession(false), accounts.activeUser(actor.id()))));
    }
    @PostMapping("/password-setups")
    ApiResponse<Boolean> confirm(@AuthenticationPrincipal UserPrincipal actor, @Valid @RequestBody AccountRecoveryService.ResetInput input,
            HttpServletRequest request, HttpServletResponse response) {
        limiter.check(request.getRemoteAddr());
        boolean done = service.confirm(actor.id(), input, (String) request.getAttribute(RequestIdFilter.ATTRIBUTE));
        new org.springframework.security.web.authentication.logout.CompositeLogoutHandler(
                new org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler(),
                new org.springframework.security.web.authentication.logout.CookieClearingLogoutHandler("JSESSIONID"))
                .logout(request, response, org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication());
        return ApiResponse.of(done);
    }
}

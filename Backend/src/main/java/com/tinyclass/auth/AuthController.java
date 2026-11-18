package com.tinyclass.auth;

import com.tinyclass.common.api.*;
import com.tinyclass.common.web.RequestIdFilter;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.*;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthenticationManager manager;
    private final SecurityContextRepository contexts;
    private final SessionAuthenticationStrategy sessions;
    private final UserAccountRepository users;
    private final TeacherSetupService setup;
    private final AuthAttemptLimiter limiter;

    public AuthController(AuthenticationManager manager, SecurityContextRepository contexts,
            SessionAuthenticationStrategy sessions, UserAccountRepository users,
            TeacherSetupService setup, AuthAttemptLimiter limiter) {
        this.manager = manager; this.contexts = contexts; this.sessions = sessions;
        this.users = users; this.setup = setup; this.limiter = limiter;
    }

    @GetMapping("/csrf")
    ApiResponse<CsrfView> csrf(CsrfToken token) {
        return ApiResponse.of(new CsrfView(token.getHeaderName(), token.getToken()));
    }

    @GetMapping("/setup-status")
    ApiResponse<SetupStatus> setupStatus() { return ApiResponse.of(new SetupStatus(setup.required(), setup.enabled())); }

    @PostMapping("/setup")
    @ResponseStatus(HttpStatus.CREATED)
    ApiResponse<AccountView> setup(@Valid @RequestBody SetupInput input, HttpServletRequest request) {
        limiter.check(request.getRemoteAddr());
        return ApiResponse.of(AccountView.from(setup.setup(input,
                (String) request.getAttribute(RequestIdFilter.ATTRIBUTE))));
    }

    @PostMapping("/login")
    ApiResponse<AccountView> login(@Valid @RequestBody LoginInput input,
            HttpServletRequest request, HttpServletResponse response) {
        limiter.check(request.getRemoteAddr());
        try {
            var authentication = manager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(input.email().strip(), input.password()));
            sessions.onAuthentication(authentication, request, response);
            var context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);
            contexts.saveContext(context, request, response);
            return ApiResponse.of(AccountView.from(users.findById(
                    ((UserPrincipal) authentication.getPrincipal()).id()).orElseThrow()));
        } catch (org.springframework.security.core.AuthenticationException exception) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không chính xác.");
        }
    }

    @GetMapping("/me")
    ApiResponse<AccountView> me(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.of(AccountView.from(users.findById(principal.id()).orElseThrow()));
    }

    @PostMapping("/logout")
    ApiResponse<Boolean> logout(HttpServletRequest request, HttpServletResponse response) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        new CompositeLogoutHandler(new SecurityContextLogoutHandler(), new CookieClearingLogoutHandler("JSESSIONID"))
                .logout(request, response, authentication);
        return ApiResponse.of(true);
    }

    public record LoginInput(@NotBlank @Email @Size(max = 254) String email,
                             @NotBlank @Size(max = 128) String password) {}
    public record SetupInput(@NotBlank @Size(max = 100) String displayName,
                             @NotBlank @Email @Size(max = 254) String email,
                             @NotBlank @Size(min = 12, max = 128) String password,
                             @NotBlank @Size(max = 256) String setupKey) {}
    public record CsrfView(String headerName, String token) {}
    public record SetupStatus(boolean setupRequired, boolean setupEnabled) {}
    public record AccountView(UUID id, String email, String displayName, String role, String status, Instant emailVerifiedAt) {
        public static AccountView from(UserAccount user) {
            return new AccountView(user.getId(), user.getEmail(), user.getDisplayName(), user.getRole(), user.getStatus(), user.getEmailVerifiedAt());
        }
    }
}

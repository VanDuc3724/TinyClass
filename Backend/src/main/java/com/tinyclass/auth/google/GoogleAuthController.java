package com.tinyclass.auth.google;

import com.tinyclass.auth.*;
import com.tinyclass.common.api.*;
import com.tinyclass.common.web.RequestIdFilter;
import com.tinyclass.family.GuardianService;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.web.authentication.logout.*;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
public class GoogleAuthController {
    private final ObjectProvider<ClientRegistrationRepository> clients;
    private final GoogleAccountService accounts;
    private final AuthIdentityRepository identities;
    private final RecentAuthentication recent;
    private final GoogleLoginHandlers handlers;
    private final AuthAttemptLimiter limiter;
    private final GuardianService guardians;
    public GoogleAuthController(ObjectProvider<ClientRegistrationRepository> clients, GoogleAccountService accounts,
            AuthIdentityRepository identities, RecentAuthentication recent, GoogleLoginHandlers handlers,
            AuthAttemptLimiter limiter, GuardianService guardians) {
        this.clients = clients; this.accounts = accounts; this.identities = identities; this.recent = recent;
        this.handlers = handlers; this.limiter = limiter; this.guardians = guardians;
    }
    @GetMapping("/providers")
    ApiResponse<Providers> providers() { return ApiResponse.of(new Providers(available())); }
    private boolean available() { var repository = clients.getIfAvailable(); return repository != null && repository.findByRegistrationId("google-login") != null; }

    @PostMapping("/google/start")
    ApiResponse<Started> start(@AuthenticationPrincipal UserPrincipal actor, @Valid @RequestBody StartInput input, HttpServletRequest request) {
        limiter.check(request.getRemoteAddr());
        if (!available()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "GOOGLE_NOT_CONFIGURED", "Đăng nhập Google hiện chưa khả dụng.");
        RecentAuthentication.Proof proof = null; long version = 0;
        if (input.intent() == GoogleFlow.Intent.LINK || input.intent() == GoogleFlow.Intent.REAUTHENTICATE) {
            if (actor == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Đăng nhập trước khi thay đổi phương thức.");
            var user = accounts.activeUser(actor.id());
            if (user.getCredentialVersion() != actor.credentialVersion()) throw recent.required();
            version = user.getCredentialVersion();
            if (input.intent() == GoogleFlow.Intent.LINK) proof = recent.consume(request.getSession(false), user);
            else if (identities.findByUserIdAndUnlinkedAtIsNull(actor.id()).isEmpty())
                throw new ApiException(HttpStatus.CONFLICT, "GOOGLE_NOT_LINKED", "Tài khoản chưa có phương thức Google để xác thực lại.");
        }
        if (input.intent() == GoogleFlow.Intent.REGISTER && input.invitationToken() == null)
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVITATION_REQUIRED", "Cần lời mời hợp lệ để đăng ký phụ huynh.");
        if (input.invitationToken() != null && !"PENDING".equals(guardians.preview(input.invitationToken()).status()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVITATION_UNAVAILABLE", "Lời mời không còn hiệu lực.");
        var session = request.getSession(); handlers.clear(session);
        session.setAttribute(GoogleFlowRequests.PENDING, new GoogleFlow(input.intent(), actor == null ? null : actor.id(), version,
                input.invitationToken(), input.displayName(), proof, Instant.now()));
        return ApiResponse.of(new Started("/api/v1/auth/google/authorize"));
    }
    @GetMapping("/google/authorize")
    void invalidAuthorization() { throw new ApiException(HttpStatus.BAD_REQUEST, "GOOGLE_CONTEXT_EXPIRED", "Bắt đầu lại từ nút Google trong ứng dụng."); }
    @GetMapping("/google/result")
    ApiResponse<GoogleLoginHandlers.Result> result(HttpServletRequest request) { return ApiResponse.of(handlers.result(request.getSession(false))); }
    @GetMapping("/methods")
    ApiResponse<Methods> methods(@AuthenticationPrincipal UserPrincipal actor, HttpServletRequest request) {
        var user = accounts.activeUser(actor.id());
        var identity = identities.findByUserIdAndUnlinkedAtIsNull(actor.id()).map(i -> new GoogleMethod(i.getId(), i.getProviderEmail(), i.getLinkedAt())).orElse(null);
        return ApiResponse.of(new Methods(user.getPasswordHash() != null, available(), identity, recent.current(request.getSession(false), user)));
    }
    @PostMapping("/reauthenticate")
    ApiResponse<Boolean> reauthenticate(@AuthenticationPrincipal UserPrincipal actor, @Valid @RequestBody PasswordInput input, HttpServletRequest request) {
        limiter.check(request.getRemoteAddr());
        recent.remember(request.getSession(), accounts.passwordReauthenticate(actor, input.password()));
        return ApiResponse.of(true);
    }
    @PostMapping("/identities/{id}/unlink")
    ApiResponse<Boolean> unlink(@AuthenticationPrincipal UserPrincipal actor, @PathVariable UUID id,
            HttpServletRequest request, HttpServletResponse response) {
        var user = accounts.activeUser(actor.id());
        var proof = recent.consume(request.getSession(false), user);
        accounts.unlink(actor.id(), id, proof, (String) request.getAttribute(RequestIdFilter.ATTRIBUTE));
        new CompositeLogoutHandler(new SecurityContextLogoutHandler(), new CookieClearingLogoutHandler("JSESSIONID"))
                .logout(request, response, org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication());
        return ApiResponse.of(true);
    }
    public record Providers(boolean googleEnabled) {}
    public record Started(String authorizationUrl) {}
    public record StartInput(@NotNull GoogleFlow.Intent intent, @Size(min = 32, max = 256) String invitationToken, @Size(max = 100) String displayName) {}
    public record PasswordInput(@NotBlank @Size(max = 128) String password) {}
    public record GoogleMethod(UUID id, String email, Instant linkedAt) {}
    public record Methods(boolean hasPassword, boolean googleEnabled, GoogleMethod google, boolean reauthenticated) {}
}

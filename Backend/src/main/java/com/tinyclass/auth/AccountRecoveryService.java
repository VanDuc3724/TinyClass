package com.tinyclass.auth;

import com.tinyclass.common.api.ApiException;
import com.tinyclass.common.audit.*;
import com.tinyclass.family.GuardianService;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@Transactional
public class AccountRecoveryService {
    private final UserAccountRepository users;
    private final AuthTokenRepository tokens;
    private final GuardianService invitations;
    private final PasswordEncoder passwords;
    private final AccountMailer mailer;
    private final EmailCooldown cooldown;
    private final AuditEventRepository audit;
    @PersistenceContext private EntityManager entityManager;

    public AccountRecoveryService(UserAccountRepository users, AuthTokenRepository tokens,
            GuardianService invitations, PasswordEncoder passwords, AccountMailer mailer,
            EmailCooldown cooldown, AuditEventRepository audit) {
        this.users = users; this.tokens = tokens; this.invitations = invitations;
        this.passwords = passwords; this.mailer = mailer; this.cooldown = cooldown; this.audit = audit;
    }

    public AuthController.AccountView register(RegisterInput input, String trace) {
        invitations.validateRegistration(input.invitationToken(), input.email());
        if (users.findByEmail(input.email()).isPresent()) throw new ApiException(HttpStatus.CONFLICT,
                "EMAIL_ALREADY_REGISTERED", "Email đã có tài khoản. Hãy đăng nhập để nhận lời mời.");
        var user = users.saveAndFlush(new UserAccount(input.email(), passwords.encode(input.password()), input.displayName().strip(), "PARENT"));
        issueVerification(user, input.invitationToken());
        event(user.getId(), "PARENT_REGISTERED", trace);
        return AuthController.AccountView.from(user);
    }

    public boolean sendVerification(UUID actor, VerificationInput input) {
        var user = lockUser(actor);
        if (!"ACTIVE".equals(user.getStatus())) throw invalidToken();
        if (user.getEmailVerifiedAt() != null) return true;
        if (!cooldown.allow(user.getEmail())) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                "EMAIL_COOLDOWN", "Vui lòng chờ một phút trước khi yêu cầu gửi lại email.");
        String continuation = input.invitationToken();
        if (continuation != null && !continuation.isBlank()) invitations.validateContinuation(continuation, user.getEmail());
        issueVerification(user, continuation);
        return true;
    }

    public boolean verify(String raw, String trace) {
        var token = token(raw);
        var user = lockUser(token.getUserId());
        entityManager.refresh(token);
        validate(token, user, "VERIFY_EMAIL");
        user.verifyEmail();
        consume(user.getId(), "VERIFY_EMAIL");
        event(user.getId(), "EMAIL_VERIFIED", trace);
        return true;
    }

    public boolean requestReset(String email) {
        // Response is deliberately the same for absent, disabled, Google-only and rate-limited accounts.
        if (!cooldown.allow(email)) return true;
        var found = users.findByEmail(email);
        if (found.isEmpty()) return true;
        var user = lockUser(found.get().getId());
        if (!"ACTIVE".equals(user.getStatus()) || user.getPasswordHash() == null) return true;
        String raw = issue(user, "RESET_PASSWORD", 30 * 60);
        try { mailer.send(user.getEmail(), "TinyClass — Khôi phục mật khẩu",
                "Bạn đã yêu cầu đặt lại mật khẩu TinyClass. Mở liên kết trong 30 phút:\n\n"
                        + mailer.link("/reset-password", "token=" + raw)
                        + "\n\nNếu không yêu cầu, bạn có thể bỏ qua email. Mật khẩu hiện tại chưa thay đổi."); }
        catch (ApiException unavailable) {
            if (!"MAIL_UNAVAILABLE".equals(unavailable.code())) throw unavailable;
            // No account-state leak or raw failed-email logging when the SMTP service is unavailable.
        }
        return true;
    }

    public boolean reset(ResetInput input, String trace) {
        var token = token(input.token());
        var user = lockUser(token.getUserId());
        entityManager.refresh(token);
        validate(token, user, "RESET_PASSWORD");
        if (user.getPasswordHash() == null) throw invalidToken();
        user.changePassword(passwords.encode(input.password()));
        consume(user.getId(), "RESET_PASSWORD");
        event(user.getId(), "PASSWORD_RESET", trace);
        return true;
    }

    public void issueVerification(UserAccount user, String invitation) {
        String raw = issue(user, "VERIFY_EMAIL", 24 * 3600);
        String fragment = "token=" + raw;
        if (invitation != null && !invitation.isBlank()) fragment += "&invitation=" + invitation;
        mailer.send(user.getEmail(), "TinyClass — Xác minh email",
                "Chào " + user.getDisplayName() + ",\n\nXác minh email để tiếp tục với TinyClass. Liên kết có hiệu lực trong 24 giờ:\n\n"
                        + mailer.link("/verify-email", fragment)
                        + "\n\nChỉ nhận lời mời khi bạn biết giáo viên đã mời mình. Không chia sẻ liên kết này với người khác.");
    }
    private String issue(UserAccount user, String purpose, long seconds) {
        consume(user.getId(), purpose);
        String raw = SecretTokens.generate();
        tokens.saveAndFlush(new AuthToken(user.getId(), purpose, raw, seconds));
        return raw;
    }
    private void consume(UUID userId, String purpose) {
        for (var token : tokens.findByUserIdAndPurposeAndConsumedAtIsNull(userId, purpose)) token.consume();
    }
    private AuthToken token(String raw) { return tokens.findByTokenHash(SecretTokens.hash(raw)).orElseThrow(this::invalidToken); }
    private UserAccount lockUser(UUID id) {
        var user = users.lockById(id).orElseThrow(this::invalidToken);
        entityManager.refresh(user); return user;
    }
    private void validate(AuthToken token, UserAccount user, String purpose) {
        if (!token.usable() || !purpose.equals(token.getPurpose()) || !"ACTIVE".equals(user.getStatus())) throw invalidToken();
    }
    private void event(UUID user, String action, String trace) {
        audit.save(new AuditEvent(user, action, "USER", user, Map.of("action", action), null, trace));
    }
    private ApiException invalidToken() { return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_AUTH_TOKEN",
            "Liên kết không hợp lệ, đã hết hạn hoặc đã được sử dụng. Hãy yêu cầu liên kết mới."); }

    public record RegisterInput(@NotBlank @Size(max = 100) String displayName,
            @NotBlank @Email @Size(max = 254) String email, @NotBlank @Size(min = 12, max = 128) String password,
            @NotBlank @Size(min = 32, max = 256) String invitationToken) {
        public RegisterInput { if (email != null) email = email.strip().toLowerCase(Locale.ROOT); }
    }
    public record VerificationInput(@Size(min = 32, max = 256) String invitationToken) {}
    public record EmailInput(@NotBlank @Email @Size(max = 254) String email) {
        public EmailInput { if (email != null) email = email.strip().toLowerCase(Locale.ROOT); }
    }
    public record ResetInput(@NotBlank @Size(min = 32, max = 256) String token,
            @NotBlank @Size(min = 12, max = 128) String password) {}
}

package com.tinyclass.auth.google;

import com.tinyclass.auth.*;
import com.tinyclass.common.api.ApiException;
import com.tinyclass.common.audit.*;
import jakarta.persistence.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@Transactional
public class PasswordSetupService {
    private final UserAccountRepository users; private final AuthTokenRepository tokens;
    private final PasswordEncoder passwords; private final AccountMailer mailer;
    private final EmailCooldown cooldown; private final RecentAuthentication recent; private final AuditEventRepository audit;
    @PersistenceContext private EntityManager entityManager;
    public PasswordSetupService(UserAccountRepository users, AuthTokenRepository tokens, PasswordEncoder passwords,
            AccountMailer mailer, EmailCooldown cooldown, RecentAuthentication recent, AuditEventRepository audit) {
        this.users = users; this.tokens = tokens; this.passwords = passwords; this.mailer = mailer;
        this.cooldown = cooldown; this.recent = recent; this.audit = audit;
    }
    public boolean request(UUID actor, RecentAuthentication.Proof proof) {
        var user = user(actor);
        if (!recent.matches(proof, user)) throw recent.required();
        if (!cooldown.allow(user.getEmail())) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "EMAIL_COOLDOWN", "Chờ một phút trước khi yêu cầu gửi lại email.");
        consume(actor);
        String raw = SecretTokens.generate(); tokens.saveAndFlush(new AuthToken(actor, "SET_PASSWORD", raw, 1800));
        mailer.send(user.getEmail(), "TinyClass — Thiết lập mật khẩu",
                "Bạn đã yêu cầu thêm mật khẩu cho tài khoản TinyClass. Mở liên kết trong trình duyệt đang đăng nhập, trong 30 phút:\n\n"
                        + mailer.link("/set-password", "token=" + raw) + "\n\nNếu không yêu cầu, bỏ qua email. Phương thức Google vẫn được giữ.");
        return true;
    }
    public boolean confirm(UUID actor, AccountRecoveryService.ResetInput input, String trace) {
        var user = user(actor);
        var token = tokens.findByTokenHash(SecretTokens.hash(input.token())).orElseThrow(this::invalid);
        entityManager.refresh(token);
        if (!actor.equals(token.getUserId()) || !"SET_PASSWORD".equals(token.getPurpose()) || !token.usable()) throw invalid();
        user.changePassword(passwords.encode(input.password())); consume(actor);
        audit.save(new AuditEvent(actor, "PASSWORD_METHOD_ADDED", "USER", actor, Map.of("method", "PASSWORD"), null, trace));
        return true;
    }
    private UserAccount user(UUID id) {
        var user = users.lockById(id).orElseThrow(this::invalid); entityManager.refresh(user);
        if (!"ACTIVE".equals(user.getStatus())) throw invalid();
        if (user.getEmailVerifiedAt() == null) throw new ApiException(HttpStatus.FORBIDDEN, "EMAIL_VERIFICATION_REQUIRED", "Xác minh email trước khi thêm mật khẩu.");
        if (user.getPasswordHash() != null) throw new ApiException(HttpStatus.CONFLICT, "PASSWORD_ALREADY_SET", "Tài khoản đã có mật khẩu. Dùng luồng khôi phục nếu cần.");
        return user;
    }
    private void consume(UUID id) { tokens.findByUserIdAndPurposeAndConsumedAtIsNull(id, "SET_PASSWORD").forEach(AuthToken::consume); }
    private ApiException invalid() { return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_AUTH_TOKEN", "Liên kết không đúng tài khoản, đã hết hạn hoặc không còn hiệu lực."); }
}

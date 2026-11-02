package com.tinyclass.auth;

import com.tinyclass.common.api.ApiException;
import com.tinyclass.common.audit.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.Map;

@Service
public class TeacherSetupService {
    private final UserAccountRepository users;
    private final PasswordEncoder passwords;
    private final AuditEventRepository audit;
    private final String setupKey;

    public TeacherSetupService(UserAccountRepository users, PasswordEncoder passwords,
            AuditEventRepository audit, @Value("${tinyclass.auth.setup-key:}") String setupKey) {
        this.users = users; this.passwords = passwords; this.audit = audit; this.setupKey = setupKey;
    }

    public boolean required() { return !users.existsByRole("TEACHER"); }
    public boolean enabled() { return setupKey.length() >= 32; }

    @Transactional
    public UserAccount setup(AuthController.SetupInput input, String requestId) {
        if (!enabled() || !MessageDigest.isEqual(setupKey.getBytes(StandardCharsets.UTF_8),
                input.setupKey().getBytes(StandardCharsets.UTF_8))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "INVALID_SETUP_KEY", "Mã khởi tạo không hợp lệ.");
        }
        if (!required()) throw new ApiException(HttpStatus.CONFLICT, "ALREADY_CONFIGURED", "Tài khoản giáo viên đã được khởi tạo.");
        var user = users.saveAndFlush(new UserAccount(input.email().strip().toLowerCase(Locale.ROOT),
                passwords.encode(input.password()), input.displayName().strip(), "TEACHER"));
        audit.save(new AuditEvent(user.getId(), "TEACHER_CREATED", "USER", user.getId(),
                Map.of("role", "TEACHER"), null, requestId));
        return user;
    }
}

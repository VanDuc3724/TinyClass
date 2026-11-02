package com.tinyclass.auth.google;

import com.tinyclass.auth.UserAccount;
import com.tinyclass.common.api.ApiException;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

@Component
public class RecentAuthentication {
    private static final String KEY = RecentAuthentication.class.getName();
    public record Proof(UUID userId, long credentialVersion, Instant at) implements Serializable {}
    public void remember(HttpSession session, UserAccount user) { session.setAttribute(KEY, new Proof(user.getId(), user.getCredentialVersion(), Instant.now())); }
    public boolean current(HttpSession session, UserAccount user) { return matches(session == null ? null : (Proof) session.getAttribute(KEY), user); }
    public Proof consume(HttpSession session, UserAccount user) {
        if (session == null) throw required();
        synchronized (session) {
            Proof proof = (Proof) session.getAttribute(KEY);
            if (!matches(proof, user)) throw required();
            session.removeAttribute(KEY);
            return proof;
        }
    }
    public boolean matches(Proof proof, UserAccount user) {
        return proof != null && proof.userId().equals(user.getId()) && proof.credentialVersion() == user.getCredentialVersion()
                && proof.at().isAfter(Instant.now().minusSeconds(300)) && !proof.at().isAfter(Instant.now());
    }
    public ApiException required() { return new ApiException(HttpStatus.CONFLICT, "REAUTHENTICATION_REQUIRED", "Xác thực lại tài khoản trước khi thay đổi phương thức đăng nhập."); }
}

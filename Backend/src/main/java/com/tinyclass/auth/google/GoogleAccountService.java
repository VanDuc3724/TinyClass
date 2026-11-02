package com.tinyclass.auth.google;

import com.tinyclass.auth.*;
import com.tinyclass.common.api.ApiException;
import com.tinyclass.common.audit.*;
import com.tinyclass.family.*;
import jakarta.persistence.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@Transactional
public class GoogleAccountService {
    private final UserAccountRepository users;
    private final AuthIdentityRepository identities;
    private final GuardianService guardians;
    private final AccountRecoveryService recovery;
    private final PasswordEncoder passwords;
    private final AuditEventRepository audit;
    private final RecentAuthentication recent;
    @PersistenceContext private EntityManager entityManager;

    public GoogleAccountService(UserAccountRepository users, AuthIdentityRepository identities, GuardianService guardians,
            AccountRecoveryService recovery, PasswordEncoder passwords, AuditEventRepository audit, RecentAuthentication recent) {
        this.users = users; this.identities = identities; this.guardians = guardians;
        this.recovery = recovery; this.passwords = passwords; this.audit = audit; this.recent = recent;
    }
    public record Resolved(UserAccount user, String nextPath) {}

    public Resolved resolve(GoogleClaims claims, GoogleFlow flow, UserPrincipal prior, String trace) {
        if (flow == null || !flow.fresh()) throw problem("GOOGLE_CONTEXT_EXPIRED", "Phiên xác thực Google đã hết hạn. Vui lòng thử lại.");
        if (flow.intent() == GoogleFlow.Intent.LINK || flow.intent() == GoogleFlow.Intent.REAUTHENTICATE)
            return resolveSensitive(claims, flow, prior, trace);
        if (flow.intent() == GoogleFlow.Intent.REGISTER) {
            if (flow.invitationToken() == null) throw problem("INVITATION_REQUIRED", "Cần lời mời hợp lệ để đăng ký phụ huynh.");
            guardians.validateRegistration(flow.invitationToken(), claims.email());
        }
        var identity = identities.findByIssuerAndProviderSubjectAndUnlinkedAtIsNull(claims.issuer(), claims.subject());
        if (identity.isPresent()) {
            var found = identity.get();
            var user = lockUser(found.getUserId()); entityManager.refresh(found);
            if (!found.active()) throw problem("GOOGLE_IDENTITY_UNLINKED", "Phương thức Google này đã được hủy liên kết.");
            found.seen(claims);
            record(user.getId(), "GOOGLE_LOGIN", found.getId(), trace);
            return registeredResult(user, flow, trace);
        }
        if (users.findByEmail(claims.email()).isPresent()) throw problem("ACCOUNT_LINK_REQUIRED",
                "Email đã có tài khoản. Đăng nhập bằng phương thức đang có rồi liên kết Google trong trang Tài khoản.");
        if (flow.intent() != GoogleFlow.Intent.REGISTER) throw problem("INVITATION_REQUIRED", "Nhận lời mời từ giáo viên để đăng ký tài khoản mới.");
        String name = flow.displayName() == null || flow.displayName().isBlank() ? claims.displayName() : flow.displayName();
        if (name == null || name.isBlank() || name.strip().length() > 100)
            throw problem("DISPLAY_NAME_REQUIRED", "Điền họ và tên trên màn hình lời mời trước khi tiếp tục với Google.");
        var user = new UserAccount(claims.email(), null, name.strip(), "PARENT");
        if (claims.authoritativeEmail()) user.verifyEmail();
        user = users.saveAndFlush(user);
        var linked = identities.saveAndFlush(new AuthIdentity(user.getId(), claims));
        record(user.getId(), "GOOGLE_PARENT_REGISTERED", linked.getId(), trace);
        if (user.getEmailVerifiedAt() == null) recovery.issueVerification(user, flow.invitationToken());
        return registeredResult(user, flow, trace);
    }

    private Resolved registeredResult(UserAccount user, GoogleFlow flow, String trace) {
        if (flow.intent() == GoogleFlow.Intent.REGISTER) {
            if (!"PARENT".equals(user.getRole())) throw problem("ACCESS_DENIED", "Tài khoản này không thể nhận lời mời phụ huynh.");
            if (user.getEmailVerifiedAt() != null) {
                var accepted = guardians.accept(user.getId(), new FamilyDtos.AcceptInput(flow.invitationToken(), null), trace);
                return new Resolved(user, "/family/children/" + accepted.studentId());
            }
        }
        return new Resolved(user, flow.invitationToken() == null ? root(user) : "/invite#token=" + flow.invitationToken());
    }

    private Resolved resolveSensitive(GoogleClaims claims, GoogleFlow flow, UserPrincipal prior, String trace) {
        if (prior == null || flow.actorId() == null || !flow.actorId().equals(prior.id())
                || flow.credentialVersion() != prior.credentialVersion()) throw recent.required();
        var user = lockUser(flow.actorId());
        if (user.getCredentialVersion() != flow.credentialVersion()) throw recent.required();
        var matching = identities.findByIssuerAndProviderSubjectAndUnlinkedAtIsNull(claims.issuer(), claims.subject());
        if (flow.intent() == GoogleFlow.Intent.REAUTHENTICATE) {
            if (matching.isEmpty() || !matching.get().getUserId().equals(user.getId()))
                throw problem("GOOGLE_REAUTHENTICATION_MISMATCH", "Chọn đúng tài khoản Google đã liên kết với tài khoản hiện tại.");
            matching.get().seen(claims);
            return new Resolved(user, root(user) + "/account");
        }
        if (!recent.matches(flow.proof(), user)) throw recent.required();
        if (matching.isPresent()) throw problem("GOOGLE_IDENTITY_ALREADY_LINKED", "Tài khoản Google này đã được liên kết.");
        if (identities.findByUserIdAndUnlinkedAtIsNull(user.getId()).isPresent())
            throw problem("GOOGLE_ALREADY_LINKED", "Tài khoản đã có một phương thức Google. Hủy liên kết hiện tại trước khi đổi.");
        var identity = identities.saveAndFlush(new AuthIdentity(user.getId(), claims));
        if (user.getEmail().equals(claims.email()) && claims.authoritativeEmail()) user.verifyEmail();
        user.bumpCredentials(); users.flush();
        record(user.getId(), "GOOGLE_LINKED", identity.getId(), trace);
        return new Resolved(user, root(user) + "/account");
    }

    public UserAccount passwordReauthenticate(UserPrincipal actor, String password) {
        var user = lockUser(actor.id());
        if (actor.credentialVersion() != user.getCredentialVersion()) throw recent.required();
        if (user.getPasswordHash() == null || !passwords.matches(password, user.getPasswordHash()))
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Mật khẩu xác thực lại chưa chính xác.");
        return user;
    }

    public UserAccount unlink(UUID actor, UUID identityId, RecentAuthentication.Proof proof, String trace) {
        var user = lockUser(actor);
        if (!recent.matches(proof, user)) throw recent.required();
        var identity = identities.findByIdAndUserIdAndUnlinkedAtIsNull(identityId, actor)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", "Không tìm thấy phương thức đăng nhập."));
        if (user.getPasswordHash() == null) throw problem("LAST_LOGIN_METHOD", "Thêm phương thức đăng nhập khác trước khi hủy Google.");
        identity.unlink(); user.bumpCredentials();
        record(actor, "GOOGLE_UNLINKED", identityId, trace);
        return user;
    }

    public UserAccount activeUser(UUID actor) { return lockUser(actor); }
    public boolean stillCurrent(UserPrincipal principal) {
        return users.findById(principal.id()).filter(user -> "ACTIVE".equals(user.getStatus())
                && user.getRole().equals(principal.role()) && user.getCredentialVersion() == principal.credentialVersion()).isPresent();
    }
    private UserAccount lockUser(UUID id) {
        var user = users.lockById(id).orElseThrow(() -> problem("GOOGLE_ACCOUNT_UNAVAILABLE", "Tài khoản chưa thể đăng nhập."));
        entityManager.refresh(user);
        if (!"ACTIVE".equals(user.getStatus())) throw problem("GOOGLE_ACCOUNT_UNAVAILABLE", "Tài khoản chưa thể đăng nhập.");
        return user;
    }
    public static String root(UserAccount user) { return "TEACHER".equals(user.getRole()) ? "/teacher" : "/family"; }
    private void record(UUID actor, String action, UUID identity, String trace) {
        audit.save(new AuditEvent(actor, action, "AUTH_IDENTITY", identity, Map.of("provider", "GOOGLE"), null, trace));
    }
    private ApiException problem(String code, String message) { return new ApiException(HttpStatus.CONFLICT, code, message); }
}

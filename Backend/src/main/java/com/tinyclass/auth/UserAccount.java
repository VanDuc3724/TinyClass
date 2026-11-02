package com.tinyclass.auth;

import com.tinyclass.common.persistence.BaseEntity;
import com.tinyclass.common.persistence.Timestamps;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "users")
public class UserAccount extends BaseEntity {
    @Column(nullable = false, length = 254)
    private String email;
    @Column(name = "password_hash")
    private String passwordHash;
    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;
    @Column(length = 30)
    private String phone;
    @Column(nullable = false, length = 20)
    private String role;
    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";
    @Column(name = "email_verified_at")
    private Instant emailVerifiedAt;
    @Column(name = "password_changed_at")
    private Instant passwordChangedAt;
    @Column(name = "credential_version", nullable = false)
    private long credentialVersion;

    protected UserAccount() {}

    public UserAccount(String email, String passwordHash, String displayName, String role) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.displayName = displayName;
        this.role = role;
        this.passwordChangedAt = passwordHash == null ? null : Timestamps.now();
    }

    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getDisplayName() { return displayName; }
    public String getRole() { return role; }
    public String getStatus() { return status; }
    public Instant getEmailVerifiedAt() { return emailVerifiedAt; }
    public Instant getPasswordChangedAt() { return passwordChangedAt; }
    public void verifyEmail() { if (emailVerifiedAt == null) emailVerifiedAt = Timestamps.now(); }
    public long getCredentialVersion() { return credentialVersion; }
    public void bumpCredentials() { credentialVersion++; }
    public void changePassword(String hash) { passwordHash = hash; passwordChangedAt = Timestamps.now(); bumpCredentials(); }
}

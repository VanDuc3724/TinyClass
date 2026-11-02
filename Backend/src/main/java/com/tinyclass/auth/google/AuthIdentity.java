package com.tinyclass.auth.google;

import com.tinyclass.common.persistence.*;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "auth_identities")
public class AuthIdentity extends BaseEntity {
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(nullable = false, length = 20) private String provider = "GOOGLE";
    @Column(nullable = false, length = 255) private String issuer;
    @Column(name = "provider_subject", nullable = false, length = 255) private String providerSubject;
    @Column(name = "provider_email", length = 254) private String providerEmail;
    @Column(name = "provider_email_verified", nullable = false) private boolean providerEmailVerified;
    @Column(name = "linked_at", nullable = false) private Instant linkedAt = Timestamps.now();
    @Column(name = "last_login_at") private Instant lastLoginAt;
    @Column(name = "unlinked_at") private Instant unlinkedAt;
    protected AuthIdentity() {}
    public AuthIdentity(UUID userId, GoogleClaims claims) {
        this.userId = userId; this.issuer = claims.issuer(); this.providerSubject = claims.subject(); seen(claims);
    }
    public void seen(GoogleClaims claims) {
        providerEmail = claims.email(); providerEmailVerified = claims.emailVerified(); lastLoginAt = Timestamps.now();
    }
    public void unlink() { unlinkedAt = Timestamps.now(); }
    public boolean active() { return unlinkedAt == null; }
    public UUID getUserId() { return userId; }
    public String getProviderEmail() { return providerEmail; }
    public Instant getLinkedAt() { return linkedAt; }
}

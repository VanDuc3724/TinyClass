package com.tinyclass.auth;

import com.tinyclass.common.persistence.*;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "auth_tokens")
public class AuthToken extends BaseEntity {
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(nullable = false, length = 30) private String purpose;
    @Column(name = "token_hash", nullable = false, length = 128) private String tokenHash;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "consumed_at") private Instant consumedAt;
    protected AuthToken() {}
    public AuthToken(UUID userId, String purpose, String raw, long seconds) {
        this.userId = userId; this.purpose = purpose; this.tokenHash = SecretTokens.hash(raw);
        this.expiresAt = Timestamps.now().plusSeconds(seconds);
    }
    public boolean usable() { return consumedAt == null && expiresAt.isAfter(Instant.now()); }
    public void consume() { consumedAt = Timestamps.now(); }
    public UUID getUserId() { return userId; }
    public String getPurpose() { return purpose; }
}

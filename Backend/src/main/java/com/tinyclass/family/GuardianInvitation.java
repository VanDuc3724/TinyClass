package com.tinyclass.family;

import com.tinyclass.auth.SecretTokens;
import com.tinyclass.common.persistence.*;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "guardian_invitations")
public class GuardianInvitation extends BaseEntity {
    @Column(name = "teacher_id", nullable = false) private UUID teacherId;
    @Column(name = "student_id", nullable = false) private UUID studentId;
    @Column(name = "invited_email", nullable = false, length = 254) private String invitedEmail;
    @Column(name = "token_hash", nullable = false, length = 128) private String tokenHash;
    @Column(nullable = false, length = 20) private String status = "PENDING";
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "accepted_by") private UUID acceptedBy;
    @Column(name = "accepted_at") private Instant acceptedAt;
    @Column(name = "revoked_at") private Instant revokedAt;
    protected GuardianInvitation() {}
    public GuardianInvitation(UUID teacherId, UUID studentId, String email, String raw, long hours) {
        this.teacherId = teacherId; this.studentId = studentId; this.invitedEmail = email;
        this.tokenHash = SecretTokens.hash(raw); this.expiresAt = Timestamps.now().plusSeconds(hours * 3600);
    }
    public boolean pending() { return "PENDING".equals(status) && expiresAt.isAfter(Instant.now()); }
    public String displayStatus() { return "PENDING".equals(status) && !pending() ? "EXPIRED" : status; }
    public void revoke() { status = "REVOKED"; revokedAt = Timestamps.now(); }
    public void accept(UUID user) { status = "ACCEPTED"; acceptedBy = user; acceptedAt = Timestamps.now(); }
    public UUID getTeacherId() { return teacherId; }
    public UUID getStudentId() { return studentId; }
    public String getInvitedEmail() { return invitedEmail; }
    public String getStatus() { return status; }
    public Instant getExpiresAt() { return expiresAt; }
}

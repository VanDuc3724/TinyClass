package com.tinyclass.family;

import com.tinyclass.common.persistence.*;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "student_guardians")
public class StudentGuardian extends BaseEntity {
    @Column(name = "student_id", nullable = false) private UUID studentId;
    @Column(name = "guardian_user_id", nullable = false) private UUID guardianUserId;
    @Column(name = "relationship_label", length = 50) private String relationshipLabel;
    @Column(nullable = false, length = 20) private String status;
    @Column(name = "linked_at", nullable = false) private Instant linkedAt;
    @Column(name = "revoked_at") private Instant revokedAt;
    protected StudentGuardian() {}
    public StudentGuardian(UUID studentId, UUID userId, String label) {
        this.studentId = studentId; this.guardianUserId = userId; activate(label);
    }
    public void activate(String label) { status = "ACTIVE"; relationshipLabel = label; linkedAt = Timestamps.now(); revokedAt = null; }
    public void revoke() { status = "REVOKED"; revokedAt = Timestamps.now(); }
    public UUID getStudentId() { return studentId; }
    public UUID getGuardianUserId() { return guardianUserId; }
    public String getRelationshipLabel() { return relationshipLabel; }
    public String getStatus() { return status; }
    public Instant getLinkedAt() { return linkedAt; }
}

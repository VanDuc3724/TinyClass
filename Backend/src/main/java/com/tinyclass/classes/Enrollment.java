package com.tinyclass.classes;

import com.tinyclass.common.persistence.BaseEntity;
import com.tinyclass.common.persistence.Timestamps;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "class_enrollments")
public class Enrollment extends BaseEntity {
    @Column(name = "class_id", nullable = false)
    private UUID classId;
    @Column(name = "student_id", nullable = false)
    private UUID studentId;
    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";
    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt = Timestamps.now();
    @Column(name = "status_changed_at", nullable = false)
    private Instant statusChangedAt = joinedAt;
    @Column(name = "ended_at")
    private Instant endedAt;
    @Column(columnDefinition = "text")
    private String note;

    protected Enrollment() {}
    public Enrollment(UUID classId, UUID studentId) { this.classId = classId; this.studentId = studentId; }
    public void changeStatus(String status, String reason) {
        this.status = status; this.note = reason; this.statusChangedAt = Timestamps.now();
        endedAt = "ACTIVE".equals(status) ? null : statusChangedAt;
    }
    public UUID getClassId() { return classId; }
    public UUID getStudentId() { return studentId; }
    public String getStatus() { return status; }
    public Instant getJoinedAt() { return joinedAt; }
    public Instant getStatusChangedAt() { return statusChangedAt; }
    public Instant getEndedAt() { return endedAt; }
    public String getNote() { return note; }
}

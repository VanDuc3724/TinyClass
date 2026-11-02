package com.tinyclass.classes;

import com.tinyclass.common.persistence.BaseEntity;
import com.tinyclass.common.persistence.Timestamps;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "students")
public class Student extends BaseEntity {
    @Column(name = "teacher_id", nullable = false)
    private UUID teacherId;
    @Column(name = "full_name", nullable = false, length = 150)
    private String fullName;
    @Column(name = "preferred_name", length = 100)
    private String preferredName;
    @Column(name = "birth_date")
    private LocalDate birthDate;
    @Column(name = "internal_note", columnDefinition = "text")
    private String internalNote;
    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";
    @Column(name = "archived_at")
    private Instant archivedAt;

    protected Student() {}
    public Student(UUID teacherId, ClassDtos.StudentInput input) { this.teacherId = teacherId; edit(input); }
    public void edit(ClassDtos.StudentInput input) {
        fullName = input.fullName().strip(); preferredName = LearningClass.clean(input.preferredName());
        birthDate = input.birthDate(); internalNote = LearningClass.clean(input.internalNote());
    }
    public void archive() { status = "ARCHIVED"; archivedAt = Timestamps.now(); }
    public void restore() { status = "ACTIVE"; archivedAt = null; }
    public UUID getTeacherId() { return teacherId; }
    public String getFullName() { return fullName; }
    public String getPreferredName() { return preferredName; }
    public LocalDate getBirthDate() { return birthDate; }
    public String getInternalNote() { return internalNote; }
    public String getStatus() { return status; }
}

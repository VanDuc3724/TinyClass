package com.tinyclass.classes;

import jakarta.validation.constraints.*;
import java.time.*;
import java.util.*;

public final class ClassDtos {
    private ClassDtos() {}

    public record ClassInput(@NotBlank @Size(max = 150) String name, @Size(max = 5000) String description,
            @PositiveOrZero Integer minAgeMonths, @PositiveOrZero Integer maxAgeMonths,
            @Positive Integer capacity, @Size(max = 300) String location,
            LocalDate startDate, LocalDate endDate, @PositiveOrZero Long version) {}

    public record StudentInput(@NotBlank @Size(max = 150) String fullName,
            @Size(max = 100) String preferredName, LocalDate birthDate,
            @Size(max = 5000) String internalNote, @PositiveOrZero Long version) {}

    public record VersionInput(@NotNull @PositiveOrZero Long version, @Size(max = 1000) String reason) {}
    public record EnrollInput(@NotNull UUID studentId) {}
    public record EnrollmentInput(@NotNull @PositiveOrZero Long version,
            @NotBlank @Pattern(regexp = "ACTIVE|WITHDRAWN|COMPLETED") String status,
            @NotBlank @Size(max = 1000) String reason) {}

    public record ClassView(UUID id, String name, String description, Integer minAgeMonths,
            Integer maxAgeMonths, Integer capacity, String location, LocalDate startDate, LocalDate endDate,
            String status, long activeStudents, Long version, Instant createdAt, Instant updatedAt) {
        static ClassView from(LearningClass c, long count) {
            return new ClassView(c.getId(), c.getName(), c.getDescription(), c.getMinAgeMonths(), c.getMaxAgeMonths(),
                    c.getCapacity(), c.getLocation(), c.getStartDate(), c.getEndDate(), c.getStatus(), count,
                    c.getVersion(), c.getCreatedAt(), c.getUpdatedAt());
        }
    }

    public record StudentView(UUID id, String fullName, String preferredName, LocalDate birthDate,
            String internalNote, String status, Long version, Instant createdAt, Instant updatedAt) {
        static StudentView from(Student s) {
            return new StudentView(s.getId(), s.getFullName(), s.getPreferredName(), s.getBirthDate(),
                    s.getInternalNote(), s.getStatus(), s.getVersion(), s.getCreatedAt(), s.getUpdatedAt());
        }
    }

    public record EnrollmentView(UUID id, UUID classId, UUID studentId, String studentName, String preferredName,
            LocalDate birthDate, String status, Instant joinedAt, Instant statusChangedAt,
            Instant endedAt, String note, Long version) {
        static EnrollmentView from(Enrollment e, Student s) {
            return new EnrollmentView(e.getId(), e.getClassId(), e.getStudentId(), s.getFullName(), s.getPreferredName(),
                    s.getBirthDate(), e.getStatus(), e.getJoinedAt(), e.getStatusChangedAt(), e.getEndedAt(), e.getNote(), e.getVersion());
        }
    }

    public record StudentClassView(UUID enrollmentId, UUID classId, String className, String classStatus,
            String status, Instant joinedAt, Instant endedAt) {}
    public record HistoryView(UUID id, String action, Map<String, Object> changedFields, String reason, Instant createdAt) {}
}

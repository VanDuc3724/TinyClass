package com.tinyclass.teaching;

import jakarta.validation.constraints.*;
import java.time.*;
import java.util.UUID;

public final class ScheduleDtos {
    private ScheduleDtos() {}
    public record RuleInput(Long version, @NotNull @Min(1) @Max(7) Integer weekday,
            @NotNull LocalTime startTime, @NotNull LocalTime endTime,
            @NotBlank @Size(max=64) String timezone, @NotNull LocalDate effectiveFrom, LocalDate effectiveTo,
            @Size(max=300) String location, @NotNull Boolean isActive,
            Boolean preview, Boolean allowConflicts, @Size(max=64) String conflictKey) {
        public RuleInput { preview=Boolean.TRUE.equals(preview);allowConflicts=Boolean.TRUE.equals(allowConflicts); }
    }
    public record GenerateInput(@NotNull LocalDate from, @NotNull LocalDate to,
            Boolean preview, Boolean allowConflicts, @Size(max=64) String conflictKey) {
        public GenerateInput { preview=Boolean.TRUE.equals(preview);allowConflicts=Boolean.TRUE.equals(allowConflicts); }
    }
    public record SessionInput(Long version, @NotNull UUID classId, UUID clientRequestId,
            @NotNull Instant startsAt, @NotNull Instant endsAt, @Size(max=200) String title,
            @Size(max=300) String location, @Size(max=5000) String lessonPlan, @Size(max=1000) String reason,
            Boolean preview, Boolean allowConflicts, @Size(max=64) String conflictKey) {
        public SessionInput { preview=Boolean.TRUE.equals(preview);allowConflicts=Boolean.TRUE.equals(allowConflicts); }
    }
    public record CancelInput(@NotNull @Min(0) Long version, @NotBlank @Size(max=1000) String reason) {}
}

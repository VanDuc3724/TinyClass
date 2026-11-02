package com.tinyclass.learning;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;

public final class AssignmentDtos {
    private AssignmentDtos() {}
    public record CreateInput(@NotBlank @Size(max=200) String title,@NotNull @Pattern(regexp="LESSON|COURSE") String sourceType,
            UUID lessonId,UUID courseId,@NotNull @Pattern(regexp="CLASS|STUDENT") String targetType,UUID classId,UUID studentId,
            Instant availableAt,Instant dueAt,@NotNull UUID clientRequestId) {}
    public record ItemInput(@NotNull UUID id,boolean isRequired,@NotNull @Pattern(regexp="REFERENCE|PARENT_CONFIRM|TEACHER_REVIEW") String completionMode,
            @NotNull @Size(max=4) List<@Pattern(regexp="TEXT|IMAGE|AUDIO|VIDEO") String> allowedResponseTypes) {}
    public record DraftInput(@NotNull Long version,@NotBlank @Size(max=200) String title,Instant availableAt,Instant dueAt,
            @NotNull @Size(max=100) List<@Valid ItemInput> items) {}
    public record RecipientsInput(@NotNull Long version,@NotEmpty @Size(max=100) List<@NotNull UUID> studentIds,@NotBlank @Size(max=1000) String reason) {}
}

package com.tinyclass.games;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;

public final class GameDtos {
    private GameDtos() {}
    public record Face(@Size(max=120) String label,UUID imageFileId,UUID audioFileId) {}
    public record Option(@NotNull UUID id,@Size(max=120) String label,UUID imageFileId,UUID audioFileId) {}
    public record Question(@NotNull UUID id,@Size(max=500) String prompt,UUID imageFileId,UUID audioFileId,
            @Size(max=300) String hint,@NotNull @Size(max=4) List<@NotNull @Valid Option> options,UUID correctOptionId) {}
    public record Pair(@NotNull UUID id,@Valid Face left,@Valid Face right) {}
    public record Content(UUID instructionAudioFileId,
            @NotNull @Size(max=12) List<@NotNull @Valid Question> questions,
            @NotNull @Size(max=8) List<@NotNull @Valid Pair> pairs) {}
    public record Save(@NotBlank @Size(max=200) String title,@NotBlank @Pattern(regexp="CHOICE|MATCH|MEMORY") String gameType,
            @Size(max=2000) String instructions,@Min(0) @Max(216) Integer minAgeMonths,@Min(0) @Max(216) Integer maxAgeMonths,
            @NotNull @Valid Content content,@Min(0) Long version,@Size(max=1000) String reason,UUID clientRequestId) {}
    public record Action(@NotNull @Min(0) Long version,@Size(max=1000) String reason) {}
    public record Assign(@NotNull UUID clientRequestId,@NotNull UUID gameId,@NotBlank @Size(max=200) String title,
            @NotBlank @Pattern(regexp="CLASS|STUDENT") String targetType,UUID classId,UUID studentId,
            @NotNull Instant availableAt,Instant dueAt,UUID linkedLessonId,UUID linkedCourseId) {}
    public record Grant(@NotNull @Min(0) Long version,@NotEmpty @Size(max=100) List<@NotNull UUID> studentIds,
            @NotBlank @Size(max=1000) String reason) {}
    public record Start(@NotNull UUID clientRequestId) {}
    public record Move(@NotNull UUID clientRequestId,@NotNull @Min(0) Long version,
            @NotBlank @Pattern(regexp="ANSWER|MATCH|FLIP|HINT") String action,
            UUID optionId,UUID leftId,UUID rightId,UUID cardId) {}
}

package com.tinyclass.learning;

import jakarta.validation.constraints.*;
import java.util.*;

public final class SubmissionDtos {
    private SubmissionDtos() {}
    public record DraftInput(@NotNull @Min(0) Long version,@Size(max=5000) String textResponse,
            @NotNull @Size(max=5) List<@NotNull UUID> fileIds) {}
    public record VersionInput(@NotNull @Min(0) Long version) {}
    public record ReviewInput(@NotNull @Min(0) Long version,@NotBlank @Pattern(regexp="ACCEPTED|CHANGES_REQUESTED") String outcome,
            @Size(max=5000) String feedbackText,UUID feedbackAudioFileId) {}
    public record ReopenInput(@NotNull @Min(0) Long version,@NotBlank @Size(max=1000) String reason) {}
}

package com.tinyclass.communication;

import jakarta.validation.constraints.*;
import java.util.UUID;

public final class AnnouncementDtos {
    private AnnouncementDtos() {}
    public record CreateInput(@NotNull UUID clientRequestId,@NotNull UUID classId,
        @NotBlank @Size(max=200) String title,@NotBlank @Size(max=10000) String body) {}
    public record UpdateInput(@NotNull @Min(0) Long version,@NotBlank @Size(max=200) String title,
        @NotBlank @Size(max=10000) String body,@NotBlank @Size(max=1000) String reason) {}
    public record ActionInput(@NotNull @Min(0) Long version,@Size(max=1000) String reason) {}
    public record ReadInput(@NotNull @Min(1) Long revision) {}
}

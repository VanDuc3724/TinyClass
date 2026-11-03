package com.tinyclass.teaching;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.*;

public final class StudentNoteDtos {
    private StudentNoteDtos() {}
    public record CreateInput(@NotNull UUID clientRequestId, @Size(max=200) String title,
            @NotBlank @Size(max=10000) String body, @NotNull LocalDate observedOn,
            @Pattern(regexp="PRIVATE|SHARED") String visibility, UUID classId, UUID sessionId,
            @Size(max=5) List<@NotNull UUID> fileIds) {
        public CreateInput { fileIds=fileIds==null?List.of():fileIds; }
    }
    public record UpdateInput(@NotNull @Min(0) Long version, @Size(max=200) String title,
            @NotBlank @Size(max=10000) String body, @NotNull LocalDate observedOn,
            @NotBlank @Pattern(regexp="PRIVATE|SHARED") String visibility, UUID classId, UUID sessionId,
            @Size(max=5) List<@NotNull UUID> fileIds, @NotBlank @Size(max=1000) String reason) {
        public UpdateInput { fileIds=fileIds==null?List.of():fileIds; }
    }
    public record StateInput(@NotNull @Min(0) Long version, @NotBlank @Size(max=1000) String reason) {}
}

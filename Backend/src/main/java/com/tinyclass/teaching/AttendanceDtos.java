package com.tinyclass.teaching;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;

public final class AttendanceDtos {
    private AttendanceDtos() {}
    public record RosterInput(@NotNull @Min(0) Long sessionVersion) {}
    public record RowInput(@NotNull UUID id,@NotNull @Min(0) Long version,
            @NotBlank @Pattern(regexp="UNMARKED|PRESENT|LATE|ABSENT_EXCUSED|ABSENT_UNEXCUSED") String status,
            @Size(max=1000) String note,@Size(max=1000) String familyNote) {}
    public record BatchInput(@NotNull @Min(0) Long sessionVersion,@NotEmpty @Size(max=500) List<@NotNull @Valid RowInput> rows,@Size(max=1000) String reason) {}
    public record MemberInput(@NotNull @Min(0) Long sessionVersion,@NotNull UUID studentId,
            @NotBlank @Pattern(regexp="ADD|REMOVE") String action,@NotBlank @Size(max=1000) String reason) {}
    public record CompleteInput(@NotNull @Min(0) Long version,@Size(max=1000) String reason) {}
}

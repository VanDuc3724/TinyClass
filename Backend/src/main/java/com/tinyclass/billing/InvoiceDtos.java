package com.tinyclass.billing;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class InvoiceDtos {
    private InvoiceDtos() {}
    public record PreviewInput(@NotNull UUID agreementId, @NotNull LocalDate periodStart,
            @NotNull LocalDate periodEnd, UUID invoiceId) {}
    public record LineInput(@NotBlank @Size(max=300) String description,
            @NotBlank @Pattern(regexp="PER_SESSION|MONTHLY_FIXED|FULL_PROGRAM|OTHER") String pricingBasis,
            @NotNull @DecimalMin("1") @DecimalMax("10000") @Digits(integer=5,fraction=0) BigDecimal quantity,
            @NotNull @DecimalMin("0") @DecimalMax("1000000000000") @Digits(integer=13,fraction=0) BigDecimal unitPriceVnd,
            @NotNull @DecimalMin("0") @DecimalMax("1000000000000") @Digits(integer=13,fraction=0) BigDecimal discountVnd,
            UUID attendanceId) {}
    public record SaveInput(UUID clientRequestId, @NotNull UUID agreementId, Long version,
            @NotNull LocalDate periodStart, @NotNull LocalDate periodEnd, LocalDate dueOn,
            @NotBlank @Pattern(regexp="[a-f0-9]{64}") String previewKey,
            @NotNull @Size(max=100) List<@NotNull @Valid LineInput> lines,
            @Size(max=5000) String publicNote, @Size(max=5000) String internalNote,
            @Size(max=1000) String adjustmentReason, @Size(max=1000) String reason) {}
    public record IssueInput(@NotNull @Min(0) Long version,
            @NotBlank @Pattern(regexp="[a-f0-9]{64}") String reviewKey) {}
    public record CancelInput(@NotNull @Min(0) Long version, @NotBlank @Size(max=1000) String reason) {}
}

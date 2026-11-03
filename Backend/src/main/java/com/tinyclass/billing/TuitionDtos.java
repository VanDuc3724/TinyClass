package com.tinyclass.billing;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public final class TuitionDtos {
    private TuitionDtos() {}
    public record Terms(@NotBlank @Pattern(regexp="PER_SESSION|MONTHLY_FIXED|FULL_PROGRAM") String pricingMode,
            @NotBlank @Pattern(regexp="AT_PERIOD_START|AT_PERIOD_END|UPFRONT") String collectionTiming,
            @DecimalMin("0") @DecimalMax("1000000000000") @Digits(integer=13,fraction=0) BigDecimal sessionUnitPriceVnd,
            @DecimalMin("0") @DecimalMax("1000000000000") @Digits(integer=13,fraction=0) BigDecimal monthlyAmountVnd,
            @DecimalMin("0") @DecimalMax("1000000000000") @Digits(integer=13,fraction=0) BigDecimal programTotalVnd,
            @Size(max=200) String programLabel,@Min(1) @Max(10000) Integer expectedSessions,
            Boolean chargeExcusedAbsence,Boolean chargeUnexcusedAbsence,
            @Pattern(regexp="KEEP_AGREED_AMOUNT|MANUAL_ADJUSTMENT") String fixedFeeAbsenceRule,
            @Size(max=5000) String publicTerms) {}
    public record PolicyInput(@Min(0) Long version,@NotNull @Valid Terms terms,
            @Size(max=5000) String internalNote,@Size(max=1000) String reason) {}
    public record AgreementInput(@NotNull UUID clientRequestId,@NotBlank @Pattern(regexp="POLICY|CUSTOM") String source,
            @Min(0) Long policyVersion,@Valid Terms terms,@NotNull LocalDate effectiveFrom,LocalDate effectiveTo,
            @Size(max=5000) String internalNote,@Size(max=1000) String reason,@Min(0) Long version) {}
    public record EndInput(@NotNull @Min(0) Long version,@NotNull LocalDate effectiveTo,@NotBlank @Size(max=1000) String reason) {}
    public record CancelInput(@NotNull @Min(0) Long version,@NotBlank @Size(max=1000) String reason) {}
}

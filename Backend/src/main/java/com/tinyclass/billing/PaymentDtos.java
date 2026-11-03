package com.tinyclass.billing;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;

public final class PaymentDtos {
    private PaymentDtos() {}
    public record RecordInput(@NotNull @Min(0) Long invoiceVersion,
            @NotNull @DecimalMin("1") @DecimalMax("1000000000000") @Digits(integer=13,fraction=0) BigDecimal amountVnd,
            @NotBlank @Pattern(regexp="CASH|BANK_TRANSFER|OTHER") String method,
            @NotNull Instant paidAt,@Size(max=1000) String publicNote,@Size(max=1000) String internalNote) {}
    public record VoidInput(@NotNull @Min(0) Long version,@NotNull @Min(0) Long invoiceVersion,
            @NotBlank @Size(max=1000) String reason) {}
}

package com.sparesbilling.backend.creditnote;

import com.sparesbilling.backend.common.PaymentMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

public record CreditNoteRequest(
        @NotNull Long invoiceId,
        @NotEmpty @Valid List<Item> items,
        @NotBlank @Size(max = 255) String reason,
        @DecimalMin("0.0") @Digits(integer = 10, fraction = 2) BigDecimal refundAmount,  // walk-in: always the full total
        PaymentMethod refundMethod                                                       // default CASH
) {
    public record Item(
            @NotNull Long productId,               // the part being returned (it must be on the invoice)
            @NotNull @Min(1) Integer quantity,
            Boolean restock                        // default true; false = damaged, do not add back to stock
    ) {}
}
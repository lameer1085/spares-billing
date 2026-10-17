package com.sparesbilling.backend.invoice;

import com.sparesbilling.backend.common.PaymentMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

public record InvoiceRequest(
        Long customerId,                                   // omit = walk-in customer
        @NotEmpty @Valid List<Item> items,
        @DecimalMin("0.0") @Digits(integer = 10, fraction = 2) BigDecimal paidAmount,  // omit = paid in full
        PaymentMethod paymentMethod                        // default CASH
) {
    public record Item(
            @NotNull Long productId,
            @NotNull @Min(1) Integer quantity,
            @DecimalMin("0.0") @Digits(integer = 10, fraction = 2) BigDecimal discountAmount  // Rs off this line, GST-inclusive
    ) {}
}
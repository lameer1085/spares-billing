package com.sparesbilling.backend.purchase;

import com.sparesbilling.backend.common.PaymentMethod;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PurchasePaymentRequest(
        @NotNull @DecimalMin("0.01") @Digits(integer = 10, fraction = 2) BigDecimal amount,
        @NotNull PaymentMethod method,
        @Size(max = 100) String reference,
        LocalDate paymentDate,                // defaults to today
        @Size(max = 255) String notes
) {}
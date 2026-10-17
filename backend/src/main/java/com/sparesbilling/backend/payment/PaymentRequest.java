package com.sparesbilling.backend.payment;

import com.sparesbilling.backend.common.PaymentMethod;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PaymentRequest(
        @NotNull Long customerId,
        Long invoiceId,                        // omit = on account (settles the oldest bills first)
        @NotNull @DecimalMin("0.01") @Digits(integer = 10, fraction = 2) BigDecimal amount,
        @NotNull PaymentMethod method,
        @Size(max = 100) String reference,     // UPI ref, cheque no., etc.
        LocalDate paymentDate,                 // default today
        @Size(max = 255) String notes,
        Boolean advance                        // true = allow paying more than the balance
) {}
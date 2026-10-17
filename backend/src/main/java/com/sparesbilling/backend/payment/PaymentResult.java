package com.sparesbilling.backend.payment;

import java.math.BigDecimal;
import java.util.List;

/** What happened to the money: one row per bill it settled, plus any amount left on account. */
public record PaymentResult(BigDecimal amount, List<PaymentResponse> allocations, BigDecimal customerBalance) {}
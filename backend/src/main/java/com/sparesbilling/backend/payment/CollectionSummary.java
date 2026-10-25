package com.sparesbilling.backend.payment;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

/** byMethod = money received minus refunds paid out. total = the net of all methods. */
public record CollectionSummary(LocalDate from, LocalDate to, Map<String, BigDecimal> byMethod,
                                Map<String, BigDecimal> refundsByMethod, BigDecimal total) {}
package com.sparesbilling.backend.payment;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

public record CollectionSummary(LocalDate from, LocalDate to, Map<String, BigDecimal> byMethod, BigDecimal total) {}
package com.sparesbilling.backend.quotation;

import java.math.BigDecimal;
import java.time.LocalDate;

public record QuotationSummary(Long id, String quotationNo, LocalDate quotationDate, LocalDate validUntil,
                               String buyerName, BigDecimal grandTotal, String status, int revision) {}
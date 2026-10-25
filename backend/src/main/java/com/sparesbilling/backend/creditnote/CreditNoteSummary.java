package com.sparesbilling.backend.creditnote;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreditNoteSummary(Long id, String creditNoteNo, LocalDate creditNoteDate, Long invoiceId,
                                String invoiceNo, String customerName, BigDecimal grandTotal,
                                BigDecimal refundAmount) {}
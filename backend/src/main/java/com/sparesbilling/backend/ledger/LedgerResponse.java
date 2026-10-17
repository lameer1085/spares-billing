package com.sparesbilling.backend.ledger;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record LedgerResponse(
        Long customerId, String customerName, LocalDate from, LocalDate to,
        BigDecimal openingBalance, BigDecimal totalDebit, BigDecimal totalCredit, BigDecimal closingBalance,
        List<Entry> entries
) {
    /** debit = customer owes more (a bill), credit = customer owes less (a payment). */
    public record Entry(LocalDate date, String type, String reference, String description,
                        BigDecimal debit, BigDecimal credit, BigDecimal balance) {}
}
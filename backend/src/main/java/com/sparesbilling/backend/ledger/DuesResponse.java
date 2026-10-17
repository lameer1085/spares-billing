package com.sparesbilling.backend.ledger;

import java.math.BigDecimal;
import java.util.List;

public record DuesResponse(BigDecimal totalOutstanding, List<Row> customers) {
    public record Row(Long customerId, String name, String phone, BigDecimal balance, BigDecimal creditLimit) {}
}
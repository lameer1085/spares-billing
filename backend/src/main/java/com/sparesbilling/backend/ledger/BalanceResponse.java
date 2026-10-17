package com.sparesbilling.backend.ledger;

import java.math.BigDecimal;

public record BalanceResponse(Long customerId, String customerName, BigDecimal balance,
                              BigDecimal creditLimit, BigDecimal availableCredit) {}
package com.sparesbilling.backend.customer;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;

public record CustomerRequest(
        @NotBlank @Size(max = 150) String name,
        @Size(max = 20) String phone,
        @Size(max = 15) String gstin,
        String address,
        @Size(max = 2) String stateCode,
        @DecimalMin("0.0") @Digits(integer = 10, fraction = 2) BigDecimal creditLimit,     // Owner only
        @Digits(integer = 10, fraction = 2) BigDecimal openingBalance                      // Owner only
) {}
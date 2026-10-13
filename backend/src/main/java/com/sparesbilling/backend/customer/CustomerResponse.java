package com.sparesbilling.backend.customer;

import com.sparesbilling.backend.common.StateCodes;

import java.math.BigDecimal;

public record CustomerResponse(
        Long id, String name, String phone, String gstin, String address,
        String stateCode, String stateName,
        BigDecimal creditLimit, BigDecimal openingBalance, boolean active
) {
    public static CustomerResponse from(Customer c) {
        return new CustomerResponse(c.getId(), c.getName(), c.getPhone(), c.getGstin(), c.getAddress(),
                c.getStateCode(), StateCodes.name(c.getStateCode()),
                c.getCreditLimit(), c.getOpeningBalance(), c.isActive());
    }
}
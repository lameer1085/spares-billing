package com.sparesbilling.backend.supplier;

import com.sparesbilling.backend.common.StateCodes;

public record SupplierResponse(Long id, String name, String phone, String gstin, String address,
                               String stateCode, String stateName, boolean active) {
    public static SupplierResponse from(Supplier s) {
        return new SupplierResponse(s.getId(), s.getName(), s.getPhone(), s.getGstin(), s.getAddress(),
                s.getStateCode(), StateCodes.name(s.getStateCode()), s.isActive());
    }
}
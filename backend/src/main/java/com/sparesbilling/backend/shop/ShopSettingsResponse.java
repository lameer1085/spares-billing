package com.sparesbilling.backend.shop;

import com.sparesbilling.backend.common.StateCodes;

public record ShopSettingsResponse(String shopName, String address, String phone, String gstin,
                                   String stateCode, String stateName, String invoicePrefix) {
    public static ShopSettingsResponse from(ShopSettings s) {
        return new ShopSettingsResponse(s.getShopName(), s.getAddress(), s.getPhone(), s.getGstin(),
                s.getStateCode(), StateCodes.name(s.getStateCode()), s.getInvoicePrefix());
    }
}
package com.sparesbilling.backend.shop;

import com.sparesbilling.backend.common.StateCodes;

public record ShopSettingsResponse(String shopName, String address, String phone, String gstin,
                                   String stateCode, String stateName, String invoicePrefix,
                                   String pincode, String bankAccountName, String bankName,
                                   String bankAccountNo, String bankIfsc, String upiId) {
    public static ShopSettingsResponse from(ShopSettings s) {
        return new ShopSettingsResponse(s.getShopName(), s.getAddress(), s.getPhone(), s.getGstin(),
                s.getStateCode(), StateCodes.name(s.getStateCode()), s.getInvoicePrefix(),
                s.getPincode(), s.getBankAccountName(), s.getBankName(),
                s.getBankAccountNo(), s.getBankIfsc(), s.getUpiId());
    }
}
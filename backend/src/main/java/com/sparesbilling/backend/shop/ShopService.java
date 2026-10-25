package com.sparesbilling.backend.shop;

import com.sparesbilling.backend.common.ContactRules;
import com.sparesbilling.backend.common.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ShopService {

    private final ShopSettingsRepository repository;

    @Transactional(readOnly = true)
    public ShopSettingsResponse get() {
        return ShopSettingsResponse.from(find());
    }

    @Transactional
    public ShopSettingsResponse update(ShopSettingsRequest req) {
        ShopSettings s = find();
        String gstin = ContactRules.normalizeGstin(req.gstin());
        String state = ContactRules.resolveStateCode(gstin, req.stateCode());
        if (state == null) {
            throw new IllegalArgumentException("State is required (give a GSTIN or a state code)");
        }
        s.setShopName(req.shopName().trim());
        s.setAddress(ContactRules.blankToNull(req.address()));
        s.setPhone(ContactRules.normalizePhone(req.phone()));
        s.setGstin(gstin);
        s.setStateCode(state);
        s.setInvoicePrefix(req.invoicePrefix().trim().toUpperCase());
        s.setPincode(ContactRules.blankToNull(req.pincode()));
        s.setBankAccountName(ContactRules.blankToNull(req.bankAccountName()));
        s.setBankName(ContactRules.blankToNull(req.bankName()));
        s.setBankAccountNo(ContactRules.blankToNull(req.bankAccountNo()));
        String ifsc = ContactRules.blankToNull(req.bankIfsc());
        s.setBankIfsc(ifsc == null ? null : ifsc.trim().toUpperCase());
        s.setUpiId(ContactRules.blankToNull(req.upiId()));
        return ShopSettingsResponse.from(s);
    }

    private ShopSettings find() {
        return repository.findById(1).orElseThrow(() -> new NotFoundException("Shop settings not found"));
    }
}
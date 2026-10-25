package com.sparesbilling.backend.creditnote;

import com.sparesbilling.backend.invoice.InvoiceResponse;
import com.sparesbilling.backend.shop.ShopSettingsResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record CreditNoteResponse(
        Long id, String creditNoteNo, LocalDate creditNoteDate,
        Long invoiceId, String invoiceNo, LocalDate invoiceDate,
        String placeOfSupply, String placeOfSupplyName,
        BigDecimal taxableAmount, BigDecimal cgstTotal, BigDecimal sgstTotal, BigDecimal igstTotal,
        BigDecimal roundOff, BigDecimal grandTotal, BigDecimal refundAmount, String refundMethod,
        String reason, ShopSettingsResponse shop, InvoiceResponse.Buyer customer, List<Line> items
) {
    public record Line(String description, String hsnCode, int quantity, BigDecimal taxableAmount,
                       BigDecimal gstRate, BigDecimal cgstAmount, BigDecimal sgstAmount,
                       BigDecimal igstAmount, BigDecimal lineTotal, boolean restocked) {}
}
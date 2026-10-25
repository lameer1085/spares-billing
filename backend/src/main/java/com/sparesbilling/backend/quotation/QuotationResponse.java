package com.sparesbilling.backend.quotation;

import com.sparesbilling.backend.shop.ShopSettingsResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record QuotationResponse(
        Long id, String quotationNo, LocalDate quotationDate, LocalDate validUntil, int revision,
        String status, String cancelReason,
        Long customerId, String buyerName, String buyerAddress, String buyerGstin, String buyerPhone,
        String placeOfSupply, String placeOfSupplyName, boolean sameState,
        BigDecimal subtotal, BigDecimal discountTotal, BigDecimal taxableAmount,
        BigDecimal cgstTotal, BigDecimal sgstTotal, BigDecimal igstTotal,
        BigDecimal roundOff, BigDecimal grandTotal,
        String terms, String notes, LocalDateTime createdAt,
        ShopSettingsResponse shop, List<Line> items
) {
    public record Line(int lineNo, Long productId, String partNumber, String description, String hsnCode,
                       int quantity, String unit, BigDecimal unitPrice, BigDecimal grossAmount,
                       BigDecimal discountPercent, BigDecimal discountAmount, BigDecimal taxableAmount,
                       BigDecimal gstRate, BigDecimal cgstAmount, BigDecimal sgstAmount,
                       BigDecimal igstAmount, BigDecimal lineTotal) {}
}
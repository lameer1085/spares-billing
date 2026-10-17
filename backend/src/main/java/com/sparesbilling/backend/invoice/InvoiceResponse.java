package com.sparesbilling.backend.invoice;

import com.sparesbilling.backend.shop.ShopSettingsResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record InvoiceResponse(
        Long id, String invoiceNo, LocalDate invoiceDate, String status, String cancelReason,
        String placeOfSupply, String placeOfSupplyName,
        BigDecimal subtotal, BigDecimal discountTotal, BigDecimal taxableAmount,
        BigDecimal cgstTotal, BigDecimal sgstTotal, BigDecimal igstTotal,
        BigDecimal roundOff, BigDecimal grandTotal, BigDecimal paidAmount, BigDecimal dueAmount,
        ShopSettingsResponse shop, Buyer customer,
        List<Line> items, List<PaymentLine> payments
) {
    public record Buyer(Long id, String name, String phone, String gstin, String address,
                        String stateCode, String stateName) {}

    public record Line(String description, String hsnCode, int quantity, BigDecimal unitPrice,
                       BigDecimal discountAmount, BigDecimal taxableAmount, BigDecimal gstRate,
                       BigDecimal cgstAmount, BigDecimal sgstAmount, BigDecimal igstAmount,
                       BigDecimal lineTotal) {}

    public record PaymentLine(Long id, BigDecimal amount, String method, String reference,
                              LocalDate paymentDate, String notes) {}
}
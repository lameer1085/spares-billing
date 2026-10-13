package com.sparesbilling.backend.purchase;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PurchaseSummary(
        Long id, Long supplierId, String supplierName, String supplierInvoiceNo, LocalDate purchaseDate,
        BigDecimal totalAmount, BigDecimal paidAmount, BigDecimal dueAmount, String status
) {
    public static PurchaseSummary from(Purchase p, String supplierName) {
        return new PurchaseSummary(p.getId(), p.getSupplierId(), supplierName, p.getSupplierInvoiceNo(),
                p.getPurchaseDate(), p.getTotalAmount(), p.getPaidAmount(), p.due(), p.getStatus().name());
    }
}
package com.sparesbilling.backend.purchase;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record PurchaseResponse(
        Long id, Long supplierId, String supplierName, String supplierInvoiceNo, LocalDate purchaseDate,
        BigDecimal totalAmount, BigDecimal paidAmount, BigDecimal dueAmount,
        String status, String notes, String cancelReason, LocalDateTime createdAt,
        List<Line> items, List<Payment> payments
) {
    public record Line(Long productId, String partNumber, String name, int quantity,
                       BigDecimal unitCost, BigDecimal gstRate, BigDecimal lineTotal) {}

    public record Payment(Long id, BigDecimal amount, String method, String reference,
                          LocalDate paymentDate, String notes) {}
}
package com.sparesbilling.backend.payment;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record PaymentResponse(
        Long id, Long customerId, String customerName, Long invoiceId, String invoiceNo,
        BigDecimal amount, String method, String reference, LocalDate paymentDate, String notes,
        String status, String reverseReason, LocalDateTime createdAt
) {
    public static PaymentResponse from(Payment p, String customerName, String invoiceNo) {
        return new PaymentResponse(p.getId(), p.getCustomerId(), customerName, p.getInvoiceId(), invoiceNo,
                p.getAmount(), p.getMethod().name(), p.getReference(), p.getPaymentDate(), p.getNotes(),
                p.getStatus().name(), p.getReverseReason(), p.getCreatedAt());
    }
}
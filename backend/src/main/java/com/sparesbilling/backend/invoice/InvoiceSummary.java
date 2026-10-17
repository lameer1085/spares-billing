package com.sparesbilling.backend.invoice;

import java.math.BigDecimal;
import java.time.LocalDate;

public record InvoiceSummary(Long id, String invoiceNo, LocalDate invoiceDate, Long customerId,
                             String customerName, BigDecimal grandTotal, BigDecimal paidAmount,
                             BigDecimal dueAmount, String status) {
    public static InvoiceSummary from(Invoice i, String customerName) {
        return new InvoiceSummary(i.getId(), i.getInvoiceNo(), i.getInvoiceDate(), i.getCustomerId(),
                customerName == null ? "Walk-in" : customerName,
                i.getGrandTotal(), i.getPaidAmount(), i.due(), i.getStatus().name());
    }
}
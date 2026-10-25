package com.sparesbilling.backend.invoice;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "invoices")
@Getter
@Setter
@NoArgsConstructor
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "invoice_no", nullable = false, unique = true, length = 30)
    private String invoiceNo;

    @Column(name = "invoice_date", nullable = false)
    private LocalDate invoiceDate;

    @Column(name = "customer_id")
    private Long customerId;                       // null = walk-in

    @Column(name = "place_of_supply_state", length = 2)
    private String placeOfSupplyState;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(name = "discount_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal discountTotal = BigDecimal.ZERO;

    @Column(name = "taxable_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal taxableAmount = BigDecimal.ZERO;

    @Column(name = "cgst_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal cgstTotal = BigDecimal.ZERO;

    @Column(name = "sgst_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal sgstTotal = BigDecimal.ZERO;

    @Column(name = "igst_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal igstTotal = BigDecimal.ZERO;

    @Column(name = "round_off", nullable = false, precision = 6, scale = 2)
    private BigDecimal roundOff = BigDecimal.ZERO;

    @Column(name = "grand_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal grandTotal = BigDecimal.ZERO;

    @Column(name = "paid_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal paidAmount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private InvoiceStatus status = InvoiceStatus.ACTIVE;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @Column(name = "cancel_reason", length = 255)
    private String cancelReason;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @OneToMany(cascade = CascadeType.ALL)
    @JoinColumn(name = "invoice_id", nullable = false)
    private List<InvoiceItem> items = new ArrayList<>();

    @Column(name = "credited_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal creditedAmount = BigDecimal.ZERO;

    /** What the customer still owes on this invoice, after returns and payments. Never below 0. */
    public BigDecimal due() {
        if (status == InvoiceStatus.CANCELLED) {
            return BigDecimal.ZERO;
        }
        return grandTotal.subtract(creditedAmount).subtract(paidAmount).max(BigDecimal.ZERO);
    }
}
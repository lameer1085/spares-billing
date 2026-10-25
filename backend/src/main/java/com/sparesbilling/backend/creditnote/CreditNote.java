package com.sparesbilling.backend.creditnote;

import com.sparesbilling.backend.common.PaymentMethod;
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
@Table(name = "credit_notes")
@Getter
@Setter
@NoArgsConstructor
public class CreditNote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "credit_note_no", nullable = false, unique = true, length = 30)
    private String creditNoteNo;

    @Column(name = "credit_note_date", nullable = false)
    private LocalDate creditNoteDate;

    @Column(name = "invoice_id", nullable = false)
    private Long invoiceId;

    @Column(name = "customer_id")
    private Long customerId;                       // null = walk-in

    @Column(name = "place_of_supply_state", length = 2)
    private String placeOfSupplyState;

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

    @Column(name = "refund_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal refundAmount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "refund_method", length = 10)
    private PaymentMethod refundMethod;

    @Column(nullable = false, length = 255)
    private String reason;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @OneToMany(cascade = CascadeType.ALL)
    @JoinColumn(name = "credit_note_id", nullable = false)
    private List<CreditNoteItem> items = new ArrayList<>();
}
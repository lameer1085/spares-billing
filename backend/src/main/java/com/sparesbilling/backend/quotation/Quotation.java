package com.sparesbilling.backend.quotation;

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
@Table(name = "quotations")
@Getter
@Setter
@NoArgsConstructor
public class Quotation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "quotation_no", nullable = false, unique = true, length = 30)
    private String quotationNo;

    @Column(name = "quotation_date", nullable = false)
    private LocalDate quotationDate;

    @Column(name = "valid_until", nullable = false)
    private LocalDate validUntil;

    @Column(nullable = false)
    private int revision = 1;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private QuotationStatus status = QuotationStatus.OPEN;

    @Column(name = "cancel_reason", length = 255)
    private String cancelReason;

    @Column(name = "customer_id")
    private Long customerId;

    @Column(name = "buyer_name", nullable = false, length = 150)
    private String buyerName;

    @Column(name = "buyer_address", columnDefinition = "text")
    private String buyerAddress;

    @Column(name = "buyer_gstin", length = 15)
    private String buyerGstin;

    @Column(name = "buyer_phone", length = 20)
    private String buyerPhone;

    @Column(name = "place_of_supply_state", nullable = false, length = 2)
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

    @Column(columnDefinition = "text")
    private String terms;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "quotation_id", nullable = false)
    @OrderBy("lineNo ASC")
    private List<QuotationItem> items = new ArrayList<>();
}
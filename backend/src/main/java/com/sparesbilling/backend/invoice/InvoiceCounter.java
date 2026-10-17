package com.sparesbilling.backend.invoice;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "invoice_counters")
@Getter
@Setter
@NoArgsConstructor
public class InvoiceCounter {

    @Id
    @Column(name = "financial_year", length = 7)
    private String financialYear;                  // e.g. 2026-27

    @Column(name = "last_number", nullable = false)
    private int lastNumber;
}
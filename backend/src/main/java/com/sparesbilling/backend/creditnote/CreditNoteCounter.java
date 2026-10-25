package com.sparesbilling.backend.creditnote;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "credit_note_counters")
@Getter
@Setter
@NoArgsConstructor
public class CreditNoteCounter {

    @Id
    @Column(name = "financial_year", length = 7)
    private String financialYear;

    @Column(name = "last_number", nullable = false)
    private int lastNumber;
}
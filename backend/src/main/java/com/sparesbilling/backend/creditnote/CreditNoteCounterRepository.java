package com.sparesbilling.backend.creditnote;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CreditNoteCounterRepository extends JpaRepository<CreditNoteCounter, String> {

    @Modifying
    @Query(value = "INSERT INTO credit_note_counters (financial_year, last_number) VALUES (:fy, 0) "
            + "ON CONFLICT (financial_year) DO NOTHING", nativeQuery = true)
    void ensureExists(@Param("fy") String financialYear);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CreditNoteCounter c where c.financialYear = :fy")
    Optional<CreditNoteCounter> findByIdForUpdate(@Param("fy") String financialYear);
}
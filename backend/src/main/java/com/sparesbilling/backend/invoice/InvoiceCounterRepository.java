package com.sparesbilling.backend.invoice;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface InvoiceCounterRepository extends JpaRepository<InvoiceCounter, String> {

    @Modifying
    @Query(value = "INSERT INTO invoice_counters (financial_year, last_number) VALUES (:fy, 0) "
            + "ON CONFLICT (financial_year) DO NOTHING", nativeQuery = true)
    void ensureExists(@Param("fy") String financialYear);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from InvoiceCounter c where c.financialYear = :fy")
    Optional<InvoiceCounter> findByIdForUpdate(@Param("fy") String financialYear);
}
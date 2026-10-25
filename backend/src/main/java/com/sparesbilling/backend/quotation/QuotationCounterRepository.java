package com.sparesbilling.backend.quotation;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface QuotationCounterRepository extends JpaRepository<QuotationCounter, String> {

    @Modifying
    @Query(value = "INSERT INTO quotation_counters (financial_year, last_number) VALUES (:fy, 0) "
            + "ON CONFLICT (financial_year) DO NOTHING", nativeQuery = true)
    void ensureExists(@Param("fy") String financialYear);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from QuotationCounter c where c.financialYear = :fy")
    Optional<QuotationCounter> findByIdForUpdate(@Param("fy") String financialYear);
}
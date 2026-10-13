package com.sparesbilling.backend.purchase;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface PurchaseRepository extends JpaRepository<Purchase, Long>, JpaSpecificationExecutor<Purchase> {

    boolean existsBySupplierIdAndSupplierInvoiceNoIgnoreCaseAndStatus(
            Long supplierId, String supplierInvoiceNo, PurchaseStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Purchase p where p.id = :id")
    Optional<Purchase> findByIdForUpdate(@Param("id") Long id);

    interface SupplierDue {
        Long getSupplierId();
        BigDecimal getDue();
    }

    @Query("select p.supplierId as supplierId, sum(p.totalAmount - p.paidAmount) as due "
            + "from Purchase p "
            + "where p.status = com.sparesbilling.backend.purchase.PurchaseStatus.ACTIVE "
            + "group by p.supplierId "
            + "having sum(p.totalAmount - p.paidAmount) > 0")
    List<SupplierDue> findSupplierDues();
}
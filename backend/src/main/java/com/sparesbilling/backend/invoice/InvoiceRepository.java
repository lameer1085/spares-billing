package com.sparesbilling.backend.invoice;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface InvoiceRepository extends JpaRepository<Invoice, Long>, JpaSpecificationExecutor<Invoice> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Invoice i where i.id = :id")
    Optional<Invoice> findByIdForUpdate(@Param("id") Long id);

    /** Total billed to this customer on active invoices. Can be null. */
    @Query("select sum(i.grandTotal) from Invoice i where i.customerId = :customerId "
            + "and i.status = com.sparesbilling.backend.invoice.InvoiceStatus.ACTIVE")
    BigDecimal sumActiveTotalByCustomer(@Param("customerId") Long customerId);

    /** All invoices of a customer, including cancelled ones. Used by the ledger statement. */
    List<Invoice> findByCustomerIdOrderByIdAsc(Long customerId);

    /** The customer's unpaid active invoices, oldest first, locked so two payments can't clash. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Invoice i where i.customerId = :customerId "
            + "and i.status = com.sparesbilling.backend.invoice.InvoiceStatus.ACTIVE "
            + "and i.grandTotal > i.paidAmount order by i.invoiceDate asc, i.id asc")
    List<Invoice> findOpenInvoicesForUpdate(@Param("customerId") Long customerId);

    interface CustomerTotal {
        Long getCustomerId();
        BigDecimal getAmount();
    }

    @Query("select i.customerId as customerId, sum(i.grandTotal) as amount from Invoice i "
            + "where i.customerId is not null "
            + "and i.status = com.sparesbilling.backend.invoice.InvoiceStatus.ACTIVE "
            + "group by i.customerId")
    List<CustomerTotal> sumActiveGroupedByCustomer();
}
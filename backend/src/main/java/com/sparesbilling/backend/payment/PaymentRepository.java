package com.sparesbilling.backend.payment;

import com.sparesbilling.backend.common.PaymentMethod;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long>, JpaSpecificationExecutor<Payment> {

    /** Payments shown on an invoice (reversed ones are hidden). */
    @Query("select p from Payment p where p.invoiceId = :invoiceId "
            + "and p.status = com.sparesbilling.backend.payment.PaymentStatus.ACTIVE order by p.id")
    List<Payment> findActiveByInvoiceId(@Param("invoiceId") Long invoiceId);

    /** Everything, including reversed ones. Used by the ledger statement. */
    List<Payment> findByCustomerIdOrderByIdAsc(Long customerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Payment p where p.id = :id")
    Optional<Payment> findByIdForUpdate(@Param("id") Long id);

    /** Total received from this customer (active only). Can be null. */
    @Query("select sum(p.amount) from Payment p where p.customerId = :customerId "
            + "and p.status = com.sparesbilling.backend.payment.PaymentStatus.ACTIVE")
    BigDecimal sumByCustomer(@Param("customerId") Long customerId);

    interface CustomerTotal {
        Long getCustomerId();
        BigDecimal getAmount();
    }

    @Query("select p.customerId as customerId, sum(p.amount) as amount from Payment p "
            + "where p.customerId is not null "
            + "and p.status = com.sparesbilling.backend.payment.PaymentStatus.ACTIVE "
            + "group by p.customerId")
    List<CustomerTotal> sumActiveGroupedByCustomer();

    interface MethodTotal {
        PaymentMethod getMethod();
        BigDecimal getTotal();
    }

    @Query("select p.method as method, sum(p.amount) as total from Payment p "
            + "where p.status = com.sparesbilling.backend.payment.PaymentStatus.ACTIVE "
            + "and p.paymentDate >= :fromDate and p.paymentDate <= :toDate group by p.method")
    List<MethodTotal> sumByMethod(@Param("fromDate") LocalDate fromDate, @Param("toDate") LocalDate toDate);
}
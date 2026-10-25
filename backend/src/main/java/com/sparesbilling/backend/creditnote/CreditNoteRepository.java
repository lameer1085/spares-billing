package com.sparesbilling.backend.creditnote;

import com.sparesbilling.backend.common.PaymentMethod;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface CreditNoteRepository extends JpaRepository<CreditNote, Long>, JpaSpecificationExecutor<CreditNote> {

    List<CreditNote> findByCustomerIdOrderByIdAsc(Long customerId);

    /** Total value of returns for this customer. Can be null. */
    @Query("select sum(c.grandTotal) from CreditNote c where c.customerId = :customerId")
    BigDecimal sumGrandByCustomer(@Param("customerId") Long customerId);

    /** Total cash/UPI/etc. refunded to this customer. Can be null. */
    @Query("select sum(c.refundAmount) from CreditNote c where c.customerId = :customerId")
    BigDecimal sumRefundByCustomer(@Param("customerId") Long customerId);

    interface CustomerTotal {
        Long getCustomerId();
        BigDecimal getAmount();
    }

    /** Per customer: returns minus refunds (what reduced their balance). */
    @Query("select c.customerId as customerId, sum(c.grandTotal - c.refundAmount) as amount "
            + "from CreditNote c where c.customerId is not null group by c.customerId")
    List<CustomerTotal> sumNetGroupedByCustomer();

    interface MethodTotal {
        PaymentMethod getMethod();
        BigDecimal getTotal();
    }

    @Query("select c.refundMethod as method, sum(c.refundAmount) as total from CreditNote c "
            + "where c.refundAmount > 0 and c.creditNoteDate >= :fromDate and c.creditNoteDate <= :toDate "
            + "group by c.refundMethod")
    List<MethodTotal> sumRefundsByMethod(@Param("fromDate") LocalDate fromDate, @Param("toDate") LocalDate toDate);
}
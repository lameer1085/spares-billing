package com.sparesbilling.backend.purchase;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PurchasePaymentRepository extends JpaRepository<PurchasePayment, Long> {
    List<PurchasePayment> findByPurchaseIdOrderByIdAsc(Long purchaseId);
}
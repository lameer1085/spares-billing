package com.sparesbilling.backend.creditnote;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface CreditNoteItemRepository extends JpaRepository<CreditNoteItem, Long> {
    List<CreditNoteItem> findByInvoiceItemIdIn(Collection<Long> invoiceItemIds);
}

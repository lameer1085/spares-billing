package com.sparesbilling.backend.eway;

import com.sparesbilling.backend.common.ContactRules;
import com.sparesbilling.backend.common.NotFoundException;
import com.sparesbilling.backend.invoice.Invoice;
import com.sparesbilling.backend.invoice.InvoiceRepository;
import com.sparesbilling.backend.invoice.InvoiceStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class EwayService {

    private final EwayDetailsRepository repository;
    private final InvoiceRepository invoiceRepository;

    @Transactional(readOnly = true)
    public EwayResponse get(Long invoiceId) {
        return repository.findById(invoiceId).map(EwayResponse::from).orElseGet(() -> EwayResponse.empty(invoiceId));
    }

    @Transactional
    public EwayResponse save(Long invoiceId, EwayRequest r) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new NotFoundException("Invoice not found"));
        if (invoice.getStatus() != InvoiceStatus.ACTIVE) {
            throw new IllegalArgumentException("A cancelled bill cannot have an e-way bill");
        }
        EwayDetails d = repository.findById(invoiceId).orElseGet(() -> {
            EwayDetails n = new EwayDetails();
            n.setInvoiceId(invoiceId);
            return n;
        });
        d.setToPincode(ContactRules.blankToNull(r.toPincode()));
        d.setToPlace(ContactRules.blankToNull(r.toPlace()));
        d.setDistanceKm(r.distanceKm());
        d.setTransMode(r.transMode());
        String vehicle = ContactRules.blankToNull(r.vehicleNo());
        d.setVehicleNo(vehicle == null ? null : vehicle.toUpperCase());
        d.setTransporterName(ContactRules.blankToNull(r.transporterName()));
        String tid = ContactRules.blankToNull(r.transporterId());
        d.setTransporterId(tid == null ? null : tid.toUpperCase());
        d.setTransDocNo(ContactRules.blankToNull(r.transDocNo()));
        d.setTransDocDate(r.transDocDate());
        d.setEwayBillNo(ContactRules.blankToNull(r.ewayBillNo()));
        d.setEwayBillDate(r.ewayBillDate());
        d.setUpdatedAt(LocalDateTime.now());
        return EwayResponse.from(repository.save(d));
    }
}
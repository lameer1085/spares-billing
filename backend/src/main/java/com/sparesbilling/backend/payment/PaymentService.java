package com.sparesbilling.backend.payment;

import com.sparesbilling.backend.common.*;
import com.sparesbilling.backend.customer.Customer;
import com.sparesbilling.backend.customer.CustomerRepository;
import com.sparesbilling.backend.invoice.Invoice;
import com.sparesbilling.backend.invoice.InvoiceRepository;
import com.sparesbilling.backend.invoice.InvoiceStatus;
import com.sparesbilling.backend.ledger.LedgerService;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.sparesbilling.backend.creditnote.CreditNoteRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private static final ZoneId SHOP_ZONE = ZoneId.of("Asia/Kolkata");

    private final PaymentRepository paymentRepository;
    private final InvoiceRepository invoiceRepository;
    private final CustomerRepository customerRepository;
    private final LedgerService ledgerService;
    private final CurrentUser currentUser;
    private final CreditNoteRepository creditNoteRepository;

    // ---------- receive money ----------

    @Transactional
    public PaymentResult receive(PaymentRequest req) {
        LocalDate today = LocalDate.now(SHOP_ZONE);
        LocalDate date = req.paymentDate() == null ? today : req.paymentDate();
        if (date.isAfter(today)) {
            throw new IllegalArgumentException("Payment date cannot be in the future");
        }
        Customer customer = customerRepository.findById(req.customerId())
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        BigDecimal amount = req.amount().setScale(2, RoundingMode.HALF_UP);
        List<Payment> created = new ArrayList<>();

        if (req.invoiceId() != null) {
            // Payment against one specific bill
            Invoice inv = invoiceRepository.findByIdForUpdate(req.invoiceId())
                    .orElseThrow(() -> new NotFoundException("Invoice not found"));
            if (!customer.getId().equals(inv.getCustomerId())) {
                throw new IllegalArgumentException("This invoice does not belong to the selected customer");
            }
            if (inv.getStatus() == InvoiceStatus.CANCELLED) {
                throw new IllegalArgumentException("Invoice is cancelled");
            }
            if (amount.compareTo(inv.due()) > 0) {
                throw new IllegalArgumentException("Payment is more than the invoice due (" + inv.due() + ")");
            }
            created.add(newPayment(customer, inv, amount, req, date));
        } else {
            // On account: settle the oldest unpaid bills first, then keep any rest on account
            BigDecimal balance = ledgerService.balanceOf(customer);
            BigDecimal outstanding = balance.max(BigDecimal.ZERO);
            boolean advance = Boolean.TRUE.equals(req.advance());
            if (amount.compareTo(outstanding) > 0 && !advance) {
                throw new IllegalArgumentException("Payment (" + amount + ") is more than the customer's balance ("
                        + outstanding + "). If this is an advance, send \"advance\": true.");
            }
            BigDecimal remaining = amount;
            for (Invoice inv : invoiceRepository.findOpenInvoicesForUpdate(customer.getId())) {
                if (remaining.signum() == 0) break;
                BigDecimal part = remaining.min(inv.due());
                created.add(newPayment(customer, inv, part, req, date));
                remaining = remaining.subtract(part);
            }
            if (remaining.signum() > 0) {
                created.add(newPayment(customer, null, remaining, req, date));
            }
        }
        return new PaymentResult(amount, toResponses(created), ledgerService.balanceOf(customer));
    }

    // ---------- reverse ----------

    @Transactional
    public PaymentResponse reverse(Long id, String reason) {
        Payment p = paymentRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new NotFoundException("Payment not found"));
        if (p.getStatus() == PaymentStatus.REVERSED) {
            throw new IllegalArgumentException("Payment is already reversed");
        }
        if (p.getCustomerId() == null) {
            throw new IllegalArgumentException(
                    "Payments on walk-in bills cannot be reversed. Cancel the invoice instead.");
        }
        if (p.getInvoiceId() != null) {
            Invoice inv = invoiceRepository.findByIdForUpdate(p.getInvoiceId())
                    .orElseThrow(() -> new NotFoundException("Invoice not found"));
            if (inv.getPaidAmount().compareTo(p.getAmount()) < 0) {
                throw new IllegalArgumentException(
                        "Part of this payment was refunded through a credit note, so it cannot be reversed.");
            }
            inv.setPaidAmount(inv.getPaidAmount().subtract(p.getAmount()));
        }
        p.setStatus(PaymentStatus.REVERSED);
        p.setReversedAt(LocalDateTime.now());
        p.setReverseReason(reason.trim());
        return toResponses(List.of(p)).get(0);
    }

    // ---------- reads ----------

    @Transactional(readOnly = true)
    public PaymentResponse get(Long id) {
        Payment p = paymentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Payment not found"));
        return toResponses(List.of(p)).get(0);
    }

    @Transactional(readOnly = true)
    public PageResponse<PaymentResponse> search(Long customerId, LocalDate from, LocalDate to,
                                                PaymentMethod method, PaymentStatus status,
                                                int page, int size) {
        Specification<Payment> spec = (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (customerId != null) ps.add(cb.equal(root.get("customerId"), customerId));
            if (from != null) ps.add(cb.greaterThanOrEqualTo(root.<LocalDate>get("paymentDate"), from));
            if (to != null) ps.add(cb.lessThanOrEqualTo(root.<LocalDate>get("paymentDate"), to));
            if (method != null) ps.add(cb.equal(root.get("method"), method));
            if (status != null) ps.add(cb.equal(root.get("status"), status));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "paymentDate").and(Sort.by(Sort.Direction.DESC, "id")));
        Page<Payment> result = paymentRepository.findAll(spec, pageable);
        List<PaymentResponse> rows = toResponses(result.getContent());
        return new PageResponse<>(rows, result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    /** Money received per method between two dates (default: today), minus refunds paid out. */
    @Transactional(readOnly = true)
    public CollectionSummary summary(LocalDate from, LocalDate to) {
        LocalDate f = from == null ? LocalDate.now(SHOP_ZONE) : from;
        LocalDate t = to == null ? f : to;
        if (t.isBefore(f)) {
            throw new IllegalArgumentException("'to' date cannot be before 'from' date");
        }
        Map<String, BigDecimal> received = new LinkedHashMap<>();
        Map<String, BigDecimal> refunds = new LinkedHashMap<>();
        for (PaymentMethod m : PaymentMethod.values()) {
            received.put(m.name(), BigDecimal.ZERO.setScale(2));
            refunds.put(m.name(), BigDecimal.ZERO.setScale(2));
        }
        for (PaymentRepository.MethodTotal row : paymentRepository.sumByMethod(f, t)) {
            received.put(row.getMethod().name(), row.getTotal());
        }
        for (CreditNoteRepository.MethodTotal row : creditNoteRepository.sumRefundsByMethod(f, t)) {
            refunds.put(row.getMethod().name(), row.getTotal());
        }
        Map<String, BigDecimal> net = new LinkedHashMap<>();
        BigDecimal total = BigDecimal.ZERO.setScale(2);
        for (String m : received.keySet()) {
            BigDecimal n = received.get(m).subtract(refunds.get(m));
            net.put(m, n);
            total = total.add(n);
        }
        return new CollectionSummary(f, t, net, refunds, total);
    }

    // ---------- helpers ----------

    private Payment newPayment(Customer c, Invoice inv, BigDecimal amount, PaymentRequest req, LocalDate date) {
        Payment p = new Payment();
        p.setCustomerId(c.getId());
        p.setInvoiceId(inv == null ? null : inv.getId());
        p.setAmount(amount);
        p.setMethod(req.method());
        p.setReference(ContactRules.blankToNull(req.reference()));
        p.setPaymentDate(date);
        p.setNotes(ContactRules.blankToNull(req.notes()));
        p.setCreatedBy(currentUser.id());
        if (inv != null) {
            inv.setPaidAmount(inv.getPaidAmount().add(amount));
        }
        return paymentRepository.save(p);
    }

    private List<PaymentResponse> toResponses(List<Payment> payments) {
        Set<Long> customerIds = payments.stream().map(Payment::getCustomerId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Set<Long> invoiceIds = payments.stream().map(Payment::getInvoiceId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, String> customerNames = customerRepository.findAllById(customerIds).stream()
                .collect(Collectors.toMap(Customer::getId, Customer::getName));
        Map<Long, String> invoiceNos = invoiceRepository.findAllById(invoiceIds).stream()
                .collect(Collectors.toMap(Invoice::getId, Invoice::getInvoiceNo));
        return payments.stream()
                .map(p -> PaymentResponse.from(p, customerNames.get(p.getCustomerId()),
                        invoiceNos.get(p.getInvoiceId())))
                .toList();
    }
}
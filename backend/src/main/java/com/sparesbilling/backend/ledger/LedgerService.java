package com.sparesbilling.backend.ledger;

import com.sparesbilling.backend.common.NotFoundException;
import com.sparesbilling.backend.creditnote.CreditNote;
import com.sparesbilling.backend.creditnote.CreditNoteRepository;
import com.sparesbilling.backend.customer.Customer;
import com.sparesbilling.backend.customer.CustomerRepository;
import com.sparesbilling.backend.invoice.Invoice;
import com.sparesbilling.backend.invoice.InvoiceRepository;
import com.sparesbilling.backend.invoice.InvoiceStatus;
import com.sparesbilling.backend.payment.Payment;
import com.sparesbilling.backend.payment.PaymentRepository;
import com.sparesbilling.backend.payment.PaymentStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LedgerService {

    private final CustomerRepository customerRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final CreditNoteRepository creditNoteRepository;

    /**
     * What the customer owes. Positive = owes us, negative = paid in advance.
     * opening + bills - returns + refunds paid out - payments received
     */
    public BigDecimal balanceOf(Customer c) {
        BigDecimal billed = nz(invoiceRepository.sumActiveTotalByCustomer(c.getId()));
        BigDecimal received = nz(paymentRepository.sumByCustomer(c.getId()));
        BigDecimal returned = nz(creditNoteRepository.sumGrandByCustomer(c.getId()));
        BigDecimal refunded = nz(creditNoteRepository.sumRefundByCustomer(c.getId()));
        return c.getOpeningBalance().add(billed).subtract(returned).add(refunded).subtract(received);
    }

    @Transactional(readOnly = true)
    public BalanceResponse balance(Long customerId) {
        Customer c = find(customerId);
        BigDecimal balance = balanceOf(c);
        BigDecimal available = c.getCreditLimit().subtract(balance).max(BigDecimal.ZERO);
        return new BalanceResponse(c.getId(), c.getName(), balance, c.getCreditLimit(), available);
    }

    @Transactional(readOnly = true)
    public DuesResponse dues() {
        Map<Long, BigDecimal> billed = invoiceRepository.sumActiveGroupedByCustomer().stream()
                .collect(Collectors.toMap(InvoiceRepository.CustomerTotal::getCustomerId,
                        InvoiceRepository.CustomerTotal::getAmount));
        Map<Long, BigDecimal> received = paymentRepository.sumActiveGroupedByCustomer().stream()
                .collect(Collectors.toMap(PaymentRepository.CustomerTotal::getCustomerId,
                        PaymentRepository.CustomerTotal::getAmount));
        Map<Long, BigDecimal> returnedNet = creditNoteRepository.sumNetGroupedByCustomer().stream()
                .collect(Collectors.toMap(CreditNoteRepository.CustomerTotal::getCustomerId,
                        CreditNoteRepository.CustomerTotal::getAmount));

        List<DuesResponse.Row> rows = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        for (Customer c : customerRepository.findAll()) {
            BigDecimal balance = c.getOpeningBalance()
                    .add(billed.getOrDefault(c.getId(), BigDecimal.ZERO))
                    .subtract(returnedNet.getOrDefault(c.getId(), BigDecimal.ZERO))
                    .subtract(received.getOrDefault(c.getId(), BigDecimal.ZERO));
            if (balance.signum() > 0) {
                rows.add(new DuesResponse.Row(c.getId(), c.getName(), c.getPhone(), balance, c.getCreditLimit()));
                total = total.add(balance);
            }
        }
        rows.sort(Comparator.comparing(DuesResponse.Row::balance).reversed());
        return new DuesResponse(total, rows);
    }

    private record Row(LocalDate date, int order, long seq, String type, String reference,
                       String description, BigDecimal debit, BigDecimal credit) {}

    @Transactional(readOnly = true)
    public LedgerResponse statement(Long customerId, LocalDate from, LocalDate to) {
        Customer c = find(customerId);
        List<Row> rows = new ArrayList<>();
        Map<Long, String> invoiceNos = new HashMap<>();

        for (Invoice i : invoiceRepository.findByCustomerIdOrderByIdAsc(customerId)) {
            invoiceNos.put(i.getId(), i.getInvoiceNo());
            rows.add(new Row(i.getInvoiceDate(), 0, i.getId(), "INVOICE", i.getInvoiceNo(),
                    "Sale", i.getGrandTotal(), BigDecimal.ZERO));
            if (i.getStatus() == InvoiceStatus.CANCELLED && i.getCancelledAt() != null) {
                rows.add(new Row(i.getCancelledAt().toLocalDate(), 2, i.getId(), "INVOICE_CANCELLED",
                        i.getInvoiceNo(), "Cancelled: " + i.getCancelReason(),
                        BigDecimal.ZERO, i.getGrandTotal()));
            }
        }
        for (Payment p : paymentRepository.findByCustomerIdOrderByIdAsc(customerId)) {
            String desc = p.getMethod().name();
            if (p.getReference() != null) desc += " " + p.getReference();
            String against = invoiceNos.get(p.getInvoiceId());
            if (against != null) desc += " (against " + against + ")";
            rows.add(new Row(p.getPaymentDate(), 1, p.getId(), "PAYMENT", "Receipt #" + p.getId(),
                    desc, BigDecimal.ZERO, p.getAmount()));
            if (p.getStatus() == PaymentStatus.REVERSED && p.getReversedAt() != null) {
                rows.add(new Row(p.getReversedAt().toLocalDate(), 2, p.getId(), "PAYMENT_REVERSED",
                        "Receipt #" + p.getId(), "Reversed: " + p.getReverseReason(),
                        p.getAmount(), BigDecimal.ZERO));
            }
        }
        for (CreditNote cn : creditNoteRepository.findByCustomerIdOrderByIdAsc(customerId)) {
            String against = invoiceNos.get(cn.getInvoiceId());
            rows.add(new Row(cn.getCreditNoteDate(), 1, cn.getId(), "CREDIT_NOTE", cn.getCreditNoteNo(),
                    "Return" + (against != null ? " (against " + against + ")" : "") + ": " + cn.getReason(),
                    BigDecimal.ZERO, cn.getGrandTotal()));
            if (cn.getRefundAmount().signum() > 0) {
                rows.add(new Row(cn.getCreditNoteDate(), 3, cn.getId(), "REFUND", cn.getCreditNoteNo(),
                        "Refund paid by " + cn.getRefundMethod(), cn.getRefundAmount(), BigDecimal.ZERO));
            }
        }
        // same day: bill first, then payments/returns, then cancellations/reversals, then refunds
        rows.sort(Comparator.comparing(Row::date).thenComparingInt(Row::order).thenComparingLong(Row::seq));

        BigDecimal running = c.getOpeningBalance();
        BigDecimal periodOpening = running;
        BigDecimal totalDebit = BigDecimal.ZERO;
        BigDecimal totalCredit = BigDecimal.ZERO;
        List<LedgerResponse.Entry> entries = new ArrayList<>();

        for (Row r : rows) {
            if (to != null && r.date().isAfter(to)) break;          // rows are in date order
            running = running.add(r.debit()).subtract(r.credit());
            if (from != null && r.date().isBefore(from)) {
                periodOpening = running;                            // before the period: roll into opening
            } else {
                entries.add(new LedgerResponse.Entry(r.date(), r.type(), r.reference(), r.description(),
                        r.debit(), r.credit(), running));
                totalDebit = totalDebit.add(r.debit());
                totalCredit = totalCredit.add(r.credit());
            }
        }
        return new LedgerResponse(c.getId(), c.getName(), from, to, periodOpening,
                totalDebit, totalCredit, running, entries);
    }

    private Customer find(Long id) {
        return customerRepository.findById(id).orElseThrow(() -> new NotFoundException("Customer not found"));
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
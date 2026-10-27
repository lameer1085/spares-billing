package com.sparesbilling.backend.creditnote;

import com.sparesbilling.backend.common.*;
import com.sparesbilling.backend.customer.Customer;
import com.sparesbilling.backend.customer.CustomerRepository;
import com.sparesbilling.backend.invoice.Invoice;
import com.sparesbilling.backend.invoice.InvoiceItem;
import com.sparesbilling.backend.invoice.InvoiceRepository;
import com.sparesbilling.backend.invoice.InvoiceResponse;
import com.sparesbilling.backend.invoice.InvoiceStatus;
import com.sparesbilling.backend.shop.ShopSettings;
import com.sparesbilling.backend.shop.ShopSettingsRepository;
import com.sparesbilling.backend.shop.ShopSettingsResponse;
import com.sparesbilling.backend.stock.StockMovementType;
import com.sparesbilling.backend.stock.StockService;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;

@Service
@RequiredArgsConstructor
public class CreditNoteService {

    private static final ZoneId SHOP_ZONE = ZoneId.of("Asia/Kolkata");
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final BigDecimal TWO = BigDecimal.valueOf(2);

    private final CreditNoteRepository creditNoteRepository;
    private final CreditNoteItemRepository itemRepository;
    private final CreditNoteCounterRepository counterRepository;
    private final InvoiceRepository invoiceRepository;
    private final CustomerRepository customerRepository;
    private final ShopSettingsRepository shopRepository;
    private final StockService stockService;
    private final CurrentUser currentUser;

    private record Pending(InvoiceItem line, int quantity, boolean restock) {}

    // ---------- create ----------

    @Transactional
    public CreditNoteResponse create(CreditNoteRequest req) {
        LocalDate today = LocalDate.now(SHOP_ZONE);

        // Lock the invoice so two returns on the same bill cannot run at the same time
        Invoice inv = invoiceRepository.findByIdForUpdate(req.invoiceId())
                .orElseThrow(() -> new NotFoundException("Invoice not found"));
        if (inv.getStatus() == InvoiceStatus.CANCELLED) {
            throw new IllegalArgumentException("Invoice is cancelled. Credit notes need an active invoice.");
        }

        Map<Long, InvoiceItem> byProduct = new HashMap<>();
        for (InvoiceItem i : inv.getItems()) {
            byProduct.put(i.getProductId(), i);
        }

        Set<Long> seen = new HashSet<>();
        List<Pending> pending = new ArrayList<>();
        for (CreditNoteRequest.Item it : req.items()) {
            if (!seen.add(it.productId())) {
                throw new IllegalArgumentException("The same part is added twice. Combine it into one line.");
            }
            InvoiceItem line = byProduct.get(it.productId());
            if (line == null) {
                throw new IllegalArgumentException("Part " + it.productId() + " is not on this invoice");
            }
            pending.add(new Pending(line, it.quantity(), it.restock() == null || it.restock()));
        }
        pending.sort(Comparator.comparing(p -> p.line().getProductId()));

        // Everything returned on this invoice earlier
        Map<Long, List<CreditNoteItem>> earlier = itemRepository
                .findByInvoiceItemIdIn(byProduct.values().stream().map(InvoiceItem::getId).toList())
                .stream().collect(Collectors.groupingBy(CreditNoteItem::getInvoiceItemId));

        BigDecimal taxableTotal = BigDecimal.ZERO;
        BigDecimal cgstTotal = BigDecimal.ZERO;
        BigDecimal sgstTotal = BigDecimal.ZERO;
        BigDecimal igstTotal = BigDecimal.ZERO;
        BigDecimal netTotal = BigDecimal.ZERO;
        Map<Long, CreditNoteItem> built = new HashMap<>();

        for (Pending p : pending) {
            InvoiceItem line = p.line();
            List<CreditNoteItem> prev = earlier.getOrDefault(line.getId(), List.of());
            int prevQty = prev.stream().mapToInt(CreditNoteItem::getQuantity).sum();
            int remaining = line.getQuantity() - prevQty;
            if (p.quantity() > remaining) {
                throw new IllegalArgumentException("Cannot return " + p.quantity() + " of " + line.getDescription()
                        + ". Sold: " + line.getQuantity() + ", already returned: " + prevQty);
            }

            BigDecimal net, taxable, cgst, sgst, igst;
            if (p.quantity() == remaining) {
                // Returning whatever is left: take the exact remainder so the notes add up to the invoice line
                net = line.getLineTotal().subtract(sum(prev, CreditNoteItem::getLineTotal));
                taxable = line.getTaxableAmount().subtract(sum(prev, CreditNoteItem::getTaxableAmount));
                cgst = line.getCgstAmount().subtract(sum(prev, CreditNoteItem::getCgstAmount));
                sgst = line.getSgstAmount().subtract(sum(prev, CreditNoteItem::getSgstAmount));
                igst = line.getIgstAmount().subtract(sum(prev, CreditNoteItem::getIgstAmount));
            } else {
                net = line.getLineTotal().multiply(BigDecimal.valueOf(p.quantity()))
                        .divide(BigDecimal.valueOf(line.getQuantity()), 2, RoundingMode.HALF_UP);
                taxable = net.multiply(HUNDRED).divide(HUNDRED.add(line.getGstRate()), 2, RoundingMode.HALF_UP);
                BigDecimal gst = net.subtract(taxable);
                if (line.getIgstAmount().signum() > 0) {            // the original sale was another state
                    cgst = BigDecimal.ZERO;
                    sgst = BigDecimal.ZERO;
                    igst = gst;
                } else {
                    cgst = gst.divide(TWO, 2, RoundingMode.HALF_UP);
                    sgst = gst.subtract(cgst);
                    igst = BigDecimal.ZERO;
                }
            }

            CreditNoteItem ci = new CreditNoteItem();
            ci.setInvoiceItemId(line.getId());
            ci.setProductId(line.getProductId());
            ci.setDescription(line.getDescription());
            ci.setHsnCode(line.getHsnCode());
            ci.setQuantity(p.quantity());
            ci.setTaxableAmount(taxable);
            ci.setGstRate(line.getGstRate());
            ci.setCgstAmount(cgst);
            ci.setSgstAmount(sgst);
            ci.setIgstAmount(igst);
            ci.setLineTotal(net);
            ci.setCostPrice(line.getCostPrice());
            ci.setRestocked(p.restock());
            built.put(line.getProductId(), ci);

            taxableTotal = taxableTotal.add(taxable);
            cgstTotal = cgstTotal.add(cgst);
            sgstTotal = sgstTotal.add(sgst);
            igstTotal = igstTotal.add(igst);
            netTotal = netTotal.add(net);
        }

        BigDecimal grand = netTotal.setScale(0, RoundingMode.HALF_UP).setScale(2);
        BigDecimal roundOff = grand.subtract(netTotal);

        // Refund rules
        BigDecimal creditedAfter = inv.getCreditedAmount().add(grand);
        BigDecimal refundable = inv.getPaidAmount()
                .subtract(inv.getGrandTotal().subtract(creditedAfter)).max(BigDecimal.ZERO);
        BigDecimal refund;
        if (inv.getCustomerId() == null) {
            refund = grand;                                          // walk-in: no account, so refund in full
            if (req.refundAmount() != null && req.refundAmount().compareTo(grand) != 0) {
                throw new IllegalArgumentException("Returns on walk-in bills are refunded in full (" + grand + ")");
            }
        } else {
            refund = req.refundAmount() == null ? BigDecimal.ZERO : req.refundAmount().setScale(2, RoundingMode.HALF_UP);
        }
        if (refund.compareTo(grand) > 0) {
            throw new IllegalArgumentException("Refund cannot be more than the credit note total (" + grand + ")");
        }
        if (refund.compareTo(refundable) > 0) {
            throw new IllegalArgumentException(
                    "Refund cannot be more than what the customer has paid for these goods (" + refundable + ")");
        }
        PaymentMethod method = refund.signum() > 0
                ? (req.refundMethod() == null ? PaymentMethod.CASH : req.refundMethod()) : null;

        // Takes the next number (part of this transaction, so a failed return leaves no gap)
        CreditNote cn = new CreditNote();
        cn.setCreditNoteNo(nextNo(today));
        cn.setCreditNoteDate(today);
        cn.setInvoiceId(inv.getId());
        cn.setCustomerId(inv.getCustomerId());
        cn.setPlaceOfSupplyState(inv.getPlaceOfSupplyState());
        cn.setReason(req.reason().trim());
        cn.setCreatedBy(currentUser.id());
        cn = creditNoteRepository.saveAndFlush(cn);

        for (Pending p : pending) {
            if (p.restock()) {
                stockService.changeStock(p.line().getProductId(), p.quantity(), StockMovementType.RETURN,
                        "CREDIT_NOTE", cn.getId(), "Return " + cn.getCreditNoteNo());
            }
        }

        cn.setTaxableAmount(taxableTotal);
        cn.setCgstTotal(cgstTotal);
        cn.setSgstTotal(sgstTotal);
        cn.setIgstTotal(igstTotal);
        cn.setRoundOff(roundOff);
        cn.setGrandTotal(grand);
        cn.setRefundAmount(refund);
        cn.setRefundMethod(method);
        for (CreditNoteRequest.Item it : req.items()) {              // keep the order the cashier entered
            cn.getItems().add(built.get(it.productId()));
        }

        inv.setCreditedAmount(creditedAfter);
        inv.setPaidAmount(inv.getPaidAmount().subtract(refund));     // refunded money is no longer "paid"
        return toResponse(cn);
    }

    // ---------- reads ----------

    @Transactional(readOnly = true)
    public CreditNoteResponse get(Long id) {
        return toResponse(creditNoteRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Credit note not found")));
    }

    @Transactional(readOnly = true)
    public PageResponse<CreditNoteSummary> search(String q, Long invoiceId, Long customerId,
                                                  LocalDate from, LocalDate to, int page, int size) {
        Specification<CreditNote> spec = (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String pattern = ContactRules.searchPattern(q);
                Subquery<Long> invSub = query.subquery(Long.class);
                Root<Invoice> invRoot = invSub.from(Invoice.class);
                invSub.select(invRoot.<Long>get("id"))
                        .where(cb.like(cb.lower(invRoot.<String>get("invoiceNo")), pattern));
                Subquery<Long> custSub = query.subquery(Long.class);
                Root<Customer> custRoot = custSub.from(Customer.class);
                custSub.select(custRoot.<Long>get("id")).where(cb.or(
                        cb.like(cb.lower(custRoot.<String>get("name")), pattern),
                        cb.like(cb.lower(custRoot.<String>get("phone")), pattern)));
                ps.add(cb.or(
                        cb.like(cb.lower(root.<String>get("creditNoteNo")), pattern),
                        root.get("invoiceId").in(invSub),
                        root.get("customerId").in(custSub)));
            }
            if (invoiceId != null) ps.add(cb.equal(root.get("invoiceId"), invoiceId));
            if (customerId != null) ps.add(cb.equal(root.get("customerId"), customerId));
            if (from != null) ps.add(cb.greaterThanOrEqualTo(root.<LocalDate>get("creditNoteDate"), from));
            if (to != null) ps.add(cb.lessThanOrEqualTo(root.<LocalDate>get("creditNoteDate"), to));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "creditNoteDate").and(Sort.by(Sort.Direction.DESC, "id")));
        Page<CreditNote> result = creditNoteRepository.findAll(spec, pageable);

        Set<Long> invoiceIds = result.getContent().stream().map(CreditNote::getInvoiceId).collect(Collectors.toSet());
        Set<Long> customerIds = result.getContent().stream().map(CreditNote::getCustomerId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, String> invoiceNos = invoiceRepository.findAllById(invoiceIds).stream()
                .collect(Collectors.toMap(Invoice::getId, Invoice::getInvoiceNo));
        Map<Long, String> names = customerRepository.findAllById(customerIds).stream()
                .collect(Collectors.toMap(Customer::getId, Customer::getName));

        return PageResponse.from(result.map(c -> new CreditNoteSummary(c.getId(), c.getCreditNoteNo(),
                c.getCreditNoteDate(), c.getInvoiceId(), invoiceNos.get(c.getInvoiceId()),
                c.getCustomerId() == null ? "Walk-in" : names.get(c.getCustomerId()),
                c.getGrandTotal(), c.getRefundAmount())));
    }

    // ---------- helpers ----------

    /** CN/26-27/00001: financial year runs April to March. 14 characters, within the 16-character GST limit. */
    private String nextNo(LocalDate date) {
        int startYear = date.getMonthValue() >= 4 ? date.getYear() : date.getYear() - 1;
        String fy = startYear + "-" + String.format("%02d", (startYear + 1) % 100);
        String shortFy = String.format("%02d-%02d", startYear % 100, (startYear + 1) % 100);

        counterRepository.ensureExists(fy);
        CreditNoteCounter counter = counterRepository.findByIdForUpdate(fy)
                .orElseThrow(() -> new IllegalStateException("Credit note counter missing"));
        counter.setLastNumber(counter.getLastNumber() + 1);
        return String.format("CN/%s/%05d", shortFy, counter.getLastNumber());
    }

    private static <T> BigDecimal sum(List<T> list, Function<T, BigDecimal> f) {
        return list.stream().map(f).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private CreditNoteResponse toResponse(CreditNote c) {
        ShopSettings shop = shopRepository.findById(1)
                .orElseThrow(() -> new NotFoundException("Shop settings not found"));
        Invoice inv = invoiceRepository.findById(c.getInvoiceId()).orElse(null);

        InvoiceResponse.Buyer buyer = null;
        if (c.getCustomerId() != null) {
            buyer = customerRepository.findById(c.getCustomerId())
                    .map(x -> new InvoiceResponse.Buyer(x.getId(), x.getName(), x.getPhone(), x.getGstin(),
                            x.getAddress(), x.getStateCode(), StateCodes.name(x.getStateCode())))
                    .orElse(null);
        }
        List<CreditNoteResponse.Line> lines = c.getItems().stream()
                .map(i -> new CreditNoteResponse.Line(i.getDescription(), i.getHsnCode(), i.getQuantity(),
                        i.getTaxableAmount(), i.getGstRate(), i.getCgstAmount(), i.getSgstAmount(),
                        i.getIgstAmount(), i.getLineTotal(), i.isRestocked()))
                .toList();

        return new CreditNoteResponse(c.getId(), c.getCreditNoteNo(), c.getCreditNoteDate(),
                c.getInvoiceId(), inv == null ? null : inv.getInvoiceNo(), inv == null ? null : inv.getInvoiceDate(),
                c.getPlaceOfSupplyState(), StateCodes.name(c.getPlaceOfSupplyState()),
                c.getTaxableAmount(), c.getCgstTotal(), c.getSgstTotal(), c.getIgstTotal(),
                c.getRoundOff(), c.getGrandTotal(), c.getRefundAmount(),
                c.getRefundMethod() == null ? null : c.getRefundMethod().name(),
                c.getReason(), ShopSettingsResponse.from(shop), buyer, lines);
    }
}
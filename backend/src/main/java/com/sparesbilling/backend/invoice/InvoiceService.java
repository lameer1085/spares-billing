package com.sparesbilling.backend.invoice;

import com.sparesbilling.backend.catalog.Product;
import com.sparesbilling.backend.common.ContactRules;
import com.sparesbilling.backend.common.CurrentUser;
import com.sparesbilling.backend.common.NotFoundException;
import com.sparesbilling.backend.common.PageResponse;
import com.sparesbilling.backend.common.PaymentMethod;
import com.sparesbilling.backend.common.StateCodes;
import com.sparesbilling.backend.customer.Customer;
import com.sparesbilling.backend.customer.CustomerRepository;
import com.sparesbilling.backend.payment.Payment;
import com.sparesbilling.backend.payment.PaymentRepository;
import com.sparesbilling.backend.shop.ShopSettings;
import com.sparesbilling.backend.shop.ShopSettingsRepository;
import com.sparesbilling.backend.shop.ShopSettingsResponse;
import com.sparesbilling.backend.stock.StockMovementType;
import com.sparesbilling.backend.stock.StockService;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.sparesbilling.backend.ledger.LedgerService;
import com.sparesbilling.backend.creditnote.CreditNoteItem;
import com.sparesbilling.backend.creditnote.CreditNoteItemRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InvoiceService {

    private static final ZoneId SHOP_ZONE = ZoneId.of("Asia/Kolkata");
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final BigDecimal TWO = BigDecimal.valueOf(2);

    private final InvoiceRepository invoiceRepository;
    private final InvoiceCounterRepository counterRepository;
    private final PaymentRepository paymentRepository;
    private final CustomerRepository customerRepository;
    private final ShopSettingsRepository shopRepository;
    private final StockService stockService;
    private final CurrentUser currentUser;
    private final LedgerService ledgerService;
    private final CreditNoteItemRepository creditNoteItemRepository;

    @Value("${app.billing.staff-max-discount-percent:10}")
    private BigDecimal staffMaxDiscountPercent;

    // ---------- reads ----------

    @Transactional(readOnly = true)
    public PageResponse<InvoiceSummary> search(String q, Long customerId, LocalDate from, LocalDate to,
                                               InvoiceStatus status, int page, int size) {
        Specification<Invoice> spec = (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String pattern = ContactRules.searchPattern(q);
                // customers whose name or phone matches
                Subquery<Long> sub = query.subquery(Long.class);
                Root<Customer> c = sub.from(Customer.class);
                sub.select(c.<Long>get("id")).where(cb.or(
                        cb.like(cb.lower(c.<String>get("name")), pattern),
                        cb.like(cb.lower(c.<String>get("phone")), pattern)));
                ps.add(cb.or(
                        cb.like(cb.lower(root.<String>get("invoiceNo")), pattern),
                        root.get("customerId").in(sub)));
            }
            if (customerId != null) ps.add(cb.equal(root.get("customerId"), customerId));
            if (from != null) ps.add(cb.greaterThanOrEqualTo(root.<LocalDate>get("invoiceDate"), from));
            if (to != null) ps.add(cb.lessThanOrEqualTo(root.<LocalDate>get("invoiceDate"), to));
            if (status != null) ps.add(cb.equal(root.get("status"), status));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "invoiceDate").and(Sort.by(Sort.Direction.DESC, "id")));
        Page<Invoice> result = invoiceRepository.findAll(spec, pageable);

        Set<Long> ids = result.getContent().stream().map(Invoice::getCustomerId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, String> names = customerRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Customer::getId, Customer::getName));
        return PageResponse.from(result.map(i -> InvoiceSummary.from(i, names.get(i.getCustomerId()))));
    }

    @Transactional(readOnly = true)
    public InvoiceResponse get(Long id) {
        return toResponse(invoiceRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Invoice not found")));
    }

    // ---------- create ----------

    @Transactional
    public InvoiceResponse create(InvoiceRequest req) {
        LocalDate today = LocalDate.now(SHOP_ZONE);
        ShopSettings shop = shopRepository.findById(1)
                .orElseThrow(() -> new NotFoundException("Shop settings not found"));

        Set<Long> seen = new HashSet<>();
        for (InvoiceRequest.Item it : req.items()) {
            if (!seen.add(it.productId())) {
                throw new IllegalArgumentException("The same part is added twice. Combine it into one line.");
            }
        }

        Customer customer = null;
        if (req.customerId() != null) {
            customer = customerRepository.findById(req.customerId())
                    .orElseThrow(() -> new NotFoundException("Customer not found"));
            if (!customer.isActive()) {
                throw new IllegalArgumentException("Customer is inactive");
            }
        }

        // Same state as the shop = CGST + SGST. Another state = IGST. Walk-ins count as the shop's state.
        String placeOfSupply = (customer != null && customer.getStateCode() != null)
                ? customer.getStateCode() : shop.getStateCode();
        boolean intraState = placeOfSupply.equals(shop.getStateCode());
        boolean owner = currentUser.isOwner();

        // Takes the next number. It is part of THIS transaction, so a failed bill gives it back.
        Invoice inv = new Invoice();
        inv.setInvoiceNo(nextInvoiceNo(today, shop.getInvoicePrefix()));
        inv.setInvoiceDate(today);
        inv.setCustomerId(customer == null ? null : customer.getId());
        inv.setPlaceOfSupplyState(placeOfSupply);
        inv.setCreatedBy(currentUser.id());
        inv = invoiceRepository.saveAndFlush(inv);          // the stock movements need the invoice id

        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal discountTotal = BigDecimal.ZERO;
        BigDecimal taxableTotal = BigDecimal.ZERO;
        BigDecimal cgstTotal = BigDecimal.ZERO;
        BigDecimal sgstTotal = BigDecimal.ZERO;
        BigDecimal igstTotal = BigDecimal.ZERO;
        BigDecimal netTotal = BigDecimal.ZERO;
        Map<Long, InvoiceItem> lines = new HashMap<>();

        // Sorted by product id so two bills never lock the same parts in opposite order
        List<InvoiceRequest.Item> sorted = req.items().stream()
                .sorted(Comparator.comparing(InvoiceRequest.Item::productId)).toList();

        for (InvoiceRequest.Item it : sorted) {
            // Locks the product row, checks stock, reduces it, writes the stock movement
            Product p = stockService.changeStock(it.productId(), -it.quantity(), StockMovementType.SALE,
                    "INVOICE", inv.getId(), "Sale " + inv.getInvoiceNo());
            if (!p.isActive()) {
                throw new IllegalArgumentException(p.getPartNumber() + " is inactive and cannot be sold");
            }
            BigDecimal unitPrice = p.getSellingPrice();
            if (unitPrice.signum() <= 0) {
                throw new IllegalArgumentException("Selling price is not set for " + p.getPartNumber());
            }

            BigDecimal gross = unitPrice.multiply(BigDecimal.valueOf(it.quantity()));
            BigDecimal discount = it.discountAmount() == null
                    ? BigDecimal.ZERO : it.discountAmount().setScale(2, RoundingMode.HALF_UP);
            if (discount.compareTo(gross) > 0) {
                throw new IllegalArgumentException("Discount is more than the line amount for " + p.getPartNumber());
            }
            if (!owner) {
                BigDecimal maxDiscount = gross.multiply(staffMaxDiscountPercent)
                        .divide(HUNDRED, 2, RoundingMode.HALF_UP);
                if (discount.compareTo(maxDiscount) > 0) {
                    throw new IllegalArgumentException("Staff can give at most " + staffMaxDiscountPercent
                            + "% discount (" + p.getPartNumber() + "). Ask the owner.");
                }
            }

            // The price includes GST, so work backwards: taxable = amount / (1 + rate)
            BigDecimal rate = p.getGstRate();
            BigDecimal net = gross.subtract(discount);
            BigDecimal taxable = net.multiply(HUNDRED).divide(HUNDRED.add(rate), 2, RoundingMode.HALF_UP);
            BigDecimal gst = net.subtract(taxable);
            BigDecimal cgst = BigDecimal.ZERO;
            BigDecimal sgst = BigDecimal.ZERO;
            BigDecimal igst = BigDecimal.ZERO;
            if (intraState) {
                cgst = gst.divide(TWO, 2, RoundingMode.HALF_UP);
                sgst = gst.subtract(cgst);
            } else {
                igst = gst;
            }

            String description = p.getPartNumber() + " - " + p.getName();
            if (description.length() > 200) description = description.substring(0, 200);

            InvoiceItem item = new InvoiceItem();
            item.setProductId(p.getId());
            item.setDescription(description);
            item.setHsnCode(p.getHsnCode());
            item.setQuantity(it.quantity());
            item.setUnitPrice(unitPrice);
            item.setCostPrice(p.getPurchasePrice());
            item.setDiscountAmount(discount);
            item.setTaxableAmount(taxable);
            item.setGstRate(rate);
            item.setCgstAmount(cgst);
            item.setSgstAmount(sgst);
            item.setIgstAmount(igst);
            item.setLineTotal(net);
            lines.put(p.getId(), item);

            subtotal = subtotal.add(gross);
            discountTotal = discountTotal.add(discount);
            taxableTotal = taxableTotal.add(taxable);
            cgstTotal = cgstTotal.add(cgst);
            sgstTotal = sgstTotal.add(sgst);
            igstTotal = igstTotal.add(igst);
            netTotal = netTotal.add(net);
        }

        // Round to the nearest rupee. The difference is shown as "round off".
        BigDecimal grandTotal = netTotal.setScale(0, RoundingMode.HALF_UP).setScale(2);
        BigDecimal roundOff = grandTotal.subtract(netTotal);

        BigDecimal paid = req.paidAmount() == null
                ? grandTotal : req.paidAmount().setScale(2, RoundingMode.HALF_UP);
        if (paid.compareTo(grandTotal) > 0) {
            throw new IllegalArgumentException("Paid amount cannot be more than the bill total (" + grandTotal + ")");
        }

        // Credit sale rules (checked BEFORE the totals are set on the invoice, so it is not counted twice)
        BigDecimal due = grandTotal.subtract(paid);
        if (due.signum() > 0) {
            if (customer == null) {
                throw new IllegalArgumentException(
                        "Walk-in customers must pay in full. Select a customer to bill on credit.");
            }
            BigDecimal balance = ledgerService.balanceOf(customer);
            if (balance.add(due).compareTo(customer.getCreditLimit()) > 0) {
                throw new IllegalArgumentException("Credit limit exceeded. Current balance: " + balance
                        + ", this bill on credit: " + due + ", limit: " + customer.getCreditLimit());
            }
        }

        inv.setSubtotal(subtotal);
        inv.setDiscountTotal(discountTotal);
        inv.setTaxableAmount(taxableTotal);
        inv.setCgstTotal(cgstTotal);
        inv.setSgstTotal(sgstTotal);
        inv.setIgstTotal(igstTotal);
        inv.setRoundOff(roundOff);
        inv.setGrandTotal(grandTotal);
        inv.setPaidAmount(paid);
        for (InvoiceRequest.Item it : req.items()) {        // keep the order the cashier entered
            inv.getItems().add(lines.get(it.productId()));
        }

        if (paid.signum() > 0) {
            Payment pay = new Payment();
            pay.setInvoiceId(inv.getId());
            pay.setCustomerId(inv.getCustomerId());
            pay.setAmount(paid);
            pay.setMethod(req.paymentMethod() == null ? PaymentMethod.CASH : req.paymentMethod());
            pay.setPaymentDate(today);
            pay.setNotes("Paid at billing");
            pay.setCreatedBy(currentUser.id());
            paymentRepository.save(pay);
        }
        return toResponse(inv);
    }

    // ---------- cancel ----------

    @Transactional
    public InvoiceResponse cancel(Long id, String reason) {
        Invoice inv = invoiceRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new NotFoundException("Invoice not found"));
        if (inv.getStatus() == InvoiceStatus.CANCELLED) {
            throw new IllegalArgumentException("Invoice is already cancelled");
        }
        if (inv.getCreditedAmount().signum() > 0) {
            throw new IllegalArgumentException(
                    "This invoice has credit notes (returns), so it cannot be cancelled.");
        }
        List<InvoiceItem> items = inv.getItems().stream()
                .sorted(Comparator.comparing(InvoiceItem::getProductId)).toList();
        for (InvoiceItem i : items) {
            stockService.changeStock(i.getProductId(), i.getQuantity(), StockMovementType.SALE_CANCEL,
                    "INVOICE", inv.getId(), "Invoice " + inv.getInvoiceNo() + " cancelled");
        }
        inv.setStatus(InvoiceStatus.CANCELLED);
        inv.setCancelledAt(LocalDateTime.now());
        inv.setCancelReason(reason.trim());
        return toResponse(inv);
    }

    // ---------- helpers ----------

    /** INV/26-27/00001: prefix / financial year (April to March) / running number. Max 16 characters. */
    private String nextInvoiceNo(LocalDate date, String prefix) {
        int startYear = date.getMonthValue() >= 4 ? date.getYear() : date.getYear() - 1;
        String fy = startYear + "-" + String.format("%02d", (startYear + 1) % 100);
        String shortFy = String.format("%02d-%02d", startYear % 100, (startYear + 1) % 100);

        counterRepository.ensureExists(fy);
        InvoiceCounter counter = counterRepository.findByIdForUpdate(fy)
                .orElseThrow(() -> new IllegalStateException("Invoice counter missing"));
        counter.setLastNumber(counter.getLastNumber() + 1);
        return String.format("%s/%s/%05d", prefix, shortFy, counter.getLastNumber());
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private InvoiceResponse toResponse(Invoice i) {
        ShopSettings shop = shopRepository.findById(1)
                .orElseThrow(() -> new NotFoundException("Shop settings not found"));

        InvoiceResponse.Buyer buyer = null;
        if (i.getCustomerId() != null) {
            buyer = customerRepository.findById(i.getCustomerId())
                    .map(c -> new InvoiceResponse.Buyer(c.getId(), c.getName(), c.getPhone(), c.getGstin(),
                            c.getAddress(), c.getStateCode(), StateCodes.name(c.getStateCode())))
                    .orElse(null);
        }

        Map<Long, Integer> returned = i.getItems().isEmpty() ? Map.of()
                : creditNoteItemRepository
                  .findByInvoiceItemIdIn(i.getItems().stream().map(InvoiceItem::getId).toList())
                  .stream()
                  .collect(Collectors.groupingBy(CreditNoteItem::getInvoiceItemId,
                          Collectors.summingInt(CreditNoteItem::getQuantity)));

        List<InvoiceResponse.Line> lines = i.getItems().stream()
                .map(x -> new InvoiceResponse.Line(x.getDescription(), x.getHsnCode(), x.getQuantity(),
                        x.getUnitPrice(), x.getDiscountAmount(), x.getTaxableAmount(), x.getGstRate(),
                        x.getCgstAmount(), x.getSgstAmount(), x.getIgstAmount(), x.getLineTotal(),
                        x.getProductId(), returned.getOrDefault(x.getId(), 0)))
                .toList();

        List<InvoiceResponse.PaymentLine> payments = paymentRepository.findActiveByInvoiceId(i.getId())
                .stream().map(p -> new InvoiceResponse.PaymentLine(p.getId(), p.getAmount(),
                        p.getMethod().name(), p.getReference(), p.getPaymentDate(), p.getNotes()))
                .toList();

        return new InvoiceResponse(i.getId(), i.getInvoiceNo(), i.getInvoiceDate(), i.getStatus().name(),
                i.getCancelReason(), i.getPlaceOfSupplyState(), StateCodes.name(i.getPlaceOfSupplyState()),
                i.getSubtotal(), i.getDiscountTotal(), i.getTaxableAmount(),
                i.getCgstTotal(), i.getSgstTotal(), i.getIgstTotal(),
                i.getRoundOff(), i.getGrandTotal(), i.getPaidAmount(), i.due(),
                ShopSettingsResponse.from(shop), buyer, lines, payments);
    }
}
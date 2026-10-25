package com.sparesbilling.backend.quotation;

import com.sparesbilling.backend.catalog.Product;
import com.sparesbilling.backend.catalog.ProductRepository;
import com.sparesbilling.backend.common.*;
import com.sparesbilling.backend.customer.Customer;
import com.sparesbilling.backend.customer.CustomerRepository;
import com.sparesbilling.backend.shop.ShopSettings;
import com.sparesbilling.backend.shop.ShopSettingsRepository;
import com.sparesbilling.backend.shop.ShopSettingsResponse;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class QuotationService {

    private static final ZoneId SHOP_ZONE = ZoneId.of("Asia/Kolkata");
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final BigDecimal TWO = BigDecimal.valueOf(2);

    private final QuotationRepository quotationRepository;
    private final QuotationCounterRepository counterRepository;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final ShopSettingsRepository shopRepository;
    private final CurrentUser currentUser;

    @Value("${app.billing.staff-max-discount-percent:10}")
    private BigDecimal staffMaxDiscountPercent;

    // ---------- reads ----------

    @Transactional(readOnly = true)
    public PageResponse<QuotationSummary> search(String q, QuotationStatus status, LocalDate from, LocalDate to,
                                                 int page, int size) {
        Specification<Quotation> spec = (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String pattern = ContactRules.searchPattern(q);
                ps.add(cb.or(
                        cb.like(cb.lower(root.<String>get("quotationNo")), pattern),
                        cb.like(cb.lower(root.<String>get("buyerName")), pattern)));
            }
            if (status != null) ps.add(cb.equal(root.get("status"), status));
            if (from != null) ps.add(cb.greaterThanOrEqualTo(root.<LocalDate>get("quotationDate"), from));
            if (to != null) ps.add(cb.lessThanOrEqualTo(root.<LocalDate>get("quotationDate"), to));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "quotationDate").and(Sort.by(Sort.Direction.DESC, "id")));
        return PageResponse.from(quotationRepository.findAll(spec, pageable).map(x ->
                new QuotationSummary(x.getId(), x.getQuotationNo(), x.getQuotationDate(), x.getValidUntil(),
                        x.getBuyerName(), x.getGrandTotal(), x.getStatus().name(), x.getRevision())));
    }

    @Transactional(readOnly = true)
    public QuotationResponse get(Long id) {
        return toResponse(find(id));
    }

    // ---------- writes ----------

    @Transactional
    public QuotationResponse create(QuotationRequest req) {
        Quotation q = new Quotation();
        q.setCreatedBy(currentUser.id());
        apply(q, req);
        q.setQuotationNo(nextNo(q.getQuotationDate()));
        return toResponse(quotationRepository.saveAndFlush(q));
    }

    @Transactional
    public QuotationResponse update(Long id, QuotationRequest req) {
        Quotation q = find(id);
        if (q.getStatus() == QuotationStatus.CANCELLED) {
            throw new IllegalArgumentException("A cancelled quotation cannot be edited");
        }
        apply(q, req);
        q.setRevision(q.getRevision() + 1);
        q.setUpdatedAt(LocalDateTime.now());
        return toResponse(quotationRepository.saveAndFlush(q));
    }

    @Transactional
    public QuotationResponse cancel(Long id, String reason) {
        Quotation q = find(id);
        if (q.getStatus() == QuotationStatus.CANCELLED) {
            throw new IllegalArgumentException("Quotation is already cancelled");
        }
        q.setStatus(QuotationStatus.CANCELLED);
        q.setCancelReason(reason.trim());
        q.setUpdatedAt(LocalDateTime.now());
        return toResponse(q);
    }

    // ---------- the calculation ----------

    /**
     * Same rules as your Excel sheet, with the two fixes noted in the design:
     * price excludes GST; discount % comes off first; GST is charged on the discounted value;
     * each line's tax is rounded once and then split, so CGST + SGST always equals the line's tax.
     */
    private void apply(Quotation q, QuotationRequest req) {
        LocalDate today = LocalDate.now(SHOP_ZONE);
        LocalDate date = req.quotationDate() == null ? today : req.quotationDate();
        int validity = req.validityDays() == null ? 15 : req.validityDays();

        ShopSettings shop = shopRepository.findById(1)
                .orElseThrow(() -> new NotFoundException("Shop settings not found"));

        String pos = req.placeOfSupplyState().trim();
        if (!StateCodes.isValid(pos)) {
            throw new IllegalArgumentException("Invalid place of supply state");
        }
        boolean sameState = pos.equals(shop.getStateCode());

        if (req.customerId() != null) {
            Customer c = customerRepository.findById(req.customerId())
                    .orElseThrow(() -> new NotFoundException("Customer not found"));
            q.setCustomerId(c.getId());
        } else {
            q.setCustomerId(null);
        }

        // Staff may not quote more than the staff discount limit
        if (!currentUser.isOwner()) {
            for (QuotationRequest.Item it : req.items()) {
                if (it.discountPercent() != null && it.discountPercent().compareTo(staffMaxDiscountPercent) > 0) {
                    throw new IllegalArgumentException("Staff can give at most " + staffMaxDiscountPercent.stripTrailingZeros().toPlainString()
                            + "% discount. Ask the owner for a bigger discount.");
                }
            }
        }

        Set<Long> productIds = req.items().stream().map(QuotationRequest.Item::productId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, Product> products = productRepository.findAllById(productIds).stream()
                .collect(Collectors.toMap(Product::getId, p -> p));

        q.getItems().clear();
        BigDecimal subtotal = BigDecimal.ZERO, discountTotal = BigDecimal.ZERO, taxable = BigDecimal.ZERO;
        BigDecimal cgst = BigDecimal.ZERO, sgst = BigDecimal.ZERO, igst = BigDecimal.ZERO;
        int lineNo = 0;

        for (QuotationRequest.Item it : req.items()) {
            lineNo++;
            Product p = null;
            if (it.productId() != null) {
                p = products.get(it.productId());
                if (p == null) throw new IllegalArgumentException("Line " + lineNo + ": part not found");
            }
            String description = ContactRules.blankToNull(it.description());
            if (description == null && p != null) description = p.getName();
            if (description == null) throw new IllegalArgumentException("Line " + lineNo + ": description is required");

            String partNumber = ContactRules.blankToNull(it.partNumber());
            if (partNumber == null && p != null) partNumber = p.getPartNumber();
            String hsn = ContactRules.blankToNull(it.hsnCode());
            if (hsn == null && p != null) hsn = p.getHsnCode();

            BigDecimal rate = it.gstRate();
            if (rate == null && p != null) rate = p.getGstRate();
            if (rate == null) throw new IllegalArgumentException("Line " + lineNo + ": GST rate is required");

            String unit = ContactRules.blankToNull(it.unit());
            unit = unit == null ? "NOS" : unit.toUpperCase();

            BigDecimal price = it.unitPrice().setScale(2, RoundingMode.HALF_UP);
            BigDecimal pct = it.discountPercent() == null ? BigDecimal.ZERO : it.discountPercent();

            BigDecimal gross = price.multiply(BigDecimal.valueOf(it.quantity())).setScale(2, RoundingMode.HALF_UP);
            BigDecimal discount = gross.multiply(pct).divide(HUNDRED, 2, RoundingMode.HALF_UP);
            BigDecimal lineTaxable = gross.subtract(discount);
            BigDecimal tax = lineTaxable.multiply(rate).divide(HUNDRED, 2, RoundingMode.HALF_UP);

            BigDecimal lineCgst = BigDecimal.ZERO, lineSgst = BigDecimal.ZERO, lineIgst = BigDecimal.ZERO;
            if (sameState) {
                lineCgst = tax.divide(TWO, 2, RoundingMode.HALF_UP);
                lineSgst = tax.subtract(lineCgst);
            } else {
                lineIgst = tax;
            }

            QuotationItem qi = new QuotationItem();
            qi.setLineNo(lineNo);
            qi.setProductId(p == null ? null : p.getId());
            qi.setPartNumber(partNumber);
            qi.setDescription(description);
            qi.setHsnCode(hsn);
            qi.setQuantity(it.quantity());
            qi.setUnit(unit);
            qi.setUnitPrice(price);
            qi.setGrossAmount(gross);
            qi.setDiscountPercent(pct.setScale(2, RoundingMode.HALF_UP));
            qi.setDiscountAmount(discount);
            qi.setTaxableAmount(lineTaxable);
            qi.setGstRate(rate);
            qi.setCgstAmount(lineCgst);
            qi.setSgstAmount(lineSgst);
            qi.setIgstAmount(lineIgst);
            qi.setLineTotal(lineTaxable.add(tax));
            q.getItems().add(qi);

            subtotal = subtotal.add(gross);
            discountTotal = discountTotal.add(discount);
            taxable = taxable.add(lineTaxable);
            cgst = cgst.add(lineCgst);
            sgst = sgst.add(lineSgst);
            igst = igst.add(lineIgst);
        }

        BigDecimal raw = taxable.add(cgst).add(sgst).add(igst);
        BigDecimal grand = raw.setScale(0, RoundingMode.HALF_UP).setScale(2);

        q.setQuotationDate(date);
        q.setValidUntil(date.plusDays(validity));
        q.setBuyerName(req.buyerName().trim());
        q.setBuyerAddress(ContactRules.blankToNull(req.buyerAddress()));
        q.setBuyerGstin(ContactRules.normalizeGstin(req.buyerGstin()));
        q.setBuyerPhone(ContactRules.blankToNull(req.buyerPhone()));
        q.setPlaceOfSupplyState(pos);
        q.setSubtotal(subtotal);
        q.setDiscountTotal(discountTotal);
        q.setTaxableAmount(taxable);
        q.setCgstTotal(cgst);
        q.setSgstTotal(sgst);
        q.setIgstTotal(igst);
        q.setRoundOff(grand.subtract(raw));
        q.setGrandTotal(grand);
        q.setTerms(ContactRules.blankToNull(req.terms()));
        q.setNotes(ContactRules.blankToNull(req.notes()));
    }

    // ---------- helpers ----------

    private Quotation find(Long id) {
        return quotationRepository.findById(id).orElseThrow(() -> new NotFoundException("Quotation not found"));
    }

    /** QT/26-27/00001, financial year April to March. */
    private String nextNo(LocalDate date) {
        int startYear = date.getMonthValue() >= 4 ? date.getYear() : date.getYear() - 1;
        String fy = startYear + "-" + String.format("%02d", (startYear + 1) % 100);
        String shortFy = String.format("%02d-%02d", startYear % 100, (startYear + 1) % 100);

        counterRepository.ensureExists(fy);
        QuotationCounter counter = counterRepository.findByIdForUpdate(fy)
                .orElseThrow(() -> new IllegalStateException("Quotation counter missing"));
        counter.setLastNumber(counter.getLastNumber() + 1);
        return String.format("QT/%s/%05d", shortFy, counter.getLastNumber());
    }

    private QuotationResponse toResponse(Quotation q) {
        ShopSettings shop = shopRepository.findById(1)
                .orElseThrow(() -> new NotFoundException("Shop settings not found"));
        List<QuotationResponse.Line> lines = q.getItems().stream()
                .map(i -> new QuotationResponse.Line(i.getLineNo(), i.getProductId(), i.getPartNumber(),
                        i.getDescription(), i.getHsnCode(), i.getQuantity(), i.getUnit(), i.getUnitPrice(),
                        i.getGrossAmount(), i.getDiscountPercent(), i.getDiscountAmount(), i.getTaxableAmount(),
                        i.getGstRate(), i.getCgstAmount(), i.getSgstAmount(), i.getIgstAmount(), i.getLineTotal()))
                .toList();
        return new QuotationResponse(q.getId(), q.getQuotationNo(), q.getQuotationDate(), q.getValidUntil(),
                q.getRevision(), q.getStatus().name(), q.getCancelReason(),
                q.getCustomerId(), q.getBuyerName(), q.getBuyerAddress(), q.getBuyerGstin(), q.getBuyerPhone(),
                q.getPlaceOfSupplyState(), StateCodes.name(q.getPlaceOfSupplyState()),
                q.getPlaceOfSupplyState().equals(shop.getStateCode()),
                q.getSubtotal(), q.getDiscountTotal(), q.getTaxableAmount(),
                q.getCgstTotal(), q.getSgstTotal(), q.getIgstTotal(), q.getRoundOff(), q.getGrandTotal(),
                q.getTerms(), q.getNotes(), q.getCreatedAt(), ShopSettingsResponse.from(shop), lines);
    }
}
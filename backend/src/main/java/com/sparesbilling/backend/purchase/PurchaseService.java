package com.sparesbilling.backend.purchase;

import com.sparesbilling.backend.catalog.Product;
import com.sparesbilling.backend.catalog.ProductRepository;
import com.sparesbilling.backend.common.*;
import com.sparesbilling.backend.stock.StockMovementType;
import com.sparesbilling.backend.stock.StockService;
import com.sparesbilling.backend.supplier.Supplier;
import com.sparesbilling.backend.supplier.SupplierRepository;
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
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PurchaseService {

    private static final ZoneId SHOP_ZONE = ZoneId.of("Asia/Kolkata");
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final PurchaseRepository purchaseRepository;
    private final PurchasePaymentRepository paymentRepository;
    private final SupplierRepository supplierRepository;
    private final ProductRepository productRepository;
    private final StockService stockService;
    private final CurrentUser currentUser;

    // ---------- reads ----------

    @Transactional(readOnly = true)
    public PageResponse<PurchaseSummary> search(Long supplierId, LocalDate from, LocalDate to,
                                                int page, int size) {
        Specification<Purchase> spec = (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (supplierId != null) ps.add(cb.equal(root.get("supplierId"), supplierId));
            if (from != null) ps.add(cb.greaterThanOrEqualTo(root.<LocalDate>get("purchaseDate"), from));
            if (to != null) ps.add(cb.lessThanOrEqualTo(root.<LocalDate>get("purchaseDate"), to));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "purchaseDate").and(Sort.by(Sort.Direction.DESC, "id")));
        Page<Purchase> result = purchaseRepository.findAll(spec, pageable);

        Set<Long> ids = result.getContent().stream().map(Purchase::getSupplierId).collect(Collectors.toSet());
        Map<Long, String> names = supplierNames(ids);
        return PageResponse.from(result.map(p -> PurchaseSummary.from(p, names.get(p.getSupplierId()))));
    }

    @Transactional(readOnly = true)
    public PurchaseResponse get(Long id) {
        return toResponse(find(id));
    }

    @Transactional(readOnly = true)
    public List<SupplierDueResponse> dues() {
        List<PurchaseRepository.SupplierDue> rows = purchaseRepository.findSupplierDues();
        Map<Long, String> names = supplierNames(
                rows.stream().map(PurchaseRepository.SupplierDue::getSupplierId).collect(Collectors.toSet()));
        return rows.stream()
                .map(r -> new SupplierDueResponse(r.getSupplierId(), names.get(r.getSupplierId()), r.getDue()))
                .sorted(Comparator.comparing(SupplierDueResponse::due).reversed())
                .toList();
    }

    // ---------- writes ----------

    @Transactional
    public PurchaseResponse create(PurchaseRequest req) {
        LocalDate today = LocalDate.now(SHOP_ZONE);
        if (req.purchaseDate().isAfter(today)) {
            throw new IllegalArgumentException("Purchase date cannot be in the future");
        }
        Supplier supplier = supplierRepository.findById(req.supplierId())
                .orElseThrow(() -> new NotFoundException("Supplier not found"));
        if (!supplier.isActive()) {
            throw new IllegalArgumentException("Supplier is inactive");
        }
        String invoiceNo = ContactRules.blankToNull(req.supplierInvoiceNo());
        if (invoiceNo != null && purchaseRepository.existsBySupplierIdAndSupplierInvoiceNoIgnoreCaseAndStatus(
                supplier.getId(), invoiceNo, PurchaseStatus.ACTIVE)) {
            throw new IllegalArgumentException("This supplier invoice number is already entered");
        }

        Purchase purchase = new Purchase();
        purchase.setSupplierId(supplier.getId());
        purchase.setSupplierInvoiceNo(invoiceNo);
        purchase.setPurchaseDate(req.purchaseDate());
        purchase.setNotes(ContactRules.blankToNull(req.notes()));
        purchase.setCreatedBy(currentUser.id());
        purchase = purchaseRepository.saveAndFlush(purchase);   // need the id for the stock movements

        boolean updatePrice = req.updatePurchasePrice() == null || req.updatePurchasePrice();
        BigDecimal total = BigDecimal.ZERO;
        Set<Long> seen = new HashSet<>();

        // sorted by product id so concurrent transactions lock rows in the same order
        List<PurchaseRequest.Item> sorted = req.items().stream()
                .sorted(Comparator.comparing(PurchaseRequest.Item::productId)).toList();

        for (PurchaseRequest.Item it : sorted) {
            if (!seen.add(it.productId())) {
                throw new IllegalArgumentException("The same part is added twice. Combine it into one line.");
            }
            // StockService locks the product row and returns fresh data
            Product prod = stockService.changeStock(it.productId(), it.quantity(),
                    StockMovementType.PURCHASE, "PURCHASE", purchase.getId(),
                    "Purchase from " + supplier.getName());
            if (!prod.isActive()) {
                throw new IllegalArgumentException(prod.getPartNumber() + " is inactive. Reactivate it first.");
            }

            BigDecimal gst = it.gstRate() != null ? it.gstRate() : prod.getGstRate();
            BigDecimal base = it.unitCost().multiply(BigDecimal.valueOf(it.quantity()));
            BigDecimal gstAmount = base.multiply(gst).divide(HUNDRED, 2, RoundingMode.HALF_UP);
            BigDecimal lineTotal = base.add(gstAmount).setScale(2, RoundingMode.HALF_UP);

            PurchaseItem pi = new PurchaseItem();
            pi.setProductId(prod.getId());
            pi.setQuantity(it.quantity());
            pi.setUnitCost(it.unitCost().setScale(2, RoundingMode.HALF_UP));
            pi.setGstRate(gst);
            pi.setLineTotal(lineTotal);
            purchase.getItems().add(pi);
            total = total.add(lineTotal);

            if (updatePrice) {
                prod.setPurchasePrice(pi.getUnitCost());
            }
        }

        BigDecimal paid = req.paidAmount() == null
                ? BigDecimal.ZERO : req.paidAmount().setScale(2, RoundingMode.HALF_UP);
        if (paid.compareTo(total) > 0) {
            throw new IllegalArgumentException("Paid amount cannot be more than the purchase total (" + total + ")");
        }
        purchase.setTotalAmount(total);
        purchase.setPaidAmount(paid);

        if (paid.signum() > 0) {
            PurchasePayment pay = new PurchasePayment();
            pay.setPurchaseId(purchase.getId());
            pay.setAmount(paid);
            pay.setMethod(req.paymentMethod() == null ? PaymentMethod.CASH : req.paymentMethod());
            pay.setPaymentDate(req.purchaseDate());
            pay.setNotes("Paid at purchase entry");
            pay.setCreatedBy(currentUser.id());
            paymentRepository.save(pay);
        }
        return toResponse(purchase);
    }

    @Transactional
    public PurchaseResponse addPayment(Long id, PurchasePaymentRequest req) {
        Purchase p = purchaseRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new NotFoundException("Purchase not found"));
        if (p.getStatus() == PurchaseStatus.CANCELLED) {
            throw new IllegalArgumentException("Purchase is cancelled");
        }
        BigDecimal due = p.due();
        if (req.amount().compareTo(due) > 0) {
            throw new IllegalArgumentException("Payment is more than the amount due (" + due + ")");
        }
        LocalDate date = req.paymentDate() == null ? LocalDate.now(SHOP_ZONE) : req.paymentDate();
        if (date.isAfter(LocalDate.now(SHOP_ZONE))) {
            throw new IllegalArgumentException("Payment date cannot be in the future");
        }

        PurchasePayment pay = new PurchasePayment();
        pay.setPurchaseId(p.getId());
        pay.setAmount(req.amount());
        pay.setMethod(req.method());
        pay.setReference(ContactRules.blankToNull(req.reference()));
        pay.setPaymentDate(date);
        pay.setNotes(ContactRules.blankToNull(req.notes()));
        pay.setCreatedBy(currentUser.id());
        paymentRepository.save(pay);

        p.setPaidAmount(p.getPaidAmount().add(req.amount()));
        return toResponse(p);
    }

    @Transactional
    public PurchaseResponse cancel(Long id, String reason) {
        Purchase p = purchaseRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new NotFoundException("Purchase not found"));
        if (p.getStatus() == PurchaseStatus.CANCELLED) {
            throw new IllegalArgumentException("Purchase is already cancelled");
        }
        List<PurchaseItem> items = p.getItems().stream()
                .sorted(Comparator.comparing(PurchaseItem::getProductId)).toList();
        for (PurchaseItem i : items) {
            // throws "Insufficient stock" if these parts were already sold
            stockService.changeStock(i.getProductId(), -i.getQuantity(), StockMovementType.ADJUSTMENT,
                    "PURCHASE", p.getId(), "Purchase #" + p.getId() + " cancelled");
        }
        p.setStatus(PurchaseStatus.CANCELLED);
        p.setCancelledAt(LocalDateTime.now());
        p.setCancelReason(reason.trim());
        return toResponse(p);
    }

    // ---------- helpers ----------

    private Purchase find(Long id) {
        return purchaseRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Purchase not found"));
    }

    private Map<Long, String> supplierNames(Set<Long> ids) {
        return supplierRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Supplier::getId, Supplier::getName));
    }

    private PurchaseResponse toResponse(Purchase p) {
        String supplierName = supplierRepository.findById(p.getSupplierId())
                .map(Supplier::getName).orElse("Unknown");

        Set<Long> productIds = p.getItems().stream().map(PurchaseItem::getProductId).collect(Collectors.toSet());
        Map<Long, Product> products = productRepository.findAllById(productIds).stream()
                .collect(Collectors.toMap(Product::getId, x -> x));

        List<PurchaseResponse.Line> lines = p.getItems().stream().map(i -> {
            Product prod = products.get(i.getProductId());
            return new PurchaseResponse.Line(i.getProductId(),
                    prod == null ? null : prod.getPartNumber(),
                    prod == null ? null : prod.getName(),
                    i.getQuantity(), i.getUnitCost(), i.getGstRate(), i.getLineTotal());
        }).toList();

        List<PurchaseResponse.Payment> payments = paymentRepository.findByPurchaseIdOrderByIdAsc(p.getId())
                .stream().map(x -> new PurchaseResponse.Payment(x.getId(), x.getAmount(), x.getMethod().name(),
                        x.getReference(), x.getPaymentDate(), x.getNotes())).toList();

        return new PurchaseResponse(p.getId(), p.getSupplierId(), supplierName, p.getSupplierInvoiceNo(),
                p.getPurchaseDate(), p.getTotalAmount(), p.getPaidAmount(), p.due(),
                p.getStatus().name(), p.getNotes(), p.getCancelReason(), p.getCreatedAt(), lines, payments);
    }
}
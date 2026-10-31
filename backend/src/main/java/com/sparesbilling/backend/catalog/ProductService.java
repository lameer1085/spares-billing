package com.sparesbilling.backend.catalog;

import com.sparesbilling.backend.common.CurrentUser;
import com.sparesbilling.backend.common.NotFoundException;
import com.sparesbilling.backend.common.PageResponse;
import com.sparesbilling.backend.stock.*;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final BrandRepository brandRepository;
    private final CategoryRepository categoryRepository;
    private final StockService stockService;
    private final StockMovementRepository movementRepository;
    private final CurrentUser currentUser;

    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> search(String q, Long categoryId, Long brandId,
                                                boolean includeInactive, int page, int size) {
        return search(q, categoryId, brandId, includeInactive, false, page, size);
    }

    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> search(String q, Long categoryId, Long brandId,
                                                boolean includeInactive, boolean lowStockOnly,
                                                int page, int size) {
        Specification<Product> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (!includeInactive) {
                predicates.add(cb.isTrue(root.<Boolean>get("active")));
            }
            if (categoryId != null) {
                predicates.add(cb.equal(root.get("category").get("id"), categoryId));
            }
            if (brandId != null) {
                predicates.add(cb.equal(root.get("brand").get("id"), brandId));
            }
            if (lowStockOnly) {
                predicates.add(cb.le(root.<Integer>get("stockQty"), root.<Integer>get("minStock")));
            }
            if (q != null && !q.isBlank()) {
                Join<Product, Brand> brand = root.join("brand", JoinType.LEFT);
                // every word typed must match somewhere (part no, name, vehicle or brand)
                for (String token : q.trim().toLowerCase().split("\\s+")) {
                    String like = "%" + escapeLike(token) + "%";
                    predicates.add(cb.or(
                            cb.like(cb.lower(root.<String>get("partNumber")), like, '\\'),
                            cb.like(cb.lower(root.<String>get("name")), like, '\\'),
                            cb.like(cb.lower(root.<String>get("vehicleCompatibility")), like, '\\'),
                            cb.like(cb.lower(brand.<String>get("name")), like, '\\')));
                }
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                lowStockOnly ? Sort.by("stockQty").ascending().and(Sort.by("partNumber").ascending())
                        : Sort.by("partNumber").ascending());
        return PageResponse.from(productRepository.findAll(spec, pageable).map(this::toResponse));
    }

    @Transactional(readOnly = true)
    public ProductResponse get(Long id) {
        return toResponse(find(id));
    }

    @Transactional(readOnly = true)
    public List<ProductResponse> lowStock() {
        return productRepository.findLowStock().stream().map(this::toResponse).toList();
    }

    @Transactional
    public ProductResponse create(ProductRequest req) {
        Product p = new Product();
        apply(p, req);
        p = productRepository.saveAndFlush(p);

        int opening = req.openingStock() == null ? 0 : req.openingStock();
        if (opening > 0) {
            p = stockService.changeStock(p.getId(), opening, StockMovementType.ADJUSTMENT,
                    "PRODUCT", p.getId(), "Opening stock");
        }
        return toResponse(p);
    }

    @Transactional
    public ProductResponse update(Long id, ProductRequest req) {
        Product p = find(id);
        apply(p, req);                        // stock is NOT changed here
        return toResponse(productRepository.saveAndFlush(p));
    }

    @Transactional
    public ProductResponse setActive(Long id, boolean active) {
        Product p = find(id);
        p.setActive(active);
        return toResponse(p);
    }

    @Transactional
    public ProductResponse adjustStock(Long id, StockAdjustmentRequest req) {
        if (req.quantityChange() == 0) {
            throw new IllegalArgumentException("Quantity change cannot be zero");
        }
        Product p = stockService.changeStock(id, req.quantityChange(), StockMovementType.ADJUSTMENT,
                "MANUAL", null, req.reason().trim());
        return toResponse(p);
    }

    @Transactional(readOnly = true)
    public List<StockMovementResponse> movements(Long id) {
        if (!productRepository.existsById(id)) {
            throw new NotFoundException("Product not found");
        }
        return movementRepository.findTop50ByProductIdOrderByIdDesc(id).stream()
                .map(StockMovementResponse::from).toList();
    }

    // ---------- helpers ----------

    private Product find(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Product not found"));
    }

    private ProductResponse toResponse(Product p) {
        return ProductResponse.from(p, currentUser.isOwner());
    }

    private void apply(Product p, ProductRequest req) {
        if (req.mrp().signum() > 0 && req.sellingPrice().compareTo(req.mrp()) > 0) {
            throw new IllegalArgumentException("Selling price cannot be higher than MRP");
        }
        p.setPartNumber(req.partNumber().trim());
        p.setName(req.name().trim());
        p.setBrand(req.brandId() == null ? null : brandRepository.findById(req.brandId())
                                                  .orElseThrow(() -> new NotFoundException("Brand not found")));
        p.setCategory(req.categoryId() == null ? null : categoryRepository.findById(req.categoryId())
                                                        .orElseThrow(() -> new NotFoundException("Category not found")));
        p.setVehicleCompatibility(blankToNull(req.vehicleCompatibility()));
        p.setHsnCode(blankToNull(req.hsnCode()));
        p.setGstRate(req.gstRate());
        p.setMrp(req.mrp());
        p.setPurchasePrice(req.purchasePrice());
        p.setSellingPrice(req.sellingPrice());
        p.setListPrice(req.listPrice());
        p.setMinStock(req.minStock() == null ? 0 : req.minStock());
        p.setRackLocation(blankToNull(req.rackLocation()));
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
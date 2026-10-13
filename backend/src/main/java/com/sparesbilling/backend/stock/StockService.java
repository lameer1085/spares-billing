package com.sparesbilling.backend.stock;

import com.sparesbilling.backend.catalog.Product;
import com.sparesbilling.backend.catalog.ProductRepository;
import com.sparesbilling.backend.common.CurrentUser;
import com.sparesbilling.backend.common.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class StockService {

    private final ProductRepository productRepository;
    private final StockMovementRepository movementRepository;
    private final CurrentUser currentUser;

    @Value("${app.stock.allow-negative:false}")
    private boolean allowNegative;

    /**
     * Changes stock and records the movement. MANDATORY means it must be called from inside
     * another transaction (e.g. creating an invoice), so stock and invoice save together or not at all.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public Product changeStock(Long productId, int delta, StockMovementType type,
                               String referenceType, Long referenceId, String note) {
        Product p = productRepository.findByIdForUpdate(productId)
                .orElseThrow(() -> new NotFoundException("Product not found: " + productId));

        int newBalance = p.getStockQty() + delta;
        if (newBalance < 0 && !allowNegative) {
            throw new IllegalArgumentException("Insufficient stock for " + p.getPartNumber()
                    + " (available: " + p.getStockQty() + ")");
        }
        p.setStockQty(newBalance);

        StockMovement m = new StockMovement();
        m.setProductId(p.getId());
        m.setMovementType(type);
        m.setQuantityChange(delta);
        m.setBalanceAfter(newBalance);
        m.setReferenceType(referenceType);
        m.setReferenceId(referenceId);
        m.setNote(note);
        m.setCreatedBy(currentUser.id());
        movementRepository.save(m);
        return p;
    }
}
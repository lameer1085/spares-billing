package com.sparesbilling.backend.stock;

import java.time.LocalDateTime;

public record StockMovementResponse(Long id, String type, int quantityChange, int balanceAfter,
                                    String referenceType, Long referenceId, String note,
                                    LocalDateTime createdAt) {
    public static StockMovementResponse from(StockMovement m) {
        return new StockMovementResponse(m.getId(), m.getMovementType().name(), m.getQuantityChange(),
                m.getBalanceAfter(), m.getReferenceType(), m.getReferenceId(), m.getNote(), m.getCreatedAt());
    }
}
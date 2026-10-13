package com.sparesbilling.backend.catalog;

import java.math.BigDecimal;

public record ProductResponse(
        Long id, String partNumber, String name,
        Long brandId, String brandName,
        Long categoryId, String categoryName,
        String vehicleCompatibility, String hsnCode,
        BigDecimal gstRate, BigDecimal mrp, BigDecimal purchasePrice, BigDecimal sellingPrice,
        int stockQty, int minStock, String rackLocation,
        boolean active, boolean lowStock
) {
    public static ProductResponse from(Product p, boolean showCost) {
        Brand b = p.getBrand();
        Category c = p.getCategory();
        return new ProductResponse(
                p.getId(), p.getPartNumber(), p.getName(),
                b == null ? null : b.getId(), b == null ? null : b.getName(),
                c == null ? null : c.getId(), c == null ? null : c.getName(),
                p.getVehicleCompatibility(), p.getHsnCode(),
                p.getGstRate(), p.getMrp(),
                showCost ? p.getPurchasePrice() : null,
                p.getSellingPrice(),
                p.getStockQty(), p.getMinStock(), p.getRackLocation(),
                p.isActive(),
                p.getMinStock() > 0 && p.getStockQty() <= p.getMinStock());
    }
}
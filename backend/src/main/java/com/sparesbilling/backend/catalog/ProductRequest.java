package com.sparesbilling.backend.catalog;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;

public record ProductRequest(
        @NotBlank @Size(max = 60) String partNumber,
        @NotBlank @Size(max = 200) String name,
        Long brandId,
        Long categoryId,
        String vehicleCompatibility,
//        @Size(max = 10) String hsnCode,
        @Pattern(regexp = "^\\d{4,8}$", message = "HSN must be 4 to 8 digits, numbers only") String hsnCode,
        @NotNull @DecimalMin("0.0") @DecimalMax("40.0") BigDecimal gstRate,
        @NotNull @DecimalMin("0.0") @Digits(integer = 10, fraction = 2) BigDecimal mrp,
        @NotNull @DecimalMin("0.0") @Digits(integer = 10, fraction = 2) BigDecimal purchasePrice,
        @NotNull @DecimalMin("0.0") @Digits(integer = 10, fraction = 2) BigDecimal sellingPrice,
        @Min(0) Integer minStock,
        @Size(max = 50) String rackLocation,
        @Min(0) Integer openingStock,   // used only when creating
        @DecimalMin("0.01") @Digits(integer = 10, fraction = 2) BigDecimal listPrice   // optional
) {}
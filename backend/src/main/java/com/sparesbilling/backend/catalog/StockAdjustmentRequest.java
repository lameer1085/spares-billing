package com.sparesbilling.backend.catalog;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record StockAdjustmentRequest(
        @NotNull Integer quantityChange,   // +5 adds stock, -2 removes stock
        @NotBlank @Size(max = 255) String reason
) {}
package com.sparesbilling.backend.purchase;

import com.sparesbilling.backend.common.PaymentMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record PurchaseRequest(
        @NotNull Long supplierId,
        @Size(max = 50) String supplierInvoiceNo,
        @NotNull LocalDate purchaseDate,
        @NotEmpty @Valid List<Item> items,
        @DecimalMin("0.0") @Digits(integer = 10, fraction = 2) BigDecimal paidAmount,
        PaymentMethod paymentMethod,          // for the amount paid now; defaults to CASH
        String notes,
        Boolean updatePurchasePrice           // default true
) {
    public record Item(
            @NotNull Long productId,
            @NotNull @Min(1) Integer quantity,
            @NotNull @DecimalMin("0.0") @Digits(integer = 10, fraction = 2) BigDecimal unitCost,  // excluding GST
            @DecimalMin("0.0") @DecimalMax("40.0") BigDecimal gstRate,
            @DecimalMin("0.01") @Digits(integer = 10, fraction = 2) BigDecimal newSellingPrice,
            @DecimalMin("0.01") @Digits(integer = 10, fraction = 2) BigDecimal newListPrice
    ) {}
}
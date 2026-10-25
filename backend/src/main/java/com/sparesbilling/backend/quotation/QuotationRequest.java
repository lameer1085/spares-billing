package com.sparesbilling.backend.quotation;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record QuotationRequest(
        Long customerId,                                   // optional: a saved customer
        @NotBlank @Size(max = 150) String buyerName,
        @Size(max = 500) String buyerAddress,
        @Size(max = 15) String buyerGstin,
        @Size(max = 20) String buyerPhone,
        @NotBlank @Size(min = 2, max = 2) String placeOfSupplyState,   // state code, e.g. 32 = Kerala
        LocalDate quotationDate,                           // default today
        @Min(1) @Max(365) Integer validityDays,            // default 15
        @NotEmpty @Valid List<Item> items,
        String terms,
        String notes
) {
    public record Item(
            Long productId,                                // optional: omit for a custom line
            @Size(max = 60) String partNumber,
            @Size(max = 200) String description,
            @Size(max = 10) String hsnCode,
            @NotNull @Min(1) Integer quantity,
            @Size(max = 10) String unit,                   // default NOS
            @NotNull @DecimalMin("0.0") @Digits(integer = 10, fraction = 2) BigDecimal unitPrice,   // excluding GST
            @DecimalMin("0.0") @DecimalMax("100.0") @Digits(integer = 3, fraction = 2) BigDecimal discountPercent,
            @DecimalMin("0.0") @DecimalMax("40.0") BigDecimal gstRate   // default: the product's rate
    ) {}
}
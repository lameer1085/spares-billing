package com.sparesbilling.backend.supplier;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SupplierRequest(
        @NotBlank @Size(max = 150) String name,
        @Size(max = 20) String phone,
        @Size(max = 15) String gstin,
        String address,
        @Size(max = 2) String stateCode
) {}
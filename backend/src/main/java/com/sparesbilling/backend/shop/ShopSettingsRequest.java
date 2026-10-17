package com.sparesbilling.backend.shop;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ShopSettingsRequest(
        @NotBlank @Size(max = 150) String shopName,
        String address,
        @Size(max = 20) String phone,
        @Size(max = 15) String gstin,
        @Size(max = 2) String stateCode,
        @NotBlank @Pattern(regexp = "^[A-Za-z0-9]{1,4}$", message = "Prefix must be 1 to 4 letters or digits")
        String invoicePrefix
) {}
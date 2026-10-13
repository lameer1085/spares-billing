package com.sparesbilling.backend.purchase;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PurchaseCancelRequest(@NotBlank @Size(max = 255) String reason) {}
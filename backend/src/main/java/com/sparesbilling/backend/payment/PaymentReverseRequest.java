package com.sparesbilling.backend.payment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PaymentReverseRequest(@NotBlank @Size(max = 255) String reason) {}
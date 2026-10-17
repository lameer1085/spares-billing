package com.sparesbilling.backend.invoice;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InvoiceCancelRequest(@NotBlank @Size(max = 255) String reason) {}
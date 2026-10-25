package com.sparesbilling.backend.quotation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record QuotationCancelRequest(@NotBlank @Size(max = 255) String reason) {}
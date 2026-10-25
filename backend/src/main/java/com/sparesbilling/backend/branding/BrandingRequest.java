package com.sparesbilling.backend.branding;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BrandingRequest(@NotBlank @Size(max = 60) String appName) {}
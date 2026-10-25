package com.sparesbilling.backend.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
        @NotBlank @Size(max = 100) String fullName,
        @NotNull Role role,
        @NotNull Boolean active
) {}
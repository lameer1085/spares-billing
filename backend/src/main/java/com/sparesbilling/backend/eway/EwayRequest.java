package com.sparesbilling.backend.eway;

import jakarta.validation.constraints.*;

import java.time.LocalDate;

public record EwayRequest(
        @Pattern(regexp = "^$|^[0-9]{6}$", message = "Pincode must be 6 digits") String toPincode,
        @Size(max = 100) String toPlace,
        @Min(0) @Max(4000) Integer distanceKm,
        @NotNull @Min(1) @Max(4) Short transMode,
        @Pattern(regexp = "^$|^[A-Za-z0-9]{7,15}$", message = "Vehicle number: letters and digits only, no spaces")
        String vehicleNo,
        @Size(max = 100) String transporterName,
        @Pattern(regexp = "^$|^[0-9A-Za-z]{15}$", message = "Transporter ID must be 15 characters") String transporterId,
        @Size(max = 30) String transDocNo,
        LocalDate transDocDate,
        @Pattern(regexp = "^$|^[0-9]{12}$", message = "E-way bill number must be 12 digits") String ewayBillNo,
        LocalDate ewayBillDate
) {}
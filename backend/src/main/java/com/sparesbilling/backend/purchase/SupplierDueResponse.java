package com.sparesbilling.backend.purchase;

import java.math.BigDecimal;

public record SupplierDueResponse(Long supplierId, String supplierName, BigDecimal due) {}
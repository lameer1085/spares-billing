package com.sparesbilling.backend.eway;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/invoices/{invoiceId}/eway")
@RequiredArgsConstructor
public class EwayController {

    private final EwayService service;

    @GetMapping
    public EwayResponse get(@PathVariable Long invoiceId) {
        return service.get(invoiceId);
    }

    @PutMapping
    public EwayResponse save(@PathVariable Long invoiceId, @Valid @RequestBody EwayRequest request) {
        return service.save(invoiceId, request);
    }
}
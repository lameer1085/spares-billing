package com.sparesbilling.backend.payment;

import com.sparesbilling.backend.common.PageResponse;
import com.sparesbilling.backend.common.PaymentMethod;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PaymentResult receive(@Valid @RequestBody PaymentRequest req) {
        return paymentService.receive(req);
    }

    @GetMapping
    @PreAuthorize("hasRole('OWNER')")
    public PageResponse<PaymentResponse> search(
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) PaymentMethod method,
            @RequestParam(required = false) PaymentStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return paymentService.search(customerId, from, to, method, status, page, size);
    }

    @GetMapping("/summary")
    @PreAuthorize("hasRole('OWNER')")
    public CollectionSummary summary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return paymentService.summary(from, to);
    }

    @GetMapping("/{id}")
    public PaymentResponse get(@PathVariable Long id) {
        return paymentService.get(id);
    }

    @PostMapping("/{id}/reverse")
    @PreAuthorize("hasRole('OWNER')")
    public PaymentResponse reverse(@PathVariable Long id, @Valid @RequestBody PaymentReverseRequest req) {
        return paymentService.reverse(id, req.reason());
    }
}
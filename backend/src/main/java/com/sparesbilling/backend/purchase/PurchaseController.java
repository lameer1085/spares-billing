package com.sparesbilling.backend.purchase;

import com.sparesbilling.backend.common.PageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/purchases")
@RequiredArgsConstructor
@PreAuthorize("hasRole('OWNER')")
public class PurchaseController {

    private final PurchaseService purchaseService;

    @GetMapping
    public PageResponse<PurchaseSummary> search(
            @RequestParam(required = false) Long supplierId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return purchaseService.search(supplierId, from, to, page, size);
    }

    @GetMapping("/dues")
    public List<SupplierDueResponse> dues() {
        return purchaseService.dues();
    }

    @GetMapping("/{id}")
    public PurchaseResponse get(@PathVariable Long id) {
        return purchaseService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PurchaseResponse create(@Valid @RequestBody PurchaseRequest req) {
        return purchaseService.create(req);
    }

    @PostMapping("/{id}/payments")
    public PurchaseResponse addPayment(@PathVariable Long id, @Valid @RequestBody PurchasePaymentRequest req) {
        return purchaseService.addPayment(id, req);
    }

    @PostMapping("/{id}/cancel")
    public PurchaseResponse cancel(@PathVariable Long id, @Valid @RequestBody PurchaseCancelRequest req) {
        return purchaseService.cancel(id, req.reason());
    }
}
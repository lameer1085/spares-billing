package com.sparesbilling.backend.quotation;

import com.sparesbilling.backend.common.PageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/quotations")
@RequiredArgsConstructor
public class QuotationController {

    private final QuotationService quotationService;

    @GetMapping
    public PageResponse<QuotationSummary> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) QuotationStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return quotationService.search(q, status, from, to, page, size);
    }

    @GetMapping("/{id}")
    public QuotationResponse get(@PathVariable Long id) {
        return quotationService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public QuotationResponse create(@Valid @RequestBody QuotationRequest req) {
        return quotationService.create(req);
    }

    @PutMapping("/{id}")
    public QuotationResponse update(@PathVariable Long id, @Valid @RequestBody QuotationRequest req) {
        return quotationService.update(id, req);
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('OWNER')")
    public QuotationResponse cancel(@PathVariable Long id, @Valid @RequestBody QuotationCancelRequest req) {
        return quotationService.cancel(id, req.reason());
    }
}
package com.sparesbilling.backend.creditnote;

import com.sparesbilling.backend.common.PageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/credit-notes")
@RequiredArgsConstructor
public class CreditNoteController {

    private final CreditNoteService creditNoteService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('OWNER')")
    public CreditNoteResponse create(@Valid @RequestBody CreditNoteRequest req) {
        return creditNoteService.create(req);
    }

    @GetMapping
    public PageResponse<CreditNoteSummary> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long invoiceId,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return creditNoteService.search(q, invoiceId, customerId, from, to, page, size);
    }

    @GetMapping("/{id}")
    public CreditNoteResponse get(@PathVariable Long id) {
        return creditNoteService.get(id);
    }
}
package com.sparesbilling.backend.ledger;

import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class LedgerController {

    private final LedgerService ledgerService;

    @GetMapping("/customers/{id}/balance")
    public BalanceResponse balance(@PathVariable Long id) {
        return ledgerService.balance(id);
    }

    @GetMapping("/customers/{id}/ledger")
    public LedgerResponse ledger(
            @PathVariable Long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ledgerService.statement(id, from, to);
    }

    @GetMapping("/ledger/dues")
    @PreAuthorize("hasRole('OWNER')")
    public DuesResponse dues() {
        return ledgerService.dues();
    }
}
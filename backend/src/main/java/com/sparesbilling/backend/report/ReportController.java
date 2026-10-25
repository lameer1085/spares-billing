package com.sparesbilling.backend.report;

import com.sparesbilling.backend.report.ReportDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
@PreAuthorize("hasRole('OWNER')")
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/dashboard")
    public Dashboard dashboard() {
        return reportService.dashboard();
    }

    @GetMapping("/sales")
    public SalesReport sales(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return reportService.sales(from, to);
    }

    @GetMapping("/gst")
    public GstSummary gst(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return reportService.gst(from, to);
    }

    @GetMapping("/stock")
    public StockReport stock() {
        return reportService.stock();
    }

    @GetMapping("/top-products")
    public List<TopProduct> topProducts(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "quantity") String by,
            @RequestParam(defaultValue = "10") int limit) {
        return reportService.topProducts(from, to, by, limit);
    }

    @GetMapping("/profit")
    public ProfitReport profit(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "10") int limit) {
        return reportService.profit(from, to, limit);
    }
}
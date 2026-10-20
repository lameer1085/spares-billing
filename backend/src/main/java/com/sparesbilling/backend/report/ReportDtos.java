package com.sparesbilling.backend.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class ReportDtos {

    private ReportDtos() {}

    // ----- dashboard -----
    public record Dashboard(LocalDate date, long invoiceCount, BigDecimal salesTotal, BigDecimal collectedToday,
                            BigDecimal customerDues, BigDecimal supplierDues, long lowStockCount) {}

    // ----- sales -----
    public record SalesRow(LocalDate date, long invoices, BigDecimal discount, BigDecimal taxable,
                           BigDecimal cgst, BigDecimal sgst, BigDecimal igst, BigDecimal roundOff,
                           BigDecimal grandTotal, BigDecimal paid, BigDecimal due) {}

    public record SalesReport(LocalDate from, LocalDate to, SalesRow totals,
                              long cancelledCount, BigDecimal cancelledAmount, List<SalesRow> days) {}

    // ----- GST -----
    public record RateRow(BigDecimal rate, BigDecimal taxable, BigDecimal cgst, BigDecimal sgst,
                          BigDecimal igst, BigDecimal totalTax) {}

    public record TaxTotals(BigDecimal taxable, BigDecimal cgst, BigDecimal sgst, BigDecimal igst,
                            BigDecimal totalTax) {}

    public record HsnRow(String hsn, BigDecimal rate, long quantity, BigDecimal taxable, BigDecimal cgst,
                         BigDecimal sgst, BigDecimal igst, BigDecimal totalTax) {}

    public record GstSummary(LocalDate from, LocalDate to,
                             List<RateRow> output, TaxTotals outputTotals,
                             List<RateRow> input, TaxTotals inputTotals,
                             BigDecimal netTaxEstimate,
                             List<HsnRow> hsnSales) {}

    // ----- stock -----
    public record CategoryRow(String category, long products, long units,
                              BigDecimal costValue, BigDecimal sellingValue) {}

    public record StockReport(long products, long units, BigDecimal costValue, BigDecimal sellingValue,
                              long outOfStock, long lowStock, List<CategoryRow> categories) {}

    // ----- top products -----
    public record TopProduct(Long productId, String description, long quantity, BigDecimal amount) {}
}
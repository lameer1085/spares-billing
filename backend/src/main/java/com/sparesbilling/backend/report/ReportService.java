package com.sparesbilling.backend.report;

import com.sparesbilling.backend.catalog.ProductRepository;
import com.sparesbilling.backend.ledger.LedgerService;
import com.sparesbilling.backend.payment.PaymentService;
import com.sparesbilling.backend.purchase.PurchaseService;
import com.sparesbilling.backend.purchase.SupplierDueResponse;
import com.sparesbilling.backend.report.ReportDtos.*;
import com.sparesbilling.backend.shop.ShopSettings;
import com.sparesbilling.backend.shop.ShopSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
public class ReportService {

    private static final ZoneId SHOP_ZONE = ZoneId.of("Asia/Kolkata");
    private static final BigDecimal TWO = BigDecimal.valueOf(2);
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final ReportRepository repo;
    private final ShopSettingsRepository shopRepository;
    private final PaymentService paymentService;
    private final LedgerService ledgerService;
    private final PurchaseService purchaseService;
    private final ProductRepository productRepository;

    private record DateRange(LocalDate from, LocalDate to) {}

    // ---------- dashboard ----------

    @Transactional(readOnly = true)
    public Dashboard dashboard() {
        LocalDate today = LocalDate.now(SHOP_ZONE);
        SalesReport s = sales(today, today);
        BigDecimal supplierDues = purchaseService.dues().stream()
                .map(SupplierDueResponse::due).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new Dashboard(today, s.totals().invoices(), s.netSales(),
                paymentService.summary(today, today).total(),
                ledgerService.dues().totalOutstanding(), supplierDues,
                productRepository.findLowStock().size());
    }

    // ---------- sales ----------

    @Transactional(readOnly = true)
    public SalesReport sales(LocalDate from, LocalDate to) {
        DateRange r = range(from, to);
        List<SalesRow> days = new ArrayList<>();
        for (Object[] x : repo.salesByDay(r.from(), r.to())) {
            BigDecimal grand = bd(x[8]);
            BigDecimal paid = bd(x[9]);
            days.add(new SalesRow(date(x[0]), lng(x[1]), bd(x[2]), bd(x[3]), bd(x[4]), bd(x[5]), bd(x[6]),
                    bd(x[7]), grand, paid, grand.subtract(paid)));
        }
        SalesRow totals = new SalesRow(null,
                days.stream().mapToLong(SalesRow::invoices).sum(),
                sum(days, SalesRow::discount), sum(days, SalesRow::taxable), sum(days, SalesRow::cgst),
                sum(days, SalesRow::sgst), sum(days, SalesRow::igst), sum(days, SalesRow::roundOff),
                sum(days, SalesRow::grandTotal), sum(days, SalesRow::paid), sum(days, SalesRow::due));

        Object[] cr = repo.creditNoteTotals(r.from(), r.to()).get(0);
        ReturnsRow returns = new ReturnsRow(lng(cr[0]), bd(cr[1]), bd(cr[2]), bd(cr[3]), bd(cr[4]), bd(cr[5]), bd(cr[6]));

        Object[] c = repo.cancelledTotals(r.from(), r.to()).get(0);
        return new SalesReport(r.from(), r.to(), totals, returns,
                totals.grandTotal().subtract(returns.grandTotal()), lng(c[0]), bd(c[1]), days);
    }

    // ---------- GST ----------

    @Transactional(readOnly = true)
    public GstSummary gst(LocalDate from, LocalDate to) {
        DateRange r = range(from, to);
        ShopSettings shop = shopRepository.findById(1).orElseThrow();

        List<RateRow> output = new ArrayList<>();
        for (Object[] x : repo.outputByRate(r.from(), r.to())) {
            BigDecimal cgst = bd(x[2]), sgst = bd(x[3]), igst = bd(x[4]);
            output.add(new RateRow(bd(x[0]).setScale(2, RoundingMode.HALF_UP), bd(x[1]), cgst, sgst, igst,
                    cgst.add(sgst).add(igst)));
        }

        // purchases: [taxable, tax charged within state, tax charged from other states]
        TreeMap<BigDecimal, BigDecimal[]> agg = new TreeMap<>();
        for (Object[] x : repo.inputByRate(r.from(), r.to(), shop.getStateCode())) {
            BigDecimal rate = bd(x[0]).setScale(2, RoundingMode.HALF_UP);
            boolean inter = lng(x[1]) == 1;
            BigDecimal[] a = agg.computeIfAbsent(rate,
                    k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO});
            a[0] = a[0].add(bd(x[2]));
            if (inter) a[2] = a[2].add(bd(x[3])); else a[1] = a[1].add(bd(x[3]));
        }
        List<RateRow> input = new ArrayList<>();
        for (Map.Entry<BigDecimal, BigDecimal[]> e : agg.entrySet()) {
            BigDecimal[] a = e.getValue();
            BigDecimal cgst = a[1].divide(TWO, 2, RoundingMode.HALF_UP);
            BigDecimal sgst = a[1].subtract(cgst);
            input.add(new RateRow(e.getKey(), a[0], cgst, sgst, a[2], a[1].add(a[2])));
        }

        TaxTotals outTotals = totals(output);
        TaxTotals inTotals = totals(input);

        Object[] cr = repo.creditNoteTotals(r.from(), r.to()).get(0);
        BigDecimal crCgst = bd(cr[2]), crSgst = bd(cr[3]), crIgst = bd(cr[4]);
        TaxTotals creditNotes = new TaxTotals(bd(cr[1]), crCgst, crSgst, crIgst, crCgst.add(crSgst).add(crIgst));

        List<HsnRow> hsn = new ArrayList<>();
        for (Object[] x : repo.outputByHsn(r.from(), r.to())) {
            BigDecimal cgst = bd(x[4]), sgst = bd(x[5]), igst = bd(x[6]);
            hsn.add(new HsnRow((String) x[0], bd(x[1]).setScale(2, RoundingMode.HALF_UP), lng(x[2]), bd(x[3]),
                    cgst, sgst, igst, cgst.add(sgst).add(igst)));
        }
        return new GstSummary(r.from(), r.to(), output, outTotals, input, inTotals,
                outTotals.totalTax().subtract(inTotals.totalTax()), creditNotes, hsn);
    }

    // ---------- stock ----------

    @Transactional(readOnly = true)
    public StockReport stock() {
        List<CategoryRow> cats = new ArrayList<>();
        for (Object[] x : repo.stockByCategory()) {
            cats.add(new CategoryRow((String) x[0], lng(x[1]), lng(x[2]), bd(x[3]), bd(x[4])));
        }
        Object[] counts = repo.stockCounts().get(0);
        return new StockReport(
                cats.stream().mapToLong(CategoryRow::products).sum(),
                cats.stream().mapToLong(CategoryRow::units).sum(),
                sum(cats, CategoryRow::costValue), sum(cats, CategoryRow::sellingValue),
                lng(counts[0]), lng(counts[1]), cats);
    }

    // ---------- top products ----------

    @Transactional(readOnly = true)
    public List<TopProduct> topProducts(LocalDate from, LocalDate to, String by, int limit) {
        if (!"quantity".equals(by) && !"amount".equals(by)) {
            throw new IllegalArgumentException("'by' must be quantity or amount");
        }
        DateRange r = range(from, to);
        List<TopProduct> out = new ArrayList<>();
        for (Object[] x : repo.topProducts(r.from(), r.to(), "amount".equals(by), Math.min(Math.max(limit, 1), 50))) {
            out.add(new TopProduct(lng(x[0]), (String) x[1], lng(x[2]), bd(x[3])));
        }
        return out;
    }

    // ---------- profit ----------

    @Transactional(readOnly = true)
    public ProfitReport profit(LocalDate from, LocalDate to, int limit) {
        DateRange r = range(from, to);
        List<ProfitRow> products = new ArrayList<>();
        Map<String, BigDecimal[]> cats = new TreeMap<>();                  // category -> [revenue, cost]

        for (Object[] x : repo.profitByProduct(r.from(), r.to())) {
            BigDecimal revenue = bd(x[4]);
            BigDecimal cost = bd(x[5]);
            BigDecimal profit = revenue.subtract(cost);
            products.add(new ProfitRow(lng(x[0]), (String) x[1], (String) x[2], lng(x[3]),
                    revenue, cost, profit, margin(profit, revenue)));
            BigDecimal[] a = cats.computeIfAbsent((String) x[2], k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            a[0] = a[0].add(revenue);
            a[1] = a[1].add(cost);
        }

        List<CategoryProfit> categories = new ArrayList<>();
        for (Map.Entry<String, BigDecimal[]> e : cats.entrySet()) {
            BigDecimal revenue = e.getValue()[0];
            BigDecimal cost = e.getValue()[1];
            categories.add(new CategoryProfit(e.getKey(), revenue.setScale(2, RoundingMode.HALF_UP),
                    cost.setScale(2, RoundingMode.HALF_UP), revenue.subtract(cost).setScale(2, RoundingMode.HALF_UP),
                    margin(revenue.subtract(cost), revenue)));
        }
        categories.sort(Comparator.comparing(CategoryProfit::profit).reversed());

        BigDecimal revenue = sum(products, ProfitRow::revenue);
        BigDecimal cost = sum(products, ProfitRow::cost);
        BigDecimal profit = revenue.subtract(cost);

        products.sort(Comparator.comparing(ProfitRow::profit).reversed());
        List<ProfitRow> top = products.subList(0, Math.min(products.size(), Math.min(Math.max(limit, 1), 100)));
        return new ProfitReport(r.from(), r.to(), revenue, cost, profit, margin(profit, revenue), categories,
                new ArrayList<>(top));
    }

    // ---------- helpers ----------

    private DateRange range(LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.now(SHOP_ZONE);
        LocalDate f = from != null ? from : today.withDayOfMonth(1);
        LocalDate t = to != null ? to : today;
        if (t.isBefore(f)) {
            throw new IllegalArgumentException("'to' date cannot be before 'from' date");
        }
        if (ChronoUnit.DAYS.between(f, t) > 366) {
            throw new IllegalArgumentException("Date range cannot be more than 1 year");
        }
        return new DateRange(f, t);
    }

    private static BigDecimal margin(BigDecimal profit, BigDecimal revenue) {
        if (revenue.signum() == 0) return BigDecimal.ZERO.setScale(2);
        return profit.multiply(HUNDRED).divide(revenue, 2, RoundingMode.HALF_UP);
    }

    private static TaxTotals totals(List<RateRow> rows) {
        return new TaxTotals(sum(rows, RateRow::taxable), sum(rows, RateRow::cgst), sum(rows, RateRow::sgst),
                sum(rows, RateRow::igst), sum(rows, RateRow::totalTax));
    }

    private static <T> BigDecimal sum(List<T> list, Function<T, BigDecimal> f) {
        return list.stream().map(f).reduce(BigDecimal.ZERO, BigDecimal::add).setScale(2, RoundingMode.HALF_UP);
    }

    // database values arrive as different number/date types, so convert them safely
    private static BigDecimal bd(Object o) {
        if (o == null) return BigDecimal.ZERO.setScale(2);
        return o instanceof BigDecimal b ? b : new BigDecimal(o.toString());
    }

    private static long lng(Object o) {
        return o == null ? 0 : ((Number) o).longValue();
    }

    private static LocalDate date(Object o) {
        if (o instanceof LocalDate d) return d;
        if (o instanceof java.sql.Date d) return d.toLocalDate();
        return LocalDate.parse(o.toString().substring(0, 10));
    }
}
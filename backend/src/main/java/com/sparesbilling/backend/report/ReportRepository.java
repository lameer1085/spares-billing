package com.sparesbilling.backend.report;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Repository
public class ReportRepository {

    @PersistenceContext
    private EntityManager em;

    @SuppressWarnings("unchecked")
    private List<Object[]> rows(String sql, Map<String, Object> params) {
        Query q = em.createNativeQuery(sql);
        params.forEach(q::setParameter);
        return q.getResultList();
    }

    private static Map<String, Object> range(LocalDate from, LocalDate to) {
        return Map.of("fromDate", from, "toDate", to);
    }

    public List<Object[]> salesByDay(LocalDate from, LocalDate to) {
        return rows("""
                SELECT invoice_date, COUNT(*), SUM(discount_total), SUM(taxable_amount), SUM(cgst_total),
                       SUM(sgst_total), SUM(igst_total), SUM(round_off), SUM(grand_total), SUM(paid_amount)
                FROM invoices
                WHERE status = 'ACTIVE' AND invoice_date BETWEEN :fromDate AND :toDate
                GROUP BY invoice_date ORDER BY invoice_date
                """, range(from, to));
    }

    public List<Object[]> cancelledTotals(LocalDate from, LocalDate to) {
        return rows("""
                SELECT COUNT(*), COALESCE(SUM(grand_total), 0)
                FROM invoices
                WHERE status = 'CANCELLED' AND invoice_date BETWEEN :fromDate AND :toDate
                """, range(from, to));
    }

    /** Credit notes issued in the period (by credit note date). */
    public List<Object[]> creditNoteTotals(LocalDate from, LocalDate to) {
        return rows("""
                SELECT COUNT(*), COALESCE(SUM(taxable_amount), 0), COALESCE(SUM(cgst_total), 0),
                       COALESCE(SUM(sgst_total), 0), COALESCE(SUM(igst_total), 0),
                       COALESCE(SUM(grand_total), 0), COALESCE(SUM(refund_amount), 0)
                FROM credit_notes
                WHERE credit_note_date BETWEEN :fromDate AND :toDate
                """, range(from, to));
    }

    /** Output tax per rate: sales (by invoice date) minus credit notes (by credit note date). */
    public List<Object[]> outputByRate(LocalDate from, LocalDate to) {
        return rows("""
                SELECT t.rate, SUM(t.taxable), SUM(t.cgst), SUM(t.sgst), SUM(t.igst)
                FROM (
                    SELECT ii.gst_rate AS rate, ii.taxable_amount AS taxable, ii.cgst_amount AS cgst,
                           ii.sgst_amount AS sgst, ii.igst_amount AS igst
                    FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
                    WHERE i.status = 'ACTIVE' AND i.invoice_date BETWEEN :fromDate AND :toDate
                    UNION ALL
                    SELECT ci.gst_rate, -ci.taxable_amount, -ci.cgst_amount, -ci.sgst_amount, -ci.igst_amount
                    FROM credit_note_items ci JOIN credit_notes cn ON cn.id = ci.credit_note_id
                    WHERE cn.credit_note_date BETWEEN :fromDate AND :toDate
                ) t
                GROUP BY t.rate ORDER BY t.rate
                """, range(from, to));
    }

    public List<Object[]> outputByHsn(LocalDate from, LocalDate to) {
        return rows("""
                SELECT t.hsn, t.rate, SUM(t.qty), SUM(t.taxable), SUM(t.cgst), SUM(t.sgst), SUM(t.igst)
                FROM (
                    SELECT COALESCE(ii.hsn_code, '') AS hsn, ii.gst_rate AS rate, ii.quantity AS qty,
                           ii.taxable_amount AS taxable, ii.cgst_amount AS cgst, ii.sgst_amount AS sgst,
                           ii.igst_amount AS igst
                    FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
                    WHERE i.status = 'ACTIVE' AND i.invoice_date BETWEEN :fromDate AND :toDate
                    UNION ALL
                    SELECT COALESCE(ci.hsn_code, ''), ci.gst_rate, -ci.quantity, -ci.taxable_amount,
                           -ci.cgst_amount, -ci.sgst_amount, -ci.igst_amount
                    FROM credit_note_items ci JOIN credit_notes cn ON cn.id = ci.credit_note_id
                    WHERE cn.credit_note_date BETWEEN :fromDate AND :toDate
                ) t
                GROUP BY t.hsn, t.rate ORDER BY 1, 2
                """, range(from, to));
    }

    /** Purchases: GST per rate, split by whether the supplier is in another state (inter = 1). */
    public List<Object[]> inputByRate(LocalDate from, LocalDate to, String shopState) {
        return rows("""
                SELECT pi.gst_rate,
                       CASE WHEN s.state_code IS NOT NULL AND s.state_code <> :shopState THEN 1 ELSE 0 END,
                       SUM(pi.unit_cost * pi.quantity),
                       SUM(pi.line_total - pi.unit_cost * pi.quantity)
                FROM purchase_items pi
                JOIN purchases p ON p.id = pi.purchase_id
                JOIN suppliers s ON s.id = p.supplier_id
                WHERE p.status = 'ACTIVE' AND p.purchase_date BETWEEN :fromDate AND :toDate
                GROUP BY pi.gst_rate, 2 ORDER BY pi.gst_rate
                """, Map.of("fromDate", from, "toDate", to, "shopState", shopState));
    }

    public List<Object[]> stockByCategory() {
        return rows("""
                SELECT COALESCE(c.name, 'Uncategorised'), COUNT(*), COALESCE(SUM(p.stock_qty), 0),
                       COALESCE(SUM(p.stock_qty * p.purchase_price), 0),
                       COALESCE(SUM(p.stock_qty * p.selling_price), 0)
                FROM products p LEFT JOIN categories c ON c.id = p.category_id
                WHERE p.active = TRUE
                GROUP BY COALESCE(c.name, 'Uncategorised') ORDER BY 1
                """, Map.of());
    }

    public List<Object[]> stockCounts() {
        return rows("""
                SELECT COUNT(*) FILTER (WHERE stock_qty = 0),
                       COUNT(*) FILTER (WHERE min_stock > 0 AND stock_qty <= min_stock)
                FROM products WHERE active = TRUE
                """, Map.of());
    }

    public List<Object[]> topProducts(LocalDate from, LocalDate to, boolean byAmount, int limit) {
        String order = byAmount ? "amount DESC, qty DESC" : "qty DESC, amount DESC";
        return rows("""
                SELECT ii.product_id, MAX(ii.description), SUM(ii.quantity) AS qty, SUM(ii.line_total) AS amount
                FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
                WHERE i.status = 'ACTIVE' AND i.invoice_date BETWEEN :fromDate AND :toDate
                GROUP BY ii.product_id ORDER BY\s""" + order + " LIMIT :limit",
                Map.of("fromDate", from, "toDate", to, "limit", limit));
    }

    /**
     * Revenue (before GST) and cost per product, net of returns.
     * A damaged return (not restocked) does not give its cost back, so it stays as a loss.
     */
    public List<Object[]> profitByProduct(LocalDate from, LocalDate to) {
        return rows("""
                SELECT t.product_id, MAX(t.description), COALESCE(c.name, 'Uncategorised'),
                       SUM(t.qty), SUM(t.revenue), SUM(t.cost)
                FROM (
                    SELECT ii.product_id AS product_id, ii.description AS description, ii.quantity AS qty,
                           ii.taxable_amount AS revenue, ii.cost_price * ii.quantity AS cost
                    FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
                    WHERE i.status = 'ACTIVE' AND i.invoice_date BETWEEN :fromDate AND :toDate
                    UNION ALL
                    SELECT ci.product_id, ci.description, -ci.quantity, -ci.taxable_amount,
                           -(CASE WHEN ci.restocked THEN ci.cost_price * ci.quantity ELSE 0 END)
                    FROM credit_note_items ci JOIN credit_notes cn ON cn.id = ci.credit_note_id
                    WHERE cn.credit_note_date BETWEEN :fromDate AND :toDate
                ) t
                JOIN products p ON p.id = t.product_id
                LEFT JOIN categories c ON c.id = p.category_id
                GROUP BY t.product_id, COALESCE(c.name, 'Uncategorised')
                """, range(from, to));
    }
}
CREATE INDEX idx_invoice_items_invoice ON invoice_items (invoice_id);
CREATE INDEX idx_invoice_items_product ON invoice_items (product_id);
CREATE INDEX idx_payments_invoice ON payments (invoice_id);

-- Safety net: an invoice can never be paid more than its total
ALTER TABLE invoices ADD CONSTRAINT chk_invoices_paid
    CHECK (paid_amount >= 0 AND paid_amount <= grand_total);
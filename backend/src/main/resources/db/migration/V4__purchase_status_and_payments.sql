ALTER TABLE purchases
    ADD COLUMN status        VARCHAR(15) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED')),
    ADD COLUMN cancelled_at  TIMESTAMP,
    ADD COLUMN cancel_reason VARCHAR(255);

-- Same supplier invoice number cannot be entered twice (cancelled ones don't count)
CREATE UNIQUE INDEX uq_purchases_supplier_invoice
    ON purchases (supplier_id, LOWER(supplier_invoice_no))
    WHERE supplier_invoice_no IS NOT NULL AND status = 'ACTIVE';

CREATE INDEX idx_purchases_date ON purchases (purchase_date);
CREATE INDEX idx_purchases_supplier ON purchases (supplier_id);
CREATE INDEX idx_purchase_items_purchase ON purchase_items (purchase_id);

CREATE TABLE purchase_payments (
                                   id           BIGSERIAL PRIMARY KEY,
                                   purchase_id  BIGINT        NOT NULL REFERENCES purchases(id),
                                   amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
                                   method       VARCHAR(10)   NOT NULL CHECK (method IN ('CASH', 'UPI', 'CARD', 'BANK')),
                                   reference    VARCHAR(100),
                                   payment_date DATE          NOT NULL,
                                   notes        VARCHAR(255),
                                   created_by   BIGINT REFERENCES users(id),
                                   created_at   TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_purchase_payments_purchase ON purchase_payments (purchase_id);
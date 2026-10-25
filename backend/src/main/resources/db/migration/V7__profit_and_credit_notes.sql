-- 1. Cost snapshot on invoice lines (profit reports)
ALTER TABLE invoice_items ADD COLUMN cost_price NUMERIC(12,2) NOT NULL DEFAULT 0;
-- Bills made before this change: best guess = the part's current purchase price
UPDATE invoice_items ii SET cost_price = p.purchase_price FROM products p WHERE p.id = ii.product_id;

-- 2. Value of returns recorded against an invoice
ALTER TABLE invoices ADD COLUMN credited_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD CONSTRAINT chk_invoices_credited CHECK (credited_amount >= 0);

-- 3. Credit notes
CREATE TABLE credit_note_counters (
                                      financial_year VARCHAR(7) PRIMARY KEY,
                                      last_number    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE credit_notes (
                              id                    BIGSERIAL PRIMARY KEY,
                              credit_note_no        VARCHAR(30)   NOT NULL UNIQUE,
                              credit_note_date      DATE          NOT NULL,
                              invoice_id            BIGINT        NOT NULL REFERENCES invoices(id),
                              customer_id           BIGINT REFERENCES customers(id),
                              place_of_supply_state VARCHAR(2),
                              taxable_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
                              cgst_total            NUMERIC(12,2) NOT NULL DEFAULT 0,
                              sgst_total            NUMERIC(12,2) NOT NULL DEFAULT 0,
                              igst_total            NUMERIC(12,2) NOT NULL DEFAULT 0,
                              round_off             NUMERIC(6,2)  NOT NULL DEFAULT 0,
                              grand_total           NUMERIC(12,2) NOT NULL DEFAULT 0,
                              refund_amount         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
                              refund_method         VARCHAR(10) CHECK (refund_method IN ('CASH', 'UPI', 'CARD', 'BANK')),
                              reason                VARCHAR(255)  NOT NULL,
                              created_by            BIGINT REFERENCES users(id),
                              created_at            TIMESTAMP     NOT NULL DEFAULT NOW(),
                              CHECK (refund_amount <= grand_total)
);
CREATE INDEX idx_credit_notes_invoice  ON credit_notes (invoice_id);
CREATE INDEX idx_credit_notes_customer ON credit_notes (customer_id);
CREATE INDEX idx_credit_notes_date     ON credit_notes (credit_note_date);

CREATE TABLE credit_note_items (
                                   id              BIGSERIAL PRIMARY KEY,
                                   credit_note_id  BIGINT        NOT NULL REFERENCES credit_notes(id),
                                   invoice_item_id BIGINT        NOT NULL REFERENCES invoice_items(id),
                                   product_id      BIGINT        NOT NULL REFERENCES products(id),
                                   description     VARCHAR(200)  NOT NULL,
                                   hsn_code        VARCHAR(10),
                                   quantity        INTEGER       NOT NULL CHECK (quantity > 0),
                                   taxable_amount  NUMERIC(12,2) NOT NULL,
                                   gst_rate        NUMERIC(5,2)  NOT NULL,
                                   cgst_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
                                   sgst_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
                                   igst_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
                                   line_total      NUMERIC(12,2) NOT NULL,
                                   cost_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
                                   restocked       BOOLEAN       NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_credit_note_items_note ON credit_note_items (credit_note_id);
CREATE INDEX idx_credit_note_items_invoice_item ON credit_note_items (invoice_item_id);
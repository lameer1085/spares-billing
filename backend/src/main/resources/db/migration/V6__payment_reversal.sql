ALTER TABLE payments
    ADD COLUMN status         VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVERSED')),
    ADD COLUMN reversed_at    TIMESTAMP,
    ADD COLUMN reverse_reason VARCHAR(255);

CREATE INDEX idx_payments_date ON payments (payment_date);
CREATE TABLE quotation_counters (
                                    financial_year VARCHAR(7) PRIMARY KEY,
                                    last_number    INT NOT NULL DEFAULT 0
);

CREATE TABLE quotations (
                            id                    BIGSERIAL PRIMARY KEY,
                            quotation_no          VARCHAR(30) NOT NULL UNIQUE,
                            quotation_date        DATE NOT NULL,
                            valid_until           DATE NOT NULL,
                            revision              INT NOT NULL DEFAULT 1,
                            status                VARCHAR(12) NOT NULL DEFAULT 'OPEN',
                            cancel_reason         VARCHAR(255),
                            customer_id           BIGINT REFERENCES customers (id),
                            buyer_name            VARCHAR(150) NOT NULL,
                            buyer_address         TEXT,
                            buyer_gstin           VARCHAR(15),
                            buyer_phone           VARCHAR(20),
                            place_of_supply_state VARCHAR(2) NOT NULL,
                            subtotal              NUMERIC(12,2) NOT NULL DEFAULT 0,
                            discount_total        NUMERIC(12,2) NOT NULL DEFAULT 0,
                            taxable_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
                            cgst_total            NUMERIC(12,2) NOT NULL DEFAULT 0,
                            sgst_total            NUMERIC(12,2) NOT NULL DEFAULT 0,
                            igst_total            NUMERIC(12,2) NOT NULL DEFAULT 0,
                            round_off             NUMERIC(6,2)  NOT NULL DEFAULT 0,
                            grand_total           NUMERIC(12,2) NOT NULL DEFAULT 0,
                            terms                 TEXT,
                            notes                 TEXT,
                            created_by            BIGINT,
                            created_at            TIMESTAMP NOT NULL DEFAULT now(),
                            updated_at            TIMESTAMP NOT NULL DEFAULT now(),
                            CONSTRAINT chk_quotations_status CHECK (status IN ('OPEN', 'CANCELLED'))
);

CREATE TABLE quotation_items (
                                 id               BIGSERIAL PRIMARY KEY,
                                 quotation_id     BIGINT NOT NULL REFERENCES quotations (id),
                                 line_no          INT NOT NULL,
                                 product_id       BIGINT REFERENCES products (id),
                                 part_number      VARCHAR(60),
                                 description      VARCHAR(200) NOT NULL,
                                 hsn_code         VARCHAR(10),
                                 quantity         INT NOT NULL CHECK (quantity > 0),
                                 unit             VARCHAR(10) NOT NULL DEFAULT 'NOS',
                                 unit_price       NUMERIC(12,2) NOT NULL,
                                 gross_amount     NUMERIC(12,2) NOT NULL,
                                 discount_percent NUMERIC(5,2)  NOT NULL DEFAULT 0,
                                 discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
                                 taxable_amount   NUMERIC(12,2) NOT NULL,
                                 gst_rate         NUMERIC(5,2)  NOT NULL,
                                 cgst_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
                                 sgst_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
                                 igst_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
                                 line_total       NUMERIC(12,2) NOT NULL
);

CREATE INDEX idx_quotations_date ON quotations (quotation_date);
CREATE INDEX idx_quotations_customer ON quotations (customer_id);
CREATE INDEX idx_quotation_items_quotation ON quotation_items (quotation_id);
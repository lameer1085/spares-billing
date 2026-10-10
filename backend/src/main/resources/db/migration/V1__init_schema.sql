-- USERS
CREATE TABLE users (
                       id            BIGSERIAL PRIMARY KEY,
                       username      VARCHAR(50)  NOT NULL UNIQUE,
                       password_hash VARCHAR(255) NOT NULL,
                       full_name     VARCHAR(100) NOT NULL,
                       role          VARCHAR(20)  NOT NULL CHECK (role IN ('OWNER', 'STAFF')),
                       active        BOOLEAN      NOT NULL DEFAULT TRUE,
                       created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- MASTER DATA
CREATE TABLE categories (
                            id   BIGSERIAL PRIMARY KEY,
                            name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE brands (
                        id   BIGSERIAL PRIMARY KEY,
                        name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE products (
                          id                    BIGSERIAL PRIMARY KEY,
                          part_number           VARCHAR(60)    NOT NULL,
                          name                  VARCHAR(200)   NOT NULL,
                          brand_id              BIGINT REFERENCES brands(id),
                          category_id           BIGINT REFERENCES categories(id),
                          vehicle_compatibility TEXT,
                          hsn_code              VARCHAR(10),
                          gst_rate              NUMERIC(5,2)   NOT NULL DEFAULT 18.00,
                          mrp                   NUMERIC(12,2)  NOT NULL DEFAULT 0,
                          purchase_price        NUMERIC(12,2)  NOT NULL DEFAULT 0,
                          selling_price         NUMERIC(12,2)  NOT NULL DEFAULT 0,
                          stock_qty             INTEGER        NOT NULL DEFAULT 0,
                          min_stock             INTEGER        NOT NULL DEFAULT 0,
                          rack_location         VARCHAR(50),
                          active                BOOLEAN        NOT NULL DEFAULT TRUE,
                          created_at            TIMESTAMP      NOT NULL DEFAULT NOW(),
                          updated_at            TIMESTAMP      NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_products_part_number ON products (LOWER(part_number));
CREATE INDEX idx_products_name ON products (LOWER(name));

CREATE TABLE customers (
                           id              BIGSERIAL PRIMARY KEY,
                           name            VARCHAR(150)  NOT NULL,
                           phone           VARCHAR(20),
                           gstin           VARCHAR(15),
                           address         TEXT,
                           state_code      VARCHAR(2),
                           credit_limit    NUMERIC(12,2) NOT NULL DEFAULT 0,
                           opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
                           active          BOOLEAN       NOT NULL DEFAULT TRUE,
                           created_at      TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_customers_name ON customers (LOWER(name));
CREATE INDEX idx_customers_phone ON customers (phone);

CREATE TABLE suppliers (
                           id         BIGSERIAL PRIMARY KEY,
                           name       VARCHAR(150) NOT NULL,
                           phone      VARCHAR(20),
                           gstin      VARCHAR(15),
                           address    TEXT,
                           state_code VARCHAR(2),
                           active     BOOLEAN   NOT NULL DEFAULT TRUE,
                           created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- PURCHASES (stock in)
CREATE TABLE purchases (
                           id                  BIGSERIAL PRIMARY KEY,
                           supplier_id         BIGINT        NOT NULL REFERENCES suppliers(id),
                           supplier_invoice_no VARCHAR(50),
                           purchase_date       DATE          NOT NULL,
                           total_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
                           paid_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
                           notes               TEXT,
                           created_by          BIGINT REFERENCES users(id),
                           created_at          TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_items (
                                id          BIGSERIAL PRIMARY KEY,
                                purchase_id BIGINT        NOT NULL REFERENCES purchases(id),
                                product_id  BIGINT        NOT NULL REFERENCES products(id),
                                quantity    INTEGER       NOT NULL CHECK (quantity > 0),
                                unit_cost   NUMERIC(12,2) NOT NULL,
                                gst_rate    NUMERIC(5,2)  NOT NULL DEFAULT 0,
                                line_total  NUMERIC(12,2) NOT NULL
);

-- INVOICES (sales)
CREATE TABLE invoices (
                          id                      BIGSERIAL PRIMARY KEY,
                          invoice_no              VARCHAR(30)   NOT NULL UNIQUE,
                          invoice_date            DATE          NOT NULL,
                          customer_id             BIGINT REFERENCES customers(id),  -- NULL = walk-in customer
                          place_of_supply_state   VARCHAR(2),
                          subtotal                NUMERIC(12,2) NOT NULL DEFAULT 0,
                          discount_total          NUMERIC(12,2) NOT NULL DEFAULT 0,
                          taxable_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
                          cgst_total              NUMERIC(12,2) NOT NULL DEFAULT 0,
                          sgst_total              NUMERIC(12,2) NOT NULL DEFAULT 0,
                          igst_total              NUMERIC(12,2) NOT NULL DEFAULT 0,
                          round_off               NUMERIC(6,2)  NOT NULL DEFAULT 0,
                          grand_total             NUMERIC(12,2) NOT NULL DEFAULT 0,
                          paid_amount             NUMERIC(12,2) NOT NULL DEFAULT 0,
                          status                  VARCHAR(15)   NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED')),
                          cancelled_at            TIMESTAMP,
                          cancel_reason           VARCHAR(255),
                          created_by              BIGINT REFERENCES users(id),
                          created_at              TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_invoices_date ON invoices (invoice_date);
CREATE INDEX idx_invoices_customer ON invoices (customer_id);

CREATE TABLE invoice_items (
                               id              BIGSERIAL PRIMARY KEY,
                               invoice_id      BIGINT        NOT NULL REFERENCES invoices(id),
                               product_id      BIGINT        NOT NULL REFERENCES products(id),
                               description     VARCHAR(200)  NOT NULL,   -- snapshot of product name at time of sale
                               hsn_code        VARCHAR(10),
                               quantity        INTEGER       NOT NULL CHECK (quantity > 0),
                               unit_price      NUMERIC(12,2) NOT NULL,
                               discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
                               taxable_amount  NUMERIC(12,2) NOT NULL,
                               gst_rate        NUMERIC(5,2)  NOT NULL,
                               cgst_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
                               sgst_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
                               igst_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
                               line_total      NUMERIC(12,2) NOT NULL
);

-- Gap-free invoice numbering: one row per financial year (e.g. '2026-27')
CREATE TABLE invoice_counters (
                                  financial_year VARCHAR(7) PRIMARY KEY,
                                  last_number    INTEGER NOT NULL DEFAULT 0
);

-- PAYMENTS
CREATE TABLE payments (
                          id           BIGSERIAL PRIMARY KEY,
                          invoice_id   BIGINT REFERENCES invoices(id),    -- NULL = general payment against ledger
                          customer_id  BIGINT REFERENCES customers(id),
                          amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
                          method       VARCHAR(10)   NOT NULL CHECK (method IN ('CASH', 'UPI', 'CARD', 'BANK')),
                          reference    VARCHAR(100),
                          payment_date DATE          NOT NULL,
                          notes        VARCHAR(255),
                          created_by   BIGINT REFERENCES users(id),
                          created_at   TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_customer ON payments (customer_id);

-- STOCK MOVEMENTS (audit trail of every stock change)
CREATE TABLE stock_movements (
                                 id             BIGSERIAL PRIMARY KEY,
                                 product_id     BIGINT      NOT NULL REFERENCES products(id),
                                 movement_type  VARCHAR(20) NOT NULL
                                     CHECK (movement_type IN ('PURCHASE', 'SALE', 'SALE_CANCEL', 'ADJUSTMENT', 'RETURN')),
                                 quantity_change INTEGER    NOT NULL,          -- positive = in, negative = out
                                 balance_after  INTEGER     NOT NULL,
                                 reference_type VARCHAR(20),                   -- 'INVOICE', 'PURCHASE', ...
                                 reference_id   BIGINT,
                                 note           VARCHAR(255),
                                 created_by     BIGINT REFERENCES users(id),
                                 created_at     TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_stock_movements_product ON stock_movements (product_id);

-- SHOP SETTINGS (single row, used on invoice header)
CREATE TABLE shop_settings (
                               id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
                               shop_name   VARCHAR(150) NOT NULL,
                               address     TEXT,
                               phone       VARCHAR(20),
                               gstin       VARCHAR(15),
                               state_code  VARCHAR(2)   NOT NULL,
                               invoice_prefix VARCHAR(10) NOT NULL DEFAULT 'INV'
);

INSERT INTO shop_settings (shop_name, state_code) VALUES ('My Auto Spares', '33');
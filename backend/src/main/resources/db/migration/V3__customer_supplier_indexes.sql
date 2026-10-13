-- One customer / supplier per GSTIN (blank GSTINs are allowed many times)
CREATE UNIQUE INDEX uq_customers_gstin ON customers (gstin) WHERE gstin IS NOT NULL;
CREATE UNIQUE INDEX uq_suppliers_gstin ON suppliers (gstin) WHERE gstin IS NOT NULL;

-- Fast "contains" search on names (pg_trgm was enabled in V2)
CREATE INDEX idx_customers_name_trgm ON customers USING gin (LOWER(name) gin_trgm_ops);
CREATE INDEX idx_suppliers_name_trgm ON suppliers USING gin (LOWER(name) gin_trgm_ops);
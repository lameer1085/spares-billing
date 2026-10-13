-- Fast "contains" search on part number, name and vehicle compatibility
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_products_part_number_trgm ON products USING gin (LOWER(part_number) gin_trgm_ops);
CREATE INDEX idx_products_name_trgm ON products USING gin (LOWER(name) gin_trgm_ops);
CREATE INDEX idx_products_vehicle_trgm ON products USING gin (LOWER(vehicle_compatibility) gin_trgm_ops);

-- Same part number + same brand cannot exist twice (case-insensitive)
CREATE UNIQUE INDEX uq_products_part_brand ON products (LOWER(part_number), COALESCE(brand_id, 0));
ALTER TABLE products ADD COLUMN list_price NUMERIC(12,2);

-- existing parts: work the list price back from the selling price (before GST)
UPDATE products SET list_price = ROUND(selling_price * 100 / (100 + gst_rate), 2);
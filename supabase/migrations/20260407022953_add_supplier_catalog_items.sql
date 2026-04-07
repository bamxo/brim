CREATE TABLE supplier_catalog_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  unit_cost NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (shop_id, supplier_id, name)
);

ALTER TABLE supplier_catalog_items ENABLE ROW LEVEL SECURITY;

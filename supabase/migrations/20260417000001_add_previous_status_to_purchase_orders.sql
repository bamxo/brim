ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS previous_status TEXT;

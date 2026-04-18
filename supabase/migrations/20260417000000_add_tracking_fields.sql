-- Tracking number + carrier on purchase orders, and detected values on supplier replies

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS tracking_carrier TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number_confidence TEXT;

ALTER TABLE supplier_replies
  ADD COLUMN IF NOT EXISTS detected_tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS detected_tracking_carrier TEXT,
  ADD COLUMN IF NOT EXISTS detected_tracking_confidence TEXT;

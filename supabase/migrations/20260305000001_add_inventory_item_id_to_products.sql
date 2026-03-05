-- Add the Shopify inventory item ID to products so we can match
-- inventory_levels/update webhook payloads to our product rows.
alter table products
  add column if not exists shopify_inventory_item_id varchar;

create index if not exists idx_products_inventory_item
  on products(shopify_inventory_item_id);

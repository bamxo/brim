-- Human-readable view of reorder_rules for debugging in the Supabase dashboard.
-- Shows product names, SKUs, supplier names and rule status instead of raw UUIDs.
create or replace view reorder_rules_view as
select
  rr.id,
  rr.shop_id,
  p.title                                         as product_name,
  p.variant_title,
  p.sku,
  p.current_stock,
  ps.name                                         as primary_supplier,
  bs.name                                         as backup_supplier,
  rr.reorder_point,
  rr.reorder_quantity,
  rr.unit_cost,
  rr.is_active,
  rr.created_at,
  rr.updated_at
from reorder_rules rr
left join products  p  on p.id  = rr.product_id
left join suppliers ps on ps.id = rr.primary_supplier_id
left join suppliers bs on bs.id = rr.backup_supplier_id
order by ps.name, p.title;

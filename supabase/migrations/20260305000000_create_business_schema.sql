-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists moddatetime;


-- ============================================================
-- SHOPS
-- ============================================================
create table shops (
  id                    uuid primary key default gen_random_uuid(),
  shopify_domain        varchar unique not null,
  shopify_access_token  varchar not null,
  email                 varchar,
  shop_name             varchar,
  currency              varchar default 'USD',
  timezone              varchar,
  is_active             boolean default true,
  installed_at          timestamp,
  uninstalled_at        timestamp,
  created_at            timestamp default now()
);


-- ============================================================
-- SUPPLIERS
-- ============================================================
create table suppliers (
  id                  uuid primary key default gen_random_uuid(),
  shop_id             uuid references shops(id) on delete cascade,
  name                varchar not null,
  email               varchar not null,
  phone               varchar,
  notes               text,
  default_location_id varchar,
  lead_time_days      integer,
  is_active           boolean default true,
  created_at          timestamp default now(),
  updated_at          timestamp default now()
);

create trigger handle_updated_at_suppliers
  before update on suppliers
  for each row execute procedure moddatetime(updated_at);


-- ============================================================
-- PRODUCTS
-- ============================================================
create table products (
  id                  uuid primary key default gen_random_uuid(),
  shop_id             uuid references shops(id) on delete cascade,
  shopify_product_id  varchar not null,
  shopify_variant_id  varchar not null,
  title               varchar not null,
  variant_title       varchar,
  sku                 varchar,
  current_stock       integer default 0,
  is_active           boolean default true,
  last_synced_at      timestamp,
  created_at          timestamp default now(),
  updated_at          timestamp default now(),
  unique(shop_id, shopify_variant_id)
);

create trigger handle_updated_at_products
  before update on products
  for each row execute procedure moddatetime(updated_at);


-- ============================================================
-- REORDER RULES
-- ============================================================
create table reorder_rules (
  id                  uuid primary key default gen_random_uuid(),
  shop_id             uuid references shops(id) on delete cascade,
  product_id          uuid references products(id) on delete cascade,
  primary_supplier_id uuid references suppliers(id),
  backup_supplier_id  uuid references suppliers(id),
  reorder_point       integer not null,
  reorder_quantity    integer not null,
  unit_cost           decimal(10,2),
  is_active           boolean default true,
  created_at          timestamp default now(),
  updated_at          timestamp default now(),
  unique(shop_id, product_id)
);

create trigger handle_updated_at_reorder_rules
  before update on reorder_rules
  for each row execute procedure moddatetime(updated_at);


-- ============================================================
-- PURCHASE ORDERS
-- ============================================================
create table purchase_orders (
  id                        uuid primary key default gen_random_uuid(),
  shop_id                   uuid references shops(id) on delete cascade,
  supplier_id               uuid references suppliers(id),
  po_number                 varchar not null,
  -- status: draft, sent, supplier_replied, confirmed,
  --         in_transit, partially_received, received,
  --         overdue, dismissed, send_failed, cancelled
  status                    varchar not null default 'draft',
  -- send_method: brim, gmail, clipboard
  send_method               varchar,
  currency                  varchar not null default 'USD',
  reply_to_address          varchar unique,
  requested_delivery_date   date,
  confirmed_delivery_date   date,
  actual_delivery_date      date,
  sent_at                   timestamp,
  confirmed_at              timestamp,
  dismissed_at              timestamp,
  is_urgent                 boolean default false,
  notes                     text,
  total_amount              decimal(10,2) default 0,
  created_at                timestamp default now(),
  updated_at                timestamp default now(),
  unique(shop_id, po_number)
);

create trigger handle_updated_at_purchase_orders
  before update on purchase_orders
  for each row execute procedure moddatetime(updated_at);


-- ============================================================
-- PURCHASE ORDER LINE ITEMS
-- ============================================================
create table purchase_order_line_items (
  id                       uuid primary key default gen_random_uuid(),
  purchase_order_id        uuid references purchase_orders(id) on delete cascade,
  product_id               uuid references products(id),
  shopify_variant_id       varchar not null,
  sku                      varchar,
  product_name             varchar not null,
  variant_title            varchar,
  quantity_ordered         integer not null,
  quantity_confirmed       integer,
  quantity_received        integer default 0,
  unit_cost                decimal(10,2),
  line_total               decimal(10,2),
  -- status: pending, confirmed, partially_received, received, unavailable
  status                   varchar default 'pending',
  created_at               timestamp default now(),
  updated_at               timestamp default now()
);

create trigger handle_updated_at_po_line_items
  before update on purchase_order_line_items
  for each row execute procedure moddatetime(updated_at);


-- ============================================================
-- DELIVERY RECORDS
-- ============================================================
create table delivery_records (
  id                uuid primary key default gen_random_uuid(),
  purchase_order_id uuid references purchase_orders(id) on delete cascade,
  recorded_at       timestamp not null,
  notes             text,
  created_at        timestamp default now()
);


-- ============================================================
-- DELIVERY RECORD ITEMS
-- ============================================================
create table delivery_record_items (
  id                          uuid primary key default gen_random_uuid(),
  delivery_record_id          uuid references delivery_records(id) on delete cascade,
  purchase_order_line_item_id uuid references purchase_order_line_items(id),
  quantity_received           integer not null,
  is_correct_item             boolean default true,
  dispute_notes               text,
  created_at                  timestamp default now()
);


-- ============================================================
-- SUPPLIER REPLIES
-- ============================================================
create table supplier_replies (
  id                          uuid primary key default gen_random_uuid(),
  purchase_order_id           uuid references purchase_orders(id) on delete cascade,
  from_email                  varchar not null,
  subject                     varchar,
  body_text                   text not null,
  raw_payload                 jsonb,
  detected_date               date,
  -- detected_date_confidence: high, medium, low, none
  detected_date_confidence    varchar,
  date_confirmed_by_merchant  boolean default false,
  received_at                 timestamp not null,
  created_at                  timestamp default now()
);


-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table notifications (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid references shops(id) on delete cascade,
  purchase_order_id uuid references purchase_orders(id),
  -- type: reorder_triggered, product_added_to_draft, supplier_replied,
  --       email_bounced, critically_low_in_transit, delivery_reminder,
  --       po_overdue, send_method_default_prompt
  type              varchar not null,
  title             varchar not null,
  body              text not null,
  action_url        varchar,
  is_read           boolean default false,
  is_dismissed      boolean default false,
  sent_via          varchar[],
  read_at           timestamp,
  created_at        timestamp default now()
);


-- ============================================================
-- SHOP SETTINGS
-- ============================================================
create table shop_settings (
  id                              uuid primary key default gen_random_uuid(),
  shop_id                         uuid references shops(id) on delete cascade unique,
  -- notification_channel: shopify, email, both
  notification_channel            varchar default 'email',
  -- default_send_method: brim, gmail, ask
  default_send_method             varchar default 'ask',
  send_method_brim_count          integer default 0,
  send_method_gmail_count         integer default 0,
  send_method_clipboard_count     integer default 0,
  send_method_prompt_shown        boolean default false,
  po_template                     text,
  po_subject_template             varchar,
  -- fraction of reorder_point at which a critical-low alert fires
  critical_stock_threshold        decimal default 0.5,
  supplier_chase_days             integer default 3,
  delivery_reminder_days_before   integer default 1,
  created_at                      timestamp default now(),
  updated_at                      timestamp default now()
);

create trigger handle_updated_at_shop_settings
  before update on shop_settings
  for each row execute procedure moddatetime(updated_at);


-- ============================================================
-- INVENTORY TRIGGER LOG
-- ============================================================
create table inventory_trigger_log (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid references shops(id) on delete cascade,
  product_id        uuid references products(id),
  triggered_at      timestamp not null,
  stock_at_trigger  integer not null,
  reorder_point     integer not null,
  -- action_taken: draft_po_created, added_to_existing_po,
  --               suppressed_po_in_transit, suppressed_draft_exists,
  --               suppressed_product_inactive, critical_low_alert_sent
  action_taken      varchar,
  purchase_order_id uuid references purchase_orders(id),
  created_at        timestamp default now()
);


-- ============================================================
-- ONBOARDING
-- ============================================================
create table onboarding (
  id                       uuid primary key default gen_random_uuid(),
  shop_id                  uuid references shops(id) on delete cascade unique,
  step_supplier_added      boolean default false,
  step_product_configured  boolean default false,
  step_notification_set    boolean default false,
  completed_at             timestamp,
  created_at               timestamp default now()
);


-- ============================================================
-- INDEXES
-- ============================================================

-- Suppliers
create index idx_suppliers_shop          on suppliers(shop_id);
create index idx_suppliers_shop_active   on suppliers(shop_id, is_active);

-- Products
create index idx_products_shop           on products(shop_id);
create index idx_products_variant        on products(shopify_variant_id);
create index idx_products_shop_active    on products(shop_id, is_active);

-- Reorder rules
create index idx_reorder_rules_product       on reorder_rules(product_id);
create index idx_reorder_rules_shop_active   on reorder_rules(shop_id, is_active);

-- Purchase orders
create index idx_pos_shop           on purchase_orders(shop_id);
create index idx_pos_supplier       on purchase_orders(supplier_id);
create index idx_pos_status         on purchase_orders(status);
create index idx_pos_reply_to       on purchase_orders(reply_to_address);
create index idx_pos_shop_status    on purchase_orders(shop_id, status);

-- Purchase order line items
create index idx_po_lines_po        on purchase_order_line_items(purchase_order_id);

-- Delivery records
create index idx_delivery_records_po    on delivery_records(purchase_order_id);

-- Supplier replies
create index idx_supplier_replies_po    on supplier_replies(purchase_order_id);

-- Notifications
create index idx_notifications_shop         on notifications(shop_id);
create index idx_notifications_shop_unread  on notifications(shop_id, is_read);

-- Inventory trigger log
create index idx_trigger_log_shop       on inventory_trigger_log(shop_id);
create index idx_trigger_log_product    on inventory_trigger_log(product_id);


-- ============================================================
-- ROW LEVEL SECURITY
-- (Service role key bypasses RLS — policies to be added before
--  any client-side or anon key usage)
-- ============================================================
alter table shops                    enable row level security;
alter table suppliers                enable row level security;
alter table products                 enable row level security;
alter table reorder_rules            enable row level security;
alter table purchase_orders          enable row level security;
alter table purchase_order_line_items enable row level security;
alter table delivery_records         enable row level security;
alter table delivery_record_items    enable row level security;
alter table supplier_replies         enable row level security;
alter table notifications            enable row level security;
alter table shop_settings            enable row level security;
alter table inventory_trigger_log    enable row level security;
alter table onboarding               enable row level security;

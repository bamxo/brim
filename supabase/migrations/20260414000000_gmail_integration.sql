-- Gmail integration: OAuth account per shop + Gmail thread link on POs

CREATE TABLE IF NOT EXISTS shop_google_accounts (
  shop_id UUID PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  google_email VARCHAR NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  gmail_history_id VARCHAR,
  watch_expires_at TIMESTAMPTZ,
  is_disconnected BOOLEAN NOT NULL DEFAULT FALSE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shop_google_accounts_google_email_idx
  ON shop_google_accounts (google_email);

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS gmail_thread_id VARCHAR,
  ADD COLUMN IF NOT EXISTS gmail_message_id VARCHAR,
  ADD COLUMN IF NOT EXISTS gmail_account_email VARCHAR;

CREATE INDEX IF NOT EXISTS purchase_orders_gmail_thread_id_idx
  ON purchase_orders (gmail_thread_id);

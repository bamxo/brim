ALTER TABLE shop_settings
  ADD COLUMN reorder_behavior varchar DEFAULT 'ask_every_time';

COMMENT ON COLUMN shop_settings.reorder_behavior IS 'ask_every_time | auto_create | auto_send';

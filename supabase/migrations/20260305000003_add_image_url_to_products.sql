-- Add image URL column to products so we can display product thumbnails
-- in the app UI. Populated on next sync from Shopify featuredMedia.
alter table products
  add column if not exists image_url varchar;

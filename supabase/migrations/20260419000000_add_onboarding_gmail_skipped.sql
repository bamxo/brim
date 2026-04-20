alter table shops
  add column if not exists onboarding_gmail_skipped boolean not null default false;

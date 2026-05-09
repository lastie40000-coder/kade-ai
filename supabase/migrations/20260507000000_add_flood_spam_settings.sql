alter table public.bots
  add column if not exists anti_flood_enabled boolean not null default false,
  add column if not exists anti_spam_enabled boolean not null default false,
  add column if not exists flood_sensitivity integer not null default 5;

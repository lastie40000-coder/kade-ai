-- Link Telegram identity to web profile for KADE system bot
alter table public.profiles add column if not exists telegram_user_id bigint unique;
alter table public.profiles add column if not exists telegram_username text;

-- One-time linking codes generated on the web, redeemed via /start in Telegram
create table if not exists public.telegram_link_codes (
  code text primary key,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  used_at timestamptz
);

alter table public.telegram_link_codes enable row level security;

create policy "Users manage own link codes"
on public.telegram_link_codes
for all
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'owner'))
with check (user_id = auth.uid() or public.has_role(auth.uid(), 'owner'));

-- System bot needs its own offset tracking, separate from user bots
create table if not exists public.system_bot_state (
  id int primary key check (id = 1),
  update_offset bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.system_bot_state (id, update_offset)
values (1, 0)
on conflict (id) do nothing;

alter table public.system_bot_state enable row level security;
create policy "Owners read system bot state"
on public.system_bot_state for select
to authenticated
using (public.has_role(auth.uid(), 'owner'));

-- Default new bots to active so they reply immediately
alter table public.bots alter column status set default 'active';

-- openai_api_key column kept for backward compat but no longer required.
-- Realtime: stream messages, bots, profiles to admin dashboard
alter publication supabase_realtime add table public.bot_messages;
alter publication supabase_realtime add table public.bots;
alter publication supabase_realtime add table public.profiles;
alter table public.bot_messages replica identity full;
alter table public.bots replica identity full;
alter table public.profiles replica identity full;
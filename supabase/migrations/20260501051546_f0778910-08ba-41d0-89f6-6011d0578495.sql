-- Personality + Telegram identity for bots
alter table public.bots
  add column if not exists tone text default 'friendly',
  add column if not exists personality text,
  add column if not exists house_rules text,
  add column if not exists welcome_message text,
  add column if not exists banned_words text[] default '{}',
  add column if not exists moderation_enabled boolean not null default true,
  add column if not exists bot_username text,
  add column if not exists bot_telegram_id bigint;

-- Group enrichments for auto-detection + per-group settings
alter table public.telegram_groups
  add column if not exists is_auto boolean not null default false,
  add column if not exists welcome_message text,
  add column if not exists banned_words text[] default '{}',
  add column if not exists moderation_enabled boolean not null default true,
  add column if not exists member_count integer,
  add column if not exists last_seen_at timestamptz;

create unique index if not exists telegram_groups_bot_chat_idx
  on public.telegram_groups (bot_id, telegram_chat_id)
  where telegram_chat_id is not null;

-- Telegram identity cached on profile for Mini App linking
alter table public.profiles
  add column if not exists telegram_first_name text,
  add column if not exists telegram_photo_url text;

-- Moderation log (visible in admin live feed)
create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  bot_id uuid not null,
  owner_id uuid not null,
  group_chat_id text,
  action text not null,
  target_user text,
  target_user_id bigint,
  performed_by text,
  reason text,
  success boolean not null default true,
  details jsonb
);
alter table public.moderation_actions enable row level security;
create policy "Owners view own mod actions"
  on public.moderation_actions for select
  to authenticated
  using ((owner_id = auth.uid()) or has_role(auth.uid(), 'owner'::app_role));
create policy "Service inserts mod actions"
  on public.moderation_actions for insert
  to authenticated
  with check ((owner_id = auth.uid()) or has_role(auth.uid(), 'owner'::app_role));
alter publication supabase_realtime add table public.moderation_actions;
alter table public.moderation_actions replica identity full;

-- Embeddings for RAG
create extension if not exists vector;

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  bot_id uuid not null,
  owner_id uuid not null,
  chunk_index integer not null,
  content text not null,
  embedding vector(768),
  created_at timestamptz not null default now()
);
create index if not exists knowledge_chunks_bot_idx on public.knowledge_chunks (bot_id);
create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
alter table public.knowledge_chunks enable row level security;
create policy "Owners manage own chunks"
  on public.knowledge_chunks for all
  to authenticated
  using ((owner_id = auth.uid()) or has_role(auth.uid(), 'owner'::app_role))
  with check ((owner_id = auth.uid()) or has_role(auth.uid(), 'owner'::app_role));

-- Track indexing status on the source itself
alter table public.knowledge_sources
  add column if not exists indexed_at timestamptz,
  add column if not exists chunk_count integer not null default 0,
  add column if not exists indexing_error text;

-- Top-k similarity search (security definer to keep cosine indexable)
create or replace function public.match_knowledge_chunks(
  _bot_id uuid,
  _query vector(768),
  _match_count int default 5
)
returns table (
  id uuid,
  source_id uuid,
  content text,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.source_id, c.content, 1 - (c.embedding <=> _query) as similarity
  from public.knowledge_chunks c
  where c.bot_id = _bot_id and c.embedding is not null
  order by c.embedding <=> _query
  limit _match_count;
$$;

-- Auto-link Telegram on signup (when a stored link code matches the new user)
-- (no trigger here; the Mini App linking happens via dedicated edge function)
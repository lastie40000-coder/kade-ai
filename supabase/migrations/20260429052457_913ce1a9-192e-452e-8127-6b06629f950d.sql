
-- ============ ROLES ============
create type public.app_role as enum ('owner', 'admin', 'user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Auto-create profile + default role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Profiles policies
create policy "Users view own profile" on public.profiles
  for select to authenticated using (auth.uid() = id or public.has_role(auth.uid(), 'owner'));
create policy "Users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- user_roles policies
create policy "Users view own roles" on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'owner'));
create policy "Owners manage roles" on public.user_roles
  for all to authenticated using (public.has_role(auth.uid(), 'owner')) with check (public.has_role(auth.uid(), 'owner'));

-- ============ BOTS ============
create type public.bot_status as enum ('active', 'paused', 'stopped');

create table public.bots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  telegram_bot_token text,
  openai_api_key text,
  default_instructions text,
  status public.bot_status not null default 'paused',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bots enable row level security;
create trigger bots_set_updated_at before update on public.bots
  for each row execute function public.set_updated_at();

create policy "Owners manage own bots" on public.bots
  for all to authenticated
  using (owner_id = auth.uid() or public.has_role(auth.uid(), 'owner'))
  with check (owner_id = auth.uid() or public.has_role(auth.uid(), 'owner'));

-- ============ TELEGRAM GROUPS ============
create table public.telegram_groups (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  telegram_chat_id text,
  rules text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.telegram_groups enable row level security;
create trigger groups_set_updated_at before update on public.telegram_groups
  for each row execute function public.set_updated_at();

create policy "Owners manage own groups" on public.telegram_groups
  for all to authenticated
  using (owner_id = auth.uid() or public.has_role(auth.uid(), 'owner'))
  with check (owner_id = auth.uid() or public.has_role(auth.uid(), 'owner'));

-- ============ BOT RULES ============
create table public.bot_rules (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid references public.telegram_groups(id) on delete cascade,
  trigger_keyword text,
  instruction text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.bot_rules enable row level security;

create policy "Owners manage own rules" on public.bot_rules
  for all to authenticated
  using (owner_id = auth.uid() or public.has_role(auth.uid(), 'owner'))
  with check (owner_id = auth.uid() or public.has_role(auth.uid(), 'owner'));

-- ============ KNOWLEDGE SOURCES ============
create type public.knowledge_kind as enum ('url', 'text');

create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind public.knowledge_kind not null,
  title text not null,
  content text,
  source_url text,
  created_at timestamptz not null default now()
);
alter table public.knowledge_sources enable row level security;

create policy "Owners manage own knowledge" on public.knowledge_sources
  for all to authenticated
  using (owner_id = auth.uid() or public.has_role(auth.uid(), 'owner'))
  with check (owner_id = auth.uid() or public.has_role(auth.uid(), 'owner'));

-- ============ BOT MESSAGES (log) ============
create type public.message_direction as enum ('inbound', 'outbound');

create table public.bot_messages (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid references public.telegram_groups(id) on delete set null,
  direction public.message_direction not null,
  telegram_user text,
  content text,
  created_at timestamptz not null default now()
);
alter table public.bot_messages enable row level security;

create policy "Owners view own messages" on public.bot_messages
  for select to authenticated
  using (owner_id = auth.uid() or public.has_role(auth.uid(), 'owner'));
create policy "Owners insert own messages" on public.bot_messages
  for insert to authenticated
  with check (owner_id = auth.uid() or public.has_role(auth.uid(), 'owner'));

-- ============ SUBSCRIPTIONS ============
create type public.plan_tier as enum ('free', 'starter', 'pro', 'business');
create type public.sub_status as enum ('active', 'trialing', 'past_due', 'canceled', 'incomplete');

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan public.plan_tier not null default 'free',
  status public.sub_status not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create trigger subs_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create policy "Users view own subscription" on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'owner'));
create policy "Owners manage subscriptions" on public.subscriptions
  for all to authenticated
  using (public.has_role(auth.uid(), 'owner'))
  with check (public.has_role(auth.uid(), 'owner'));


-- Plan limits helper + enforcement triggers, plus rate-limit helpers.

CREATE OR REPLACE FUNCTION public.plan_limits(_plan plan_tier)
RETURNS TABLE(max_bots int, max_groups int, max_monthly_messages int, max_msgs_per_minute int)
LANGUAGE sql IMMUTABLE
AS $$
  SELECT
    CASE _plan
      WHEN 'free'     THEN 1
      WHEN 'starter'  THEN 3
      WHEN 'pro'      THEN 10
      WHEN 'business' THEN 1000000
      ELSE 1
    END,
    CASE _plan
      WHEN 'free'     THEN 1
      WHEN 'starter'  THEN 10
      WHEN 'pro'      THEN 1000000
      WHEN 'business' THEN 1000000
      ELSE 1
    END,
    CASE _plan
      WHEN 'free'     THEN 100
      WHEN 'starter'  THEN 10000
      WHEN 'pro'      THEN 100000
      WHEN 'business' THEN 100000000
      ELSE 100
    END,
    CASE _plan
      WHEN 'free'     THEN 5
      WHEN 'starter'  THEN 20
      WHEN 'pro'      THEN 60
      WHEN 'business' THEN 240
      ELSE 5
    END;
$$;

-- Resolve a user's active plan (defaults to free).
CREATE OR REPLACE FUNCTION public.user_plan(_user_id uuid)
RETURNS plan_tier
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT plan FROM public.subscriptions
      WHERE user_id = _user_id AND status = 'active'
      ORDER BY updated_at DESC LIMIT 1),
    'free'::plan_tier
  );
$$;

-- Enforce bot quota
CREATE OR REPLACE FUNCTION public.enforce_bot_quota()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cap int;
  cnt int;
BEGIN
  -- Owners (admins) bypass quotas.
  IF public.has_role(NEW.owner_id, 'owner') THEN
    RETURN NEW;
  END IF;

  SELECT max_bots INTO cap FROM public.plan_limits(public.user_plan(NEW.owner_id));
  SELECT count(*) INTO cnt FROM public.bots WHERE owner_id = NEW.owner_id;
  IF cnt >= cap THEN
    RAISE EXCEPTION 'PLAN_LIMIT_BOTS: Your plan allows up to % bot(s). Upgrade to add more.', cap
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_bot_quota ON public.bots;
CREATE TRIGGER trg_enforce_bot_quota
  BEFORE INSERT ON public.bots
  FOR EACH ROW EXECUTE FUNCTION public.enforce_bot_quota();

-- Enforce group quota
CREATE OR REPLACE FUNCTION public.enforce_group_quota()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cap int;
  cnt int;
BEGIN
  IF public.has_role(NEW.owner_id, 'owner') THEN
    RETURN NEW;
  END IF;

  SELECT max_groups INTO cap FROM public.plan_limits(public.user_plan(NEW.owner_id));
  SELECT count(*) INTO cnt FROM public.telegram_groups WHERE owner_id = NEW.owner_id;
  IF cnt >= cap THEN
    RAISE EXCEPTION 'PLAN_LIMIT_GROUPS: Your plan allows up to % group(s). Upgrade for more.', cap
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_group_quota ON public.telegram_groups;
CREATE TRIGGER trg_enforce_group_quota
  BEFORE INSERT ON public.telegram_groups
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_quota();

-- Indexes for fast monthly + per-minute counts used by the bot.
CREATE INDEX IF NOT EXISTS idx_bot_messages_owner_created
  ON public.bot_messages (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_messages_user_recent
  ON public.bot_messages (bot_id, telegram_user, created_at DESC);

-- Helper for the edge function: returns current usage + caps for a bot's owner.
CREATE OR REPLACE FUNCTION public.bot_usage_status(_bot_id uuid)
RETURNS TABLE(
  plan plan_tier,
  monthly_messages int,
  max_monthly_messages int,
  max_msgs_per_minute int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH b AS (SELECT owner_id FROM public.bots WHERE id = _bot_id),
       p AS (SELECT public.user_plan((SELECT owner_id FROM b)) AS plan),
       l AS (SELECT * FROM public.plan_limits((SELECT plan FROM p))),
       m AS (
         SELECT count(*)::int AS c
         FROM public.bot_messages
         WHERE owner_id = (SELECT owner_id FROM b)
           AND direction = 'inbound'
           AND created_at >= date_trunc('month', now())
       )
  SELECT (SELECT plan FROM p), (SELECT c FROM m),
         (SELECT max_monthly_messages FROM l),
         (SELECT max_msgs_per_minute FROM l);
$$;

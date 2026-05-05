CREATE OR REPLACE FUNCTION public.can_create_bot(_user_id uuid)
RETURNS TABLE(plan plan_tier, current_bots integer, max_bots integer, allowed boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH p AS (
    SELECT public.user_plan(_user_id) AS plan
  ),
  l AS (
    SELECT max_bots FROM public.plan_limits((SELECT plan FROM p))
  ),
  b AS (
    SELECT count(*)::int AS current_bots
    FROM public.bots
    WHERE owner_id = _user_id
  )
  SELECT
    (SELECT plan FROM p),
    (SELECT current_bots FROM b),
    (SELECT max_bots FROM l),
    public.has_role(_user_id, 'owner'::app_role) OR (SELECT current_bots FROM b) < (SELECT max_bots FROM l);
$$;

CREATE OR REPLACE FUNCTION public.enforce_bot_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  quota record;
BEGIN
  SELECT * INTO quota FROM public.can_create_bot(NEW.owner_id);

  IF quota.allowed THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'PLAN_LIMIT_BOTS: Your % plan allows up to % bot(s). Upgrade to add more.', quota.plan, quota.max_bots
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_bot_quota ON public.bots;
CREATE TRIGGER trg_enforce_bot_quota
  BEFORE INSERT ON public.bots
  FOR EACH ROW EXECUTE FUNCTION public.enforce_bot_quota();
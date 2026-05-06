CREATE OR REPLACE FUNCTION public.my_workspace_usage()
RETURNS TABLE(
  plan plan_tier,
  current_bots integer,
  max_bots integer,
  monthly_messages integer,
  max_monthly_messages integer,
  max_msgs_per_minute integer,
  period_start timestamptz,
  period_end timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH p AS (SELECT public.user_plan(auth.uid()) AS plan),
       l AS (SELECT * FROM public.plan_limits((SELECT plan FROM p))),
       b AS (SELECT count(*)::int AS c FROM public.bots WHERE owner_id = auth.uid()),
       m AS (
         SELECT count(*)::int AS c
         FROM public.bot_messages
         WHERE owner_id = auth.uid()
           AND direction = 'inbound'
           AND created_at >= date_trunc('month', now())
       )
  SELECT
    (SELECT plan FROM p),
    (SELECT c FROM b),
    (SELECT max_bots FROM l),
    (SELECT c FROM m),
    (SELECT max_monthly_messages FROM l),
    (SELECT max_msgs_per_minute FROM l),
    date_trunc('month', now()),
    (date_trunc('month', now()) + interval '1 month')
  WHERE auth.uid() IS NOT NULL;
$$;
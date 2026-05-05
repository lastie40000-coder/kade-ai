REVOKE ALL ON FUNCTION public.can_create_bot(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_create_bot(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.my_bot_quota()
RETURNS TABLE(plan plan_tier, current_bots integer, max_bots integer, allowed boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.can_create_bot(auth.uid())
  WHERE auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.my_bot_quota() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_bot_quota() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_bot_quota() TO authenticated;
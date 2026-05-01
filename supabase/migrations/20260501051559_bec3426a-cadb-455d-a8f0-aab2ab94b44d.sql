-- Restrict execute on the RAG match function to service role only.
-- (User app calls it via the edge function which uses the service role.)
revoke execute on function public.match_knowledge_chunks(uuid, vector, int) from public;
revoke execute on function public.match_knowledge_chunks(uuid, vector, int) from anon;
revoke execute on function public.match_knowledge_chunks(uuid, vector, int) from authenticated;

-- Tighten previously-existing definer helpers that don't need broad EXECUTE.
revoke execute on function public.has_role(uuid, app_role) from public;
revoke execute on function public.has_role(uuid, app_role) from anon;
-- authenticated still needs it for RLS — leave that grant intact.

-- Move pgvector out of public to satisfy the "extension in public" warning.
create schema if not exists extensions;
alter extension vector set schema extensions;
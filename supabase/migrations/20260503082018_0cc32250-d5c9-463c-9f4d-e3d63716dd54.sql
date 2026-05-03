
-- Grant owner role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner'::app_role FROM auth.users WHERE email = 'johnwanderi202@outlook.com'
ON CONFLICT DO NOTHING;

-- Full-text search column
ALTER TABLE public.knowledge_chunks
  ADD COLUMN IF NOT EXISTS content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

CREATE INDEX IF NOT EXISTS knowledge_chunks_tsv_idx
  ON public.knowledge_chunks USING GIN (content_tsv);

CREATE INDEX IF NOT EXISTS knowledge_chunks_bot_idx
  ON public.knowledge_chunks (bot_id);

-- Lexical RAG (replaces embedding-based search)
DROP FUNCTION IF EXISTS public.match_knowledge_chunks(uuid, extensions.vector, integer);

CREATE OR REPLACE FUNCTION public.match_knowledge_chunks_text(
  _bot_id uuid, _query text, _match_count integer DEFAULT 5
)
RETURNS TABLE(id uuid, source_id uuid, content text, similarity double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH q AS (
    SELECT plainto_tsquery('english', coalesce(_query, '')) AS tsq
  )
  SELECT c.id, c.source_id, c.content,
         ts_rank(c.content_tsv, q.tsq)::double precision AS similarity
  FROM public.knowledge_chunks c, q
  WHERE c.bot_id = _bot_id
    AND (q.tsq = ''::tsquery OR c.content_tsv @@ q.tsq)
  ORDER BY similarity DESC NULLS LAST, c.chunk_index ASC
  LIMIT _match_count;
$$;

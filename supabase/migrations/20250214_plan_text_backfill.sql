CREATE OR REPLACE FUNCTION find_plans_missing_text_chunks(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  plan_id UUID,
  plan_title TEXT,
  file_path TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS plan_id,
    COALESCE(p.title, p.file_name) AS plan_title,
    p.file_path
  FROM plans p
  LEFT JOIN (
    SELECT DISTINCT plan_id
    FROM plan_text_chunks
  ) ptc ON ptc.plan_id = p.id
  WHERE ptc.plan_id IS NULL
    AND p.file_path IS NOT NULL
  ORDER BY p.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 1), 1);
$$;

COMMENT ON FUNCTION find_plans_missing_text_chunks IS
  'Returns plans that do not yet have ingested plan_text_chunks so they can be backfilled.';


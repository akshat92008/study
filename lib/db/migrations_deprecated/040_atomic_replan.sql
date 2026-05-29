-- lib/db/migrations/040_atomic_replan.sql

CREATE OR REPLACE FUNCTION atomic_replan(
  p_user_id UUID,
  p_scheduled_date TIMESTAMPTZ,
  p_tasks JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Both operations are inside one transaction automatically
  DELETE FROM study_tasks
  WHERE user_id = p_user_id
    AND scheduled_date = p_scheduled_date;

  IF jsonb_array_length(p_tasks) > 0 THEN
    INSERT INTO study_tasks (
      user_id, scheduled_date, type, title,
      description, estimated_minutes, priority,
      subject, chapter, notes
    )
    SELECT
      p_user_id,
      p_scheduled_date,
      (t->>'type')::task_type,
      (t->>'title')::text,
      (t->>'description')::text,
      (t->>'estimated_minutes')::int,
      (t->>'priority')::task_priority,
      (t->>'subject')::text,
      (t->>'chapter')::text,
      (t->>'notes')::text
    FROM jsonb_array_elements(p_tasks) AS t;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION atomic_replan TO authenticated;

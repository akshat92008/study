-- supabase/migrations/20260529000011_incremental_learner_states.sql

CREATE OR REPLACE FUNCTION update_learner_state_incrementally(
    p_user_id UUID,
    p_confidence_delta NUMERIC,
    p_retention_delta NUMERIC,
    p_velocity_delta INT
) RETURNS void AS $$
BEGIN
    INSERT INTO public.learner_states (
        user_id,
        overall_confidence,
        estimated_retention,
        weekly_velocity,
        updated_at
    )
    VALUES (
        p_user_id,
        GREATEST(0.0, LEAST(1.0, 0.5 + p_confidence_delta)),
        GREATEST(0.0, LEAST(1.0, 0.5 + p_retention_delta)),
        GREATEST(0, p_velocity_delta),
        now()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
        overall_confidence = GREATEST(0.0, LEAST(1.0, learner_states.overall_confidence + p_confidence_delta)),
        estimated_retention = GREATEST(0.0, LEAST(1.0, learner_states.estimated_retention + p_retention_delta)),
        weekly_velocity = GREATEST(0, learner_states.weekly_velocity + p_velocity_delta),
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE TYPE "public"."confidence_level" AS ENUM (
    'very_low',
    'low',
    'medium',
    'high',
    'very_high'
);


ALTER TYPE "public"."confidence_level" OWNER TO "postgres";


CREATE TYPE "public"."consumer_lock_status" AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'RETRY_SCHEDULED',
    'DLQ'
);


ALTER TYPE "public"."consumer_lock_status" OWNER TO "postgres";


CREATE TYPE "public"."emotional_state" AS ENUM (
    'focused',
    'motivated',
    'stressed',
    'burnt_out',
    'anxious',
    'frustrated',
    'confident',
    'overwhelmed',
    'bored',
    'neutral'
);


ALTER TYPE "public"."emotional_state" OWNER TO "postgres";


CREATE TYPE "public"."event_status" AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'DLQ',
    'PARTIAL_FAILED'
);


ALTER TYPE "public"."event_status" OWNER TO "postgres";


CREATE TYPE "public"."mastery_level" AS ENUM (
    'not_started',
    'exposed',
    'developing',
    'proficient',
    'mastered',
    'automated'
);


ALTER TYPE "public"."mastery_level" OWNER TO "postgres";


CREATE TYPE "public"."memory_type" AS ENUM (
    'victory',
    'struggle',
    'turning_point',
    'behavioral_quirk'
);


ALTER TYPE "public"."memory_type" OWNER TO "postgres";


CREATE TYPE "public"."mistake_category" AS ENUM (
    'conceptual',
    'calculation',
    'silly',
    'time_pressure',
    'misread',
    'incomplete_knowledge',
    'overconfidence',
    'anxiety',
    'recall_failure',
    'calculation_error',
    'unknown'
);


ALTER TYPE "public"."mistake_category" OWNER TO "postgres";


CREATE TYPE "public"."task_priority" AS ENUM (
    'critical',
    'high',
    'medium',
    'low'
);


ALTER TYPE "public"."task_priority" OWNER TO "postgres";


CREATE TYPE "public"."task_type" AS ENUM (
    'study',
    'revision',
    'practice',
    'mock_test',
    'break',
    'review'
);


ALTER TYPE "public"."task_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."acquire_event_leases"("p_worker_id" "text", "p_limit" integer, "p_lease_timeout" interval) RETURNS TABLE("lock_id" "uuid", "event_id" "uuid", "consumer_name" "text", "event_type" "text", "event_payload" "jsonb", "event_metadata" "jsonb", "user_id" "uuid", "retry_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return query
  with available_locks as (
    select cl.id
    from public.consumer_locks cl
    where (
        (cl.status in ('PENDING', 'RETRY_SCHEDULED') and coalesce(cl.next_attempt_at, cl.next_retry_at, now()) <= now())
        or
        (cl.status = 'PROCESSING' and cl.lease_expires_at is not null and cl.lease_expires_at < now())
      )
      and cl.retry_count < 3
    order by cl.created_at asc
    limit p_limit
    for update skip locked
  ),
  updated_locks as (
    update public.consumer_locks cl
    set
      status = 'PROCESSING',
      worker_id = p_worker_id,
      locked_by = p_worker_id,
      locked_at = now(),
      lease_expires_at = now() + p_lease_timeout,
      updated_at = now()
    from available_locks al
    where cl.id = al.id
    returning cl.id, cl.event_id, cl.consumer_name, cl.retry_count
  ),
  touched_events as (
    update public.event_queue eq
    set
      status = 'PROCESSING',
      locked_by = p_worker_id,
      locked_at = now(),
      updated_at = now()
    from updated_locks ul
    where eq.id = ul.event_id
    returning eq.id
  )
  select
    ul.id,
    ul.event_id,
    ul.consumer_name,
    eq.type,
    eq.payload,
    eq.metadata,
    eq.user_id,
    ul.retry_count
  from updated_locks ul
  join public.event_queue eq on eq.id = ul.event_id;
end;
$$;


ALTER FUNCTION "public"."acquire_event_leases"("p_worker_id" "text", "p_limit" integer, "p_lease_timeout" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atomic_ai_budget_spend"("p_user_id" "uuid", "p_feature" "text", "p_model" "text", "p_cost" numeric, "p_prompt_tokens" integer, "p_completion_tokens" integer, "p_route" "text", "p_daily_limit_usd" numeric DEFAULT 0.25) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_usage public.ai_usage_daily%rowtype;
  v_cost numeric := greatest(coalesce(p_cost, 0), 0);
  v_prompt int := greatest(coalesce(p_prompt_tokens, 0), 0);
  v_completion int := greatest(coalesce(p_completion_tokens, 0), 0);
  v_total int := v_prompt + v_completion;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'unauthorized';
  end if;

  insert into public.ai_usage_daily(user_id, usage_date)
  values (p_user_id, current_date)
  on conflict (user_id, usage_date) do nothing;

  select * into v_usage
  from public.ai_usage_daily
  where user_id = p_user_id and usage_date = current_date
  for update;

  if coalesce(v_usage.estimated_cost, 0) + v_cost > p_daily_limit_usd then
    update public.ai_usage_daily
    set budget_exceeded_count = coalesce(budget_exceeded_count, 0) + 1,
        updated_at = now()
    where id = v_usage.id;
    raise exception 'AI_DAILY_BUDGET_EXCEEDED';
  end if;

  insert into public.ai_usage_events (
    user_id,
    usage_date,
    feature,
    model,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    estimated_cost,
    route,
    metadata
  ) values (
    p_user_id,
    current_date,
    p_feature,
    p_model,
    v_prompt,
    v_completion,
    v_total,
    v_cost,
    p_route,
    jsonb_build_object('type', 'atomic_spend')
  );

  update public.ai_usage_daily
  set estimated_cost = coalesce(estimated_cost, 0) + v_cost,
      estimated_tokens = coalesce(estimated_tokens, 0) + v_total,
      updated_at = now()
  where id = v_usage.id;

end;
$$;


ALTER FUNCTION "public"."atomic_ai_budget_spend"("p_user_id" "uuid", "p_feature" "text", "p_model" "text", "p_cost" numeric, "p_prompt_tokens" integer, "p_completion_tokens" integer, "p_route" "text", "p_daily_limit_usd" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atomic_replan"("p_user_id" "uuid", "p_scheduled_date" timestamp with time zone, "p_tasks" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."atomic_replan"("p_user_id" "uuid", "p_scheduled_date" timestamp with time zone, "p_tasks" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_and_increment_usage_gate"("p_user_id" "uuid", "p_gate" "text", "p_limit" integer, "p_amount" integer DEFAULT 1) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_usage public.ai_usage_daily%rowtype;
  v_amount int := greatest(1, coalesce(p_amount, 1));
  v_used int;
begin
  if p_gate not in ('chat_messages', 'tutor_messages', 'autopsy_uploads', 'ai_calls') then
    raise exception 'UNKNOWN_USAGE_GATE:%', p_gate;
  end if;

  insert into public.ai_usage_daily(user_id, usage_date)
  values (p_user_id, current_date)
  on conflict (user_id, usage_date) do nothing;

  select * into v_usage
  from public.ai_usage_daily
  where user_id = p_user_id and usage_date = current_date
  for update;

  v_used := case p_gate
    when 'chat_messages' then coalesce(v_usage.chat_messages, 0)
    when 'tutor_messages' then coalesce(v_usage.tutor_messages, 0)
    when 'autopsy_uploads' then coalesce(v_usage.autopsy_uploads, 0)
    when 'ai_calls' then coalesce(v_usage.ai_calls, 0)
  end;

  if v_used + v_amount > p_limit then
    return jsonb_build_object(
      'allowed', false,
      'used', v_used,
      'remaining', greatest(0, p_limit - v_used),
      'limit', p_limit
    );
  end if;

  update public.ai_usage_daily
  set
    chat_messages = case when p_gate = 'chat_messages' then chat_messages + v_amount else chat_messages end,
    tutor_messages = case when p_gate = 'tutor_messages' then tutor_messages + v_amount else tutor_messages end,
    autopsy_uploads = case when p_gate = 'autopsy_uploads' then autopsy_uploads + v_amount else autopsy_uploads end,
    ai_calls = case when p_gate = 'ai_calls' then ai_calls + v_amount else ai_calls end,
    updated_at = now()
  where id = v_usage.id;

  return jsonb_build_object(
    'allowed', true,
    'used', v_used + v_amount,
    'remaining', greatest(0, p_limit - v_used - v_amount),
    'limit', p_limit
  );
end;
$$;


ALTER FUNCTION "public"."check_and_increment_usage_gate"("p_user_id" "uuid", "p_gate" "text", "p_limit" integer, "p_amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_rate_limit"("p_ip" "text", "p_limit" integer, "p_window_seconds" integer) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$ BEGIN RETURN true; END; $$;


ALTER FUNCTION "public"."check_rate_limit"("p_ip" "text", "p_limit" integer, "p_window_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."commit_ai_usage"("p_reservation_id" "uuid", "p_actual_cost" numeric, "p_prompt_tokens" integer, "p_completion_tokens" integer, "p_route" "text" DEFAULT 'unknown'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_reservation public.ai_budget_reservations%rowtype;
  v_prompt int := greatest(coalesce(p_prompt_tokens, 0), 0);
  v_completion int := greatest(coalesce(p_completion_tokens, 0), 0);
  v_total int := greatest(coalesce(p_prompt_tokens, 0), 0) + greatest(coalesce(p_completion_tokens, 0), 0);
  v_actual_cost numeric := greatest(coalesce(p_actual_cost, 0), 0);
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'unauthorized';
  end if;

  select * into v_reservation
  from public.ai_budget_reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'AI_BUDGET_RESERVATION_NOT_FOUND';
  end if;

  if v_reservation.status <> 'reserved' then
    return;
  end if;

  update public.ai_budget_reservations
  set status = 'committed',
      actual_cost = v_actual_cost,
      actual_tokens = v_total,
      updated_at = now()
  where id = p_reservation_id;

  update public.ai_usage_daily
  set reserved_cost = greatest(0, coalesce(reserved_cost, 0) - coalesce(v_reservation.estimated_cost, 0)),
      reserved_tokens = greatest(0, coalesce(reserved_tokens, 0) - coalesce(v_reservation.estimated_tokens, 0)),
      committed_cost = coalesce(committed_cost, 0) + v_actual_cost,
      estimated_cost = coalesce(estimated_cost, 0) + v_actual_cost,
      prompt_tokens = coalesce(prompt_tokens, 0) + v_prompt,
      completion_tokens = coalesce(completion_tokens, 0) + v_completion,
      total_tokens = coalesce(total_tokens, 0) + v_total,
      chat_calls = coalesce(chat_calls, 0) + case when v_reservation.feature = 'chat' then 1 else 0 end,
      autopsy_calls = coalesce(autopsy_calls, 0) + case when v_reservation.feature = 'autopsy' then 1 else 0 end,
      image_calls = coalesce(image_calls, 0) + case when v_reservation.feature = 'image' then 1 else 0 end,
      planner_calls = coalesce(planner_calls, 0) + case when v_reservation.feature = 'planner' then 1 else 0 end,
      session_card_calls = coalesce(session_card_calls, 0) + case when v_reservation.feature = 'session-card' then 1 else 0 end,
      updated_at = now()
  where user_id = v_reservation.user_id and usage_date = v_reservation.usage_date;

  insert into public.ai_usage_events (
    reservation_id,
    user_id,
    usage_date,
    feature,
    route,
    model,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    estimated_cost
  ) values (
    p_reservation_id,
    v_reservation.user_id,
    v_reservation.usage_date,
    v_reservation.feature,
    coalesce(nullif(p_route, ''), 'unknown'),
    v_reservation.model,
    v_prompt,
    v_completion,
    v_total,
    v_actual_cost
  );
end;
$$;


ALTER FUNCTION "public"."commit_ai_usage"("p_reservation_id" "uuid", "p_actual_cost" numeric, "p_prompt_tokens" integer, "p_completion_tokens" integer, "p_route" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_daily_session_card"("p_user_id" "uuid", "p_date" "date" DEFAULT CURRENT_DATE) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_updated int;
  v_version int;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    if current_setting('request.jwt.claim.role', true) <> 'service_role' then
      raise exception 'unauthorized';
    end if;
  end if;

  update public.session_cards
  set
    "isCompleted" = true,
    "completedAt" = now(),
    is_completed = true,
    completed_at = now()
  where user_id = p_user_id
    and date = p_date
    and ("isCompleted" = false or "isCompleted" is null);

  get diagnostics v_updated = row_count;

  update public.profiles
  set
    learner_state_version = coalesce(learner_state_version, 0) + 1,
    updated_at = now()
  where id = p_user_id
  returning learner_state_version into v_version;

  return jsonb_build_object(
    'updated', v_updated,
    'newVersion', v_version,
    'date', p_date
  );
end;
$$;


ALTER FUNCTION "public"."complete_daily_session_card"("p_user_id" "uuid", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_study_session"("p_user_id" "uuid", "p_subject" "text", "p_chapter" "text", "p_topic" "text", "p_concept_name" "text", "p_duration_minutes" integer, "p_understood" boolean, "p_gap_found" "text", "p_cards_created" integer, "p_session_type" "text", "p_task_id" "uuid", "p_concept_id" "uuid", "p_completion_key" "text", "p_source" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_session_id uuid;
  v_event_id uuid;
  v_ended_at timestamptz := now();
  v_started_at timestamptz := now() - (p_duration_minutes || ' minutes')::interval;
  v_current_streak int;
  v_last_active_at timestamptz;
  v_new_streak int;
  v_streak_changed boolean := false;
  v_today date := current_date;
  v_last_active_date date;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    if current_setting('request.jwt.claim.role', true) <> 'service_role' then
      raise exception 'Unauthorized';
    end if;
  end if;

  -- Get current streak
  select streak_days, last_active_at into v_current_streak, v_last_active_at
  from public.profiles
  where id = p_user_id
  for update;
  
  v_current_streak := coalesce(v_current_streak, 0);
  v_last_active_date := v_last_active_at::date;
  
  if v_last_active_date = v_today then
    -- Already active today
    v_new_streak := greatest(v_current_streak, 1);
  elsif v_last_active_date = v_today - interval '1 day' then
    -- Active yesterday
    v_new_streak := v_current_streak + 1;
    v_streak_changed := true;
  else
    -- Gap or new
    v_new_streak := 1;
    v_streak_changed := true;
  end if;

  -- Update profile
  update public.profiles
  set streak_days = v_new_streak,
      last_active_at = now(),
      updated_at = now(),
      learner_state_version = coalesce(learner_state_version, 0) + 1
  where id = p_user_id;

  -- Insert study session
  insert into public.study_sessions (
    user_id,
    subject,
    chapter,
    topic,
    concept_name,
    started_at,
    ended_at,
    completed_at,
    duration_minutes,
    understood,
    gap_found,
    cards_created,
    session_type,
    is_completed,
    notes,
    metadata
  ) values (
    p_user_id,
    p_subject,
    p_chapter,
    p_topic,
    p_concept_name,
    v_started_at,
    v_ended_at,
    v_ended_at,
    p_duration_minutes,
    p_understood,
    p_gap_found,
    p_cards_created,
    coalesce(p_session_type, 'study'),
    true,
    case when p_gap_found is not null then 'Gap identified: ' || p_gap_found else 'Studied ' || p_chapter || ' (' || p_subject || ')' end,
    jsonb_build_object(
      'completion_key', p_completion_key,
      'source', p_source,
      'taskId', p_task_id,
      'conceptId', p_concept_id
    )
  ) returning id into v_session_id;

  -- Create event atomically
  v_event_id := public.create_event_with_consumers(
    p_user_id,
    'STUDY_SESSION_COMPLETED',
    jsonb_build_object(
      'sessionId', v_session_id,
      'taskId', coalesce(p_task_id::text, 'session-' || v_session_id::text),
      'conceptId', p_concept_id,
      'conceptName', p_concept_name,
      'subject', p_subject,
      'chapter', p_chapter,
      'durationMinutes', p_duration_minutes,
      'understood', p_understood,
      'gapFound', p_gap_found,
      'cardsCreated', p_cards_created,
      'understandingGained', p_understood,
      'isSessionComplete', true,
      'masteryEvidenceRecorded', p_concept_id is not null
    ),
    coalesce(p_completion_key, p_source || ':' || v_session_id::text),
    p_source,
    jsonb_build_object('source', p_source)
  );

  return jsonb_build_object(
    'session_id', v_session_id,
    'event_id', v_event_id,
    'streak_days', v_new_streak,
    'streak_changed', v_streak_changed
  );
end;
$$;


ALTER FUNCTION "public"."complete_study_session"("p_user_id" "uuid", "p_subject" "text", "p_chapter" "text", "p_topic" "text", "p_concept_name" "text", "p_duration_minutes" integer, "p_understood" boolean, "p_gap_found" "text", "p_cards_created" integer, "p_session_type" "text", "p_task_id" "uuid", "p_concept_id" "uuid", "p_completion_key" "text", "p_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_event_with_consumers"("p_user_id" "uuid", "p_type" "text", "p_data" "jsonb", "p_idempotency_key" "text", "p_source" "text", "p_metadata" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_event_id uuid;
begin
  with inserted as (
    insert into public.event_queue (
      user_id,
      type,
      payload,
      idempotency_key,
      metadata,
      status,
      next_attempt_at
    ) values (
      p_user_id,
      p_type,
      coalesce(p_data, '{}'::jsonb),
      p_idempotency_key,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('source', coalesce(p_source, 'system')),
      'PENDING',
      now()
    )
    on conflict (idempotency_key) do nothing
    returning id
  )
  select id into v_event_id from inserted;

  if v_event_id is null then
    select id into v_event_id
    from public.event_queue
    where idempotency_key = p_idempotency_key;
    return v_event_id;
  end if;

  insert into public.consumer_locks (
    event_id,
    consumer_name,
    status,
    next_retry_at,
    next_attempt_at
  )
  select
    v_event_id,
    unnest(array[
      'learning_state_engine',
      'atlas_engine',
      'memory_engine',
      'concept_expansion_engine',
      'chat_side_effect_engine'
    ]::text[]),
    'PENDING',
    now(),
    now()
  on conflict (event_id, consumer_name) do nothing;

  return v_event_id;
end;
$$;


ALTER FUNCTION "public"."create_event_with_consumers"("p_user_id" "uuid", "p_type" "text", "p_data" "jsonb", "p_idempotency_key" "text", "p_source" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_profile_exists"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, onboarding_complete, created_at, updated_at)
  VALUES (NEW.user_id, 'Student', '', false, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_profile_exists"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_stale_ai_reservations"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_rec record;
BEGIN
  FOR v_rec IN 
    SELECT id, user_id, usage_date, estimated_cost, estimated_tokens 
    FROM public.ai_budget_reservations 
    WHERE status = 'reserved' AND created_at < NOW() - INTERVAL '5 minutes'
  LOOP
    UPDATE public.ai_budget_reservations
    SET status = 'released', updated_at = NOW()
    WHERE id = v_rec.id;

    UPDATE public.ai_usage_daily
    SET reserved_cost = GREATEST(0, COALESCE(reserved_cost, 0) - COALESCE(v_rec.estimated_cost, 0)),
        reserved_tokens = GREATEST(0, COALESCE(reserved_tokens, 0) - COALESCE(v_rec.estimated_tokens, 0)),
        updated_at = NOW()
    WHERE user_id = v_rec.user_id AND usage_date = v_rec.usage_date;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."expire_stale_ai_reservations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_salient_memories"("p_user_id" "uuid", "p_query_embedding" "public"."vector", "p_pulse_state" "text", "p_limit" integer DEFAULT 2) RETURNS TABLE("id" "uuid", "user_id" "uuid", "concept_id" "uuid", "type" "public"."memory_type", "description" "text", "emotional_context" "text", "importance_score" real, "decay_factor" real, "created_at" timestamp without time zone, "last_recalled_at" timestamp without time zone, "salience_score" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    em.id,
    em.user_id,
    em.concept_id,
    em.type,
    em.description,
    em.emotional_context,
    em.importance_score,
    em.decay_factor,
    em.created_at,
    em.last_recalled_at,
    (
      (em.importance_score * exp(- em.decay_factor * (EXTRACT(epoch FROM (now() - em.created_at)) / 86400.0)))
      + (COALESCE(1.0 - (em.embedding <=> p_query_embedding), 0.0) * 1.5)
      + (CASE 
          WHEN p_pulse_state IN ('frustrated', 'overwhelmed', 'burnt_out') AND em.type = 'struggle' THEN 1.0
          WHEN p_pulse_state IN ('frustrated', 'overwhelmed', 'burnt_out') AND em.type = 'turning_point' THEN 0.8
          ELSE 0.0 
         END)
    )::double precision AS salience_score
  FROM episodic_memories em
  WHERE em.user_id = p_user_id
  ORDER BY salience_score DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_salient_memories"("p_user_id" "uuid", "p_query_embedding" "public"."vector", "p_pulse_state" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, exam_type, streak_days, last_active_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Student'),
    'neet',
    0,
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_syllabus"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.exam_type IS NOT NULL THEN
    PERFORM seed_syllabus_for_user(NEW.id, NEW.exam_type);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_syllabus"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hybrid_search_chunks"("p_user_id" "uuid", "p_query_text" "text", "p_query_embedding" "public"."vector", "p_match_count" integer DEFAULT 10, "p_full_text_weight" double precision DEFAULT 1.0, "p_semantic_weight" double precision DEFAULT 1.0, "p_rrf_k" integer DEFAULT 60) RETURNS TABLE("id" "uuid", "material_id" "uuid", "chunk_text" "text", "similarity" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    WITH semantic_search AS (
        SELECT mc.id, RANK() OVER (ORDER BY mc.embedding <=> p_query_embedding) as rank
        FROM material_chunks mc
        WHERE mc.user_id = p_user_id
        ORDER BY mc.embedding <=> p_query_embedding
        LIMIT p_match_count * 2
    ),
    keyword_search AS (
        SELECT mc.id, RANK() OVER (ORDER BY ts_rank_cd(mc.fts_vector, plainto_tsquery('english', p_query_text)) DESC) as rank
        FROM material_chunks mc
        WHERE mc.user_id = p_user_id AND mc.fts_vector @@ plainto_tsquery('english', p_query_text)
        ORDER BY ts_rank_cd(mc.fts_vector, plainto_tsquery('english', p_query_text)) DESC
        LIMIT p_match_count * 2
    )
    SELECT
        c.id,
        c.material_id,
        c.chunk_text,
        (COALESCE(1.0 / (p_rrf_k + ss.rank), 0.0) * p_semantic_weight +
         COALESCE(1.0 / (p_rrf_k + ks.rank), 0.0) * p_full_text_weight)::float AS similarity
    FROM material_chunks c
    LEFT JOIN semantic_search ss ON ss.id = c.id
    LEFT JOIN keyword_search ks ON ks.id = c.id
    WHERE (ss.id IS NOT NULL OR ks.id IS NOT NULL) AND c.user_id = p_user_id
    ORDER BY similarity DESC
    LIMIT p_match_count;
END;
$$;


ALTER FUNCTION "public"."hybrid_search_chunks"("p_user_id" "uuid", "p_query_text" "text", "p_query_embedding" "public"."vector", "p_match_count" integer, "p_full_text_weight" double precision, "p_semantic_weight" double precision, "p_rrf_k" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_cache_access"("cache_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE semantic_cache
  SET access_count = access_count + 1,
      last_accessed_at = now()
  WHERE id = cache_id;
END;
$$;


ALTER FUNCTION "public"."increment_cache_access"("cache_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_daily_tasks_completed"("p_user_id" "uuid", "p_date" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO learner_daily_metrics (user_id, date, tasks_completed)
  VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET tasks_completed = learner_daily_metrics.tasks_completed + 1;
END;
$$;


ALTER FUNCTION "public"."increment_daily_tasks_completed"("p_user_id" "uuid", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ingest_autopsy_document"("p_user_id" "uuid", "p_filename" "text", "p_file_url" "text", "p_file_type" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_metadata" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  raise exception 'disabled_for_mvp';
end;
$$;


ALTER FUNCTION "public"."ingest_autopsy_document"("p_user_id" "uuid", "p_filename" "text", "p_file_url" "text", "p_file_type" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ingest_mock_autopsy"("p_user_id" "uuid", "p_test_name" "text", "p_exam_type" "text", "p_total_questions" integer, "p_correct_count" integer, "p_incorrect_count" integer, "p_unattempted_count" integer, "p_current_score" numeric, "p_recoverable_marks" numeric, "p_potential_score" numeric, "p_questions" "jsonb", "p_idempotency_key" "text", "p_trace_id" "uuid", "p_confidence_threshold" numeric DEFAULT 70) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_autopsy_id uuid;
  v_event_id uuid;
  v_question jsonb;
  v_question_id uuid;
  v_question_number int;
  v_status text;
  v_confidence numeric;
  v_needs_review boolean;
  v_evidence_status text;
  v_wrong_questions jsonb := '[]'::jsonb;
  v_source_hash text;

  -- Idempotency guard
  v_existing_autopsy_id uuid;
  v_existing_metadata jsonb;

  -- Secure server-side recompute variables
  v_computed_correct_count int := 0;
  v_computed_incorrect_count int := 0;
  v_computed_unattempted_count int := 0;
  v_computed_score numeric := 0;
  v_computed_potential numeric := 0;
  v_computed_recoverable numeric := 0;
  v_total_marks numeric;
  v_marks_lost numeric;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  -- ─── IDEMPOTENCY GUARD ────────────────────────────────────────────────────
  -- If this upload was already processed (e.g. client retry after timeout),
  -- return the original result without re-inserting or re-publishing.
  if p_idempotency_key is not null then
    select id, metadata into v_existing_autopsy_id, v_existing_metadata
    from public.mock_autopsies
    where idempotency_key = p_idempotency_key
    limit 1;

    if v_existing_autopsy_id is not null then
      return jsonb_build_object(
        'autopsy_id', v_existing_autopsy_id,
        'event_id',   coalesce(v_existing_metadata->>'event_id', null),
        'idempotent_replay', true
      );
    end if;
  end if;

  -- ─── STEP 1: Securely recompute aggregates from questions array ───────────
  -- We ignore client-provided counts/scores and derive them server-side.
  for v_question in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    v_status := coalesce(v_question->>'status', 'Unattempted');
    v_total_marks := coalesce((v_question->>'totalMarks')::numeric, 4);
    v_marks_lost  := coalesce((v_question->>'marksLost')::numeric, 0);

    v_computed_potential := v_computed_potential + v_total_marks;
    v_computed_score     := v_computed_score + (v_total_marks - v_marks_lost);

    if v_status = 'Correct' then
      v_computed_correct_count := v_computed_correct_count + 1;
    elsif v_status = 'Incorrect' then
      v_computed_incorrect_count := v_computed_incorrect_count + 1;
      -- Only recoverable categories contribute to recoverable marks
      if v_question->>'mistakeCategory' in ('silly_mistake', 'time_pressure', 'misread_question', 'recall_failure') then
        v_computed_recoverable := v_computed_recoverable + v_marks_lost;
      end if;
    else
      v_computed_unattempted_count := v_computed_unattempted_count + 1;
    end if;
  end loop;

  -- ─── STEP 2: Insert mock_autopsies row ───────────────────────────────────
  insert into public.mock_autopsies (
    user_id,
    test_name,
    exam_type,
    total_questions,
    correct_count,
    incorrect_count,
    unattempted_count,
    current_score,
    recoverable_marks,
    potential_score,
    status,
    idempotency_key,
    trace_id
  ) values (
    p_user_id,
    p_test_name,
    p_exam_type,
    jsonb_array_length(coalesce(p_questions, '[]'::jsonb)),
    v_computed_correct_count,
    v_computed_incorrect_count,
    v_computed_unattempted_count,
    v_computed_score,
    v_computed_recoverable,
    v_computed_potential,
    'processing',
    p_idempotency_key,
    p_trace_id
  ) returning id into v_autopsy_id;

  -- ─── STEP 3: Process each question ───────────────────────────────────────
  for v_question in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    v_question_number := coalesce(
      nullif(v_question->>'questionNumber', '')::int,
      nullif(v_question->>'question_number', '')::int
    );
    v_status := coalesce(v_question->>'status', 'Unattempted');

    -- Resolve confidence: prefer extractionConfidence, fall back to ocrConfidence, default 100
    v_confidence := coalesce(
      nullif(v_question->>'extractionConfidence', '')::numeric,
      nullif(v_question->>'ocrConfidence', '')::numeric,
      100
    );

    -- needsReview flag wins over confidence calculation
    v_needs_review := coalesce((v_question->>'needsReview')::boolean, false)
                      or v_confidence < p_confidence_threshold;

    -- ─── THREE-TIER ROUTING ────────────────────────────────────────────────
    -- THIS IS THE CRITICAL FIX: previous code never assigned 'verified_mistake'
    -- because the CASE only checked needs_review or Incorrect — never both
    -- conditions together.
    --
    -- verified_mistake  → high-confidence incorrect answer → safe to update ATLAS/MEMORY
    -- pending_review    → low-confidence incorrect answer  → stored, no state mutations
    -- needs_review      → OCR/extraction flags raised      → stored, no state mutations
    -- ignored_or_unverified → correct/unattempted          → not stored in mistakes table
    v_evidence_status := case
      when v_needs_review                                                     then 'needs_review'
      when v_status = 'Incorrect' and v_confidence >= p_confidence_threshold  then 'verified_mistake'
      when v_status = 'Incorrect'                                              then 'pending_review'
      else                                                                          'ignored_or_unverified'
    end;

    -- Source hash for idempotent dedup on the question level
    v_source_hash := md5(
      v_autopsy_id::text || ':' ||
      coalesce(v_question_number::text, '') || ':' ||
      coalesce(v_question->>'questionText', '') || ':' ||
      coalesce(v_question->>'correctAnswer', '')
    );

    -- ─── Insert autopsy_questions row (upsert on conflict) ─────────────────
    insert into public.autopsy_questions (
      autopsy_id,
      user_id,
      question_number,
      subject,
      chapter,
      subtopic,
      difficulty,
      status,
      question_text,
      correct_answer,
      student_answer,
      mistake_category,
      reasoning,
      marks_lost,
      needs_review,
      ocr_confidence,
      extraction_confidence,
      evidence_status,
      source_hash,
      trace_id,
      trace_metadata
    ) values (
      v_autopsy_id,
      p_user_id,
      v_question_number,
      v_question->>'subject',
      v_question->>'chapter',
      v_question->>'subtopic',
      v_question->>'difficulty',
      v_status,
      v_question->>'questionText',
      v_question->>'correctAnswer',
      v_question->>'studentAnswer',
      v_question->>'mistakeCategory',
      v_question->>'reasoning',
      coalesce(nullif(v_question->>'marksLost', '')::numeric, 0),
      v_needs_review,
      v_confidence,
      v_confidence,
      v_evidence_status,
      v_source_hash,
      p_trace_id,
      jsonb_build_object(
        'trace_id',            p_trace_id,
        'status',              v_evidence_status,
        'extraction_confidence', v_confidence,
        'needs_review',        v_needs_review,
        'source_autopsy_id',   v_autopsy_id
      )
    )
    on conflict (autopsy_id, question_number) do update
      set extraction_confidence = excluded.extraction_confidence,
          evidence_status       = excluded.evidence_status,
          updated_at            = now()
    returning id into v_question_id;

    -- ─── Insert into mistakes table for pending_review AND verified_mistake ──
    -- IMPORTANT: pending_review items ARE stored (for future manual review),
    -- but the event payload only includes verified_mistake items in wrongQuestions.
    -- Downstream consumers (AtlasConsumer, MemoryConsumer, CommandConsumer) use
    -- isVerifiedAutopsyMistake() to gate their operations.
    if v_evidence_status in ('pending_review', 'verified_mistake') then
      insert into public.mistakes (
        user_id,
        autopsy_id,
        concept_id,
        category,
        status,
        subject,
        chapter,
        topic,
        question_text,
        user_answer,
        correct_answer,
        marks_lost,
        total_marks,
        ai_analysis,
        improvement_suggestion,
        source_autopsy_id,
        source_question_number,
        extraction_confidence
      ) values (
        p_user_id,
        v_autopsy_id,
        null,
        coalesce(nullif(v_question->>'mistakeCategory', ''), 'unknown')::mistake_category,
        v_evidence_status,   -- status on mistakes table mirrors evidence_status
        v_question->>'subject',
        v_question->>'chapter',
        coalesce(v_question->>'conceptualGap', v_question->>'subtopic'),
        v_question->>'questionText',
        v_question->>'studentAnswer',
        v_question->>'correctAnswer',
        coalesce(nullif(v_question->>'marksLost', '')::numeric, 0),
        coalesce(nullif(v_question->>'totalMarks', '')::numeric, 0),
        v_question->>'reasoning',
        coalesce(v_question->>'correctExplanation', v_question->>'conceptualGap'),
        v_autopsy_id,
        v_question_number,
        v_confidence
      )
      on conflict (user_id, source_autopsy_id, source_question_number)
        where source_autopsy_id is not null and source_question_number is not null
      do nothing;   -- idempotent: retry does not duplicate mistakes

      -- Only include verified_mistake items in the event payload.
      -- pending_review items sit in the DB waiting for manual confirmation.
      if v_evidence_status = 'verified_mistake' then
        v_wrong_questions := v_wrong_questions || jsonb_build_array(jsonb_build_object(
          'questionNumber',      v_question_number,
          'subject',             v_question->>'subject',
          'chapter',             v_question->>'chapter',
          'mistakeCategory',     v_question->>'mistakeCategory',
          'reasoning',           v_question->>'reasoning',
          'correctExplanation',  v_question->>'correctExplanation',
          'conceptualGap',       v_question->>'conceptualGap',
          'status',              v_evidence_status,
          -- Both snake_case and camelCase to satisfy isVerifiedAutopsyMistake()
          'evidence_status',     v_evidence_status,
          'evidenceStatus',      v_evidence_status,
          'extraction_confidence', v_confidence,
          'extractionConfidence',  v_confidence,
          'needs_review',        false,
          'needsReview',         false,
          'source_question_id',  v_question_id,
          'sourceQuestionId',    v_question_id,
          'source_autopsy_id',   v_autopsy_id,
          'sourceAutopsyId',     v_autopsy_id,
          'trace_id',            p_trace_id
        ));
      end if;
    end if;
  end loop;

  -- ─── STEP 4: Publish AUTOPSY_MOCK_PROCESSED event transactionally ────────
  -- The event payload includes summary counts and wrongQuestions (verified only).
  -- Downstream consumers use wrongQuestions to decide what to update.
  v_event_id := public.create_event_with_consumers(
    p_user_id,
    'AUTOPSY_MOCK_PROCESSED',
    jsonb_build_object(
      'autopsyId',        v_autopsy_id,
      'testName',         p_test_name,
      'examType',         p_exam_type,
      'rawScore',         v_computed_score,
      'recoverableScore', v_computed_score + v_computed_recoverable,
      'potentialScore',   v_computed_potential,
      'totalQuestions',   jsonb_array_length(coalesce(p_questions, '[]'::jsonb)),
      'correctCount',     v_computed_correct_count,
      'incorrectCount',   v_computed_incorrect_count,
      'verifiedCount',    jsonb_array_length(v_wrong_questions),
      'pendingReviewCount', (
        select count(*) from public.autopsy_questions
        where autopsy_id = v_autopsy_id
          and evidence_status = 'pending_review'
      ),
      'needsReviewCount', (
        select count(*) from public.autopsy_questions
        where autopsy_id = v_autopsy_id
          and evidence_status = 'needs_review'
      )
    ),
    'autopsy:' || v_autopsy_id::text || ':processed',
    'autopsy_engine',
    jsonb_build_object(
      'source',          'autopsy_engine',
      'autopsyId',       v_autopsy_id,
      'trace_id',        p_trace_id,
      -- Only verified mistakes flow downstream to mutate learner state
      'wrongQuestions',  v_wrong_questions
    )
  );

  -- ─── STEP 5: Mark autopsy as completed ───────────────────────────────────
  update public.mock_autopsies
  set status       = 'completed',
      completed_at = now(),
      metadata     = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('event_id', v_event_id)
  where id = v_autopsy_id;

  -- Invalidate today's and tomorrow's session cards (stale after new autopsy)
  delete from public.session_cards
  where user_id = p_user_id
    and date in (current_date, current_date + 1);

  -- Bump learner state version so caches know state changed
  update public.profiles
  set learner_state_version = coalesce(learner_state_version, 0) + 1,
      updated_at            = now()
  where id = p_user_id;

  return jsonb_build_object(
    'autopsy_id',        v_autopsy_id,
    'event_id',          v_event_id,
    'idempotent_replay', false,
    'verified_count',    jsonb_array_length(v_wrong_questions),
    'pending_review_count', (
      select count(*) from public.autopsy_questions
      where autopsy_id = v_autopsy_id and evidence_status = 'pending_review'
    )
  );

exception when others then
  -- On any failure, mark the autopsy row as failed so it doesn't appear
  -- as stuck in 'processing'. Do NOT mutate ATLAS or MEMORY on failure.
  if v_autopsy_id is not null then
    update public.mock_autopsies
    set status        = 'failed',
        error_message = sqlerrm
    where id = v_autopsy_id;
  end if;
  raise;
end;
$$;


ALTER FUNCTION "public"."ingest_mock_autopsy"("p_user_id" "uuid", "p_test_name" "text", "p_exam_type" "text", "p_total_questions" integer, "p_correct_count" integer, "p_incorrect_count" integer, "p_unattempted_count" integer, "p_current_score" numeric, "p_recoverable_marks" numeric, "p_potential_score" numeric, "p_questions" "jsonb", "p_idempotency_key" "text", "p_trace_id" "uuid", "p_confidence_threshold" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_student_model"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.student_models (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."initialize_student_model"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invalidate_session_card"("p_user_id" "uuid", "p_reason" "text" DEFAULT 'manual_invalidation'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_version int;
  v_deleted int := 0;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    if current_setting('request.jwt.claim.role', true) <> 'service_role' then
      raise exception 'unauthorized';
    end if;
  end if;

  delete from public.session_cards
  where user_id = p_user_id
    and date in (current_date, current_date + 1);

  get diagnostics v_deleted = row_count;

  update public.profiles
  set
    learner_state_version = coalesce(learner_state_version, 0) + 1,
    updated_at = now()
  where id = p_user_id
  returning learner_state_version into v_version;

  return jsonb_build_object(
    'deleted', v_deleted,
    'newVersion', v_version,
    'reason', p_reason
  );
end;
$$;


ALTER FUNCTION "public"."invalidate_session_card"("p_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_chat_memory"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") RETURNS TABLE("id" "uuid", "content" "text", "similarity" double precision, "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    cm.id,
    cm.content,
    1 - (cm.embedding <=> query_embedding) as similarity,
    cm.created_at
  from public.chat_memory cm
  where cm.user_id = p_user_id
    and cm.embedding is not null
    and 1 - (cm.embedding <=> query_embedding) > match_threshold
  order by
    (1 - (cm.embedding <=> query_embedding)) desc,
    coalesce(cm.importance_score, 0) desc,
    cm.created_at desc
  limit match_count;
$$;


ALTER FUNCTION "public"."match_chat_memory"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_chat_memory"("query_embedding" "public"."vector", "p_user_id" "uuid", "match_threshold" double precision DEFAULT 0.7, "match_count" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "content" "text", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM chat_memory_embeddings m
  WHERE m.user_id = p_user_id
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_chat_memory"("query_embedding" "public"."vector", "p_user_id" "uuid", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_concepts"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "subject" "text", "chapter" "text", "topic" "text", "similarity" double precision)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  return query
  select
    c.id,
    c.name,
    c.subject,
    c.chapter,
    c.topic,
    (1 - (c.embedding <=> query_embedding))::float as similarity
  from public.concepts c
  where c.user_id = p_user_id
    and c.embedding is not null
    and (1 - (c.embedding <=> query_embedding)) >= match_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;


ALTER FUNCTION "public"."match_concepts"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_material_chunks"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") RETURNS TABLE("id" "uuid", "chunk_text" "text", "similarity" double precision)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    id,
    chunk_text,
    1 - (embedding <=> query_embedding) AS similarity
  FROM material_chunks
  WHERE user_id = p_user_id
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;


ALTER FUNCTION "public"."match_material_chunks"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_semantic_cache"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) RETURNS TABLE("id" "uuid", "response_text" "text", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id,
    sc.response_text,
    1 - (sc.embedding <=> query_embedding) AS similarity
  FROM semantic_cache sc
  WHERE 1 - (sc.embedding <=> query_embedding) > match_threshold
  ORDER BY sc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_semantic_cache"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_semantic_cache"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") RETURNS TABLE("id" "uuid", "response_text" "text", "similarity" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    sc.id,
    sc.response_text,
    1 - (sc.embedding <=> query_embedding) AS similarity
  FROM semantic_cache sc
  WHERE 1 - (sc.embedding <=> query_embedding) > match_threshold
  ORDER BY sc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_semantic_cache"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_academic_chapter"("p_value" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v text := public.normalize_academic_text(p_value);
begin
  if v in (
    'electrostatic',
    'electrostatics',
    'electric charge field',
    'electric charge fields',
    'electric charges field',
    'electric charges fields'
  ) then
    return 'electric charge field';
  end if;
  return v;
end;
$$;


ALTER FUNCTION "public"."normalize_academic_chapter"("p_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_academic_subject"("p_value" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
declare
  raw text := lower(coalesce(p_value, ''));
  v text := public.normalize_academic_text(p_value);
begin
  if raw like '%physics%' then
    return 'physics';
  end if;
  if raw ~ 'mathematics|maths|math' then
    return 'mathematics';
  end if;
  return v;
end;
$$;


ALTER FUNCTION "public"."normalize_academic_subject"("p_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_academic_text"("p_value" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v text;
  word text;
  words text[] := array[]::text[];
begin
  if p_value is null then
    return null;
  end if;

  v := lower(unaccent(p_value));
  v := replace(v, '&', ' and ');
  v := regexp_replace(v, '[^a-z0-9]+', ' ', 'g');
  v := btrim(regexp_replace(v, '\s+', ' ', 'g'));

  if v = '' then
    return null;
  end if;

  foreach word in array string_to_array(v, ' ')
  loop
    if word in ('and', 'the', 'of') then
      continue;
    end if;
    if length(word) > 4 and right(word, 3) = 'ies' then
      word := left(word, length(word) - 3) || 'y';
    elsif length(word) > 3 and right(word, 1) = 's' then
      word := left(word, length(word) - 1);
    end if;
    words := array_append(words, word);
  end loop;

  v := array_to_string(words, ' ');
  return nullif(v, '');
end;
$$;


ALTER FUNCTION "public"."normalize_academic_text"("p_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_autopsy_transaction"("p_user_id" "uuid", "p_mock_id" "uuid", "p_score" integer, "p_recoverable_marks" integer, "p_atlas_updates" "jsonb"[], "p_memory_cards" "jsonb"[]) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE mock_tests 
    SET 
        status = 'completed',
        score = p_score,
        recoverable_marks = p_recoverable_marks,
        processed_at = now()
    WHERE id = p_mock_id AND user_id = p_user_id;

    IF array_length(p_atlas_updates, 1) > 0 THEN
        FOR i IN 1 .. array_length(p_atlas_updates, 1) LOOP
            UPDATE atlas_nodes
            SET 
                mastery_level = LEAST(1.0, mastery_level + (p_atlas_updates[i]->>'mastery_delta')::float),
                last_tested_at = now()
            WHERE id = (p_atlas_updates[i]->>'node_id')::uuid 
            AND user_id = p_user_id;
        END LOOP;
    END IF;

    IF array_length(p_memory_cards, 1) > 0 THEN
        FOR i IN 1 .. array_length(p_memory_cards, 1) LOOP
            INSERT INTO revision_cards (
                user_id,
                front,
                back,
                tags,
                state,
                stability,
                difficulty,
                elapsed_days,
                scheduled_days,
                reps,
                lapses
            ) VALUES (
                p_user_id,
                p_memory_cards[i]->>'front',
                p_memory_cards[i]->>'back',
                ARRAY(SELECT jsonb_array_elements_text(p_memory_cards[i]->'tags')),
                0,
                0,
                0,
                0,
                0,
                0,
                0
            );
        END LOOP;
    END IF;

    RETURN true;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'process_autopsy_transaction failed: %', SQLERRM;
        RAISE EXCEPTION 'Transaction failed and was rolled back.';
END;
$$;


ALTER FUNCTION "public"."process_autopsy_transaction"("p_user_id" "uuid", "p_mock_id" "uuid", "p_score" integer, "p_recoverable_marks" integer, "p_atlas_updates" "jsonb"[], "p_memory_cards" "jsonb"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_ai_budget"("p_reservation_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_reservation public.ai_budget_reservations%rowtype;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'unauthorized';
  end if;

  select * into v_reservation
  from public.ai_budget_reservations
  where id = p_reservation_id
  for update;

  if not found or v_reservation.status <> 'reserved' then
    return;
  end if;

  update public.ai_budget_reservations
  set status = 'released',
      updated_at = now()
  where id = p_reservation_id;

  update public.ai_usage_daily
  set reserved_cost = greatest(0, coalesce(reserved_cost, 0) - coalesce(v_reservation.estimated_cost, 0)),
      reserved_tokens = greatest(0, coalesce(reserved_tokens, 0) - coalesce(v_reservation.estimated_tokens, 0)),
      updated_at = now()
  where user_id = v_reservation.user_id and usage_date = v_reservation.usage_date;
end;
$$;


ALTER FUNCTION "public"."release_ai_budget"("p_reservation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_ai_budget"("p_user_id" "uuid", "p_feature" "text", "p_model" "text", "p_estimated_cost" numeric, "p_estimated_tokens" integer, "p_daily_limit_usd" numeric DEFAULT 0.25) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_reserved_id uuid;
  v_usage public.ai_usage_daily%rowtype;
  v_estimated_cost numeric := greatest(coalesce(p_estimated_cost, 0), 0);
  v_estimated_tokens int := greatest(coalesce(p_estimated_tokens, 0), 0);
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'unauthorized';
  end if;

  insert into public.ai_usage_daily(user_id, usage_date)
  values (p_user_id, current_date)
  on conflict (user_id, usage_date) do nothing;

  select * into v_usage
  from public.ai_usage_daily
  where user_id = p_user_id and usage_date = current_date
  for update;

  if coalesce(v_usage.estimated_cost, 0) + coalesce(v_usage.reserved_cost, 0) + v_estimated_cost > p_daily_limit_usd then
    update public.ai_usage_daily
    set budget_exceeded_count = coalesce(budget_exceeded_count, 0) + 1,
        updated_at = now()
    where id = v_usage.id;
    raise exception 'AI_DAILY_BUDGET_EXCEEDED';
  end if;

  insert into public.ai_budget_reservations (
    user_id,
    usage_date,
    feature,
    model,
    estimated_cost,
    estimated_tokens
  ) values (
    p_user_id,
    current_date,
    p_feature,
    coalesce(nullif(p_model, ''), 'unknown'),
    v_estimated_cost,
    v_estimated_tokens
  )
  returning id into v_reserved_id;

  update public.ai_usage_daily
  set reserved_cost = coalesce(reserved_cost, 0) + v_estimated_cost,
      reserved_tokens = coalesce(reserved_tokens, 0) + v_estimated_tokens,
      updated_at = now()
  where id = v_usage.id;

  return v_reserved_id;
end;
$$;


ALTER FUNCTION "public"."reserve_ai_budget"("p_user_id" "uuid", "p_feature" "text", "p_model" "text", "p_estimated_cost" numeric, "p_estimated_tokens" integer, "p_daily_limit_usd" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_broken_streaks"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE profiles 
  SET streak_days = 0
  WHERE last_active_date < CURRENT_DATE - INTERVAL '1 day'
    AND streak_days > 0;
END;
$$;


ALTER FUNCTION "public"."reset_broken_streaks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_syllabus_for_user"("p_user_id" "uuid", "p_exam_type" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_subject text;
  v_chapter text;
BEGIN
  -- Only seed if user has no concepts yet
  IF (SELECT COUNT(*) FROM concepts WHERE user_id = p_user_id) > 0 THEN
    RETURN;
  END IF;

  -- NEET syllabus
  IF p_exam_type ILIKE '%neet%' THEN

    -- Physics
    FOR v_chapter IN SELECT unnest(ARRAY[
      'Physical World and Measurement',
      'Kinematics',
      'Laws of Motion',
      'Work Energy and Power',
      'Motion of System of Particles and Rigid Body',
      'Gravitation',
      'Properties of Bulk Matter',
      'Thermodynamics',
      'Behaviour of Perfect Gas and Kinetic Theory',
      'Oscillations and Waves',
      'Electrostatics',
      'Current Electricity',
      'Magnetic Effects of Current and Magnetism',
      'Electromagnetic Induction and Alternating Currents',
      'Electromagnetic Waves',
      'Optics',
      'Dual Nature of Matter and Radiation',
      'Atoms and Nuclei',
      'Electronic Devices'
    ]) LOOP
      INSERT INTO concepts (user_id, subject, chapter, name, mastery, confidence, last_reviewed_at)
      VALUES (p_user_id, 'Physics', v_chapter, v_chapter, 'not_started', 'low', now())
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- Chemistry
    FOR v_chapter IN SELECT unnest(ARRAY[
      'Some Basic Concepts of Chemistry',
      'Structure of Atom',
      'Classification of Elements and Periodicity in Properties',
      'Chemical Bonding and Molecular Structure',
      'States of Matter',
      'Thermodynamics',
      'Equilibrium',
      'Redox Reactions',
      'Hydrogen',
      'The s-Block Elements',
      'The p-Block Elements',
      'Organic Chemistry: Basic Principles and Techniques',
      'Hydrocarbons',
      'Environmental Chemistry',
      'The Solid State',
      'Solutions',
      'Electrochemistry',
      'Chemical Kinetics',
      'Surface Chemistry',
      'General Principles and Processes of Isolation of Elements',
      'The d and f Block Elements',
      'Coordination Compounds',
      'Haloalkanes and Haloarenes',
      'Alcohols Phenols and Ethers',
      'Aldehydes Ketones and Carboxylic Acids',
      'Amines',
      'Biomolecules',
      'Polymers',
      'Chemistry in Everyday Life'
    ]) LOOP
      INSERT INTO concepts (user_id, subject, chapter, name, mastery, confidence, last_reviewed_at)
      VALUES (p_user_id, 'Chemistry', v_chapter, v_chapter, 'not_started', 'low', now())
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- Biology
    FOR v_chapter IN SELECT unnest(ARRAY[
      'The Living World',
      'Biological Classification',
      'Plant Kingdom',
      'Animal Kingdom',
      'Morphology of Flowering Plants',
      'Anatomy of Flowering Plants',
      'Structural Organisation in Animals',
      'Cell The Unit of Life',
      'Cell Structure and Function',
      'Biomolecules',
      'Cell Cycle and Cell Division',
      'Transport in Plants',
      'Mineral Nutrition',
      'Photosynthesis in Higher Plants',
      'Respiration in Plants',
      'Plant Growth and Development',
      'Digestion and Absorption',
      'Breathing and Exchange of Gases',
      'Body Fluids and Circulation',
      'Excretory Products and their Elimination',
      'Locomotion and Movement',
      'Neural Control and Coordination',
      'Chemical Coordination and Integration',
      'Reproduction in Organisms',
      'Sexual Reproduction in Flowering Plants',
      'Human Reproduction',
      'Reproductive Health',
      'Principles of Inheritance and Variation',
      'Molecular Basis of Inheritance',
      'Evolution',
      'Human Health and Disease',
      'Strategies for Enhancement in Food Production',
      'Microbes in Human Welfare',
      'Biotechnology Principles and Processes',
      'Biotechnology and its Applications',
      'Organisms and Populations',
      'Ecosystem',
      'Biodiversity and Conservation',
      'Environmental Issues'
    ]) LOOP
      INSERT INTO concepts (user_id, subject, chapter, name, mastery, confidence, last_reviewed_at)
      VALUES (p_user_id, 'Biology', v_chapter, v_chapter, 'not_started', 'low', now())
      ON CONFLICT DO NOTHING;
    END LOOP;

  END IF;

  -- JEE syllabus (add similarly when ready)
  -- IF p_exam_type ILIKE '%jee%' THEN ... END IF;

END;
$$;


ALTER FUNCTION "public"."seed_syllabus_for_user"("p_user_id" "uuid", "p_exam_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_concept_canonical_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.normalized_subject := public.normalize_academic_subject(new.subject);
  new.normalized_chapter := public.normalize_academic_chapter(new.chapter);
  new.normalized_name := public.normalize_academic_text(coalesce(new.name, new.topic, new.chapter));
  new.concept_key := concat_ws(
    '::',
    coalesce(new.normalized_subject, 'general'),
    coalesce(new.normalized_chapter, 'general'),
    coalesce(new.normalized_name, new.normalized_chapter, 'general')
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."set_concept_canonical_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_learner_state_incrementally"("p_user_id" "uuid", "p_confidence_delta" numeric, "p_retention_delta" numeric, "p_velocity_delta" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    if current_setting('request.jwt.claim.role', true) <> 'service_role' then
      raise exception 'unauthorized';
    end if;
  end if;

  insert into public.learner_states (
    user_id,
    overall_confidence,
    estimated_retention,
    weekly_velocity,
    updated_at
  )
  values (
    p_user_id,
    greatest(0.0, least(1.0, 0.5 + p_confidence_delta)),
    greatest(0.0, least(1.0, 0.5 + p_retention_delta)),
    greatest(0, p_velocity_delta),
    now()
  )
  on conflict (user_id) do update
  set
    overall_confidence = greatest(0.0, least(1.0, public.learner_states.overall_confidence + p_confidence_delta)),
    estimated_retention = greatest(0.0, least(1.0, public.learner_states.estimated_retention + p_retention_delta)),
    weekly_velocity = greatest(0, public.learner_states.weekly_velocity + p_velocity_delta),
    updated_at = now();
end;
$$;


ALTER FUNCTION "public"."update_learner_state_incrementally"("p_user_id" "uuid", "p_confidence_delta" numeric, "p_retention_delta" numeric, "p_velocity_delta" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."adaptation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "adaptation_type" "text" NOT NULL,
    "context" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."adaptation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_budget_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "usage_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "feature" "text" NOT NULL,
    "model" "text" NOT NULL,
    "status" "text" DEFAULT 'reserved'::"text" NOT NULL,
    "estimated_cost" numeric DEFAULT 0 NOT NULL,
    "estimated_tokens" integer DEFAULT 0 NOT NULL,
    "actual_cost" numeric,
    "actual_tokens" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_budget_reservations_status_check" CHECK (("status" = ANY (ARRAY['reserved'::"text", 'committed'::"text", 'released'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."ai_budget_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_usage_daily" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "usage_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "chat_calls" integer DEFAULT 0,
    "autopsy_calls" integer DEFAULT 0,
    "image_calls" integer DEFAULT 0,
    "prompt_tokens" integer DEFAULT 0,
    "completion_tokens" integer DEFAULT 0,
    "total_tokens" integer DEFAULT 0,
    "estimated_cost" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "planner_calls" integer DEFAULT 0,
    "session_card_calls" integer DEFAULT 0,
    "budget_exceeded_count" integer DEFAULT 0,
    "reserved_cost" numeric DEFAULT 0 NOT NULL,
    "reserved_tokens" integer DEFAULT 0 NOT NULL,
    "committed_cost" numeric DEFAULT 0 NOT NULL,
    "chat_messages" integer DEFAULT 0 NOT NULL,
    "tutor_messages" integer DEFAULT 0 NOT NULL,
    "autopsy_uploads" integer DEFAULT 0 NOT NULL,
    "ai_calls" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."ai_usage_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_usage_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "usage_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "feature" "text" NOT NULL,
    "route" "text" NOT NULL,
    "model" "text" NOT NULL,
    "prompt_tokens" integer DEFAULT 0,
    "completion_tokens" integer DEFAULT 0,
    "total_tokens" integer DEFAULT 0,
    "estimated_cost" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reservation_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "prompt_version" "text",
    "prompt_family" "text",
    "prompt_source" "text"
);


ALTER TABLE "public"."ai_usage_events" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."ai_usage_logs" AS
 SELECT "id",
    "user_id",
    "usage_date",
    "feature",
    "route",
    "model",
    "prompt_tokens",
    "completion_tokens",
    "total_tokens",
    "estimated_cost",
    "created_at",
    "reservation_id",
    "metadata"
   FROM "public"."ai_usage_events";


ALTER VIEW "public"."ai_usage_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audio_overviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "material_id" "uuid",
    "audio_url" "text" NOT NULL,
    "transcript" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."audio_overviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."autopsy_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "test_name" "text",
    "exam_type" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source" "text",
    "idempotency_key" "text" NOT NULL,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "result_autopsy_id" "uuid",
    "error_message" "text",
    "processing_started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "autopsy_jobs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'processing'::"text", 'completed'::"text", 'needs_user_input'::"text", 'failed'::"text", 'dead_letter'::"text"])))
);


ALTER TABLE "public"."autopsy_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."autopsy_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "autopsy_id" "uuid" NOT NULL,
    "question_number" integer NOT NULL,
    "subject" "text" NOT NULL,
    "chapter" "text",
    "subtopic" "text",
    "difficulty" "text" DEFAULT 'Medium'::"text",
    "status" "text" NOT NULL,
    "correct_answer" "text",
    "student_answer" "text",
    "mistake_category" "text",
    "marks_lost" real DEFAULT 0,
    "suggested_fix" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "question_text" "text",
    "reasoning" "text",
    "ocr_confidence" numeric,
    "needs_review" boolean DEFAULT false,
    "extraction_confidence" numeric,
    "trace_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "evidence_status" "text" DEFAULT 'ignored_or_unverified'::"text" NOT NULL,
    "source_hash" "text",
    "trace_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "autopsy_questions_evidence_status_check" CHECK (("evidence_status" = ANY (ARRAY['verified_mistake'::"text", 'needs_review'::"text", 'ignored_or_unverified'::"text", 'corrected_by_user'::"text"])))
);


ALTER TABLE "public"."autopsy_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_memory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "embedding" "public"."vector"(768),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "novelty_score" numeric(4,2) DEFAULT 0,
    "emotional_score" numeric(4,2) DEFAULT 0,
    "learning_score" numeric(4,2) DEFAULT 0,
    "repetition_score" numeric(4,2) DEFAULT 0,
    "importance_score" numeric(4,2) DEFAULT 0,
    "source" "text" DEFAULT 'chat'::"text",
    "memory_type" "text" DEFAULT 'episodic'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "source_type" "text" DEFAULT 'global_chat'::"text" NOT NULL,
    "source_id" "text",
    "role" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "chat_memory_memory_type_check" CHECK (("memory_type" = ANY (ARRAY['episodic'::"text", 'semantic'::"text", 'procedural'::"text", 'learner_profile'::"text", 'concept_gap'::"text", 'mistake_pattern'::"text", 'preference'::"text", 'goal'::"text", 'behavioral_pattern'::"text"])))
);


ALTER TABLE "public"."chat_memory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "token_count" integer,
    "estimated_cost" numeric DEFAULT 0,
    "idempotency_key" "text",
    "emotional_state" "text",
    "intent" "text",
    "prompt_version" "text"
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_type" "text" NOT NULL,
    "concept_id" "uuid",
    "title" "text" NOT NULL,
    "summary" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_global" boolean DEFAULT false
);


ALTER TABLE "public"."chat_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."concept_aliases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "concept_id" "uuid" NOT NULL,
    "alias" "text" NOT NULL,
    "normalized_alias" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."concept_aliases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."concept_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source_concept_id" "uuid" NOT NULL,
    "target_concept_id" "uuid" NOT NULL,
    "link_type" "text" DEFAULT 'prerequisite'::"text",
    "strength" real DEFAULT 0.5,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "goal_id" "uuid"
);


ALTER TABLE "public"."concept_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."concept_mastery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "concept_id" "uuid" NOT NULL,
    "mastery_score" numeric DEFAULT 0 NOT NULL,
    "confidence" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."concept_mastery" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."concept_mastery_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "concept_id" "uuid",
    "evidence_type" "text",
    "evidence" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source" "text",
    "source_id" "text",
    "confidence" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."concept_mastery_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."concept_resolution_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "concept_id" "uuid",
    "source_type" "text" NOT NULL,
    "raw_subject" "text",
    "raw_chapter" "text",
    "raw_topic" "text",
    "normalized_subject" "text",
    "normalized_chapter" "text",
    "normalized_topic" "text",
    "method" "text" NOT NULL,
    "confidence" numeric,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."concept_resolution_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."concept_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "exam_type" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "chapter" "text" NOT NULL,
    "concepts_json" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "cache_key" "text"
);


ALTER TABLE "public"."concept_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."concepts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "chapter" "text" NOT NULL,
    "topic" "text" DEFAULT ''::"text",
    "mastery" "text" DEFAULT 'not_started'::"public"."mastery_level",
    "confidence" "public"."confidence_level" DEFAULT 'low'::"public"."confidence_level",
    "last_reviewed_at" timestamp with time zone,
    "times_reviewed" integer DEFAULT 0,
    "times_correct" integer DEFAULT 0,
    "times_incorrect" integer DEFAULT 0,
    "forgetting_probability" real DEFAULT 1.0,
    "retention_strength" real DEFAULT 0.0,
    "embedding" "public"."vector"(768),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "importance" "text" DEFAULT 'core'::"text",
    "version" integer DEFAULT 1,
    "goal_id" "uuid",
    "mastery_score" numeric DEFAULT 0,
    "forgetting" double precision,
    "normalized_subject" "text",
    "normalized_chapter" "text",
    "normalized_name" "text",
    "concept_key" "text",
    "description" "text"
);


ALTER TABLE "public"."concepts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consumer_locks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "consumer_name" "text" NOT NULL,
    "status" "public"."consumer_lock_status" DEFAULT 'PENDING'::"public"."consumer_lock_status",
    "worker_id" "text",
    "lease_expires_at" timestamp with time zone,
    "retry_count" integer DEFAULT 0,
    "next_retry_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "next_attempt_at" timestamp with time zone,
    "locked_at" timestamp with time zone,
    "locked_by" "text",
    "last_error" "text"
);


ALTER TABLE "public"."consumer_locks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan_date" "date" NOT NULL,
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "morning_briefing" "text",
    "summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dlq_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "data" "jsonb" NOT NULL,
    "error_message" "text",
    "failed_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "trace_id" "uuid" DEFAULT "gen_random_uuid"(),
    "version" "text" DEFAULT 'v1'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "resolved_at" timestamp with time zone,
    "resolution_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dlq_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."episodic_memories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "concept_id" "uuid",
    "type" "public"."memory_type" NOT NULL,
    "description" "text" NOT NULL,
    "emotional_context" "text",
    "importance_score" real DEFAULT 1.0,
    "decay_factor" real DEFAULT 0.05,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "last_recalled_at" timestamp without time zone,
    "embedding" "public"."vector"(768),
    "summary" "text" DEFAULT ''::"text" NOT NULL,
    "source_type" "text" DEFAULT 'system'::"text" NOT NULL,
    "source_id" "text",
    "emotional_salience" numeric(4,2) DEFAULT 0 NOT NULL,
    "retrieval_weight" numeric(6,3) DEFAULT 0 NOT NULL,
    "last_referenced_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."episodic_memories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "consumer_lock_id" "uuid",
    "worker_id" "text",
    "error_message" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "finished_at" timestamp with time zone,
    "result_status" "text",
    "result_reason" "text",
    "event_id" "uuid",
    "consumer_name" "text"
);


ALTER TABLE "public"."event_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_consumer_tracking" (
    "event_id" "uuid" NOT NULL,
    "consumer_name" "text" NOT NULL,
    "status" "text" DEFAULT 'processing'::"text" NOT NULL,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_consumer_tracking_status_check" CHECK (("status" = ANY (ARRAY['processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."event_consumer_tracking" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_dlq" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "consumer_name" "text",
    "payload" "jsonb",
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "event_type" "text",
    "event_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "resolved_at" timestamp with time zone,
    "resolution_notes" "text",
    "attempts" integer DEFAULT 0,
    "last_attempt_at" timestamp with time zone
);


ALTER TABLE "public"."event_dlq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "idempotency_key" "text",
    "type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "public"."event_status" DEFAULT 'PENDING'::"public"."event_status",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "retry_count" integer DEFAULT 0,
    "next_attempt_at" timestamp with time zone DEFAULT "now"(),
    "locked_at" timestamp with time zone,
    "locked_by" "text",
    "last_error" "text"
);


ALTER TABLE "public"."event_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feature_usage_daily" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "usage_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "chat_sessions" integer DEFAULT 0 NOT NULL,
    "autopsy_uploads" integer DEFAULT 0 NOT NULL,
    "revision_cards_reviewed" integer DEFAULT 0 NOT NULL,
    "study_sessions_completed" integer DEFAULT 0 NOT NULL,
    "tutor_turns" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."feature_usage_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."institute_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institute_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'student'::"text",
    "joined_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."institute_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."institutes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "stripe_subscription_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."institutes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learner_daily_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE,
    "confidence" real DEFAULT 0.5,
    "retention" real DEFAULT 0.9,
    "velocity" real DEFAULT 0.0,
    "hours_spent" real DEFAULT 0.0,
    "tasks_completed" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."learner_daily_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learner_event" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."learner_event" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."learner_event_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."learner_event_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."learner_event_id_seq" OWNED BY "public"."learner_event"."id";



CREATE TABLE IF NOT EXISTS "public"."learner_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."learner_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learner_state" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "exam_type" "text" DEFAULT 'NEET'::"text" NOT NULL,
    "target_score" integer,
    "current_score" integer,
    "study_hours_per_day" integer DEFAULT 8,
    "learning_style" "text" DEFAULT 'visual'::"text",
    "difficulty_tolerance" real DEFAULT 0.5,
    "focus_capacity_minutes" integer DEFAULT 45,
    "preferred_session_length" integer DEFAULT 60,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."learner_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learner_state_versions" (
    "user_id" "uuid" NOT NULL,
    "version" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."learner_state_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learner_states" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "overall_confidence" real DEFAULT 0.5,
    "estimated_retention" real DEFAULT 0.9,
    "weekly_velocity" real DEFAULT 0.0,
    "struggle_patterns" "jsonb" DEFAULT '[]'::"jsonb",
    "weak_areas" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "state_type" "text" DEFAULT 'aggregate'::"text"
);


ALTER TABLE "public"."learner_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learning_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "target_completion_date" timestamp without time zone,
    "confidence_score" real DEFAULT 0.5,
    "status" "text" DEFAULT 'active'::"text",
    "current_level" "text" DEFAULT 'beginner'::"text",
    "preferred_learning_style" "text" DEFAULT 'read_write'::"text",
    "daily_hours_available" integer DEFAULT 8,
    "milestones" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "deadline" "text",
    "time_available" "text",
    "roadmap" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."learning_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mastery_confidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mastery_id" "uuid" NOT NULL,
    "confidence" numeric DEFAULT 0 NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mastery_confidence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mastery_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "concept_id" "uuid" NOT NULL,
    "old_mastery" "text",
    "new_mastery" "text" NOT NULL,
    "source" "text" NOT NULL,
    "source_id" "text",
    "evidence" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "evidence_type" "text",
    "weight" numeric,
    "confidence" numeric,
    "source_event_id" "uuid"
);


ALTER TABLE "public"."mastery_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mastery_evidence_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mastery_id" "uuid" NOT NULL,
    "evidence_type" "text" NOT NULL,
    "strength" numeric DEFAULT 0 NOT NULL,
    "source_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mastery_evidence_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."material_chunks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "chunk_text" "text" NOT NULL,
    "embedding" "public"."vector"(768),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "fts_vector" "tsvector" GENERATED ALWAYS AS ("to_tsvector"('"english"'::"regconfig", "chunk_text")) STORED
);


ALTER TABLE "public"."material_chunks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "source_type" "text" DEFAULT 'text'::"text",
    "raw_content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "storage_path" "text",
    "file_size_bytes" integer,
    "mime_type" "text",
    "original_filename" "text"
);


ALTER TABLE "public"."materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mentor_chats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."mentor_chats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mistakes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "concept_id" "uuid",
    "category" "public"."mistake_category" NOT NULL,
    "subject" "text" NOT NULL,
    "chapter" "text" NOT NULL,
    "topic" "text" DEFAULT ''::"text",
    "question_text" "text",
    "user_answer" "text",
    "correct_answer" "text",
    "marks_lost" real DEFAULT 0,
    "total_marks" real DEFAULT 0,
    "time_spent_seconds" integer,
    "ai_analysis" "text",
    "improvement_suggestion" "text",
    "is_recurring" boolean DEFAULT false,
    "occurrence_count" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "source_autopsy_id" "uuid",
    "source_question_number" integer,
    "extraction_confidence" numeric,
    "status" "text" DEFAULT 'pending_review'::"text",
    "autopsy_id" "uuid",
    CONSTRAINT "mistakes_status_check" CHECK (("status" = ANY (ARRAY['pending_review'::"text", 'verified_mistake'::"text", 'rejected'::"text", 'corrected_by_user'::"text"])))
);


ALTER TABLE "public"."mistakes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."mistake_events" AS
 SELECT "id",
    "user_id",
    "concept_id",
    "category",
    "subject",
    "chapter",
    "topic",
    "question_text",
    "user_answer",
    "correct_answer",
    "marks_lost",
    "total_marks",
    "time_spent_seconds",
    "ai_analysis",
    "improvement_suggestion",
    "is_recurring",
    "occurrence_count",
    "created_at",
    "source_autopsy_id",
    "source_question_number",
    "extraction_confidence",
    "status"
   FROM "public"."mistakes";


ALTER VIEW "public"."mistake_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mock_autopsies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "test_name" "text" NOT NULL,
    "current_score" integer DEFAULT 0 NOT NULL,
    "potential_score" integer DEFAULT 0 NOT NULL,
    "recoverable_marks" integer DEFAULT 0 NOT NULL,
    "total_questions" integer,
    "exam_type" "text" DEFAULT 'General Study'::"text",
    "mentor_insight" "text",
    "mentor_quote" "text",
    "praise_roast_tag" "text",
    "confidence_level" "text" DEFAULT 'Medium'::"text",
    "ocr_raw_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "correct_count" integer DEFAULT 0,
    "incorrect_count" integer DEFAULT 0,
    "unattempted_count" integer DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "trace_id" "uuid",
    "idempotency_key" "text",
    "completed_at" timestamp with time zone,
    "error_message" "text",
    "status" "text" DEFAULT 'processing'::"text" NOT NULL
);


ALTER TABLE "public"."mock_autopsies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mock_tests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "test_name" "text" NOT NULL,
    "total_questions" integer NOT NULL,
    "attempted" integer DEFAULT 0,
    "correct" integer DEFAULT 0,
    "incorrect" integer DEFAULT 0,
    "unattempted" integer DEFAULT 0,
    "total_marks" real NOT NULL,
    "marks_obtained" real DEFAULT 0,
    "negative_marks" real DEFAULT 0,
    "time_taken" integer,
    "total_time" integer,
    "subject_wise" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."mock_tests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orchestrator_chats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "messages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."orchestrator_chats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outcome_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "snapshot_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "mock_score" numeric,
    "subject_scores" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "recoverable_marks" numeric,
    "mastery_percent" numeric,
    "revision_consistency" numeric,
    "summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."outcome_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."performance_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" timestamp with time zone NOT NULL,
    "study_minutes" integer DEFAULT 0,
    "concepts_learned" integer DEFAULT 0,
    "concepts_revised" integer DEFAULT 0,
    "questions_attempted" integer DEFAULT 0,
    "questions_correct" integer DEFAULT 0,
    "accuracy" real DEFAULT 0,
    "focus_score" real DEFAULT 0,
    "retention_rate" real DEFAULT 0,
    "emotional_state" "public"."emotional_state" DEFAULT 'neutral'::"public"."emotional_state",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."performance_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "exam_type" "text" DEFAULT 'neet'::"text",
    "target_year" integer,
    "target_score" integer,
    "current_score" integer,
    "study_hours_per_day" integer DEFAULT 8,
    "emotional_state" "public"."emotional_state" DEFAULT 'neutral'::"public"."emotional_state",
    "onboarding_complete" boolean DEFAULT false,
    "streak_days" integer DEFAULT 0,
    "last_active_at" timestamp with time zone,
    "stripe_customer_id" "text",
    "subscription_status" "text" DEFAULT 'free'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_active_date" "date",
    "atlas_seeding_status" "text" DEFAULT 'pending'::"text",
    "atlas_seeding_concepts_total" integer DEFAULT 0,
    "atlas_seeding_concepts_done" integer DEFAULT 0,
    "current_level" "text",
    "timezone" "text" DEFAULT 'UTC'::"text",
    "learner_state_version" integer DEFAULT 0 NOT NULL,
    "target_date" "date",
    "overall_mastery" numeric DEFAULT 0,
    "daily_hours_available" numeric,
    "daily_hours" numeric,
    "subjects" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "stripe_subscription_id" "text",
    CONSTRAINT "profiles_atlas_seeding_status_check" CHECK (("atlas_seeding_status" = ANY (ARRAY['pending'::"text", 'seeding'::"text", 'complete'::"text", 'failed'::"text"]))),
    CONSTRAINT "profiles_exam_type_check" CHECK (("exam_type" = ANY (ARRAY['neet'::"text", 'jee'::"text", 'jee-advanced'::"text", 'other'::"text"])))
);

ALTER TABLE ONLY "public"."profiles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_health" (
    "provider" "text" NOT NULL,
    "status" "text" DEFAULT 'healthy'::"text" NOT NULL,
    "last_checked" timestamp with time zone DEFAULT "now"() NOT NULL,
    "failure_reason" "text",
    CONSTRAINT "provider_health_status_check" CHECK (("status" = ANY (ARRAY['healthy'::"text", 'unhealthy'::"text"])))
);


ALTER TABLE "public"."provider_health" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pulse_signals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "signal_type" "text" NOT NULL,
    "emotional_state" "public"."emotional_state" NOT NULL,
    "confidence" real DEFAULT 0.5,
    "session_duration_minutes" integer,
    "recent_accuracy" real,
    "interaction_count" integer,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pulse_signals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rate_limit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limit_tokens" (
    "key" "text" NOT NULL,
    "tokens" numeric NOT NULL,
    "last_refill" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."rate_limit_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "key" "text" NOT NULL,
    "tokens" integer DEFAULT 0 NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recovery_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "autopsy_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "expected_marks_gain" integer DEFAULT 0 NOT NULL,
    "estimated_minutes" integer DEFAULT 60 NOT NULL,
    "tasks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recovery_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "card_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "elapsed_days" integer,
    "scheduled_days" integer,
    "review" timestamp with time zone DEFAULT "now"(),
    "state" integer
);


ALTER TABLE "public"."review_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."revision_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "concept_id" "uuid",
    "front" "text" NOT NULL,
    "back" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "chapter" "text" NOT NULL,
    "due" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stability" real DEFAULT 0,
    "difficulty" real DEFAULT 0,
    "elapsed_days" integer DEFAULT 0,
    "scheduled_days" integer DEFAULT 0,
    "reps" integer DEFAULT 0,
    "lapses" integer DEFAULT 0,
    "state" integer DEFAULT 0,
    "last_review" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "forgetting_probability" double precision DEFAULT 1.0,
    "source_type" "text",
    "source_id" "text",
    "source_hash" "text",
    "verified" boolean DEFAULT false NOT NULL,
    "confidence" numeric,
    "origin_event_id" "uuid",
    "normalized_key" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "revision_cards_state_check" CHECK ((("state" >= 0) AND ("state" <= 4)))
);


ALTER TABLE "public"."revision_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."revision_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "card_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "prev_stability" double precision,
    "new_stability" double precision,
    "prev_difficulty" double precision,
    "new_difficulty" double precision,
    "review_duration_ms" integer,
    "reviewed_at" timestamp with time zone DEFAULT "now"(),
    "elapsed_days" integer,
    "scheduled_days" integer,
    "state" integer,
    "response_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "revision_logs_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 4)))
);


ALTER TABLE "public"."revision_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."semantic_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "prompt_hash" "text" NOT NULL,
    "prompt_text" "text" NOT NULL,
    "response_text" "text" NOT NULL,
    "embedding" "public"."vector"(768),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "access_count" integer DEFAULT 0
);


ALTER TABLE "public"."semantic_cache" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."semantic_memories" AS
 SELECT "id",
    "user_id",
    "content",
    "embedding",
    "created_at",
    "novelty_score",
    "emotional_score",
    "learning_score",
    "repetition_score",
    "importance_score",
    "source",
    "memory_type",
    "updated_at"
   FROM "public"."chat_memory";


ALTER VIEW "public"."semantic_memories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "dayNumber" integer,
    "streakDays" integer,
    "focusTopic" "text",
    "subject" "text",
    "estimatedMinutes" integer,
    "rationale" "text",
    "daysToExam" integer,
    "overdueCards" integer,
    "masteryPercent" integer,
    "closingMessage" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "learner_state_version" integer DEFAULT 0 NOT NULL,
    "task_type" "text",
    "resource_type" "text",
    "target_concept_id" "uuid",
    "priority" "text",
    "is_completed" boolean DEFAULT false NOT NULL,
    "completed_at" timestamp with time zone,
    "selection_reason" "text",
    "mistake_count" integer DEFAULT 0,
    "weak_concept_count" integer DEFAULT 0,
    "has_active_goal" boolean DEFAULT false,
    "taskType" "text",
    "resourceType" "text",
    "targetConceptId" "uuid",
    "isCompleted" boolean DEFAULT false NOT NULL,
    "completedAt" timestamp with time zone,
    "selectionReason" "text",
    "mistakeCount" integer DEFAULT 0,
    "weakConceptCount" integer DEFAULT 0,
    "hasActiveGoal" boolean DEFAULT false
);


ALTER TABLE "public"."session_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_closing_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "session_closing_messages_type_check" CHECK (("type" = ANY (ARRAY['success'::"text", 'partial'::"text", 'gap_identified'::"text"])))
);


ALTER TABLE "public"."session_closing_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "data" "jsonb" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'pending'::"text",
    "idempotency_key" "text",
    "retry_count" integer DEFAULT 0,
    "error_message" "text",
    "version" "text" DEFAULT 'v1'::"text" NOT NULL,
    "trace_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_error" "text"
);


ALTER TABLE "public"."student_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_models" (
    "user_id" "uuid" NOT NULL,
    "learning_style" "text",
    "strengths" "text"[],
    "chronic_weaknesses" "jsonb",
    "behavioral_traps" "text"[],
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "optimal_pacing" "text" DEFAULT 'standard'::"text",
    "fatigue_threshold_minutes" integer DEFAULT 90,
    "comeback_probability" real DEFAULT 0.8,
    "explanation_preference" "text" DEFAULT 'conceptual_first'::"text",
    "peak_productivity_hour" integer DEFAULT 10,
    "last_updated_at" timestamp with time zone
);


ALTER TABLE "public"."student_models" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."study_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subject" "text",
    "chapter" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "ended_at" timestamp with time zone,
    "duration_minutes" integer,
    "focus_score" integer,
    "breaks_taken" integer DEFAULT 0,
    "notes" "text",
    "summary" "text",
    "topic" "text",
    "concept_name" "text",
    "understood" boolean DEFAULT false,
    "gap_found" "text",
    "cards_created" integer DEFAULT 0,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "date" "date" DEFAULT CURRENT_DATE,
    "session_type" "text" DEFAULT 'study'::"text",
    "is_completed" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."study_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."study_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "type" "public"."task_type" DEFAULT 'study'::"public"."task_type",
    "subject" "text",
    "chapter" "text",
    "priority" "public"."task_priority" DEFAULT 'medium'::"public"."task_priority",
    "estimated_minutes" integer DEFAULT 45,
    "scheduled_date" timestamp with time zone NOT NULL,
    "scheduled_start_time" "text",
    "is_completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "focus_score" integer,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."study_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tutor_session_states" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "concept_id" "uuid",
    "current_state" "text" DEFAULT 'DIAGNOSTIC'::"text" NOT NULL,
    "misconception_detected" "text",
    "turns_count" integer DEFAULT 0,
    "is_completed" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."tutor_session_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tutor_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "concept_id" "uuid",
    "messages" "jsonb" DEFAULT '[]'::"jsonb",
    "cognitive_level" "text" DEFAULT 'intermediate'::"text",
    "understanding_gained" integer DEFAULT 0,
    "summary" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "ended_at" timestamp with time zone,
    "session_id" "text",
    "topic" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "current_state" "text" DEFAULT 'DIAGNOSTIC'::"text",
    "misconception_detected" "text",
    "turns_count" integer DEFAULT 0,
    "is_completed" boolean DEFAULT false
);


ALTER TABLE "public"."tutor_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unresolved_concept_mentions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source_type" "text" NOT NULL,
    "exam_type" "text",
    "raw_subject" "text",
    "raw_chapter" "text",
    "raw_topic" "text",
    "question_text" "text",
    "normalized_subject" "text",
    "normalized_chapter" "text",
    "normalized_topic" "text",
    "confidence" numeric,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."unresolved_concept_mentions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."worker_health" (
    "worker_id" "text" NOT NULL,
    "last_heartbeat" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."worker_health" OWNER TO "postgres";


ALTER TABLE ONLY "public"."learner_event" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."learner_event_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."adaptation_logs"
    ADD CONSTRAINT "adaptation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_budget_reservations"
    ADD CONSTRAINT "ai_budget_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_usage_daily"
    ADD CONSTRAINT "ai_usage_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_usage_daily"
    ADD CONSTRAINT "ai_usage_daily_user_id_usage_date_key" UNIQUE ("user_id", "usage_date");



ALTER TABLE ONLY "public"."ai_usage_events"
    ADD CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audio_overviews"
    ADD CONSTRAINT "audio_overviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."autopsy_jobs"
    ADD CONSTRAINT "autopsy_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."autopsy_jobs"
    ADD CONSTRAINT "autopsy_jobs_user_id_idempotency_key_key" UNIQUE ("user_id", "idempotency_key");



ALTER TABLE ONLY "public"."autopsy_questions"
    ADD CONSTRAINT "autopsy_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_memory"
    ADD CONSTRAINT "chat_memory_embeddings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_sessions"
    ADD CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."concept_aliases"
    ADD CONSTRAINT "concept_aliases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."concept_aliases"
    ADD CONSTRAINT "concept_aliases_user_id_normalized_alias_key" UNIQUE ("user_id", "normalized_alias");



ALTER TABLE ONLY "public"."concept_links"
    ADD CONSTRAINT "concept_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."concept_mastery_events"
    ADD CONSTRAINT "concept_mastery_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."concept_mastery"
    ADD CONSTRAINT "concept_mastery_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."concept_mastery"
    ADD CONSTRAINT "concept_mastery_user_id_concept_id_key" UNIQUE ("user_id", "concept_id");



ALTER TABLE ONLY "public"."concept_resolution_logs"
    ADD CONSTRAINT "concept_resolution_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."concept_templates"
    ADD CONSTRAINT "concept_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."concepts"
    ADD CONSTRAINT "concepts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."concepts"
    ADD CONSTRAINT "concepts_user_subject_chapter_name_unique" UNIQUE ("user_id", "subject", "chapter", "name");



ALTER TABLE ONLY "public"."consumer_locks"
    ADD CONSTRAINT "consumer_locks_event_id_consumer_name_key" UNIQUE ("event_id", "consumer_name");



ALTER TABLE ONLY "public"."consumer_locks"
    ADD CONSTRAINT "consumer_locks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_plans"
    ADD CONSTRAINT "daily_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_plans"
    ADD CONSTRAINT "daily_plans_user_id_plan_date_key" UNIQUE ("user_id", "plan_date");



ALTER TABLE ONLY "public"."dlq_events"
    ADD CONSTRAINT "dlq_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."episodic_memories"
    ADD CONSTRAINT "episodic_memories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_attempts"
    ADD CONSTRAINT "event_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_consumer_tracking"
    ADD CONSTRAINT "event_consumer_tracking_pkey" PRIMARY KEY ("event_id", "consumer_name");



ALTER TABLE ONLY "public"."event_dlq"
    ADD CONSTRAINT "event_dlq_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_queue"
    ADD CONSTRAINT "event_queue_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."event_queue"
    ADD CONSTRAINT "event_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_usage_daily"
    ADD CONSTRAINT "feature_usage_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_usage_daily"
    ADD CONSTRAINT "feature_usage_daily_user_id_usage_date_key" UNIQUE ("user_id", "usage_date");



ALTER TABLE ONLY "public"."institute_memberships"
    ADD CONSTRAINT "institute_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."institutes"
    ADD CONSTRAINT "institutes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learner_daily_metrics"
    ADD CONSTRAINT "learner_daily_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learner_event"
    ADD CONSTRAINT "learner_event_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learner_events"
    ADD CONSTRAINT "learner_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learner_state"
    ADD CONSTRAINT "learner_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learner_state"
    ADD CONSTRAINT "learner_state_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."learner_state_versions"
    ADD CONSTRAINT "learner_state_versions_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."learner_states"
    ADD CONSTRAINT "learner_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learner_states"
    ADD CONSTRAINT "learner_states_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."learning_goals"
    ADD CONSTRAINT "learning_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mastery_confidence"
    ADD CONSTRAINT "mastery_confidence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mastery_events"
    ADD CONSTRAINT "mastery_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mastery_evidence_log"
    ADD CONSTRAINT "mastery_evidence_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_chunks"
    ADD CONSTRAINT "material_chunks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mentor_chats"
    ADD CONSTRAINT "mentor_chats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mistakes"
    ADD CONSTRAINT "mistakes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mock_autopsies"
    ADD CONSTRAINT "mock_autopsies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mock_tests"
    ADD CONSTRAINT "mock_tests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orchestrator_chats"
    ADD CONSTRAINT "orchestrator_chats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orchestrator_chats"
    ADD CONSTRAINT "orchestrator_chats_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."outcome_snapshots"
    ADD CONSTRAINT "outcome_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outcome_snapshots"
    ADD CONSTRAINT "outcome_snapshots_user_id_snapshot_date_key" UNIQUE ("user_id", "snapshot_date");



ALTER TABLE ONLY "public"."performance_snapshots"
    ADD CONSTRAINT "perf_snap_user_date" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."performance_snapshots"
    ADD CONSTRAINT "performance_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_health"
    ADD CONSTRAINT "provider_health_pkey" PRIMARY KEY ("provider");



ALTER TABLE ONLY "public"."pulse_signals"
    ADD CONSTRAINT "pulse_signals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limit_log"
    ADD CONSTRAINT "rate_limit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limit_tokens"
    ADD CONSTRAINT "rate_limit_tokens_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."recovery_plans"
    ADD CONSTRAINT "recovery_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_logs"
    ADD CONSTRAINT "review_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."revision_cards"
    ADD CONSTRAINT "revision_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."revision_logs"
    ADD CONSTRAINT "revision_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."semantic_cache"
    ADD CONSTRAINT "semantic_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."semantic_cache"
    ADD CONSTRAINT "semantic_cache_prompt_hash_key" UNIQUE ("prompt_hash");



ALTER TABLE ONLY "public"."session_cards"
    ADD CONSTRAINT "session_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_cards"
    ADD CONSTRAINT "session_cards_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."session_closing_messages"
    ADD CONSTRAINT "session_closing_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_events"
    ADD CONSTRAINT "student_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_models"
    ADD CONSTRAINT "student_models_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."study_sessions"
    ADD CONSTRAINT "study_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_tasks"
    ADD CONSTRAINT "study_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tutor_session_states"
    ADD CONSTRAINT "tutor_session_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tutor_sessions"
    ADD CONSTRAINT "tutor_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learner_daily_metrics"
    ADD CONSTRAINT "unique_user_date" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."unresolved_concept_mentions"
    ADD CONSTRAINT "unresolved_concept_mentions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_health"
    ADD CONSTRAINT "worker_health_pkey" PRIMARY KEY ("worker_id");



CREATE UNIQUE INDEX "chat_messages_idempotency_key_idx" ON "public"."chat_messages" USING "btree" ("user_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "dlq_events_resolved_at_idx" ON "public"."dlq_events" USING "btree" ("resolved_at");



CREATE INDEX "event_consumer_tracking_cron_idx" ON "public"."event_consumer_tracking" USING "btree" ("status", "retry_count", "updated_at");



CREATE INDEX "event_consumer_tracking_event_id_idx" ON "public"."event_consumer_tracking" USING "btree" ("event_id");



CREATE INDEX "event_consumer_tracking_status_idx" ON "public"."event_consumer_tracking" USING "btree" ("event_id", "status");



CREATE INDEX "idx_ai_budget_reservations_user_date" ON "public"."ai_budget_reservations" USING "btree" ("user_id", "usage_date", "status");



CREATE INDEX "idx_ai_budget_reservations_user_date_status" ON "public"."ai_budget_reservations" USING "btree" ("user_id", "usage_date", "status");



CREATE INDEX "idx_ai_usage_events_prompt_family" ON "public"."ai_usage_events" USING "btree" ("user_id", "prompt_family", "created_at" DESC);



CREATE INDEX "idx_ai_usage_events_user_created" ON "public"."ai_usage_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_ai_usage_events_user_date" ON "public"."ai_usage_events" USING "btree" ("user_id", "usage_date" DESC, "created_at" DESC);



CREATE INDEX "idx_autopsies_user" ON "public"."mock_autopsies" USING "btree" ("user_id", "created_at");



CREATE UNIQUE INDEX "idx_autopsy_jobs_idempotency" ON "public"."autopsy_jobs" USING "btree" ("user_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "idx_autopsy_jobs_status_created" ON "public"."autopsy_jobs" USING "btree" ("status", "created_at");



CREATE INDEX "idx_autopsy_jobs_user_created" ON "public"."autopsy_jobs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_autopsy_qs_autopsy" ON "public"."autopsy_questions" USING "btree" ("autopsy_id");



CREATE INDEX "idx_autopsy_questions_autopsy" ON "public"."autopsy_questions" USING "btree" ("autopsy_id", "question_number");



CREATE UNIQUE INDEX "idx_autopsy_questions_autopsy_qnum" ON "public"."autopsy_questions" USING "btree" ("autopsy_id", "question_number");



CREATE INDEX "idx_autopsy_questions_evidence_status" ON "public"."autopsy_questions" USING "btree" ("autopsy_id", "evidence_status");



CREATE UNIQUE INDEX "idx_autopsy_questions_unique_question" ON "public"."autopsy_questions" USING "btree" ("autopsy_id", "question_number");



CREATE INDEX "idx_autopsy_questions_user" ON "public"."autopsy_questions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_autopsy_questions_user_created" ON "public"."autopsy_questions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_autopsy_questions_verified" ON "public"."autopsy_questions" USING "btree" ("user_id", "evidence_status", "extraction_confidence" DESC) WHERE ("evidence_status" = 'verified_mistake'::"text");



CREATE INDEX "idx_chat_memory_embedding_hnsw" ON "public"."chat_memory" USING "hnsw" ("embedding" "public"."vector_cosine_ops");



CREATE INDEX "idx_chat_memory_embeddings_hnsw" ON "public"."chat_memory" USING "hnsw" ("embedding" "public"."vector_cosine_ops");



CREATE UNIQUE INDEX "idx_chat_memory_source_dedupe" ON "public"."chat_memory" USING "btree" ("user_id", "source_type", "source_id", "role") WHERE ("source_id" IS NOT NULL);



CREATE INDEX "idx_chat_memory_source_lookup" ON "public"."chat_memory" USING "btree" ("user_id", "source_type", "created_at" DESC);



CREATE INDEX "idx_chat_messages_lookup" ON "public"."chat_messages" USING "btree" ("session_id", "created_at" DESC);



CREATE INDEX "idx_chat_messages_session" ON "public"."chat_messages" USING "btree" ("session_id", "created_at" DESC);



CREATE INDEX "idx_chat_messages_session_created" ON "public"."chat_messages" USING "btree" ("session_id", "created_at");



CREATE INDEX "idx_chat_messages_user_created" ON "public"."chat_messages" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_chat_messages_user_idempotency" ON "public"."chat_messages" USING "btree" ("user_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE UNIQUE INDEX "idx_chat_sessions_one_global" ON "public"."chat_sessions" USING "btree" ("user_id") WHERE ("session_type" = 'global'::"text");



CREATE INDEX "idx_chat_sessions_user_created" ON "public"."chat_sessions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_concept_aliases_concept" ON "public"."concept_aliases" USING "btree" ("concept_id");



CREATE INDEX "idx_concept_aliases_user_alias" ON "public"."concept_aliases" USING "btree" ("user_id", "normalized_alias");



CREATE INDEX "idx_concept_links_user_created" ON "public"."concept_links" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_concept_mastery_events_user_created" ON "public"."concept_mastery_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_concept_mastery_user_concept" ON "public"."concept_mastery" USING "btree" ("user_id", "concept_id");



CREATE INDEX "idx_concept_resolution_logs_user" ON "public"."concept_resolution_logs" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_concept_templates_cache_key" ON "public"."concept_templates" USING "btree" ("cache_key");



CREATE INDEX "idx_concept_templates_exam_subject" ON "public"."concept_templates" USING "btree" ("exam_type", "subject");



CREATE UNIQUE INDEX "idx_concept_templates_lookup" ON "public"."concept_templates" USING "btree" ("exam_type", "subject", "chapter");



CREATE INDEX "idx_concepts_forgetting" ON "public"."concepts" USING "btree" ("user_id", "forgetting_probability" DESC);



CREATE INDEX "idx_concepts_hnsw" ON "public"."concepts" USING "hnsw" ("embedding" "public"."vector_ip_ops");



CREATE INDEX "idx_concepts_subject" ON "public"."concepts" USING "btree" ("user_id", "subject");



CREATE INDEX "idx_concepts_user" ON "public"."concepts" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_concepts_user_concept_key_unique" ON "public"."concepts" USING "btree" ("user_id", "concept_key") WHERE ("concept_key" IS NOT NULL);



CREATE INDEX "idx_concepts_user_created" ON "public"."concepts" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_concepts_user_mastery" ON "public"."concepts" USING "btree" ("user_id", "mastery");



CREATE INDEX "idx_concepts_user_subject_chapter" ON "public"."concepts" USING "btree" ("user_id", "subject", "chapter");



CREATE INDEX "idx_consumer_locks_event" ON "public"."consumer_locks" USING "btree" ("event_id");



CREATE INDEX "idx_consumer_locks_leasing" ON "public"."consumer_locks" USING "btree" ("status", "next_retry_at", "lease_expires_at");



CREATE INDEX "idx_consumer_locks_polling" ON "public"."consumer_locks" USING "btree" ("status", "next_attempt_at", "lease_expires_at", "created_at");



CREATE INDEX "idx_consumer_locks_status_next" ON "public"."consumer_locks" USING "btree" ("status", "next_attempt_at", "next_retry_at", "lease_expires_at");



CREATE INDEX "idx_consumer_tracking_status" ON "public"."event_consumer_tracking" USING "btree" ("consumer_name", "status");



CREATE INDEX "idx_daily_plans_user_date" ON "public"."daily_plans" USING "btree" ("user_id", "plan_date" DESC);



CREATE INDEX "idx_dlq_events_unresolved" ON "public"."dlq_events" USING "btree" ("created_at") WHERE ("resolved_at" IS NULL);



CREATE INDEX "idx_dlq_events_user" ON "public"."dlq_events" USING "btree" ("user_id");



CREATE INDEX "idx_ect_event_id" ON "public"."event_consumer_tracking" USING "btree" ("event_id");



CREATE INDEX "idx_ect_status" ON "public"."event_consumer_tracking" USING "btree" ("status");



CREATE INDEX "idx_episodic_memory_retrieval" ON "public"."episodic_memories" USING "btree" ("user_id", "retrieval_weight" DESC, "created_at" DESC);



CREATE UNIQUE INDEX "idx_episodic_memory_source_dedupe" ON "public"."episodic_memories" USING "btree" ("user_id", "source_type", "source_id") WHERE ("source_id" IS NOT NULL);



CREATE INDEX "idx_event_dlq_unresolved" ON "public"."event_dlq" USING "btree" ("created_at") WHERE ("resolved_at" IS NULL);



CREATE INDEX "idx_event_queue_polling" ON "public"."event_queue" USING "btree" ("status", "next_attempt_at", "created_at");



CREATE INDEX "idx_event_queue_status" ON "public"."event_queue" USING "btree" ("status", "next_attempt_at");



CREATE INDEX "idx_event_queue_status_next" ON "public"."event_queue" USING "btree" ("status", "next_attempt_at", "created_at");



CREATE INDEX "idx_event_queue_status_next_created" ON "public"."event_queue" USING "btree" ("status", "next_attempt_at", "created_at");



CREATE INDEX "idx_event_queue_user_type_created" ON "public"."event_queue" USING "btree" ("user_id", "type", "created_at" DESC);



CREATE INDEX "idx_learner_event_user" ON "public"."learner_event" USING "btree" ("user_id");



CREATE INDEX "idx_learner_state_versions_updated" ON "public"."learner_state_versions" USING "btree" ("user_id", "updated_at" DESC);



CREATE UNIQUE INDEX "idx_learner_states_user_state_type_unique" ON "public"."learner_states" USING "btree" ("user_id", "state_type");



CREATE INDEX "idx_learning_goals_user_created" ON "public"."learning_goals" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_learning_goals_user_status" ON "public"."learning_goals" USING "btree" ("user_id", "status");



CREATE INDEX "idx_mastery_confidence_mastery" ON "public"."mastery_confidence" USING "btree" ("mastery_id", "created_at" DESC);



CREATE INDEX "idx_mastery_events_concept" ON "public"."mastery_events" USING "btree" ("concept_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_mastery_events_idempotent_source" ON "public"."mastery_events" USING "btree" ("user_id", "concept_id", "evidence_type", "source", "source_id") WHERE (("source_id" IS NOT NULL) AND ("evidence_type" IS NOT NULL));



CREATE INDEX "idx_mastery_events_user" ON "public"."mastery_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_mastery_events_user_created" ON "public"."mastery_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_mastery_evidence_log_mastery" ON "public"."mastery_evidence_log" USING "btree" ("mastery_id", "created_at" DESC);



CREATE INDEX "idx_material_chunks_embedding_hnsw" ON "public"."material_chunks" USING "hnsw" ("embedding" "public"."vector_cosine_ops");



CREATE INDEX "idx_material_chunks_fts" ON "public"."material_chunks" USING "gin" ("fts_vector");



CREATE INDEX "idx_material_chunks_hnsw" ON "public"."material_chunks" USING "hnsw" ("embedding" "public"."vector_ip_ops");



CREATE INDEX "idx_materials_user_created" ON "public"."materials" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_mentor_user" ON "public"."mentor_chats" USING "btree" ("user_id", "created_at");



CREATE UNIQUE INDEX "idx_mistakes_dedup_source" ON "public"."mistakes" USING "btree" ("user_id", "source_autopsy_id", "source_question_number") WHERE (("source_autopsy_id" IS NOT NULL) AND ("source_question_number" IS NOT NULL));



CREATE INDEX "idx_mistakes_pending_review" ON "public"."mistakes" USING "btree" ("user_id", "status") WHERE ("status" = 'pending_review'::"text");



CREATE UNIQUE INDEX "idx_mistakes_unique_autopsy_question" ON "public"."mistakes" USING "btree" ("user_id", "source_autopsy_id", "source_question_number") WHERE (("source_autopsy_id" IS NOT NULL) AND ("source_question_number" IS NOT NULL));



CREATE INDEX "idx_mistakes_user" ON "public"."mistakes" USING "btree" ("user_id");



CREATE INDEX "idx_mistakes_user_created" ON "public"."mistakes" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_mock_autopsies_idempotency" ON "public"."mock_autopsies" USING "btree" ("user_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE UNIQUE INDEX "idx_mock_autopsies_idempotency_key" ON "public"."mock_autopsies" USING "btree" ("idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "idx_mock_autopsies_user_created" ON "public"."mock_autopsies" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_mock_autopsies_user_idempotency" ON "public"."mock_autopsies" USING "btree" ("user_id", (("metadata" ->> 'idempotency_key'::"text"))) WHERE ("metadata" ? 'idempotency_key'::"text");



CREATE INDEX "idx_perf_date" ON "public"."performance_snapshots" USING "btree" ("user_id", "date");



CREATE INDEX "idx_profiles_updated" ON "public"."profiles" USING "btree" ("id", "updated_at" DESC);



CREATE INDEX "idx_pulse_user" ON "public"."pulse_signals" USING "btree" ("user_id", "created_at");



CREATE INDEX "idx_rate_limit_key_created" ON "public"."rate_limit_log" USING "btree" ("key", "created_at");



CREATE INDEX "idx_rate_limits_expires_at" ON "public"."rate_limits" USING "btree" ("expires_at");



CREATE INDEX "idx_revision_cards_due" ON "public"."revision_cards" USING "btree" ("user_id", "due") WHERE ("state" <> 4);



CREATE UNIQUE INDEX "idx_revision_cards_source_unique" ON "public"."revision_cards" USING "btree" ("user_id", "source_type", "source_id") WHERE (("source_type" IS NOT NULL) AND ("source_id" IS NOT NULL));



CREATE UNIQUE INDEX "idx_revision_cards_unique_source" ON "public"."revision_cards" USING "btree" ("user_id", "source_type", "source_id", "source_hash") WHERE (("source_type" IS NOT NULL) AND ("source_id" IS NOT NULL) AND ("source_hash" IS NOT NULL));



CREATE INDEX "idx_revision_cards_user_created" ON "public"."revision_cards" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_revision_cards_user_due" ON "public"."revision_cards" USING "btree" ("user_id", "due");



CREATE UNIQUE INDEX "idx_revision_cards_user_normalized_key_unique" ON "public"."revision_cards" USING "btree" ("user_id", "normalized_key") WHERE ("normalized_key" IS NOT NULL);



CREATE INDEX "idx_revision_due" ON "public"."revision_cards" USING "btree" ("user_id", "due");



CREATE INDEX "idx_scm_user_id" ON "public"."session_closing_messages" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_session_cards_completed" ON "public"."session_cards" USING "btree" ("user_id", "date", "isCompleted");



CREATE INDEX "idx_session_cards_concept" ON "public"."session_cards" USING "btree" ("targetConceptId") WHERE ("targetConceptId" IS NOT NULL);



CREATE INDEX "idx_session_cards_user_created" ON "public"."session_cards" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_session_cards_user_date" ON "public"."session_cards" USING "btree" ("user_id", "date");



CREATE INDEX "idx_session_closing_messages_user" ON "public"."session_closing_messages" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_student_events_idempotency" ON "public"."student_events" USING "btree" ("user_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "idx_student_events_status" ON "public"."student_events" USING "btree" ("status", "created_at");



CREATE INDEX "idx_study_sessions_completed" ON "public"."study_sessions" USING "btree" ("user_id", "completed_at" DESC NULLS LAST);



CREATE UNIQUE INDEX "idx_study_sessions_completion_key" ON "public"."study_sessions" USING "btree" ("user_id", (("metadata" ->> 'completion_key'::"text"))) WHERE (("metadata" ? 'completion_key'::"text") AND (NULLIF(("metadata" ->> 'completion_key'::"text"), ''::"text") IS NOT NULL));



CREATE INDEX "idx_study_sessions_user_created" ON "public"."study_sessions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_study_sessions_user_date" ON "public"."study_sessions" USING "btree" ("user_id", "date");



CREATE INDEX "idx_tasks_date" ON "public"."study_tasks" USING "btree" ("user_id", "scheduled_date");



CREATE INDEX "idx_tutor_session_states_user_concept" ON "public"."tutor_session_states" USING "btree" ("user_id", "concept_id");



CREATE INDEX "idx_tutor_sessions_active" ON "public"."tutor_sessions" USING "btree" ("user_id", "is_completed", "created_at" DESC);



CREATE INDEX "idx_tutor_sessions_concept" ON "public"."tutor_sessions" USING "btree" ("concept_id");



CREATE INDEX "idx_tutor_sessions_session" ON "public"."tutor_sessions" USING "btree" ("session_id");



CREATE INDEX "idx_tutor_sessions_user" ON "public"."tutor_sessions" USING "btree" ("user_id", "started_at" DESC);



CREATE INDEX "idx_unresolved_concept_mentions_user" ON "public"."unresolved_concept_mentions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "rate_limits_expires_at_idx" ON "public"."rate_limits" USING "btree" ("expires_at");



CREATE INDEX "semantic_cache_embedding_idx" ON "public"."semantic_cache" USING "hnsw" ("embedding" "public"."vector_cosine_ops");



CREATE UNIQUE INDEX "student_events_user_id_idempotency_key_idx" ON "public"."student_events" USING "btree" ("user_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "student_events_user_id_status_idx" ON "public"."student_events" USING "btree" ("user_id", "status");



CREATE OR REPLACE TRIGGER "ensure_profile_before_session" BEFORE INSERT ON "public"."study_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_profile_exists"();



CREATE OR REPLACE TRIGGER "on_profile_created" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."initialize_student_model"();



CREATE OR REPLACE TRIGGER "on_profile_created_seed_syllabus" AFTER INSERT OR UPDATE OF "exam_type" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user_syllabus"();



CREATE OR REPLACE TRIGGER "set_consumer_tracking_updated_at" BEFORE UPDATE ON "public"."event_consumer_tracking" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_set_concept_canonical_fields" BEFORE INSERT OR UPDATE OF "subject", "chapter", "topic", "name" ON "public"."concepts" FOR EACH ROW EXECUTE FUNCTION "public"."set_concept_canonical_fields"();



CREATE OR REPLACE TRIGGER "tutor_sessions_updated_at" BEFORE UPDATE ON "public"."tutor_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."adaptation_logs"
    ADD CONSTRAINT "adaptation_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_budget_reservations"
    ADD CONSTRAINT "ai_budget_reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_usage_daily"
    ADD CONSTRAINT "ai_usage_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_usage_events"
    ADD CONSTRAINT "ai_usage_events_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."ai_budget_reservations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_usage_events"
    ADD CONSTRAINT "ai_usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."autopsy_jobs"
    ADD CONSTRAINT "autopsy_jobs_result_autopsy_id_fkey" FOREIGN KEY ("result_autopsy_id") REFERENCES "public"."mock_autopsies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."autopsy_jobs"
    ADD CONSTRAINT "autopsy_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."autopsy_questions"
    ADD CONSTRAINT "autopsy_questions_autopsy_id_fkey" FOREIGN KEY ("autopsy_id") REFERENCES "public"."mock_autopsies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."autopsy_questions"
    ADD CONSTRAINT "autopsy_questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_memory"
    ADD CONSTRAINT "chat_memory_embeddings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."concept_aliases"
    ADD CONSTRAINT "concept_aliases_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."concept_aliases"
    ADD CONSTRAINT "concept_aliases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."concept_links"
    ADD CONSTRAINT "concept_links_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."learning_goals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."concept_links"
    ADD CONSTRAINT "concept_links_source_concept_id_fkey" FOREIGN KEY ("source_concept_id") REFERENCES "public"."concepts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."concept_links"
    ADD CONSTRAINT "concept_links_target_concept_id_fkey" FOREIGN KEY ("target_concept_id") REFERENCES "public"."concepts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."concept_links"
    ADD CONSTRAINT "concept_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."concept_mastery"
    ADD CONSTRAINT "concept_mastery_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."concept_mastery_events"
    ADD CONSTRAINT "concept_mastery_events_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."concept_mastery_events"
    ADD CONSTRAINT "concept_mastery_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."concept_mastery"
    ADD CONSTRAINT "concept_mastery_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."concept_resolution_logs"
    ADD CONSTRAINT "concept_resolution_logs_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."concept_resolution_logs"
    ADD CONSTRAINT "concept_resolution_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."concepts"
    ADD CONSTRAINT "concepts_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."learning_goals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."concepts"
    ADD CONSTRAINT "concepts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consumer_locks"
    ADD CONSTRAINT "consumer_locks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."event_queue"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_plans"
    ADD CONSTRAINT "daily_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."episodic_memories"
    ADD CONSTRAINT "episodic_memories_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."episodic_memories"
    ADD CONSTRAINT "episodic_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_attempts"
    ADD CONSTRAINT "event_attempts_consumer_lock_id_fkey" FOREIGN KEY ("consumer_lock_id") REFERENCES "public"."consumer_locks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_consumer_tracking"
    ADD CONSTRAINT "event_consumer_tracking_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."student_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_dlq"
    ADD CONSTRAINT "event_dlq_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feature_usage_daily"
    ADD CONSTRAINT "feature_usage_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."institute_memberships"
    ADD CONSTRAINT "institute_memberships_institute_id_fkey" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."institute_memberships"
    ADD CONSTRAINT "institute_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."institutes"
    ADD CONSTRAINT "institutes_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learner_event"
    ADD CONSTRAINT "learner_event_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learner_events"
    ADD CONSTRAINT "learner_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learner_state"
    ADD CONSTRAINT "learner_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learner_state_versions"
    ADD CONSTRAINT "learner_state_versions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mastery_confidence"
    ADD CONSTRAINT "mastery_confidence_mastery_id_fkey" FOREIGN KEY ("mastery_id") REFERENCES "public"."concept_mastery"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mastery_events"
    ADD CONSTRAINT "mastery_events_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mastery_events"
    ADD CONSTRAINT "mastery_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mastery_evidence_log"
    ADD CONSTRAINT "mastery_evidence_log_mastery_id_fkey" FOREIGN KEY ("mastery_id") REFERENCES "public"."concept_mastery"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_chunks"
    ADD CONSTRAINT "material_chunks_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_chunks"
    ADD CONSTRAINT "material_chunks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mentor_chats"
    ADD CONSTRAINT "mentor_chats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mistakes"
    ADD CONSTRAINT "mistakes_autopsy_id_fkey" FOREIGN KEY ("autopsy_id") REFERENCES "public"."mock_autopsies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mistakes"
    ADD CONSTRAINT "mistakes_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id");



ALTER TABLE ONLY "public"."mistakes"
    ADD CONSTRAINT "mistakes_source_autopsy_id_fkey" FOREIGN KEY ("source_autopsy_id") REFERENCES "public"."mock_autopsies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mistakes"
    ADD CONSTRAINT "mistakes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mock_autopsies"
    ADD CONSTRAINT "mock_autopsies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mock_tests"
    ADD CONSTRAINT "mock_tests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outcome_snapshots"
    ADD CONSTRAINT "outcome_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."performance_snapshots"
    ADD CONSTRAINT "performance_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pulse_signals"
    ADD CONSTRAINT "pulse_signals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recovery_plans"
    ADD CONSTRAINT "recovery_plans_autopsy_id_fkey" FOREIGN KEY ("autopsy_id") REFERENCES "public"."mock_autopsies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_logs"
    ADD CONSTRAINT "review_logs_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."revision_cards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_logs"
    ADD CONSTRAINT "review_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."revision_cards"
    ADD CONSTRAINT "revision_cards_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id");



ALTER TABLE ONLY "public"."revision_cards"
    ADD CONSTRAINT "revision_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."revision_logs"
    ADD CONSTRAINT "revision_logs_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."revision_cards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."revision_logs"
    ADD CONSTRAINT "revision_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_cards"
    ADD CONSTRAINT "session_cards_targetConceptId_fkey" FOREIGN KEY ("targetConceptId") REFERENCES "public"."concepts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_cards"
    ADD CONSTRAINT "session_cards_target_concept_id_fkey" FOREIGN KEY ("target_concept_id") REFERENCES "public"."concepts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_cards"
    ADD CONSTRAINT "session_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_closing_messages"
    ADD CONSTRAINT "session_closing_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_models"
    ADD CONSTRAINT "student_models_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_sessions"
    ADD CONSTRAINT "study_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_tasks"
    ADD CONSTRAINT "study_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tutor_session_states"
    ADD CONSTRAINT "tutor_session_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tutor_sessions"
    ADD CONSTRAINT "tutor_sessions_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id");



ALTER TABLE ONLY "public"."tutor_sessions"
    ADD CONSTRAINT "tutor_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unresolved_concept_mentions"
    ADD CONSTRAINT "unresolved_concept_mentions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated users read concept_templates" ON "public"."concept_templates" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Deny all to semantic cache for authenticated users" ON "public"."semantic_cache" TO "authenticated" USING (false);



CREATE POLICY "Service role adaptation logs all" ON "public"."adaptation_logs" USING (true) WITH CHECK (true);



CREATE POLICY "Service role manages concept_mastery" ON "public"."concept_mastery" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "Service role manages concept_templates" ON "public"."concept_templates" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "Service role manages mastery_confidence" ON "public"."mastery_confidence" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "Service role manages mastery_evidence_log" ON "public"."mastery_evidence_log" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "Service role manages provider_health" ON "public"."provider_health" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "Service role manages session_closing_messages" ON "public"."session_closing_messages" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "Service role only" ON "public"."dlq_events" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role only" ON "public"."event_consumer_tracking" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Users access own autopsy_questions" ON "public"."autopsy_questions" USING (("autopsy_id" IN ( SELECT "mock_autopsies"."id"
   FROM "public"."mock_autopsies"
  WHERE ("mock_autopsies"."user_id" = "auth"."uid"())))) WITH CHECK (("autopsy_id" IN ( SELECT "mock_autopsies"."id"
   FROM "public"."mock_autopsies"
  WHERE ("mock_autopsies"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users access own chat_memory_embeddings" ON "public"."chat_memory" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own chat_messages" ON "public"."chat_messages" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own chat_sessions" ON "public"."chat_sessions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own concept_aliases" ON "public"."concept_aliases" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own concept_links" ON "public"."concept_links" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own concept_mastery" ON "public"."concept_mastery" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own concept_resolution_logs" ON "public"."concept_resolution_logs" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own concepts" ON "public"."concepts" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own daily_plans" ON "public"."daily_plans" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own episodic_memories" ON "public"."episodic_memories" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own events" ON "public"."student_events" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own feature_usage_daily" ON "public"."feature_usage_daily" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own global chats" ON "public"."orchestrator_chats" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own institutes" ON "public"."institutes" USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users access own learner_events" ON "public"."learner_events" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own learner_state" ON "public"."learner_state" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own learning_goals" ON "public"."learning_goals" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own mastery_events" ON "public"."mastery_events" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own material_chunks" ON "public"."material_chunks" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own materials" ON "public"."materials" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own memberships" ON "public"."institute_memberships" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own mentor_chats" ON "public"."mentor_chats" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own mistakes" ON "public"."mistakes" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own mock_autopsies" ON "public"."mock_autopsies" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own mock_tests" ON "public"."mock_tests" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own outcome_snapshots" ON "public"."outcome_snapshots" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own perf_snapshots" ON "public"."performance_snapshots" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own profile" ON "public"."profiles" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users access own recovery_plans" ON "public"."recovery_plans" USING (("autopsy_id" IN ( SELECT "mock_autopsies"."id"
   FROM "public"."mock_autopsies"
  WHERE ("mock_autopsies"."user_id" = "auth"."uid"())))) WITH CHECK (("autopsy_id" IN ( SELECT "mock_autopsies"."id"
   FROM "public"."mock_autopsies"
  WHERE ("mock_autopsies"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users access own review_logs" ON "public"."review_logs" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own revision_cards" ON "public"."revision_cards" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own session_closing_messages" ON "public"."session_closing_messages" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own student_models" ON "public"."student_models" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own study_sessions" ON "public"."study_sessions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own study_tasks" ON "public"."study_tasks" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own tutor_sessions" ON "public"."tutor_sessions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own unresolved_concept_mentions" ON "public"."unresolved_concept_mentions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can access their own memory embeddings" ON "public"."chat_memory" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can access their own tutor states" ON "public"."tutor_session_states" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own adaptation logs" ON "public"."adaptation_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own audio overviews" ON "public"."audio_overviews" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own chat messages" ON "public"."chat_messages" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own chat sessions" ON "public"."chat_sessions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own daily metrics" ON "public"."learner_daily_metrics" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own dlq events" ON "public"."dlq_events" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own episodic memories" ON "public"."episodic_memories" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own global chats" ON "public"."orchestrator_chats" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own learner states" ON "public"."learner_states" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own learning goals" ON "public"."learning_goals" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own student events" ON "public"."student_events" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own adaptation logs" ON "public"."adaptation_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own mastery_confidence" ON "public"."mastery_confidence" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."concept_mastery" "cm"
  WHERE (("cm"."id" = "mastery_confidence"."mastery_id") AND ("cm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users insert own mastery_evidence_log" ON "public"."mastery_evidence_log" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."concept_mastery" "cm"
  WHERE (("cm"."id" = "mastery_evidence_log"."mastery_id") AND ("cm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users view own ai_usage_daily" ON "public"."ai_usage_daily" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own ai_usage_events" ON "public"."ai_usage_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own mastery_confidence" ON "public"."mastery_confidence" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."concept_mastery" "cm"
  WHERE (("cm"."id" = "mastery_confidence"."mastery_id") AND ("cm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users view own mastery_evidence_log" ON "public"."mastery_evidence_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."concept_mastery" "cm"
  WHERE (("cm"."id" = "mastery_evidence_log"."mastery_id") AND ("cm"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."adaptation_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_budget_reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_usage_daily" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_usage_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audio_overviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."autopsy_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."autopsy_questions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "autopsy_questions_owner" ON "public"."autopsy_questions" USING ((EXISTS ( SELECT 1
   FROM "public"."mock_autopsies" "ma"
  WHERE (("ma"."id" = "autopsy_questions"."autopsy_id") AND ("ma"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."chat_memory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."concept_aliases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."concept_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "concept_links_owner" ON "public"."concept_links" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."concept_mastery" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."concept_mastery_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."concept_resolution_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."concept_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "concept_templates_insert_service" ON "public"."concept_templates" FOR INSERT WITH CHECK (true);



CREATE POLICY "concept_templates_read_all" ON "public"."concept_templates" FOR SELECT USING (true);



ALTER TABLE "public"."concepts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "concepts_owner" ON "public"."concepts" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."consumer_locks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dlq_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "educators_read_institute_student_autopsies" ON "public"."mock_autopsies" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."institute_memberships" "viewer_mem"
     JOIN "public"."institute_memberships" "student_mem" ON (("student_mem"."institute_id" = "viewer_mem"."institute_id")))
  WHERE (("viewer_mem"."user_id" = "auth"."uid"()) AND ("viewer_mem"."role" = 'educator'::"text") AND ("student_mem"."user_id" = "mock_autopsies"."user_id") AND ("student_mem"."role" = 'student'::"text")))));



CREATE POLICY "educators_read_institute_student_concepts" ON "public"."concepts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."institute_memberships" "viewer_mem"
     JOIN "public"."institute_memberships" "student_mem" ON (("student_mem"."institute_id" = "viewer_mem"."institute_id")))
  WHERE (("viewer_mem"."user_id" = "auth"."uid"()) AND ("viewer_mem"."role" = 'educator'::"text") AND ("student_mem"."user_id" = "concepts"."user_id") AND ("student_mem"."role" = 'student'::"text")))));



CREATE POLICY "educators_read_institute_student_profiles" ON "public"."profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."institute_memberships" "viewer_mem"
     JOIN "public"."institute_memberships" "student_mem" ON (("student_mem"."institute_id" = "viewer_mem"."institute_id")))
  WHERE (("viewer_mem"."user_id" = "auth"."uid"()) AND ("viewer_mem"."role" = 'educator'::"text") AND ("student_mem"."user_id" = "profiles"."id") AND ("student_mem"."role" = 'student'::"text")))));



ALTER TABLE "public"."episodic_memories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_consumer_tracking" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_dlq" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feature_usage_daily" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."institute_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."institutes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "institutes_owner" ON "public"."institutes" USING (("auth"."uid"() = "owner_id"));



ALTER TABLE "public"."learner_daily_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learner_event" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learner_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learner_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learner_state_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learner_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learning_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mastery_confidence" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mastery_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mastery_evidence_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_chunks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "material_chunks_owner" ON "public"."material_chunks" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."materials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "materials_owner" ON "public"."materials" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "memberships_owner_view" ON "public"."institute_memberships" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."institutes" "i"
  WHERE (("i"."id" = "institute_memberships"."institute_id") AND ("i"."owner_id" = "auth"."uid"())))));



CREATE POLICY "memberships_self" ON "public"."institute_memberships" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."mentor_chats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mistakes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mistakes_owner" ON "public"."mistakes" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."mock_autopsies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mock_autopsies_owner" ON "public"."mock_autopsies" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."mock_tests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orchestrator_chats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orchestrator_chats_owner" ON "public"."orchestrator_chats" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."outcome_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "perf_snapshots_owner" ON "public"."performance_snapshots" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."performance_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_delete_own" ON "public"."profiles" FOR DELETE USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_self" ON "public"."profiles" USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."provider_health" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pulse_signals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pulse_signals_owner" ON "public"."pulse_signals" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."rate_limit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limit_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recovery_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recovery_plans_owner" ON "public"."recovery_plans" USING ((EXISTS ( SELECT 1
   FROM "public"."mock_autopsies" "ma"
  WHERE (("ma"."id" = "recovery_plans"."autopsy_id") AND ("ma"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."review_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_logs_owner" ON "public"."review_logs" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."revision_cards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "revision_cards_owner" ON "public"."revision_cards" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "select_concept_templates" ON "public"."concept_templates" FOR SELECT USING (true);



ALTER TABLE "public"."semantic_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service role only" ON "public"."rate_limit_log" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_ai_budget_reservations" ON "public"."ai_budget_reservations" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "service_role_all_ai_usage_daily" ON "public"."ai_usage_daily" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "service_role_all_ai_usage_events" ON "public"."ai_usage_events" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "service_role_all_autopsy_jobs" ON "public"."autopsy_jobs" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "service_role_all_autopsy_questions" ON "public"."autopsy_questions" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "service_role_all_chat_messages" ON "public"."chat_messages" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "service_role_all_chat_sessions" ON "public"."chat_sessions" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "service_role_all_concepts" ON "public"."concepts" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "service_role_all_consumer_locks" ON "public"."consumer_locks" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "service_role_all_event_attempts" ON "public"."event_attempts" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "service_role_all_event_dlq" ON "public"."event_dlq" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "service_role_all_event_queue" ON "public"."event_queue" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "service_role_all_learner_states" ON "public"."learner_states" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "service_role_all_learning_goals" ON "public"."learning_goals" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "service_role_all_mock_autopsies" ON "public"."mock_autopsies" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "service_role_all_revision_cards" ON "public"."revision_cards" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "service_role_all_session_cards" ON "public"."session_cards" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



CREATE POLICY "service_role_all_worker_health" ON "public"."worker_health" USING (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text")) WITH CHECK (("current_setting"('request.jwt.claim.role'::"text", true) = 'service_role'::"text"));



ALTER TABLE "public"."session_cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_closing_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_events_owner" ON "public"."student_events" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."student_models" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_models_owner" ON "public"."student_models" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."study_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."study_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "study_tasks_owner" ON "public"."study_tasks" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."tutor_session_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tutor_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tutor_sessions_insert_own" ON "public"."tutor_sessions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "tutor_sessions_owner" ON "public"."tutor_sessions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "tutor_sessions_select_own" ON "public"."tutor_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "tutor_sessions_update_own" ON "public"."tutor_sessions" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."unresolved_concept_mentions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_all_own_ai_usage_daily" ON "public"."ai_usage_daily" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_all_own_ai_usage_events" ON "public"."ai_usage_events" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_all_own_autopsy_jobs" ON "public"."autopsy_jobs" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_all_own_autopsy_questions" ON "public"."autopsy_questions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_all_own_chat_messages" ON "public"."chat_messages" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_all_own_chat_sessions" ON "public"."chat_sessions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_all_own_concept_aliases" ON "public"."concept_aliases" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_all_own_concept_links" ON "public"."concept_links" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_all_own_concept_mastery_events" ON "public"."concept_mastery_events" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_all_own_concepts" ON "public"."concepts" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_all_own_learner_state_versions" ON "public"."learner_state_versions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_all_own_learner_states" ON "public"."learner_states" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_all_own_learning_goals" ON "public"."learning_goals" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_all_own_mastery_events" ON "public"."mastery_events" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_all_own_mock_autopsies" ON "public"."mock_autopsies" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_all_own_profiles" ON "public"."profiles" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "users_all_own_revision_cards" ON "public"."revision_cards" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_all_own_session_cards" ON "public"."session_cards" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_all_own_study_sessions" ON "public"."study_sessions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users_own_closing_messages" ON "public"."session_closing_messages" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_own_memories" ON "public"."chat_memory" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_own_tutor_states" ON "public"."tutor_session_states" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_select_own_ai_usage_events" ON "public"."ai_usage_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_select_own_autopsy_questions" ON "public"."autopsy_questions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_select_own_chat_messages" ON "public"."chat_messages" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_select_own_chat_sessions" ON "public"."chat_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_select_own_concepts" ON "public"."concepts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_select_own_event_queue" ON "public"."event_queue" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_select_own_learner_states" ON "public"."learner_states" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_select_own_learning_goals" ON "public"."learning_goals" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_select_own_mistakes" ON "public"."mistakes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_select_own_mock_autopsies" ON "public"."mock_autopsies" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_select_own_revision_cards" ON "public"."revision_cards" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."worker_health" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."student_events";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."acquire_event_leases"("p_worker_id" "text", "p_limit" integer, "p_lease_timeout" interval) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."acquire_event_leases"("p_worker_id" "text", "p_limit" integer, "p_lease_timeout" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."acquire_event_leases"("p_worker_id" "text", "p_limit" integer, "p_lease_timeout" interval) TO "service_role";



REVOKE ALL ON FUNCTION "public"."atomic_ai_budget_spend"("p_user_id" "uuid", "p_feature" "text", "p_model" "text", "p_cost" numeric, "p_prompt_tokens" integer, "p_completion_tokens" integer, "p_route" "text", "p_daily_limit_usd" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."atomic_ai_budget_spend"("p_user_id" "uuid", "p_feature" "text", "p_model" "text", "p_cost" numeric, "p_prompt_tokens" integer, "p_completion_tokens" integer, "p_route" "text", "p_daily_limit_usd" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."atomic_ai_budget_spend"("p_user_id" "uuid", "p_feature" "text", "p_model" "text", "p_cost" numeric, "p_prompt_tokens" integer, "p_completion_tokens" integer, "p_route" "text", "p_daily_limit_usd" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."atomic_replan"("p_user_id" "uuid", "p_scheduled_date" timestamp with time zone, "p_tasks" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."atomic_replan"("p_user_id" "uuid", "p_scheduled_date" timestamp with time zone, "p_tasks" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."atomic_replan"("p_user_id" "uuid", "p_scheduled_date" timestamp with time zone, "p_tasks" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_and_increment_usage_gate"("p_user_id" "uuid", "p_gate" "text", "p_limit" integer, "p_amount" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_and_increment_usage_gate"("p_user_id" "uuid", "p_gate" "text", "p_limit" integer, "p_amount" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_ip" "text", "p_limit" integer, "p_window_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_ip" "text", "p_limit" integer, "p_window_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_ip" "text", "p_limit" integer, "p_window_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."commit_ai_usage"("p_reservation_id" "uuid", "p_actual_cost" numeric, "p_prompt_tokens" integer, "p_completion_tokens" integer, "p_route" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."commit_ai_usage"("p_reservation_id" "uuid", "p_actual_cost" numeric, "p_prompt_tokens" integer, "p_completion_tokens" integer, "p_route" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."commit_ai_usage"("p_reservation_id" "uuid", "p_actual_cost" numeric, "p_prompt_tokens" integer, "p_completion_tokens" integer, "p_route" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."complete_daily_session_card"("p_user_id" "uuid", "p_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_daily_session_card"("p_user_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_daily_session_card"("p_user_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_daily_session_card"("p_user_id" "uuid", "p_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."complete_study_session"("p_user_id" "uuid", "p_subject" "text", "p_chapter" "text", "p_topic" "text", "p_concept_name" "text", "p_duration_minutes" integer, "p_understood" boolean, "p_gap_found" "text", "p_cards_created" integer, "p_session_type" "text", "p_task_id" "uuid", "p_concept_id" "uuid", "p_completion_key" "text", "p_source" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_study_session"("p_user_id" "uuid", "p_subject" "text", "p_chapter" "text", "p_topic" "text", "p_concept_name" "text", "p_duration_minutes" integer, "p_understood" boolean, "p_gap_found" "text", "p_cards_created" integer, "p_session_type" "text", "p_task_id" "uuid", "p_concept_id" "uuid", "p_completion_key" "text", "p_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_study_session"("p_user_id" "uuid", "p_subject" "text", "p_chapter" "text", "p_topic" "text", "p_concept_name" "text", "p_duration_minutes" integer, "p_understood" boolean, "p_gap_found" "text", "p_cards_created" integer, "p_session_type" "text", "p_task_id" "uuid", "p_concept_id" "uuid", "p_completion_key" "text", "p_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_study_session"("p_user_id" "uuid", "p_subject" "text", "p_chapter" "text", "p_topic" "text", "p_concept_name" "text", "p_duration_minutes" integer, "p_understood" boolean, "p_gap_found" "text", "p_cards_created" integer, "p_session_type" "text", "p_task_id" "uuid", "p_concept_id" "uuid", "p_completion_key" "text", "p_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_event_with_consumers"("p_user_id" "uuid", "p_type" "text", "p_data" "jsonb", "p_idempotency_key" "text", "p_source" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_event_with_consumers"("p_user_id" "uuid", "p_type" "text", "p_data" "jsonb", "p_idempotency_key" "text", "p_source" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_event_with_consumers"("p_user_id" "uuid", "p_type" "text", "p_data" "jsonb", "p_idempotency_key" "text", "p_source" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_profile_exists"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_profile_exists"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_profile_exists"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."expire_stale_ai_reservations"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expire_stale_ai_reservations"() TO "anon";
GRANT ALL ON FUNCTION "public"."expire_stale_ai_reservations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_salient_memories"("p_user_id" "uuid", "p_query_embedding" "public"."vector", "p_pulse_state" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_salient_memories"("p_user_id" "uuid", "p_query_embedding" "public"."vector", "p_pulse_state" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_salient_memories"("p_user_id" "uuid", "p_query_embedding" "public"."vector", "p_pulse_state" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_syllabus"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_syllabus"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_syllabus"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hybrid_search_chunks"("p_user_id" "uuid", "p_query_text" "text", "p_query_embedding" "public"."vector", "p_match_count" integer, "p_full_text_weight" double precision, "p_semantic_weight" double precision, "p_rrf_k" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."hybrid_search_chunks"("p_user_id" "uuid", "p_query_text" "text", "p_query_embedding" "public"."vector", "p_match_count" integer, "p_full_text_weight" double precision, "p_semantic_weight" double precision, "p_rrf_k" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hybrid_search_chunks"("p_user_id" "uuid", "p_query_text" "text", "p_query_embedding" "public"."vector", "p_match_count" integer, "p_full_text_weight" double precision, "p_semantic_weight" double precision, "p_rrf_k" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_cache_access"("cache_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_cache_access"("cache_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_cache_access"("cache_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_daily_tasks_completed"("p_user_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_daily_tasks_completed"("p_user_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_daily_tasks_completed"("p_user_id" "uuid", "p_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ingest_autopsy_document"("p_user_id" "uuid", "p_filename" "text", "p_file_url" "text", "p_file_type" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ingest_autopsy_document"("p_user_id" "uuid", "p_filename" "text", "p_file_url" "text", "p_file_type" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_metadata" "jsonb") TO "anon";



REVOKE ALL ON FUNCTION "public"."ingest_mock_autopsy"("p_user_id" "uuid", "p_test_name" "text", "p_exam_type" "text", "p_total_questions" integer, "p_correct_count" integer, "p_incorrect_count" integer, "p_unattempted_count" integer, "p_current_score" numeric, "p_recoverable_marks" numeric, "p_potential_score" numeric, "p_questions" "jsonb", "p_idempotency_key" "text", "p_trace_id" "uuid", "p_confidence_threshold" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ingest_mock_autopsy"("p_user_id" "uuid", "p_test_name" "text", "p_exam_type" "text", "p_total_questions" integer, "p_correct_count" integer, "p_incorrect_count" integer, "p_unattempted_count" integer, "p_current_score" numeric, "p_recoverable_marks" numeric, "p_potential_score" numeric, "p_questions" "jsonb", "p_idempotency_key" "text", "p_trace_id" "uuid", "p_confidence_threshold" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."ingest_mock_autopsy"("p_user_id" "uuid", "p_test_name" "text", "p_exam_type" "text", "p_total_questions" integer, "p_correct_count" integer, "p_incorrect_count" integer, "p_unattempted_count" integer, "p_current_score" numeric, "p_recoverable_marks" numeric, "p_potential_score" numeric, "p_questions" "jsonb", "p_idempotency_key" "text", "p_trace_id" "uuid", "p_confidence_threshold" numeric) TO "authenticated";



GRANT ALL ON FUNCTION "public"."initialize_student_model"() TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_student_model"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_student_model"() TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



REVOKE ALL ON FUNCTION "public"."invalidate_session_card"("p_user_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invalidate_session_card"("p_user_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."invalidate_session_card"("p_user_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invalidate_session_card"("p_user_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



REVOKE ALL ON FUNCTION "public"."match_chat_memory"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."match_chat_memory"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_chat_memory"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_chat_memory"("query_embedding" "public"."vector", "p_user_id" "uuid", "match_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_chat_memory"("query_embedding" "public"."vector", "p_user_id" "uuid", "match_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_chat_memory"("query_embedding" "public"."vector", "p_user_id" "uuid", "match_threshold" double precision, "match_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."match_concepts"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."match_concepts"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."match_concepts"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_concepts"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_material_chunks"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."match_material_chunks"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_material_chunks"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."match_semantic_cache"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."match_semantic_cache"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_semantic_cache"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."match_semantic_cache"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."match_semantic_cache"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_semantic_cache"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_academic_chapter"("p_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_academic_chapter"("p_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_academic_chapter"("p_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_academic_subject"("p_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_academic_subject"("p_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_academic_subject"("p_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_academic_text"("p_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_academic_text"("p_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_academic_text"("p_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_autopsy_transaction"("p_user_id" "uuid", "p_mock_id" "uuid", "p_score" integer, "p_recoverable_marks" integer, "p_atlas_updates" "jsonb"[], "p_memory_cards" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."process_autopsy_transaction"("p_user_id" "uuid", "p_mock_id" "uuid", "p_score" integer, "p_recoverable_marks" integer, "p_atlas_updates" "jsonb"[], "p_memory_cards" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_autopsy_transaction"("p_user_id" "uuid", "p_mock_id" "uuid", "p_score" integer, "p_recoverable_marks" integer, "p_atlas_updates" "jsonb"[], "p_memory_cards" "jsonb"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."release_ai_budget"("p_reservation_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."release_ai_budget"("p_reservation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."release_ai_budget"("p_reservation_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reserve_ai_budget"("p_user_id" "uuid", "p_feature" "text", "p_model" "text", "p_estimated_cost" numeric, "p_estimated_tokens" integer, "p_daily_limit_usd" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_ai_budget"("p_user_id" "uuid", "p_feature" "text", "p_model" "text", "p_estimated_cost" numeric, "p_estimated_tokens" integer, "p_daily_limit_usd" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."reserve_ai_budget"("p_user_id" "uuid", "p_feature" "text", "p_model" "text", "p_estimated_cost" numeric, "p_estimated_tokens" integer, "p_daily_limit_usd" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_broken_streaks"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_broken_streaks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_broken_streaks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_syllabus_for_user"("p_user_id" "uuid", "p_exam_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_syllabus_for_user"("p_user_id" "uuid", "p_exam_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_syllabus_for_user"("p_user_id" "uuid", "p_exam_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_concept_canonical_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_concept_canonical_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_concept_canonical_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_learner_state_incrementally"("p_user_id" "uuid", "p_confidence_delta" numeric, "p_retention_delta" numeric, "p_velocity_delta" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_learner_state_incrementally"("p_user_id" "uuid", "p_confidence_delta" numeric, "p_retention_delta" numeric, "p_velocity_delta" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_learner_state_incrementally"("p_user_id" "uuid", "p_confidence_delta" numeric, "p_retention_delta" numeric, "p_velocity_delta" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";









GRANT ALL ON TABLE "public"."adaptation_logs" TO "anon";
GRANT ALL ON TABLE "public"."adaptation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."adaptation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."ai_budget_reservations" TO "anon";
GRANT ALL ON TABLE "public"."ai_budget_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_budget_reservations" TO "service_role";



GRANT ALL ON TABLE "public"."ai_usage_daily" TO "anon";
GRANT ALL ON TABLE "public"."ai_usage_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_usage_daily" TO "service_role";



GRANT ALL ON TABLE "public"."ai_usage_events" TO "anon";
GRANT ALL ON TABLE "public"."ai_usage_events" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_usage_events" TO "service_role";



GRANT ALL ON TABLE "public"."ai_usage_logs" TO "anon";
GRANT ALL ON TABLE "public"."ai_usage_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_usage_logs" TO "service_role";



GRANT ALL ON TABLE "public"."audio_overviews" TO "anon";
GRANT ALL ON TABLE "public"."audio_overviews" TO "authenticated";
GRANT ALL ON TABLE "public"."audio_overviews" TO "service_role";



GRANT ALL ON TABLE "public"."autopsy_jobs" TO "anon";
GRANT ALL ON TABLE "public"."autopsy_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."autopsy_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."autopsy_questions" TO "anon";
GRANT ALL ON TABLE "public"."autopsy_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."autopsy_questions" TO "service_role";



GRANT ALL ON TABLE "public"."chat_memory" TO "anon";
GRANT ALL ON TABLE "public"."chat_memory" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_memory" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."chat_sessions" TO "anon";
GRANT ALL ON TABLE "public"."chat_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."concept_aliases" TO "anon";
GRANT ALL ON TABLE "public"."concept_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."concept_aliases" TO "service_role";



GRANT ALL ON TABLE "public"."concept_links" TO "anon";
GRANT ALL ON TABLE "public"."concept_links" TO "authenticated";
GRANT ALL ON TABLE "public"."concept_links" TO "service_role";



GRANT ALL ON TABLE "public"."concept_mastery" TO "anon";
GRANT ALL ON TABLE "public"."concept_mastery" TO "authenticated";
GRANT ALL ON TABLE "public"."concept_mastery" TO "service_role";



GRANT ALL ON TABLE "public"."concept_mastery_events" TO "anon";
GRANT ALL ON TABLE "public"."concept_mastery_events" TO "authenticated";
GRANT ALL ON TABLE "public"."concept_mastery_events" TO "service_role";



GRANT ALL ON TABLE "public"."concept_resolution_logs" TO "anon";
GRANT ALL ON TABLE "public"."concept_resolution_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."concept_resolution_logs" TO "service_role";



GRANT ALL ON TABLE "public"."concept_templates" TO "anon";
GRANT ALL ON TABLE "public"."concept_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."concept_templates" TO "service_role";



GRANT ALL ON TABLE "public"."concepts" TO "anon";
GRANT ALL ON TABLE "public"."concepts" TO "authenticated";
GRANT ALL ON TABLE "public"."concepts" TO "service_role";



GRANT ALL ON TABLE "public"."consumer_locks" TO "anon";
GRANT ALL ON TABLE "public"."consumer_locks" TO "authenticated";
GRANT ALL ON TABLE "public"."consumer_locks" TO "service_role";



GRANT ALL ON TABLE "public"."daily_plans" TO "anon";
GRANT ALL ON TABLE "public"."daily_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_plans" TO "service_role";



GRANT ALL ON TABLE "public"."dlq_events" TO "anon";
GRANT ALL ON TABLE "public"."dlq_events" TO "authenticated";
GRANT ALL ON TABLE "public"."dlq_events" TO "service_role";



GRANT ALL ON TABLE "public"."episodic_memories" TO "anon";
GRANT ALL ON TABLE "public"."episodic_memories" TO "authenticated";
GRANT ALL ON TABLE "public"."episodic_memories" TO "service_role";



GRANT ALL ON TABLE "public"."event_attempts" TO "anon";
GRANT ALL ON TABLE "public"."event_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."event_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."event_consumer_tracking" TO "anon";
GRANT ALL ON TABLE "public"."event_consumer_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."event_consumer_tracking" TO "service_role";



GRANT ALL ON TABLE "public"."event_dlq" TO "anon";
GRANT ALL ON TABLE "public"."event_dlq" TO "authenticated";
GRANT ALL ON TABLE "public"."event_dlq" TO "service_role";



GRANT ALL ON TABLE "public"."event_queue" TO "anon";
GRANT ALL ON TABLE "public"."event_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."event_queue" TO "service_role";



GRANT ALL ON TABLE "public"."feature_usage_daily" TO "anon";
GRANT ALL ON TABLE "public"."feature_usage_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_usage_daily" TO "service_role";



GRANT ALL ON TABLE "public"."institute_memberships" TO "anon";
GRANT ALL ON TABLE "public"."institute_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."institute_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."institutes" TO "anon";
GRANT ALL ON TABLE "public"."institutes" TO "authenticated";
GRANT ALL ON TABLE "public"."institutes" TO "service_role";



GRANT ALL ON TABLE "public"."learner_daily_metrics" TO "anon";
GRANT ALL ON TABLE "public"."learner_daily_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."learner_daily_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."learner_event" TO "anon";
GRANT ALL ON TABLE "public"."learner_event" TO "authenticated";
GRANT ALL ON TABLE "public"."learner_event" TO "service_role";



GRANT ALL ON SEQUENCE "public"."learner_event_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."learner_event_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."learner_event_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."learner_events" TO "anon";
GRANT ALL ON TABLE "public"."learner_events" TO "authenticated";
GRANT ALL ON TABLE "public"."learner_events" TO "service_role";



GRANT ALL ON TABLE "public"."learner_state" TO "anon";
GRANT ALL ON TABLE "public"."learner_state" TO "authenticated";
GRANT ALL ON TABLE "public"."learner_state" TO "service_role";



GRANT ALL ON TABLE "public"."learner_state_versions" TO "anon";
GRANT ALL ON TABLE "public"."learner_state_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."learner_state_versions" TO "service_role";



GRANT ALL ON TABLE "public"."learner_states" TO "anon";
GRANT ALL ON TABLE "public"."learner_states" TO "authenticated";
GRANT ALL ON TABLE "public"."learner_states" TO "service_role";



GRANT ALL ON TABLE "public"."learning_goals" TO "anon";
GRANT ALL ON TABLE "public"."learning_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."learning_goals" TO "service_role";



GRANT ALL ON TABLE "public"."mastery_confidence" TO "anon";
GRANT ALL ON TABLE "public"."mastery_confidence" TO "authenticated";
GRANT ALL ON TABLE "public"."mastery_confidence" TO "service_role";



GRANT ALL ON TABLE "public"."mastery_events" TO "anon";
GRANT ALL ON TABLE "public"."mastery_events" TO "authenticated";
GRANT ALL ON TABLE "public"."mastery_events" TO "service_role";



GRANT ALL ON TABLE "public"."mastery_evidence_log" TO "anon";
GRANT ALL ON TABLE "public"."mastery_evidence_log" TO "authenticated";
GRANT ALL ON TABLE "public"."mastery_evidence_log" TO "service_role";



GRANT ALL ON TABLE "public"."material_chunks" TO "anon";
GRANT ALL ON TABLE "public"."material_chunks" TO "authenticated";
GRANT ALL ON TABLE "public"."material_chunks" TO "service_role";



GRANT ALL ON TABLE "public"."materials" TO "anon";
GRANT ALL ON TABLE "public"."materials" TO "authenticated";
GRANT ALL ON TABLE "public"."materials" TO "service_role";



GRANT ALL ON TABLE "public"."mentor_chats" TO "anon";
GRANT ALL ON TABLE "public"."mentor_chats" TO "authenticated";
GRANT ALL ON TABLE "public"."mentor_chats" TO "service_role";



GRANT ALL ON TABLE "public"."mistakes" TO "anon";
GRANT ALL ON TABLE "public"."mistakes" TO "authenticated";
GRANT ALL ON TABLE "public"."mistakes" TO "service_role";



GRANT ALL ON TABLE "public"."mistake_events" TO "anon";
GRANT ALL ON TABLE "public"."mistake_events" TO "authenticated";
GRANT ALL ON TABLE "public"."mistake_events" TO "service_role";



GRANT ALL ON TABLE "public"."mock_autopsies" TO "anon";
GRANT ALL ON TABLE "public"."mock_autopsies" TO "authenticated";
GRANT ALL ON TABLE "public"."mock_autopsies" TO "service_role";



GRANT ALL ON TABLE "public"."mock_tests" TO "anon";
GRANT ALL ON TABLE "public"."mock_tests" TO "authenticated";
GRANT ALL ON TABLE "public"."mock_tests" TO "service_role";



GRANT ALL ON TABLE "public"."orchestrator_chats" TO "anon";
GRANT ALL ON TABLE "public"."orchestrator_chats" TO "authenticated";
GRANT ALL ON TABLE "public"."orchestrator_chats" TO "service_role";



GRANT ALL ON TABLE "public"."outcome_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."outcome_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."outcome_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."performance_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."performance_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."provider_health" TO "anon";
GRANT ALL ON TABLE "public"."provider_health" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_health" TO "service_role";



GRANT ALL ON TABLE "public"."pulse_signals" TO "anon";
GRANT ALL ON TABLE "public"."pulse_signals" TO "authenticated";
GRANT ALL ON TABLE "public"."pulse_signals" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limit_log" TO "anon";
GRANT ALL ON TABLE "public"."rate_limit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limit_log" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limit_tokens" TO "anon";
GRANT ALL ON TABLE "public"."rate_limit_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limit_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."recovery_plans" TO "anon";
GRANT ALL ON TABLE "public"."recovery_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."recovery_plans" TO "service_role";



GRANT ALL ON TABLE "public"."review_logs" TO "anon";
GRANT ALL ON TABLE "public"."review_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."review_logs" TO "service_role";



GRANT ALL ON TABLE "public"."revision_cards" TO "anon";
GRANT ALL ON TABLE "public"."revision_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."revision_cards" TO "service_role";



GRANT ALL ON TABLE "public"."revision_logs" TO "anon";
GRANT ALL ON TABLE "public"."revision_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."revision_logs" TO "service_role";



GRANT ALL ON TABLE "public"."semantic_cache" TO "anon";
GRANT ALL ON TABLE "public"."semantic_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."semantic_cache" TO "service_role";



GRANT ALL ON TABLE "public"."semantic_memories" TO "anon";
GRANT ALL ON TABLE "public"."semantic_memories" TO "authenticated";
GRANT ALL ON TABLE "public"."semantic_memories" TO "service_role";



GRANT ALL ON TABLE "public"."session_cards" TO "anon";
GRANT ALL ON TABLE "public"."session_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."session_cards" TO "service_role";



GRANT ALL ON TABLE "public"."session_closing_messages" TO "anon";
GRANT ALL ON TABLE "public"."session_closing_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."session_closing_messages" TO "service_role";



GRANT ALL ON TABLE "public"."student_events" TO "anon";
GRANT ALL ON TABLE "public"."student_events" TO "authenticated";
GRANT ALL ON TABLE "public"."student_events" TO "service_role";



GRANT ALL ON TABLE "public"."student_models" TO "anon";
GRANT ALL ON TABLE "public"."student_models" TO "authenticated";
GRANT ALL ON TABLE "public"."student_models" TO "service_role";



GRANT ALL ON TABLE "public"."study_sessions" TO "anon";
GRANT ALL ON TABLE "public"."study_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."study_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."study_tasks" TO "anon";
GRANT ALL ON TABLE "public"."study_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."study_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."tutor_session_states" TO "anon";
GRANT ALL ON TABLE "public"."tutor_session_states" TO "authenticated";
GRANT ALL ON TABLE "public"."tutor_session_states" TO "service_role";



GRANT ALL ON TABLE "public"."tutor_sessions" TO "anon";
GRANT ALL ON TABLE "public"."tutor_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."tutor_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."unresolved_concept_mentions" TO "anon";
GRANT ALL ON TABLE "public"."unresolved_concept_mentions" TO "authenticated";
GRANT ALL ON TABLE "public"."unresolved_concept_mentions" TO "service_role";



GRANT ALL ON TABLE "public"."worker_health" TO "anon";
GRANT ALL ON TABLE "public"."worker_health" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_health" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































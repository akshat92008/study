-- Migration: Unbreakable Core Loop Projection RPC
-- Replaces fragmented learner-state updates with an atomic transaction.

CREATE OR REPLACE FUNCTION apply_core_loop_projection(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_goal_id uuid;
  v_local_date text;
  v_idempotency_key text;
  
  v_learner_event jsonb;
  v_practice_attempts jsonb;
  v_mastery jsonb;
  v_revision_cards jsonb;
  v_mistakes jsonb;
  v_session_card jsonb;
  v_outbox jsonb;
  v_trace jsonb;

  -- Iteration vars
  v_item jsonb;
  v_card jsonb;
  v_mistake jsonb;
  v_mastery_res jsonb;

  v_new_version int;
  v_existing_event uuid;

  v_today_card_completed boolean := false;
  
  result jsonb := '{}'::jsonb;
BEGIN
  -- 1. Parse root payload
  v_user_id := (payload->>'user_id')::uuid;
  v_goal_id := nullif(payload->>'goal_id', '')::uuid;
  v_local_date := payload->>'local_date';
  v_idempotency_key := payload->>'idempotency_key';

  if v_user_id is null or v_idempotency_key is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'message', 'user_id and idempotency_key are required');
  end if;

  v_learner_event := payload->'learner_event';
  v_practice_attempts := payload->'practice_attempts';
  v_mastery := payload->'mastery';
  v_revision_cards := payload->'revision_cards';
  v_mistakes := payload->'mistakes';
  v_session_card := payload->'session_card';
  v_outbox := payload->'outbox';
  v_trace := payload->'trace';

  -- 2. Idempotency Check (learner_events)
  select id into v_existing_event from public.learner_events 
    where user_id = v_user_id and idempotency_key = v_idempotency_key;

  if v_existing_event is not null then
    -- It's a duplicate, return a safe replay success
    return jsonb_build_object(
      'ok', true, 
      'replay', true, 
      'message', 'Event already processed'
    );
  end if;

  -- 3. Insert learner_event
  if v_learner_event is not null then
    insert into public.learner_events (
      user_id, event_type, event_data, idempotency_key, created_at, updated_at
    ) values (
      v_user_id, 
      v_learner_event->>'type', 
      v_learner_event->'data', 
      v_idempotency_key, 
      now(), 
      now()
    );
  end if;

  -- 4. Upsert practice_attempts
  if v_practice_attempts is not null and jsonb_typeof(v_practice_attempts) = 'array' then
    for v_item in select * from jsonb_array_elements(v_practice_attempts) loop
      insert into public.practice_attempts (
        user_id, practice_set_id, practice_item_id, answer, is_correct, time_taken_seconds, idempotency_key, created_at
      ) values (
        v_user_id,
        (v_item->>'practice_set_id')::uuid,
        (v_item->>'practice_item_id')::uuid,
        v_item->>'answer',
        (v_item->>'is_correct')::boolean,
        (v_item->>'time_taken_seconds')::int,
        v_item->>'idempotency_key',
        now()
      )
      on conflict (user_id, idempotency_key) do nothing;
    end loop;
  end if;

  -- 5. Update Mastery
  if v_mastery is not null then
    -- Note: calculating actual Elo/BKT from history inside PG is complex,
    -- so TS computes the delta/new score and passes it down.
    -- We just apply the pre-computed update.
    update public.concepts set
      mastery = v_mastery->>'new_mastery',
      mastery_score = (v_mastery->>'new_score')::numeric,
      confidence = coalesce(v_mastery->>'confidence', confidence),
      forgetting_probability = coalesce((v_mastery->>'forgetting_probability')::numeric, forgetting_probability),
      last_reviewed_at = now(),
      times_reviewed = coalesce(times_reviewed, 0) + 1,
      evidence_count = coalesce(evidence_count, 0) + 1,
      last_updated_reason = v_mastery->>'reason',
      updated_at = now()
    where id = (v_mastery->>'concept_id')::uuid and user_id = v_user_id;

    insert into public.mastery_events (
      user_id, concept_id, old_mastery, new_mastery, source, source_id, source_event_id,
      evidence, evidence_type, weight, confidence, created_at
    ) values (
      v_user_id,
      (v_mastery->>'concept_id')::uuid,
      v_mastery->>'old_mastery',
      v_mastery->>'new_mastery',
      v_mastery->>'source',
      v_mastery->>'source_id',
      (v_mastery->>'source_event_id')::uuid,
      v_mastery->>'evidence',
      v_mastery->>'evidence_type',
      coalesce((v_mastery->>'weight')::numeric, 1.0),
      coalesce((v_mastery->>'event_confidence')::numeric, 1.0),
      now()
    );

    insert into public.mastery_evidence_ledger (
      user_id, concept_id, source_type, source_id, source_event_id,
      previous_mastery, delta, new_mastery, confidence, evidence, reason, idempotency_key
    ) values (
      v_user_id,
      (v_mastery->>'concept_id')::uuid,
      v_mastery->>'source',
      v_mastery->>'source_id',
      (v_mastery->>'source_event_id')::uuid,
      (v_mastery->>'old_score')::numeric,
      (v_mastery->>'delta')::numeric,
      (v_mastery->>'new_score')::numeric,
      coalesce((v_mastery->>'event_confidence')::numeric, 1.0),
      v_mastery->'evidence_payload',
      v_mastery->>'reason',
      v_idempotency_key
    ) on conflict (idempotency_key) do nothing;
  end if;

  -- 6. Upsert Revision Cards
  if v_revision_cards is not null and jsonb_typeof(v_revision_cards) = 'array' then
    for v_card in select * from jsonb_array_elements(v_revision_cards) loop
      insert into public.revision_cards (
        user_id, concept_id, goal_id, subject, chapter, topic, front, back, 
        card_type, source_type, source_id, metadata, normalized_key, created_at, updated_at
      ) values (
        v_user_id,
        (v_card->>'concept_id')::uuid,
        v_goal_id,
        v_card->>'subject',
        v_card->>'chapter',
        v_card->>'topic',
        v_card->>'front',
        v_card->>'back',
        v_card->>'card_type',
        v_card->>'source_type',
        v_card->>'source_id',
        coalesce(v_card->'metadata', '{}'::jsonb),
        v_card->>'normalized_key',
        now(),
        now()
      )
      on conflict (user_id, normalized_key) do update set
        front = excluded.front,
        back = excluded.back,
        metadata = public.revision_cards.metadata || excluded.metadata,
        updated_at = now();
    end loop;
  end if;

  -- 7. Upsert Mistakes
  if v_mistakes is not null and jsonb_typeof(v_mistakes) = 'array' then
    for v_mistake in select * from jsonb_array_elements(v_mistakes) loop
      insert into public.mistakes (
        user_id, goal_id, concept_id, subject, topic, mistake_text, question_text, 
        correct_answer, user_answer, why_wrong, severity, source, source_id, 
        status, metadata, created_at, updated_at
      ) values (
        v_user_id,
        v_goal_id,
        (v_mistake->>'concept_id')::uuid,
        v_mistake->>'subject',
        v_mistake->>'topic',
        v_mistake->>'mistake_text',
        v_mistake->>'question_text',
        v_mistake->>'correct_answer',
        v_mistake->>'user_answer',
        v_mistake->>'why_wrong',
        (v_mistake->>'severity')::int,
        v_mistake->>'source',
        v_mistake->>'source_id',
        coalesce(v_mistake->>'status', 'verified_mistake'),
        coalesce(v_mistake->'metadata', '{}'::jsonb),
        now(),
        now()
      )
      on conflict (user_id, source_id, concept_id) do update set
        mistake_text = excluded.mistake_text,
        updated_at = now()
      where public.mistakes.user_id = excluded.user_id;
    end loop;
  end if;

  -- 8. Session Card (Invalidate / Complete)
  if v_session_card is not null and v_local_date is not null then
    if v_session_card->>'action' = 'complete_today' then
      -- Mark today complete
      update public.session_cards set 
        isCompleted = true, completedAt = now(),
        is_completed = true, completed_at = now()
      where user_id = v_user_id and date = v_local_date 
        and coalesce(goal_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_goal_id, '00000000-0000-0000-0000-000000000000'::uuid);
      
      -- Delete tomorrow's card
      delete from public.session_cards 
      where user_id = v_user_id and date > v_local_date
        and coalesce(goal_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_goal_id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    elsif v_session_card->>'action' = 'invalidate_tomorrow_only' then
      -- Do not touch today, but delete tomorrow
      delete from public.session_cards 
      where user_id = v_user_id and date > v_local_date
        and coalesce(goal_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_goal_id, '00000000-0000-0000-0000-000000000000'::uuid);

    elsif v_session_card->>'action' = 'invalidate_today' then
      -- Delete today and tomorrow
      delete from public.session_cards 
      where user_id = v_user_id and date >= v_local_date
        and coalesce(goal_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_goal_id, '00000000-0000-0000-0000-000000000000'::uuid);
    end if;
  end if;

  -- 9. Bump learner_state_version
  update public.profiles set
    learner_state_version = coalesce(learner_state_version, 0) + 1,
    last_active_at = now(),
    updated_at = now()
  where id = v_user_id
  returning learner_state_version into v_new_version;

  -- 10. Outbox & Traces
  if v_outbox is not null then
    insert into public.event_queue (
      user_id, idempotency_key, type, payload, metadata, status, created_at, updated_at
    ) values (
      v_user_id,
      v_idempotency_key || ':published',
      v_outbox->>'type',
      coalesce(v_outbox->'data', '{}'::jsonb),
      coalesce(v_outbox->'metadata', '{}'::jsonb),
      'PENDING',
      now(),
      now()
    ) on conflict (idempotency_key) do nothing;
  end if;

  if v_trace is not null then
    insert into public.core_loop_traces (
      id, user_id, goal_id, status, error_code, error_message, action, trace_data, created_at, updated_at
    ) values (
      coalesce((v_trace->>'trace_id')::uuid, gen_random_uuid()),
      v_user_id,
      v_goal_id,
      'completed',
      null,
      null,
      v_trace->>'action',
      coalesce(v_trace->'trace_data', '{}'::jsonb),
      now(),
      now()
    ) on conflict (id) do nothing;
  end if;

  return jsonb_build_object(
    'ok', true,
    'learner_state_version', v_new_version,
    'message', 'Atomic projection succeeded'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- If anything fails, rollback transaction implicitly by raising an exception,
    -- but Postgres doesn't allow catching and returning normally unless we do it correctly.
    -- Wait, if we catch OTHERS and return JSON, the transaction COMMITS any previous statements!
    -- Since we WANT to rollback, we must RAISE EXCEPTION or let it bubble up.
    -- Wait! If we RAISE EXCEPTION, the caller gets a Postgres error.
    -- So we RAISE EXCEPTION with detailed info.
    RAISE EXCEPTION 'CORE_LOOP_PROJECTION_FAILED: %', SQLERRM;
END;
$$;

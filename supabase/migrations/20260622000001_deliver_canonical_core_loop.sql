-- Deliver the canonical learner-state projection as one authenticated,
-- idempotent transaction with user-visible activity, repair, and notification
-- side effects.

alter table public.learner_events
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.apply_core_loop_projection(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := nullif(payload->>'user_id', '')::uuid;
  v_goal_id uuid := nullif(payload->>'goal_id', '')::uuid;
  v_local_date text := payload->>'local_date';
  v_idempotency_key text := nullif(payload->>'idempotency_key', '');
  v_learner_event jsonb := payload->'learner_event';
  v_practice_attempts jsonb := payload->'practice_attempts';
  v_mastery jsonb := payload->'mastery';
  v_revision_cards jsonb := payload->'revision_cards';
  v_mistakes jsonb := payload->'mistakes';
  v_session_card jsonb := payload->'session_card';
  v_outbox jsonb := payload->'outbox';
  v_trace jsonb := payload->'trace';
  v_activity jsonb := payload->'activity';
  v_notification jsonb := payload->'notification';
  v_item jsonb;
  v_card jsonb;
  v_mistake jsonb;
  v_learning_event_id uuid;
  v_card_id uuid;
  v_mistake_id uuid;
  v_retest_id uuid;
  v_activity_id uuid;
  v_notification_id uuid;
  v_event_id uuid;
  v_new_version integer;
  v_updated integer;
  v_revision_card_ids jsonb := '[]'::jsonb;
  v_mistake_ids jsonb := '[]'::jsonb;
  v_retest_ids jsonb := '[]'::jsonb;
begin
  if v_user_id is null or v_idempotency_key is null then
    raise exception 'CORE_LOOP_INVALID_PAYLOAD: user_id and idempotency_key are required';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' and auth.uid() is distinct from v_user_id then
    raise exception 'CORE_LOOP_FORBIDDEN: payload user does not match authenticated user';
  end if;

  if v_goal_id is not null and not exists (
    select 1 from public.learning_goals
    where id = v_goal_id and user_id = v_user_id
  ) then
    raise exception 'CORE_LOOP_GOAL_NOT_OWNED';
  end if;

  select id into v_learning_event_id
  from public.learner_events
  where user_id = v_user_id and idempotency_key = v_idempotency_key;

  if v_learning_event_id is not null then
    select coalesce(jsonb_agg(id), '[]'::jsonb) into v_revision_card_ids
    from public.revision_cards
    where user_id = v_user_id
      and metadata->>'coreLoopIdempotencyKey' = v_idempotency_key;

    select coalesce(jsonb_agg(id), '[]'::jsonb) into v_mistake_ids
    from public.mistakes
    where user_id = v_user_id
      and metadata->>'coreLoopIdempotencyKey' = v_idempotency_key;

    return jsonb_build_object(
      'ok', true,
      'replay', true,
      'learning_event_id', v_learning_event_id,
      'revision_card_ids', v_revision_card_ids,
      'mistake_ids', v_mistake_ids,
      'message', 'Event already processed'
    );
  end if;

  insert into public.learner_events (
    user_id, event_type, event_data, idempotency_key, created_at, updated_at
  ) values (
    v_user_id,
    coalesce(v_learner_event->>'type', 'non_learning_activity'),
    coalesce(v_learner_event->'data', '{}'::jsonb),
    v_idempotency_key,
    now(),
    now()
  ) returning id into v_learning_event_id;

  if v_practice_attempts is not null and jsonb_typeof(v_practice_attempts) = 'array' then
    for v_item in select * from jsonb_array_elements(v_practice_attempts) loop
      insert into public.practice_attempts (
        user_id, practice_set_id, practice_item_id, answer, is_correct,
        time_taken_seconds, idempotency_key, created_at
      ) values (
        v_user_id,
        (v_item->>'practice_set_id')::uuid,
        (v_item->>'practice_item_id')::uuid,
        v_item->>'answer',
        coalesce((v_item->>'is_correct')::boolean, false),
        nullif(v_item->>'time_taken_seconds', '')::integer,
        v_item->>'idempotency_key',
        now()
      ) on conflict (user_id, idempotency_key) do nothing;
    end loop;
  end if;

  if v_mastery is not null then
    update public.concepts set
      mastery = v_mastery->>'new_mastery',
      mastery_score = (v_mastery->>'new_score')::numeric,
      confidence = case
        when coalesce((v_mastery->>'confidence')::numeric, 0) >= 0.8 then 'high'
        when coalesce((v_mastery->>'confidence')::numeric, 0) >= 0.5 then 'medium'
        else 'low'
      end,
      forgetting_probability = coalesce((v_mastery->>'forgetting_probability')::numeric, forgetting_probability),
      last_reviewed_at = now(),
      times_reviewed = coalesce(times_reviewed, 0) + 1,
      times_correct = coalesce(times_correct, 0) + case when (v_mastery->>'evidence_type') = 'practice_correct' then 1 else 0 end,
      times_incorrect = coalesce(times_incorrect, 0) + case when (v_mastery->>'evidence_type') in ('practice_wrong', 'tutor_confused') then 1 else 0 end,
      evidence_count = coalesce(evidence_count, 0) + 1,
      last_updated_reason = coalesce(v_mastery->>'reason', v_mastery->>'evidence'),
      updated_at = now()
    where id = (v_mastery->>'concept_id')::uuid and user_id = v_user_id;

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'CORE_LOOP_CONCEPT_NOT_OWNED';
    end if;

    insert into public.mastery_events (
      user_id, concept_id, old_mastery, new_mastery, source, source_id,
      source_event_id, evidence, evidence_type, weight, confidence, created_at
    ) values (
      v_user_id,
      (v_mastery->>'concept_id')::uuid,
      v_mastery->>'old_mastery',
      v_mastery->>'new_mastery',
      coalesce(v_mastery->>'source', 'agent'),
      v_mastery->>'source_id',
      case when coalesce(v_mastery->>'source_event_id', '') ~* '^[0-9a-f-]{36}$'
        then (v_mastery->>'source_event_id')::uuid else null end,
      v_mastery->>'evidence',
      v_mastery->>'evidence_type',
      coalesce((v_mastery->>'weight')::numeric, 1),
      coalesce((v_mastery->>'event_confidence')::numeric, 1),
      now()
    ) on conflict do nothing;

    insert into public.mastery_evidence_ledger (
      user_id, concept_id, source_type, source_id, source_event_id,
      previous_mastery, delta, new_mastery, confidence, evidence, reason,
      idempotency_key
    ) values (
      v_user_id,
      (v_mastery->>'concept_id')::uuid,
      coalesce(v_mastery->>'source', 'agent'),
      case when coalesce(v_mastery->>'source_id', '') ~* '^[0-9a-f-]{36}$'
        then (v_mastery->>'source_id')::uuid else null end,
      case when coalesce(v_mastery->>'source_event_id', '') ~* '^[0-9a-f-]{36}$'
        then (v_mastery->>'source_event_id')::uuid else null end,
      (v_mastery->>'old_score')::numeric,
      (v_mastery->>'delta')::numeric,
      (v_mastery->>'new_score')::numeric,
      coalesce((v_mastery->>'event_confidence')::numeric, 1),
      coalesce(v_mastery->'evidence_payload', '{}'::jsonb),
      coalesce(v_mastery->>'reason', v_mastery->>'evidence'),
      v_idempotency_key
    ) on conflict (user_id, concept_id, source_type, idempotency_key) do nothing;
  end if;

  if v_revision_cards is not null and jsonb_typeof(v_revision_cards) = 'array' then
    for v_card in select * from jsonb_array_elements(v_revision_cards) loop
      insert into public.revision_cards (
        user_id, concept_id, goal_id, subject, chapter, topic, front, back,
        card_type, source_type, source_id, metadata, normalized_key, due,
        state, stability, difficulty, created_at, updated_at
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
        coalesce(v_card->'metadata', '{}'::jsonb) || jsonb_build_object('coreLoopIdempotencyKey', v_idempotency_key),
        v_card->>'normalized_key',
        now(), 0, 0, 5, now(), now()
      ) on conflict (user_id, normalized_key) where normalized_key is not null
      do update set
        front = excluded.front,
        back = excluded.back,
        metadata = public.revision_cards.metadata || excluded.metadata,
        updated_at = now()
      returning id into v_card_id;
      v_revision_card_ids := v_revision_card_ids || to_jsonb(v_card_id);
    end loop;
  end if;

  if v_mistakes is not null and jsonb_typeof(v_mistakes) = 'array' then
    for v_mistake in select * from jsonb_array_elements(v_mistakes) loop
      insert into public.mistakes (
        user_id, goal_id, concept_id, subject, topic, chapter, concept,
        mistake_text, question_text, correct_answer, user_answer, why_wrong,
        severity, source, source_id, category, mistake_type, normalized_key,
        status, metadata, next_retest_at, created_at, updated_at
      ) values (
        v_user_id,
        v_goal_id,
        (v_mistake->>'concept_id')::uuid,
        v_mistake->>'subject',
        v_mistake->>'topic',
        v_mistake->>'topic',
        coalesce(v_mistake->>'topic', 'Unclassified concept'),
        coalesce(v_mistake->>'mistake_text', 'Unspecified mistake'),
        v_mistake->>'question_text',
        v_mistake->>'correct_answer',
        v_mistake->>'user_answer',
        v_mistake->>'why_wrong',
        coalesce((v_mistake->>'severity')::integer, 3),
        coalesce(v_mistake->>'source', 'manual'),
        v_mistake->>'source_id',
        'conceptual_gap',
        'conceptual_gap',
        encode(digest(
          lower(coalesce(v_mistake->>'topic', 'unclassified concept')) || chr(10) ||
          lower(coalesce(v_mistake->>'mistake_text', 'unspecified mistake')),
          'sha256'
        ), 'hex'),
        'open',
        coalesce(v_mistake->'metadata', '{}'::jsonb) || jsonb_build_object('coreLoopIdempotencyKey', v_idempotency_key),
        now() + interval '1 day',
        now(),
        now()
      ) on conflict (user_id, normalized_key) where normalized_key is not null
      do update set
        severity = greatest(public.mistakes.severity, excluded.severity),
        status = case when public.mistakes.status in ('repaired', 'ignored') then 'open' else public.mistakes.status end,
        occurrence_count = coalesce(public.mistakes.occurrence_count, 1) + 1,
        metadata = public.mistakes.metadata || excluded.metadata,
        updated_at = now()
      returning id into v_mistake_id;

      v_mistake_ids := v_mistake_ids || to_jsonb(v_mistake_id);

      insert into public.mistake_retests (
        user_id, mistake_id, goal_id, due_at, question, status, attempt_count,
        created_at, updated_at
      ) values (
        v_user_id,
        v_mistake_id,
        v_goal_id,
        now() + interval '1 day',
        'Explain the correct rule for ' || coalesce(v_mistake->>'topic', 'this concept') || ' without looking at notes.',
        'due',
        0,
        now(),
        now()
      ) on conflict (mistake_id) where status = 'due'
      do update set due_at = least(public.mistake_retests.due_at, excluded.due_at), updated_at = now()
      returning id into v_retest_id;
      v_retest_ids := v_retest_ids || to_jsonb(v_retest_id);
    end loop;
  end if;

  if v_session_card is not null and v_local_date is not null then
    if v_session_card->>'action' = 'complete_today' then
      update public.session_cards set
        "isCompleted" = true,
        "completedAt" = now(),
        is_completed = true,
        completed_at = now(),
        updated_at = now()
      where user_id = v_user_id and date = v_local_date
        and coalesce(goal_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_goal_id, '00000000-0000-0000-0000-000000000000'::uuid);

      delete from public.session_cards
      where user_id = v_user_id and date > v_local_date
        and coalesce(goal_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_goal_id, '00000000-0000-0000-0000-000000000000'::uuid);
    elsif v_session_card->>'action' = 'invalidate_today' then
      delete from public.session_cards
      where user_id = v_user_id and date >= v_local_date
        and coalesce(goal_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_goal_id, '00000000-0000-0000-0000-000000000000'::uuid);
    elsif v_session_card->>'action' = 'invalidate_tomorrow_only' then
      delete from public.session_cards
      where user_id = v_user_id and date > v_local_date
        and coalesce(goal_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_goal_id, '00000000-0000-0000-0000-000000000000'::uuid);
    end if;
  end if;

  if v_activity is not null then
    insert into public.agent_actions (
      run_id, user_id, agent_name, action_type, target_type, target_id, status,
      risk_level, approval_status, confidence, evidence, reason, before_state,
      after_state, idempotency_key, applied_at, created_at, updated_at
    ) values (
      nullif(v_activity->>'run_id', '')::uuid,
      v_user_id,
      coalesce(v_activity->>'agent_name', 'system'),
      coalesce(v_activity->>'action_type', 'learner_state_updated'),
      v_activity->>'target_type',
      nullif(v_activity->>'target_id', '')::uuid,
      'applied', 'safe_auto', 'not_required',
      nullif(v_activity->>'confidence', '')::numeric,
      coalesce(v_activity->'evidence', '{}'::jsonb),
      v_activity->>'reason',
      '{}'::jsonb,
      jsonb_build_object('learningEventId', v_learning_event_id, 'revisionCardIds', v_revision_card_ids, 'mistakeIds', v_mistake_ids),
      coalesce(v_activity->>'idempotency_key', v_idempotency_key || ':activity'),
      now(), now(), now()
    ) on conflict (user_id, action_type, idempotency_key)
    do update set
      evidence = excluded.evidence,
      reason = excluded.reason,
      after_state = excluded.after_state,
      updated_at = now()
    returning id into v_activity_id;
  end if;

  if v_notification is not null then
    insert into public.amaura_notifications (
      user_id, goal_id, type, priority, title, message, action_label,
      action_type, action_payload, dedup_key, metadata, read, created_at
    ) values (
      v_user_id,
      v_goal_id,
      v_notification->>'type',
      coalesce(v_notification->>'priority', 'normal'),
      v_notification->>'title',
      v_notification->>'message',
      v_notification->>'action_label',
      v_notification->>'action_type',
      v_notification->'action_payload',
      v_notification->>'dedup_key',
      jsonb_build_object('learningEventId', v_learning_event_id),
      false,
      now()
    ) on conflict (user_id, dedup_key) where dedup_key is not null
    do update set
      priority = excluded.priority,
      title = excluded.title,
      message = excluded.message,
      action_label = excluded.action_label,
      action_type = excluded.action_type,
      action_payload = excluded.action_payload,
      read = false,
      created_at = now()
    returning id into v_notification_id;
  end if;

  update public.profiles set
    learner_state_version = coalesce(learner_state_version, 0) + 1,
    last_active_at = now(),
    updated_at = now()
  where id = v_user_id
  returning learner_state_version into v_new_version;

  if v_outbox is not null then
    insert into public.event_queue (
      user_id, idempotency_key, type, payload, metadata, status,
      next_attempt_at, created_at, updated_at
    ) values (
      v_user_id,
      v_idempotency_key || ':published',
      coalesce(v_outbox->>'type', 'LEARNER_STATE_CHANGED'),
      coalesce(v_outbox->'data', '{}'::jsonb),
      coalesce(v_outbox->'metadata', '{}'::jsonb),
      'PENDING', now(), now(), now()
    ) on conflict (idempotency_key) do update set updated_at = now()
    returning id into v_event_id;

    insert into public.consumer_locks (
      event_id, consumer_name, status, retry_count, next_retry_at,
      next_attempt_at, created_at, updated_at
    ) values
      (v_event_id, 'downstream_publisher_qstash', 'PENDING', 0, now(), now(), now(), now())
    on conflict (event_id, consumer_name) do nothing;
  end if;

  if v_trace is not null then
    insert into public.core_loop_traces (
      id, user_id, goal_id, action, status, started_at, finished_at, steps,
      result, created_at
    ) values (
      coalesce(nullif(v_trace->>'trace_id', '')::uuid, gen_random_uuid()),
      v_user_id,
      v_goal_id,
      coalesce(v_trace->>'action', 'apply_core_loop_projection'),
      'success',
      now(),
      now(),
      jsonb_build_array(jsonb_build_object('name', 'atomic_projection', 'status', 'success')),
      jsonb_build_object('learningEventId', v_learning_event_id, 'revisionCardIds', v_revision_card_ids, 'mistakeIds', v_mistake_ids),
      now()
    ) on conflict (id) do update set
      status = 'success',
      finished_at = now(),
      result = excluded.result;
  end if;

  return jsonb_build_object(
    'ok', true,
    'learning_event_id', v_learning_event_id,
    'revision_card_ids', v_revision_card_ids,
    'mistake_ids', v_mistake_ids,
    'retest_ids', v_retest_ids,
    'activity_id', v_activity_id,
    'notification_id', v_notification_id,
    'learner_state_version', v_new_version,
    'message', 'Atomic projection succeeded'
  );
exception
  when others then
    raise exception 'CORE_LOOP_PROJECTION_FAILED: %', sqlerrm;
end;
$$;

revoke execute on function public.apply_core_loop_projection(jsonb) from public, anon;
grant execute on function public.apply_core_loop_projection(jsonb) to authenticated, service_role;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_deletion_requests enable row level security;

drop policy if exists account_deletion_requests_insert_own on public.account_deletion_requests;
create policy account_deletion_requests_insert_own
  on public.account_deletion_requests for insert
  with check (auth.uid() = user_id);

drop policy if exists account_deletion_requests_select_own on public.account_deletion_requests;
create policy account_deletion_requests_select_own
  on public.account_deletion_requests for select
  using (auth.uid() = user_id);

drop policy if exists account_deletion_requests_update_own on public.account_deletion_requests;
create policy account_deletion_requests_update_own
  on public.account_deletion_requests for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.account_deletion_requests to authenticated;

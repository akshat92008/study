-- Migration: 20260618000006_schema_consolidation_deprecations.sql
-- Purpose: Formally mark overlapping and legacy tables as DEPRECATED.

do $$
begin
  -- 1. Goals
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'study_goals') then
    execute 'comment on table public.study_goals is ''DEPRECATED: Use learning_goals instead.''';
  end if;

  -- 2. Sessions
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'tutor_sessions') then
    execute 'comment on table public.tutor_sessions is ''DEPRECATED: Use chat_sessions instead.''';
  end if;
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'study_sessions') then
    execute 'comment on table public.study_sessions is ''DEPRECATED: Use chat_sessions instead.''';
  end if;

  -- 3. Materials
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'materials') then
    execute 'comment on table public.materials is ''DEPRECATED: Use study_materials instead.''';
  end if;
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'study_material_chunks') then
    execute 'comment on table public.study_material_chunks is ''DEPRECATED: Use material_chunks instead.''';
  end if;

  -- 4. Mastery
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'student_mastery') then
    execute 'comment on table public.student_mastery is ''DEPRECATED: Use concept_mastery instead.''';
  end if;
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'learner_states') then
    execute 'comment on table public.learner_states is ''DEPRECATED: Use concept_mastery instead.''';
  end if;
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'learner_state_versions') then
    execute 'comment on table public.learner_state_versions is ''DEPRECATED: Use concept_mastery instead.''';
  end if;
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'mastery_events') then
    execute 'comment on table public.mastery_events is ''DEPRECATED: Use mastery_evidence_ledger instead.''';
  end if;
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'mastery_evidence_log') then
    execute 'comment on table public.mastery_evidence_log is ''DEPRECATED: Use mastery_evidence_ledger instead.''';
  end if;
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'student_events') then
    execute 'comment on table public.student_events is ''DEPRECATED: Use mastery_evidence_ledger instead.''';
  end if;

  -- 5. Cards
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'session_cards') then
    execute 'comment on table public.session_cards is ''DEPRECATED: Use revision_cards instead.''';
  end if;

  -- 6. Agents
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'amaura_agent_runs') then
    execute 'comment on table public.amaura_agent_runs is ''DEPRECATED: Use agent_runs instead.''';
  end if;
end $$;

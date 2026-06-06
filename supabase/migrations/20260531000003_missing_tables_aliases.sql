-- Migration: 20260531000003_missing_tables_aliases.sql
-- Purpose: Provide semantic_memories and mistake_events for schema validation

create or replace view public.semantic_memories as
select * from public.chat_memory;
create or replace view public.mistake_events as
select * from public.mistakes;

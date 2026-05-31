-- Ensure already-deployed databases match the final MVP runtime contract.
-- Fresh databases also get these definitions from earlier migrations, but this
-- forward migration repairs environments that stopped before the runtime closure.

do $migration$
declare
  v_signature regprocedure := 'public.complete_study_session(uuid,text,text,text,text,integer,boolean,text,integer,text,uuid,uuid,text,text)'::regprocedure;
  v_definition text;
  v_rewritten text;
begin
  select pg_get_functiondef(v_signature) into v_definition;
  v_rewritten := replace(
    v_definition,
    '''COMMAND_SESSION_COMPLETED''',
    '''STUDY_SESSION_COMPLETED'''
  );

  if v_rewritten <> v_definition then
    execute v_rewritten;
  end if;
end
$migration$;

revoke execute on function public.ingest_mock_autopsy(
  uuid, text, text, int, int, int, int, numeric, numeric, numeric,
  jsonb, text, uuid, numeric
) from public, service_role;

grant execute on function public.ingest_mock_autopsy(
  uuid, text, text, int, int, int, int, numeric, numeric, numeric,
  jsonb, text, uuid, numeric
) to authenticated;

do $$
begin
  alter type public.mistake_category add value if not exists 'calculation_error';
  alter type public.mistake_category add value if not exists 'unknown';
exception
  when undefined_object then null;
  when duplicate_object then null;
end $$;

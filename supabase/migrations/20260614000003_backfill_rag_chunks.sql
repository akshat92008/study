update public.study_material_chunks
set content = text
where content is null and text is not null;

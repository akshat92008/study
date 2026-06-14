update public.study_material_chunks
set content = text
where content is null and text is not null;

update public.study_material_chunks
set text = content
where text is null and content is not null;

create table if not exists public.admin_audit_logs (
    id uuid default gen_random_uuid() primary key,
    admin_id uuid not null references auth.users(id),
    action text not null,
    details jsonb default '{}'::jsonb,
    created_at timestamp with time zone default now() not null
);
alter table public.admin_audit_logs enable row level security;

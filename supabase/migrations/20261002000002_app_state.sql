-- The whole app state: one JSON payload in a singleton row, with a revision for optimistic
-- concurrency. No client writes the table: every save is save_app_state or append_entries
-- (file 5). Only the Owner may select it directly; a branch reads its own copy through
-- load_app_state.

create table public.app_state (
  singleton boolean primary key default true check (singleton), payload jsonb not null,
  revision bigint not null default 1 check (revision > 0), updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id)
);
create index if not exists app_state_updated_by_idx on public.app_state(updated_by);
alter table public.app_state enable row level security;
grant select on public.app_state to authenticated;
create policy app_state_read_active on public.app_state for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active
    and p.role::text = 'L1_OWNER')
);

-- The cheap poll: the revision alone, for any active profile.
create or replace function public.app_state_revision() returns bigint
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare current_revision bigint;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active) then
    raise exception 'Account is not active' using errcode = '42501'; end if;
  select s.revision into current_revision from public.app_state s where s.singleton;
  return current_revision;
end $$;
revoke all on function public.app_state_revision() from public, anon;
grant execute on function public.app_state_revision() to authenticated;

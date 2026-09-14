create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.handle_new_user() returns trigger language plpgsql security definer
set search_path = pg_catalog, public as $$
declare first_profile boolean; chosen_name text;
begin
  perform pg_advisory_xact_lock(hashtextextended('nn-stock-bootstrap-owner', 0));
  select not exists (select 1 from public.profiles) into first_profile;
  chosen_name := coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'ผู้ใช้งาน');
  insert into public.profiles (id, display_name, role, is_active)
  values (new.id, chosen_name, case when first_profile then 'L1_OWNER'::public.user_role else 'L4_SUPPLIER'::public.user_role end, first_profile)
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();
revoke all on function private.handle_new_user() from public, anon, authenticated;

create policy profiles_read_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy user_locations_read_self on public.user_locations for select to authenticated using (profile_id = (select auth.uid()));
create policy locations_read_assigned on public.locations for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active and p.role = 'L1_OWNER'::public.user_role)
  or exists (select 1 from public.user_locations ul where ul.profile_id = (select auth.uid()) and ul.location_id = locations.id)
);
revoke all on public.profiles, public.user_locations, public.locations from anon, authenticated;
grant select on public.profiles, public.user_locations, public.locations to authenticated;

create table public.app_state (
  singleton boolean primary key default true check (singleton), payload jsonb not null,
  revision bigint not null default 1 check (revision > 0), updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id)
);
alter table public.app_state enable row level security;
revoke all on public.app_state from public, anon, authenticated;
grant select on public.app_state to authenticated;
create policy app_state_read_active on public.app_state for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active)
);

create or replace function public.save_app_state(p_payload jsonb, p_expected_revision bigint default null)
returns table(payload jsonb, revision bigint, updated_at timestamptz) language plpgsql security definer
set search_path = pg_catalog, public as $$
declare current_profile public.profiles%rowtype; state_row public.app_state%rowtype;
  old_entry_count integer; new_entry_count integer; entry_index integer; expected_entry_role text; appended_entry jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into current_profile from public.profiles where id = auth.uid() and is_active;
  if not found then raise exception 'Account is not active' using errcode = '42501'; end if;
  if jsonb_typeof(p_payload) <> 'object' or jsonb_typeof(p_payload -> 'entries') <> 'array'
    or jsonb_typeof(p_payload -> 'lots') <> 'array' or jsonb_typeof(p_payload -> 'config') <> 'object'
  then raise exception 'Invalid application state'; end if;
  select * into state_row from public.app_state where singleton for update;
  if not found then
    if current_profile.role <> 'L1_OWNER'::public.user_role then raise exception 'Only an owner can initialize application state' using errcode = '42501'; end if;
    return query insert into public.app_state(singleton, payload, revision, updated_by) values (true, p_payload, 1, auth.uid())
      returning app_state.payload, app_state.revision, app_state.updated_at; return;
  end if;
  if p_expected_revision is null or p_expected_revision <> state_row.revision then
    raise exception 'State changed on another device. Reload and try again.' using errcode = '40001'; end if;
  if current_profile.role <> 'L1_OWNER'::public.user_role and p_payload -> 'config' is distinct from state_row.payload -> 'config' then
    raise exception 'Only an owner can change configuration' using errcode = '42501'; end if;
  old_entry_count := jsonb_array_length(state_row.payload -> 'entries'); new_entry_count := jsonb_array_length(p_payload -> 'entries');
  if new_entry_count < old_entry_count then raise exception 'Existing history cannot be removed' using errcode = '42501'; end if;
  if old_entry_count > 0 then for entry_index in 0..old_entry_count - 1 loop
    if p_payload -> 'entries' -> entry_index is distinct from state_row.payload -> 'entries' -> entry_index then
      raise exception 'Existing history cannot be changed' using errcode = '42501'; end if;
  end loop; end if;
  expected_entry_role := case current_profile.role when 'L2_BRANCH_ADMIN' then 'branch' when 'L3_CM_OPERATOR' then 'cm' when 'L4_SUPPLIER' then 'fooddiva' else null end;
  if expected_entry_role is not null and new_entry_count > old_entry_count then for entry_index in old_entry_count..new_entry_count - 1 loop
    appended_entry := p_payload -> 'entries' -> entry_index;
    if appended_entry ->> 'role' is distinct from expected_entry_role then raise exception 'Entry role does not match signed-in account' using errcode = '42501'; end if;
  end loop; end if;
  return query update public.app_state set payload = p_payload, revision = app_state.revision + 1, updated_at = now(), updated_by = auth.uid()
    where singleton returning app_state.payload, app_state.revision, app_state.updated_at;
end; $$;
revoke all on function public.save_app_state(jsonb, bigint) from public, anon;
grant execute on function public.save_app_state(jsonb, bigint) to authenticated;

-- Fix: chef (and every other non-owner) hit "canceling statement due to statement timeout"
-- when submitting, because the guards were quadratic in payload SIZE, not just entry count.
--
-- `p_payload -> 'entries' -> i` inside a loop re-extracts — and therefore re-copies — the whole
-- entries array on every iteration, twice per entry (old and new), and the non-owner lot loop did
-- the same with lots. n entries over an n-sized array is O(n^2) bytes: fine at 100 entries, past
-- Supabase's 8s statement_timeout once the log grew. Same rules, one pass each.

create or replace function public.save_app_state(p_payload jsonb, p_expected_revision bigint default null)
returns table(payload jsonb, revision bigint, updated_at timestamptz) language plpgsql security definer
set search_path = pg_catalog, public as $$
declare current_profile public.profiles%rowtype; state_row public.app_state%rowtype;
  old_entries jsonb; new_entries jsonb; old_lots jsonb; new_lots jsonb;
  old_entry_count integer; new_entry_count integer; expected_entry_role text;
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
  -- Extract once. Every later reference is to these locals, never back into the payload.
  old_entries := state_row.payload -> 'entries'; new_entries := p_payload -> 'entries';
  old_entry_count := jsonb_array_length(old_entries); new_entry_count := jsonb_array_length(new_entries);
  if new_entry_count < old_entry_count then raise exception 'Existing history cannot be removed' using errcode = '42501'; end if;
  if old_entry_count > 0 and exists (
    select 1 from jsonb_array_elements(old_entries) with ordinality o(entry, ord)
    join jsonb_array_elements(new_entries) with ordinality n(entry, ord) using (ord)
    where n.entry is distinct from o.entry
  ) then raise exception 'Existing history cannot be changed' using errcode = '42501'; end if;
  expected_entry_role := case current_profile.role when 'L2_BRANCH_ADMIN' then 'branch' when 'L3_CM_OPERATOR' then 'cm' when 'L4_SUPPLIER' then 'fooddiva' else null end;
  if expected_entry_role is not null and new_entry_count > old_entry_count then
    if exists (
      select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
      where n.ord > old_entry_count and n.entry ->> 'role' is distinct from expected_entry_role
    ) then raise exception 'Entry role does not match signed-in account' using errcode = '42501'; end if;
    if current_profile.role = 'L2_BRANCH_ADMIN'::public.user_role and exists (
      select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
      where n.ord > old_entry_count and not exists (
        select 1 from public.user_locations ul join public.locations l on l.id = ul.location_id
        where ul.profile_id = auth.uid()
          and case when l.name_th like '%มีนบุรี%' then 'มีนบุรี' else 'ศาลาแดง' end = n.entry ->> 'branch'
      )
    ) then raise exception 'Entry branch does not match signed-in account' using errcode = '42501'; end if;
  end if;
  if current_profile.role <> 'L1_OWNER'::public.user_role then
    old_lots := state_row.payload -> 'lots'; new_lots := p_payload -> 'lots';
    if jsonb_array_length(new_lots) <> jsonb_array_length(old_lots) then
      raise exception 'Only an owner can add or remove lots' using errcode = '42501'; end if;
    if exists (
      select 1 from jsonb_array_elements(old_lots) with ordinality o(lot, ord)
      join jsonb_array_elements(new_lots) with ordinality n(lot, ord) using (ord)
      where n.lot ->> 'id' is distinct from o.lot ->> 'id' or n.lot ->> 'poId' is distinct from o.lot ->> 'poId'
        or n.lot -> 'config' is distinct from o.lot -> 'config'
        or jsonb_typeof(n.lot -> 'stage') is distinct from 'number'
        or (n.lot ->> 'stage')::numeric not between (o.lot ->> 'stage')::numeric and (o.lot ->> 'stage')::numeric + 1
    ) then raise exception 'Lot changes must follow the workflow' using errcode = '42501'; end if;
  end if;
  return query update public.app_state set payload = p_payload, revision = app_state.revision + 1, updated_at = now(), updated_by = auth.uid()
    where singleton returning app_state.payload, app_state.revision, app_state.updated_at;
end; $$;
revoke all on function public.save_app_state(jsonb, bigint) from public, anon;
grant execute on function public.save_app_state(jsonb, bigint) to authenticated;

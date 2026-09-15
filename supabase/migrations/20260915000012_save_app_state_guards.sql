-- save_app_state trusted non-owners with the whole lots array and with each new entry's branch.
-- Adds, for every account except the owner:
--   * lots: none added or removed, id / poId / config unchanged, stage stays or moves forward one step
--   * branch accounts: each new entry's branch must be one of the account's user_locations,
--     named the way src/lib/session.ts names it (a location containing "มีนบุรี" is มีนบุรี, else ศาลาแดง)
-- ponytail: lot values and which role may advance which stage are still checked only by mutate();
-- move that into SQL (or normalized tables) if a non-owner client is ever untrusted beyond this.

create or replace function public.save_app_state(p_payload jsonb, p_expected_revision bigint default null)
returns table(payload jsonb, revision bigint, updated_at timestamptz) language plpgsql security definer
set search_path = pg_catalog, public as $$
declare current_profile public.profiles%rowtype; state_row public.app_state%rowtype;
  old_entry_count integer; new_entry_count integer; entry_index integer; expected_entry_role text; appended_entry jsonb;
  old_lot_count integer; lot_index integer; old_lot jsonb; new_lot jsonb;
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
  expected_entry_role := case current_profile.role when 'L2_BRANCH_ADMIN' then 'branch' when 'L3_CM_OPERATOR' then 'cm' when 'L4_SUPPLIER' then 'foodiva' else null end;
  if expected_entry_role is not null and new_entry_count > old_entry_count then for entry_index in old_entry_count..new_entry_count - 1 loop
    appended_entry := p_payload -> 'entries' -> entry_index;
    if appended_entry ->> 'role' is distinct from expected_entry_role then raise exception 'Entry role does not match signed-in account' using errcode = '42501'; end if;
    if current_profile.role = 'L2_BRANCH_ADMIN'::public.user_role and not exists (
      select 1 from public.user_locations ul join public.locations l on l.id = ul.location_id
      where ul.profile_id = auth.uid()
        and case when l.name_th like '%มีนบุรี%' then 'มีนบุรี' else 'ศาลาแดง' end = appended_entry ->> 'branch'
    ) then raise exception 'Entry branch does not match signed-in account' using errcode = '42501'; end if;
  end loop; end if;
  if current_profile.role <> 'L1_OWNER'::public.user_role then
    old_lot_count := jsonb_array_length(state_row.payload -> 'lots');
    if jsonb_array_length(p_payload -> 'lots') <> old_lot_count then
      raise exception 'Only an owner can add or remove lots' using errcode = '42501'; end if;
    if old_lot_count > 0 then for lot_index in 0..old_lot_count - 1 loop
      old_lot := state_row.payload -> 'lots' -> lot_index; new_lot := p_payload -> 'lots' -> lot_index;
      if new_lot ->> 'id' is distinct from old_lot ->> 'id' or new_lot ->> 'poId' is distinct from old_lot ->> 'poId'
        or new_lot -> 'config' is distinct from old_lot -> 'config'
        or jsonb_typeof(new_lot -> 'stage') is distinct from 'number'
        or (new_lot ->> 'stage')::numeric not between (old_lot ->> 'stage')::numeric and (old_lot ->> 'stage')::numeric + 1
      then raise exception 'Lot changes must follow the workflow' using errcode = '42501'; end if;
    end loop; end if;
  end if;
  return query update public.app_state set payload = p_payload, revision = app_state.revision + 1, updated_at = now(), updated_by = auth.uid()
    where singleton returning app_state.payload, app_state.revision, app_state.updated_at;
end; $$;
revoke all on function public.save_app_state(jsonb, bigint) from public, anon;
grant execute on function public.save_app_state(jsonb, bigint) to authenticated;

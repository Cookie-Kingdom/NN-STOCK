-- Foodiva was misspelled in stored history: role "fooddiva", entry kinds and config keys "foodDiva*".
-- Rewrite the stored payload once and make save_app_state expect the new role.
-- Ship together with the app build that uses the new names: each build only reads its own spelling.
-- ponytail: plain text replace; a user-typed value that is exactly "fooddiva" or starts with "foodDiva" gets corrected too.

update public.app_state
set payload = replace(replace(payload::text, '"fooddiva"', '"foodiva"'), '"foodDiva', '"foodiva')::jsonb,
    -- Open clients hold the old revision, so their next save reloads instead of writing old names back.
    revision = revision + 1,
    updated_at = now()
where payload::text like '%"fooddiva"%' or payload::text like '%"foodDiva%';

do $$ begin
  if exists (select 1 from public.app_state where payload::text like '%"fooddiva"%' or payload::text like '%"foodDiva%') then
    raise exception 'Foodiva rename left old names in app_state';
  end if;
end $$;

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
  expected_entry_role := case current_profile.role when 'L2_BRANCH_ADMIN' then 'branch' when 'L3_CM_OPERATOR' then 'cm' when 'L4_SUPPLIER' then 'foodiva' else null end;
  if expected_entry_role is not null and new_entry_count > old_entry_count then for entry_index in old_entry_count..new_entry_count - 1 loop
    appended_entry := p_payload -> 'entries' -> entry_index;
    if appended_entry ->> 'role' is distinct from expected_entry_role then raise exception 'Entry role does not match signed-in account' using errcode = '42501'; end if;
  end loop; end if;
  return query update public.app_state set payload = p_payload, revision = app_state.revision + 1, updated_at = now(), updated_by = auth.uid()
    where singleton returning app_state.payload, app_state.revision, app_state.updated_at;
end; $$;
revoke all on function public.save_app_state(jsonb, bigint) from public, anon;
grant execute on function public.save_app_state(jsonb, bigint) to authenticated;

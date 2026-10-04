-- The three RPCs a client may call, besides app_state_revision (file 2). Each takes its profile
-- from an allow-list of roles, so a retired role is refused even when re-activated.
--
-- * load_app_state: the Owner gets the payload, the Account Manager its copy without sale money
--   and payroll (manager_strip_entries), a branch its scoped copy (scope_app_state).
-- * save_app_state: the whole payload, from the Owner or the Account Manager. Entries are
--   append-only. The Account Manager's stored history is put back from the server's copy, and
--   it may not append a sale, a payroll payment, a change about one, or settings (a `config`
--   entry, or a payload whose config differs). Neither writes a branch's notes: no new entry
--   with role "branch", no edit or delete of one, no undo of a change to one. The ones already
--   in the log stay.
-- * append_entries: a branch sends only its new entries. Its kinds are the v2 ones; a payment
--   stays in the branch's four categories; an edit names a live note of the branch and only a
--   `receive` changes Lot.
--
-- JS ports for the local SQLite mode: loadState / saveState / appendState in
-- src/lib/local-db.server.ts. Keep them in step.
-- Errors are raise exception or PTxxx only, never 40001 / 40P01 (PostgREST retries those forever).

create or replace function public.load_app_state()
returns table(payload jsonb, revision bigint) language plpgsql stable security definer
set search_path = pg_catalog, public as $$
declare profile_role text;
begin
  select p.role::text into profile_role from public.profiles p where p.id = auth.uid() and p.is_active
    and p.role::text in ('L1_OWNER', 'L1_MANAGER', 'L2_BRANCH_ADMIN');
  if not found then raise exception 'Account is not active' using errcode = '42501'; end if;
  return query select case profile_role
      when 'L1_OWNER' then s.payload
      when 'L1_MANAGER' then jsonb_set(s.payload, '{entries}', public.manager_strip_entries(s.payload -> 'entries'))
      else public.scope_app_state(s.payload, public.account_branches(auth.uid()))
    end, s.revision
    from public.app_state s where s.singleton;
end $$;
revoke all on function public.load_app_state() from public, anon;
grant execute on function public.load_app_state() to authenticated;

-- The first save (no row yet) goes through the same checks against an empty history.
create or replace function public.save_app_state(p_payload jsonb, p_expected_revision bigint default null)
returns table(revision bigint, updated_at timestamptz) language plpgsql security definer
set search_path = pg_catalog, public as $$
declare current_profile public.profiles%rowtype; state_row public.app_state%rowtype;
  old_entries jsonb; new_entries jsonb;
  old_entry_count integer; new_entry_count integer;
  current_revision bigint; has_row boolean; is_manager boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if pg_column_size(p_payload) > 2097152 then
    raise sqlstate 'PT413' using message = 'Payload too large'; end if;
  select * into current_profile from public.profiles where id = auth.uid() and is_active
    and role::text in ('L1_OWNER', 'L1_MANAGER', 'L2_BRANCH_ADMIN');
  if not found then raise exception 'Account is not active' using errcode = '42501'; end if;
  if current_profile.role::text = 'L2_BRANCH_ADMIN' then
    raise exception 'Branch accounts save through append_entries' using errcode = '42501'; end if;
  is_manager := current_profile.role::text = 'L1_MANAGER';
  if jsonb_typeof(p_payload) <> 'object' or jsonb_typeof(p_payload -> 'entries') <> 'array'
    or jsonb_typeof(p_payload -> 'lots') <> 'array' or jsonb_typeof(p_payload -> 'config') <> 'object'
  then raise exception 'Invalid application state'; end if;
  select s.revision into current_revision from public.app_state s where s.singleton;
  if found and (p_expected_revision is null or p_expected_revision <> current_revision) then
    raise sqlstate 'PT409' using message = 'State changed on another device. Reload and try again.'; end if;
  select * into state_row from public.app_state where singleton for update;
  has_row := found;
  if has_row and (p_expected_revision is null or p_expected_revision <> state_row.revision) then
    raise sqlstate 'PT409' using message = 'State changed on another device. Reload and try again.'; end if;
  old_entries := case when has_row then state_row.payload -> 'entries' else '[]'::jsonb end;
  -- The Account Manager saves from its stripped copy (load_app_state): put the rest back.
  if is_manager then
    p_payload := jsonb_set(p_payload, '{entries}', public.manager_restore_entries(old_entries, p_payload -> 'entries'));
  end if;
  new_entries := p_payload -> 'entries';
  old_entry_count := jsonb_array_length(old_entries); new_entry_count := jsonb_array_length(new_entries);
  if new_entry_count < old_entry_count then raise exception 'Existing history cannot be removed' using errcode = '42501'; end if;
  if old_entry_count > 0 and exists (
    select 1 from jsonb_array_elements(old_entries) with ordinality o(entry, ord)
    join jsonb_array_elements(new_entries) with ordinality n(entry, ord) using (ord)
    where n.entry is distinct from o.entry
  ) then raise exception 'Existing history cannot be changed' using errcode = '42501'; end if;
  -- The Account Manager stamps every new entry; the Owner stamps "owner" on an entry it jotted for
  -- someone else (an old partner step; a branch's note is refused below).
  if exists (
    select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
    where n.ord > old_entry_count and not coalesce(case when is_manager then n.entry ->> 'actor' = 'manager'
      else n.entry ->> 'actor' is null
        or (n.entry ->> 'actor' = 'owner' and n.entry ->> 'role' in ('foodiva', 'cm', 'branch')) end, false)
  ) then raise exception 'Entry actor does not match signed-in account' using errcode = '42501'; end if;
  if is_manager then
    if exists (
      select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
      where n.ord > old_entry_count and not coalesce(n.entry ->> 'role' in ('owner', 'foodiva', 'cm', 'branch'), false)
    ) then raise exception 'Entry role does not match signed-in account' using errcode = '42501'; end if;
    -- V2-ACC-03: settings are the Owner's.
    if exists (
      select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
      where n.ord > old_entry_count and n.entry ->> 'kind' = 'config'
    ) or (has_row and p_payload -> 'config' is distinct from state_row.payload -> 'config') then
      raise exception 'Only the Owner changes settings' using errcode = '42501'; end if;
    -- V2-ACC-01, V2-ACC-02: no sale, no payroll payment, no change about one. A delete does not
    -- carry its target's category, so the entry it names is looked up in the merged log, and for
    -- an undo the entry that one names (voidBlock in store/visibility.ts).
    if exists (
      select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
      left join lateral (select x as entry from jsonb_array_elements(new_entries) x
        where x ->> 'id' = n.entry -> 'values' ->> 'targetId' limit 1) t on true
      left join lateral (select x as entry from jsonb_array_elements(new_entries) x
        where x ->> 'id' = t.entry -> 'values' ->> 'targetId' limit 1) a on true
      where n.ord > old_entry_count
        and (public.manager_hidden(n.entry, t.entry) or public.manager_hidden(t.entry, a.entry))
    ) then raise exception 'Entry kind is not allowed for this account' using errcode = '42501'; end if;
  end if;
  -- A branch's notes are the branch's to write (append_entries): no new entry with role "branch",
  -- no edit or delete of one whoever jotted it, and no undo of a change to one. The target is
  -- looked up as above.
  if exists (
    select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
    left join lateral (select x as entry from jsonb_array_elements(new_entries) x
      where x ->> 'id' = n.entry -> 'values' ->> 'targetId' limit 1) t on true
    left join lateral (select x as entry from jsonb_array_elements(new_entries) x
      where x ->> 'id' = t.entry -> 'values' ->> 'targetId' limit 1) a on true
    where n.ord > old_entry_count
      and (n.entry ->> 'role' = 'branch' or (n.entry ->> 'kind' in ('entryEdit', 'void')
        and (t.entry ->> 'role' = 'branch' or a.entry ->> 'role' = 'branch')))
  ) then raise exception 'Only a branch account writes a branch''s notes' using errcode = '42501'; end if;
  if not has_row then
    return query insert into public.app_state(singleton, payload, revision, updated_by) values (true, p_payload, 1, auth.uid())
      returning app_state.revision, app_state.updated_at; return;
  end if;
  return query update public.app_state set payload = p_payload, revision = app_state.revision + 1, updated_at = now(), updated_by = auth.uid()
    where singleton returning app_state.revision, app_state.updated_at;
end; $$;
revoke all on function public.save_app_state(jsonb, bigint) from public, anon;
grant execute on function public.save_app_state(jsonb, bigint) to authenticated;

-- p_lots stays in the signature and must be empty.
create or replace function public.append_entries(p_expected_revision bigint, p_entries jsonb, p_lots jsonb default '[]'::jsonb)
returns bigint language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  current_profile public.profiles%rowtype; state_row public.app_state%rowtype;
  current_revision bigint;
  old_entries jsonb; old_lots jsonb; added jsonb := '[]'::jsonb; e jsonb; target jsonb;
  today constant text := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD');
  -- branchCategories in store/model.ts (V2-ACC-07); '' is a category not picked yet.
  categories constant text[] := array['', 'ingredient', 'packaging', 'transport', 'other'];
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if coalesce(pg_column_size(p_entries), 0) + coalesce(pg_column_size(p_lots), 0) > 2097152 then
    raise sqlstate 'PT413' using message = 'Payload too large'; end if;
  select * into current_profile from public.profiles where id = auth.uid() and is_active
    and role::text in ('L1_OWNER', 'L1_MANAGER', 'L2_BRANCH_ADMIN');
  if not found then raise exception 'Account is not active' using errcode = '42501'; end if;
  if current_profile.role::text <> 'L2_BRANCH_ADMIN' then
    raise exception 'Only branch accounts append entries' using errcode = '42501'; end if;
  p_lots := coalesce(p_lots, '[]'::jsonb);
  if jsonb_typeof(p_entries) is distinct from 'array' or jsonb_typeof(p_lots) <> 'array'
    or exists (select 1 from jsonb_array_elements(p_entries) x
      where jsonb_typeof(x) <> 'object' or jsonb_typeof(x -> 'values') is distinct from 'object')
  then raise exception 'Invalid application state'; end if;
  select s.revision into current_revision from public.app_state s where s.singleton;
  if not found then
    raise exception 'Only an owner can initialize application state' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision <> current_revision then
    raise sqlstate 'PT409' using message = 'State changed on another device. Reload and try again.'; end if;
  select * into state_row from public.app_state where singleton for update;
  if p_expected_revision <> state_row.revision then
    raise sqlstate 'PT409' using message = 'State changed on another device. Reload and try again.'; end if;
  old_entries := state_row.payload -> 'entries'; old_lots := state_row.payload -> 'lots';

  if exists (select 1 from jsonb_array_elements(p_entries) n where n ->> 'actor' is not null) then
    raise exception 'Entry actor does not match signed-in account' using errcode = '42501'; end if;
  if exists (select 1 from jsonb_array_elements(p_entries) n where n ->> 'role' is distinct from 'branch') then
    raise exception 'Entry role does not match signed-in account' using errcode = '42501'; end if;
  if exists (select 1 from jsonb_array_elements(p_entries) n
    where not coalesce(n ->> 'branch' = any (public.account_branches(auth.uid())), false)
  ) then raise exception 'Entry branch does not match signed-in account' using errcode = '42501'; end if;
  -- V2-ACC-07: a branch's notes, and the changes to its own entries.
  if exists (select 1 from jsonb_array_elements(p_entries) n
    where not coalesce(n ->> 'kind' = any (array['receive', 'sale', 'influencerBox', 'materials', 'meatCount',
      'pay', 'entryEdit', 'void']), false)
  ) then raise exception 'Entry kind is not allowed for this account' using errcode = '42501'; end if;
  if exists (select 1 from jsonb_array_elements(p_entries) n
    where coalesce(n ->> 'id', '') = ''
      or (select count(*) from jsonb_array_elements(p_entries) x where x ->> 'id' = n ->> 'id') > 1
      or exists (select 1 from jsonb_array_elements(old_entries) o where o ->> 'id' = n ->> 'id')
  ) then raise exception 'Entry id must be unique' using errcode = '42501'; end if;

  -- No branch kind opens a Lot or writes the lot cache.
  if jsonb_array_length(p_lots) > 0 then
    raise exception 'Only an owner can change lots' using errcode = '42501'; end if;
  -- mutate() writes '' for an entry with no lot.
  if exists (select 1 from jsonb_array_elements(p_entries) n
    where coalesce(n ->> 'lotId', '') <> ''
      and not exists (select 1 from jsonb_array_elements(old_lots) o where o ->> 'id' = n ->> 'lotId')
  ) then raise exception 'Entry lot does not exist' using errcode = '42501'; end if;

  -- In log order, so an entry sees the ones before it in this save (an edit, then its undo).
  for e in select x from jsonb_array_elements(p_entries) with ordinality t(x, ord) order by ord loop
    if not coalesce(e ->> 'date' ~ '^\d{4}-\d{2}-\d{2}$' and e ->> 'date' <= today, false) then
      raise exception 'Entry date is invalid or after today' using errcode = '42501'; end if;
    -- A branch pays in its four categories, and an edit keeps a payment within them.
    if coalesce(case e ->> 'kind' when 'pay' then e -> 'values' ->> 'category'
        when 'entryEdit' then e -> 'values' ->> 'to.category' end, '') <> all (categories) then
      raise exception 'Payment category is not allowed for this account' using errcode = '42501'; end if;
    target := null;
    select x into target from jsonb_array_elements(old_entries || added) x
      where x ->> 'id' = e -> 'values' ->> 'targetId' limit 1;
    -- editBlock in store/visibility.ts: a branch edits a live note of its own branch.
    if e ->> 'kind' = 'entryEdit' then
      if not coalesce(target ->> 'role' = 'branch' and target ->> 'branch' = e ->> 'branch'
          and target ->> 'kind' in ('receive', 'sale', 'influencerBox', 'meatCount', 'pay'), false) then
        raise exception 'Edit target is not an entry of this branch' using errcode = '42501'; end if;
      if public.entry_voided(old_entries || added, target) then
        raise exception 'Entry is already deleted' using errcode = '42501'; end if;
      -- Only a receive changes Lot, to one that exists; no edit dates an entry after today.
      if coalesce(e -> 'values' ->> 'toLotId', '') <> '' and not (target ->> 'kind' = 'receive'
          and exists (select 1 from jsonb_array_elements(old_lots) o where o ->> 'id' = e -> 'values' ->> 'toLotId')) then
        raise exception 'Edit cannot move an entry to another lot' using errcode = '42501'; end if;
      if coalesce(e -> 'values' ->> 'toDate', '') <> '' and not coalesce(
          e -> 'values' ->> 'toDate' ~ '^\d{4}-\d{2}-\d{2}$' and e -> 'values' ->> 'toDate' <= today, false) then
        raise exception 'Entry date is invalid or after today' using errcode = '42501'; end if;
    end if;
    -- voidBlock in store/visibility.ts: a branch deletes a live entry of its own branch. Of an
    -- edit that undoes it, of a delete it puts the entry back, and that is as far as it goes: a
    -- delete naming a delete or an edit is not deleted in turn.
    if e ->> 'kind' = 'void' then
      if not coalesce(target ->> 'role' = 'branch' and target ->> 'branch' = e ->> 'branch'
          and target ->> 'kind' <> 'config', false) then
        raise exception 'Void target is not an entry of this branch' using errcode = '42501'; end if;
      if public.entry_voided(old_entries || added, target) then
        raise exception 'Entry is already deleted' using errcode = '42501'; end if;
      if target ->> 'kind' = 'void' and not coalesce((
          select x ->> 'kind' not in ('void', 'entryEdit') from jsonb_array_elements(old_entries || added) x
          where x ->> 'id' = target -> 'values' ->> 'targetId' limit 1), false) then
        raise exception 'An undo cannot be undone' using errcode = '42501'; end if;
    end if;
    added := added || jsonb_build_array(e);
  end loop;

  update public.app_state
    set payload = jsonb_set(payload, '{entries}', old_entries || added),
      revision = app_state.revision + 1, updated_at = now(), updated_by = auth.uid()
    where singleton returning app_state.revision into current_revision;
  return current_revision;
end $$;
revoke all on function public.append_entries(bigint, jsonb, jsonb) from public, anon;
grant execute on function public.append_entries(bigint, jsonb, jsonb) to authenticated;

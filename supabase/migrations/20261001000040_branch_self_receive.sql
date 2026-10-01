-- Branches record what they receive themselves 01-10-2026: the Owner no longer sends packaging
-- material (`materialTransfer`) or allocates chili (`chiliAllocate`) to a branch. Both kinds are
-- gone from the app, with `transferId` and the "confirmed once" rule (MAT-02). The log held no
-- entry of either kind, so nothing is kept readable.
--
-- Apply after 20261001000039_branch_direct_changes.sql and together with the app release: before
-- it a branch's `chiliReceive` is refused, and with it the old app's Owner screens could still
-- save the two removed kinds. Safe to run twice.
--
-- * app_state_scope_rules (0038): a branch copy gains `chiliReceive` (STK-43, the chili a branch
--   wrote down as received) and loses `chiliAllocate` and `materialTransfer`. Everything else is
--   0038's rule; scope_app_state() is unchanged.
-- * append_entries (0039): the branch kinds gain `chiliReceive`; the material-transfer check
--   goes, and transfer_confirmed (0036, 0039) with it. Everything else is 0039's.
-- * save_app_state and load_app_state are unchanged: neither names an entry kind.
--
-- JS ports: appendState in src/lib/local-db.server.ts, branchScope in src/lib/role-scope.ts
-- (tests/unit/roleScope.test.ts reads the rule JSON below, tests/unit/appendEntries.test.ts the
-- two kind lists). Errors are raise exception or PTxxx only, never 40001 / 40P01.

create or replace function public.app_state_scope_rules() returns jsonb
language sql immutable set search_path = pg_catalog as $$ select $rules$
{
  "kinds": ["receive", "thaw", "supplyPurchase", "supplyIssue", "ricePurchase", "chiliPurchase", "chiliReceive",
    "riceIssue", "chiliIssue", "rice", "riceCarry", "sale", "influencerBox", "materials", "materialConfirm",
    "closeDay", "allocate", "unlock"],
  "hiddenKeys": ["meatCost", "wasteCost", "estimatedCost", "serviceRate", "lines", "price", "outboundCost", "returnCost"],
  "configKeys": ["branch", "boxPrice", "chiliPrice", "packKg", "rawRicePar", "rawRiceUnitPrice",
    "cookedRicePar", "cookedRiceUnitPrice", "material*"],
  "centralKinds": ["allocate", "receive"],
  "centralKeys": ["kg", "allocation", "complete", "targetId", "lotId", "decision", "to.kg", "to.allocation", "to.complete"]
}
$rules$::jsonb $$;
revoke all on function public.app_state_scope_rules() from public, anon, authenticated;

create or replace function public.append_entries(p_expected_revision bigint, p_entries jsonb, p_lots jsonb default '[]'::jsonb)
returns bigint language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  current_profile public.profiles%rowtype; state_row public.app_state%rowtype;
  current_revision bigint;
  old_entries jsonb; old_lots jsonb; added jsonb := '[]'::jsonb; e jsonb; target jsonb;
  today constant text := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD');
  cost_keys constant text[] := array['meatCost', 'wasteCost'];
  -- store/model.ts (tests/unit/appendEntries.test.ts reads the two lists): kinds no edit names,
  -- and kinds no delete names.
  not_editable constant text[] := array['chefEdit', 'materials', 'config', 'void', 'entryEdit', 'editRequest', 'editDecision', 'link', 'steakTransfer'];
  not_voidable constant text[] := array['config', 'editRequest', 'editDecision'];
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
  -- 0036: no supplyPurchase, supplyIssue, chiliPurchase or chiliIssue; 0039: no editRequest
  -- (retiredKinds), entryEdit instead; 0040: chiliReceive (STK-43).
  if exists (select 1 from jsonb_array_elements(p_entries) n
    where not coalesce(n ->> 'kind' = any (array['receive', 'thaw', 'ricePurchase', 'chiliReceive', 'riceIssue',
      'rice', 'riceCarry', 'sale', 'influencerBox', 'materials', 'materialConfirm', 'closeDay', 'entryEdit',
      'link', 'void']), false)
  ) then raise exception 'Entry kind is not allowed for this account' using errcode = '42501'; end if;
  if exists (select 1 from jsonb_array_elements(p_entries) n
    where coalesce(n ->> 'id', '') = ''
      or (select count(*) from jsonb_array_elements(p_entries) x where x ->> 'id' = n ->> 'id') > 1
      or exists (select 1 from jsonb_array_elements(old_entries) o where o ->> 'id' = n ->> 'id')
  ) then raise exception 'Entry id must be unique' using errcode = '42501'; end if;

  -- No branch kind opens a batch or writes the lot cache (lotCost reads it).
  if jsonb_array_length(p_lots) > 0 then
    raise exception 'Only an owner can change lots' using errcode = '42501'; end if;
  -- mutate() writes '' for an entry with no lot.
  if exists (select 1 from jsonb_array_elements(p_entries) n
    where coalesce(n ->> 'lotId', '') not in ('', '-')
      and not exists (select 1 from jsonb_array_elements(old_lots) o where o ->> 'id' = n ->> 'lotId')
  ) then raise exception 'Entry lot does not exist' using errcode = '42501'; end if;

  -- In log order, so an entry sees the ones before it in this save (a closeDay, a link target).
  for e in select x from jsonb_array_elements(p_entries) with ordinality t(x, ord) order by ord loop
    if not coalesce(e ->> 'date' ~ '^\d{4}-\d{2}-\d{2}$' and e ->> 'date' <= today, false) then
      raise exception 'Entry date is invalid or after today' using errcode = '42501'; end if;
    target := null;
    select x into target from jsonb_array_elements(old_entries || added) x
      where x ->> 'id' = e -> 'values' ->> 'targetId' limit 1;
    -- canLink in store/model.ts.
    if e ->> 'kind' = 'link'
      and not coalesce(target ->> 'role' = 'branch' and target ->> 'branch' = e ->> 'branch', false) then
      raise exception 'Link target is not an entry of this branch' using errcode = '42501'; end if;
    -- 0039, editBlock in store/visibility.ts: a branch edits a live entry of its own branch.
    if e ->> 'kind' = 'entryEdit' then
      if not coalesce(target ->> 'role' = 'branch' and target ->> 'branch' = e ->> 'branch'
          and not target ->> 'kind' = any (not_editable), false) then
        raise exception 'Edit target is not an entry of this branch' using errcode = '42501'; end if;
      if public.entry_voided(old_entries || added, target) then
        raise exception 'Entry is already deleted' using errcode = '42501'; end if;
      -- EDT-24: a branch entry changes lot with `link`, and no edit dates one after today.
      if coalesce(e -> 'values' ->> 'toLotId', '') <> '' then
        raise exception 'Edit cannot move an entry to another lot' using errcode = '42501'; end if;
      if coalesce(e -> 'values' ->> 'toDate', '') <> '' and not coalesce(
          e -> 'values' ->> 'toDate' ~ '^\d{4}-\d{2}-\d{2}$' and e -> 'values' ->> 'toDate' <= today, false) then
        raise exception 'Entry date is invalid or after today' using errcode = '42501'; end if;
    end if;
    -- 0039, voidBlock in store/visibility.ts: a branch deletes a live entry of its own branch. Of
    -- an edit or a link that undoes it, of a delete it puts the entry back, and that is as far as
    -- it goes: a delete naming a void, an edit or a link is not deleted in turn.
    if e ->> 'kind' = 'void' then
      if not coalesce(target ->> 'role' = 'branch' and target ->> 'branch' = e ->> 'branch'
          and not target ->> 'kind' = any (not_voidable), false) then
        raise exception 'Void target is not an entry of this branch' using errcode = '42501'; end if;
      if public.entry_voided(old_entries || added, target) then
        raise exception 'Entry is already deleted' using errcode = '42501'; end if;
      if target ->> 'kind' = 'void' and not coalesce((
          select x ->> 'kind' not in ('void', 'entryEdit', 'link') from jsonb_array_elements(old_entries || added) x
          where x ->> 'id' = target -> 'values' ->> 'targetId' limit 1), false) then
        raise exception 'An undo cannot be undone' using errcode = '42501'; end if;
    end if;
    added := added || jsonb_build_array(jsonb_set(e, '{values}', public.scope_strip_values(e -> 'values', cost_keys)));
  end loop;

  update public.app_state
    set payload = jsonb_set(payload, '{entries}', old_entries || added),
      revision = app_state.revision + 1, updated_at = now(), updated_by = auth.uid()
    where singleton returning app_state.revision into current_revision;
  return current_revision;
end $$;
revoke all on function public.append_entries(bigint, jsonb, jsonb) from public, anon;
grant execute on function public.append_entries(bigint, jsonb, jsonb) to authenticated;

drop function if exists public.transfer_confirmed(jsonb, text, text);

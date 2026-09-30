-- Branch scope: every batch S, and the other branches' central-stock entries (BR-08, VIS-03).
--
-- * Lots: every batch S (kind "shipment") besides the BR-07 lots, so the branch's receive picker
--   and link dialog list them all (BR-08). Cost and price keys stay stripped (hiddenKeys).
-- * The other branches' allocate / receive entries on those lots or on no lot, with their void /
--   edit / decision / link (never an editRequest), cut down to centralKeys: kg, allocation,
--   complete, and what a void, edit, decision or link needs to apply. centralStock() then gives
--   the branch the Owner's figure for the "สต๊อกกลางไม่พอ" warning and the link dialog; before,
--   it ignored the other branch's allocations and receives and read too high.
--   visibleEntries() keeps them out of the branch's screens (role owner, another branch, and no
--   targetRole / targetBranch left on an edit).
-- * A void of a followed own entry is sent too: the branch withdrawing its own edit request.
-- * append_entries (0034) takes a branch `void`, only of its own edit request still waiting for a
--   decision (the one void entryIndex() in store/derived.ts counts from a branch). The closed-day
--   guard lets through, besides editRequest, that void and `link`: a link is dated today whatever
--   day its target is on (STK-37), so a closed today must not stop tying an older entry to its
--   batch. A link does move its target's kg between lots (per-lot rows, lot cost) from the
--   target's date on, closed days included; the branch's day totals do not change.
-- * load_app_state (0033) is unchanged: same function, same signature.
--
-- JS port: branchScope / scopeDatabase in src/lib/role-scope.ts (tests/unit/roleScope.test.ts reads
-- the rule JSON below). Errors are raise exception or PTxxx only, never 40001 / 40P01.

create or replace function public.app_state_scope_rules() returns jsonb
language sql immutable set search_path = pg_catalog as $$ select $rules$
{
  "kinds": ["receive", "thaw", "supplyPurchase", "supplyIssue", "ricePurchase", "chiliPurchase", "riceIssue",
    "chiliIssue", "rice", "riceCarry", "sale", "influencerBox", "materials", "materialConfirm", "closeDay",
    "allocate", "chiliAllocate", "materialTransfer", "unlock"],
  "hiddenKeys": ["meatCost", "wasteCost", "estimatedCost", "serviceRate", "lines", "price", "outboundCost", "returnCost"],
  "configKeys": ["branch", "boxPrice", "addonPrice", "chiliPrice", "packKg", "rawRicePar", "rawRiceUnitPrice",
    "cookedRicePar", "cookedRiceUnitPrice", "material*"],
  "centralKinds": ["allocate", "receive"],
  "centralKeys": ["kg", "allocation", "complete", "targetId", "lotId", "decision", "to.kg", "to.allocation", "to.complete"]
}
$rules$::jsonb $$;
revoke all on function public.app_state_scope_rules() from public, anon, authenticated;

create or replace function public.scope_app_state(p_payload jsonb, p_branches text[])
returns jsonb language plpgsql stable set search_path = pg_catalog, public as $$
declare
  rule jsonb := public.app_state_scope_rules();
  all_entries jsonb := coalesce(p_payload -> 'entries', '[]'::jsonb);
  all_lots jsonb := coalesce(p_payload -> 'lots', '[]'::jsonb);
  kinds text[] := array(select jsonb_array_elements_text(rule -> 'kinds'));
  hidden text[] := array(select jsonb_array_elements_text(rule -> 'hiddenKeys'));
  config_keys text[] := array(select jsonb_array_elements_text(rule -> 'configKeys'));
  central_kinds text[] := array(select jsonb_array_elements_text(rule -> 'centralKinds'));
  central_keys text[] := array(select jsonb_array_elements_text(rule -> 'centralKeys'));
  allocated text[]; lot_ids text[];
  scoped_lots jsonb; scoped_entries jsonb;
begin
  p_branches := coalesce(p_branches, '{}'::text[]);

  -- BR-07: a branch's lots.
  allocated := array(select e ->> 'lotId' from jsonb_array_elements(all_entries) e
    where coalesce(e ->> 'branch' = any (p_branches), false)
      and (e ->> 'kind' = 'allocate' or e ->> 'role' = 'branch'));

  -- BR-08: plus every batch S.
  select coalesce(jsonb_agg(l || jsonb_build_object(
      'values', public.scope_strip_values(coalesce(l -> 'values', '{}'::jsonb), hidden),
      'config', public.scope_config(l -> 'config', config_keys)) order by ord), '[]'::jsonb),
    coalesce(array_agg(l ->> 'id'), '{}'::text[])
  into scoped_lots, lot_ids
  from jsonb_array_elements(all_lots) with ordinality t(l, ord)
  where coalesce(l ->> 'kind' = 'shipment', false) or coalesce(l ->> 'id' = any (allocated), false);

  -- Own entries (hiddenKeys stripped) and other branches' central entries (centralKeys only), on
  -- those lots or on no lot, then every void / edit / edit request / decision / link naming one
  -- (no edit request on another branch's).
  with log as (
    select e, ord, coalesce(e ->> 'branch' = any (p_branches), false) as mine,
      (coalesce(e ->> 'lotId', '') = '' or coalesce(e ->> 'lotId' = any (lot_ids), false)) as on_lots
    from jsonb_array_elements(all_entries) with ordinality t(e, ord)
  ), direct as (
    select e, ord, true as own from log where mine and on_lots and e ->> 'kind' = any (kinds)
    union all
    select e, ord, false from log where not mine and on_lots and e ->> 'kind' = any (central_kinds)
  ), follow as (
    select l.e, l.ord, d.own from log l
    join direct d on d.e ->> 'id' = l.e -> 'values' ->> 'targetId'
    where l.e ->> 'kind' in ('void', 'entryEdit', 'editRequest', 'editDecision', 'link')
      and (d.own or l.e ->> 'kind' <> 'editRequest')
  ), withdraw as (
    -- A void of a followed own entry: the branch withdrawing its own edit request.
    select l.e, l.ord, true from log l
    join follow f on f.own and f.e ->> 'id' = l.e -> 'values' ->> 'targetId'
    where l.e ->> 'kind' = 'void'
  ), picked as (
    -- An entry both sent and following a sent one goes once, as sent (the JS keeps the first).
    select distinct on (ord) e, ord, own from (select *, 0 as pass from direct
      union all select *, 1 from follow union all select *, 1 from withdraw) s
    order by ord, pass, own desc
  )
  select coalesce(jsonb_agg(case
      when not p.own then jsonb_set(p.e, '{values}', public.scope_config(p.e -> 'values', central_keys))
      when jsonb_typeof(p.e -> 'values') = 'object'
        then jsonb_set(p.e, '{values}', public.scope_strip_values(p.e -> 'values', hidden))
      else p.e end
      order by p.ord), '[]'::jsonb)
  into scoped_entries
  from picked p;

  return jsonb_build_object('version', p_payload -> 'version', 'lots', scoped_lots, 'entries', scoped_entries,
    'config', public.scope_config(p_payload -> 'config', config_keys));
end $$;
revoke all on function public.scope_app_state(jsonb, text[]) from public, anon, authenticated;

-- 0034's append_entries: a branch `void` of its own pending edit request, and a closed day takes
-- that void and a link as it takes an editRequest.
create or replace function public.append_entries(p_expected_revision bigint, p_entries jsonb, p_lots jsonb default '[]'::jsonb)
returns bigint language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  current_profile public.profiles%rowtype; state_row public.app_state%rowtype;
  current_revision bigint;
  old_entries jsonb; old_lots jsonb; added jsonb := '[]'::jsonb; e jsonb; target jsonb;
  today constant text := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD');
  cost_keys constant text[] := array['meatCost', 'wasteCost'];
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
  if exists (select 1 from jsonb_array_elements(p_entries) n
    where not coalesce(n ->> 'kind' = any (array['receive', 'thaw', 'supplyPurchase', 'supplyIssue', 'ricePurchase',
      'chiliPurchase', 'riceIssue', 'chiliIssue', 'rice', 'riceCarry', 'sale', 'influencerBox', 'materials',
      'materialConfirm', 'closeDay', 'editRequest', 'link', 'void']), false)
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
    if e ->> 'kind' not in ('editRequest', 'void', 'link')
      and public.branch_day_closed(old_entries || added, e ->> 'branch', e ->> 'date') then
      raise exception 'Branch day is closed' using errcode = '42501'; end if;
    target := null;
    select x into target from jsonb_array_elements(old_entries || added) x
      where x ->> 'id' = e -> 'values' ->> 'targetId' limit 1;
    -- canLink in store/model.ts.
    if e ->> 'kind' = 'link'
      and not coalesce(target ->> 'role' = 'branch' and target ->> 'branch' = e ->> 'branch', false) then
      raise exception 'Link target is not an entry of this branch' using errcode = '42501'; end if;
    -- mutate.ts: a branch voids only its own edit request still waiting for a decision.
    if e ->> 'kind' = 'void' and not coalesce(target ->> 'kind' = 'editRequest' and target ->> 'role' = 'branch'
        and target ->> 'branch' = e ->> 'branch'
        and not exists (select 1 from jsonb_array_elements(old_entries || added) x
          where (x ->> 'kind' = 'editDecision' and x -> 'values' ->> 'requestId' = target ->> 'id')
            or (x ->> 'kind' = 'void' and x -> 'values' ->> 'targetId' = target ->> 'id')), false) then
      raise exception 'Void target is not a pending edit request of this branch' using errcode = '42501'; end if;
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

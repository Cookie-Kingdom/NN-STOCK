-- Free ledger (Database v9, PRD "Account Stocking" card A1: SRV-01, SRV-03, SRV-04, VIS-05).
--
-- A batch (Lot S) is a bucket of entries, not a pipeline: Lot.stage is gone from the app, so the
-- server stops checking it.
-- * save_app_state / append_entries: the stage_role block goes. Still checked: append-only log,
--   entry role = signed-in account, revision, actor (Account Manager), kinds per role (+ `link`),
--   unique ids, lotId naming a lot, branch. A non-owner changes only a lot's `values` (merged,
--   DM-09) and may open a new shipment batch (`S<yymmdd>-NNN` / `SH-YYYY-NNNN`, GEN-09) in the
--   same save as the entry that lands on it. A non-owner save must be version 9.
-- * append_entries no longer stamps meatCost / wasteCost on a branch sale (BR-05: saleCost reads
--   it), it only drops what the browser sends. lot_cost_per_kg goes with it.
-- * scope_app_state follows role-scope.ts (A0): Chef House gets shipment lots with a smokeOrder or
--   any cm entry (VIS-02); a branch gets lots with an allocate to it or any of its own entries
--   (BR-07), plus its own entries with no lot; `link` follows its target. Voids are not consulted.
-- * app_state resets to an empty v9 log, settings kept (D6: the data is disposable test data).
--
-- JS ports: src/lib/role-scope.ts (rules, scopeDatabase) and saveState / appendState in
-- src/lib/local-db.server.ts. tests/unit/roleScope.test.ts compares the rule JSON below with
-- scopeRules. Errors are raise exception or PTxxx only, never 40001 / 40P01.

create or replace function public.app_state_scope_rules() returns jsonb
language sql immutable set search_path = pg_catalog as $$ select $rules$
{
  "branch": {
    "kinds": ["receive", "thaw", "supplyPurchase", "supplyIssue", "ricePurchase", "chiliPurchase", "riceIssue",
      "chiliIssue", "rice", "riceCarry", "sale", "influencerBox", "materials", "materialConfirm", "closeDay",
      "allocate", "chiliAllocate", "materialTransfer", "unlock"],
    "ownBranch": true,
    "lots": "allocated",
    "hiddenKeys": ["meatCost", "wasteCost", "estimatedCost", "serviceRate", "lines", "price", "outboundCost", "returnCost"],
    "configKeys": ["branch", "boxPrice", "addonPrice", "chiliPrice", "packKg", "rawRicePar", "rawRiceUnitPrice",
      "cookedRicePar", "cookedRiceUnitPrice", "material*"]
  },
  "foodiva": {
    "kinds": ["foodivaConfirm", "packingList", "foodivaReturnReceive", "dispatch", "purchase", "smokeOrder", "return",
      "ownerWasteReceive", "meatPayment", "smoke", "chefEdit", "steakTransfer"],
    "ownBranch": false,
    "lots": "all",
    "hiddenKeys": ["meatCost", "wasteCost", "estimatedCost", "serviceRate", "returnCost"],
    "configKeys": ["branch", "companyName", "companyAddress", "attention", "companyPhone", "taxId", "logoData",
      "logoStorageKey", "logoName", "foodivaContact", "foodivaAddress", "outboundFee", "roundFee"]
  },
  "cm": {
    "kinds": ["smokingInvoice", "smokeOrderAccept", "cmReceive", "prepare", "smoke", "closeLot", "chefEdit",
      "smokeOrder", "packingList", "invoiceReview", "invoicePayment"],
    "ownBranch": false,
    "lots": "smoked",
    "hiddenKeys": ["meatCost", "wasteCost", "lines", "price", "outboundCost", "returnCost"],
    "configKeys": ["branch", "companyName", "companyAddress", "attention", "companyPhone", "taxId", "logoData",
      "logoStorageKey", "logoName", "chefHouseContact", "chefHouseAddress"]
  }
}
$rules$::jsonb $$;

-- scopeDatabase in role-scope.ts.
create or replace function public.scope_app_state(p_payload jsonb, p_role text, p_branches text[])
returns jsonb language plpgsql stable set search_path = pg_catalog, public as $$
declare
  rule jsonb := public.app_state_scope_rules() -> p_role;
  all_entries jsonb := coalesce(p_payload -> 'entries', '[]'::jsonb);
  all_lots jsonb := coalesce(p_payload -> 'lots', '[]'::jsonb);
  kinds text[]; hidden text[]; config_keys text[]; own_branch boolean; lot_rule text;
  smoked text[]; allocated text[]; lot_ids text[];
  scoped_lots jsonb; scoped_entries jsonb;
begin
  if rule is null then
    return jsonb_build_object('version', p_payload -> 'version', 'lots', '[]'::jsonb, 'entries', '[]'::jsonb,
      'config', '{}'::jsonb);
  end if;
  kinds := array(select jsonb_array_elements_text(rule -> 'kinds'));
  hidden := array(select jsonb_array_elements_text(rule -> 'hiddenKeys'));
  config_keys := array(select jsonb_array_elements_text(rule -> 'configKeys'));
  own_branch := (rule ->> 'ownBranch')::boolean;
  lot_rule := rule ->> 'lots';
  p_branches := coalesce(p_branches, '{}'::text[]);

  -- VIS-02: Chef House's batches. BR-07: a branch's lots.
  smoked := array(select e ->> 'lotId' from jsonb_array_elements(all_entries) e
    where e ->> 'kind' = 'smokeOrder' or e ->> 'role' = 'cm');
  allocated := array(select e ->> 'lotId' from jsonb_array_elements(all_entries) e
    where coalesce(e ->> 'branch' = any (p_branches), false)
      and (e ->> 'kind' = 'allocate' or e ->> 'role' = 'branch'));

  select coalesce(jsonb_agg(l || jsonb_build_object(
      'values', public.scope_strip_values(coalesce(l -> 'values', '{}'::jsonb), hidden),
      'config', public.scope_config(l -> 'config', config_keys)) order by ord), '[]'::jsonb),
    coalesce(array_agg(l ->> 'id'), '{}'::text[])
  into scoped_lots, lot_ids
  from jsonb_array_elements(all_lots) with ordinality t(l, ord)
  where lot_rule = 'all'
    or (lot_rule = 'allocated' and coalesce(l ->> 'id' = any (allocated), false))
    or (lot_rule = 'smoked' and l ->> 'kind' = 'shipment' and coalesce(l ->> 'id' = any (smoked), false));

  -- Entries of the listed kinds (a branch's own "no lot" entries too), then every void / edit /
  -- edit request / decision / link naming one.
  with log as (
    select e, ord from jsonb_array_elements(all_entries) with ordinality t(e, ord)
  ), direct as (
    select e, ord from log
    where e ->> 'kind' = any (kinds)
      and (not own_branch or coalesce(e ->> 'branch' = any (p_branches), false))
      and (lot_rule = 'all' or coalesce(e ->> 'lotId', '') = '' or coalesce(e ->> 'lotId' = any (lot_ids), false))
  ), follow as (
    select e, ord from log
    where e ->> 'kind' in ('void', 'entryEdit', 'editRequest', 'editDecision', 'link')
      and e -> 'values' ->> 'targetId' in (select d.e ->> 'id' from direct d)
  )
  select coalesce(jsonb_agg(case when jsonb_typeof(s.e -> 'values') = 'object'
      then jsonb_set(s.e, '{values}', public.scope_strip_values(s.e -> 'values', hidden)) else s.e end
      order by s.ord), '[]'::jsonb)
  into scoped_entries
  from (select * from direct union all select * from follow) s;

  return jsonb_build_object('version', p_payload -> 'version', 'lots', scoped_lots, 'entries', scoped_entries,
    'config', public.scope_config(p_payload -> 'config', config_keys));
end $$;
revoke all on function public.app_state_scope_rules(), public.scope_app_state(jsonb, text, text[])
  from public, anon, authenticated;

-- A new shipment batch as mutate() opens one (newBatch in store/mutate.ts, isShipmentLot in
-- local-db.server.ts): kind "shipment", `S<yymmdd>-NNN` id, `SH-YYYY-NNNN` number, object values.
create or replace function public.is_new_batch(p_lot jsonb) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select coalesce(jsonb_typeof(p_lot) = 'object' and p_lot ->> 'kind' = 'shipment'
    and jsonb_typeof(p_lot -> 'id') = 'string' and p_lot ->> 'id' ~ '^S\d{6}-\d{3}$'
    and jsonb_typeof(p_lot -> 'poId') = 'string' and p_lot ->> 'poId' ~ '^SH-\d{4}-\d{4}$'
    and jsonb_typeof(coalesce(p_lot -> 'values', '{}'::jsonb)) = 'object', false)
$$;
revoke all on function public.is_new_batch(jsonb) from public, anon, authenticated;

-- 0023's save_app_state without the stage checks (SRV-01). Owner / manager path unchanged.
create or replace function public.save_app_state(p_payload jsonb, p_expected_revision bigint default null)
returns table(revision bigint, updated_at timestamptz) language plpgsql security definer
set search_path = pg_catalog, public as $$
declare current_profile public.profiles%rowtype; state_row public.app_state%rowtype;
  old_entries jsonb; new_entries jsonb; old_lots jsonb; new_lots jsonb;
  old_entry_count integer; new_entry_count integer; expected_entry_role text;
  runs_business boolean; current_revision bigint; allowed_kinds text[]; config_branch text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if pg_column_size(p_payload) > 2097152 then
    raise sqlstate 'PT413' using message = 'Payload too large'; end if;
  select * into current_profile from public.profiles where id = auth.uid() and is_active;
  if not found then raise exception 'Account is not active' using errcode = '42501'; end if;
  runs_business := current_profile.role::text in ('L1_OWNER', 'L1_MANAGER');
  if jsonb_typeof(p_payload) <> 'object' or jsonb_typeof(p_payload -> 'entries') <> 'array'
    or jsonb_typeof(p_payload -> 'lots') <> 'array' or jsonb_typeof(p_payload -> 'config') <> 'object'
  then raise exception 'Invalid application state'; end if;
  select s.revision into current_revision from public.app_state s where s.singleton;
  if found and (p_expected_revision is null or p_expected_revision <> current_revision) then
    raise sqlstate 'PT409' using message = 'State changed on another device. Reload and try again.'; end if;
  select * into state_row from public.app_state where singleton for update;
  if not found then
    if not runs_business then raise exception 'Only an owner can initialize application state' using errcode = '42501'; end if;
    if current_profile.role::text = 'L1_MANAGER' then
      p_payload := jsonb_set(p_payload, '{entries}', public.strip_sale_money_entries(p_payload -> 'entries')); end if;
    return query insert into public.app_state(singleton, payload, revision, updated_by) values (true, p_payload, 1, auth.uid())
      returning app_state.revision, app_state.updated_at; return;
  end if;
  if p_expected_revision is null or p_expected_revision <> state_row.revision then
    raise sqlstate 'PT409' using message = 'State changed on another device. Reload and try again.'; end if;
  if not runs_business and p_payload -> 'config' is distinct from state_row.payload -> 'config' then
    raise exception 'Only an owner can change configuration' using errcode = '42501'; end if;
  if not runs_business and (p_payload -> 'version' is distinct from '9'::jsonb
    or (p_payload - 'entries' - 'lots') is distinct from (state_row.payload - 'entries' - 'lots'))
  then raise exception 'Only an owner can change application state' using errcode = '42501'; end if;
  if current_profile.role::text = 'L1_MANAGER' then
    p_payload := jsonb_set(p_payload, '{entries}', public.restore_sale_money(
      state_row.payload -> 'entries', p_payload -> 'entries', p_payload -> 'config'));
  end if;
  old_entries := state_row.payload -> 'entries'; new_entries := p_payload -> 'entries';
  old_lots := state_row.payload -> 'lots'; new_lots := p_payload -> 'lots';
  old_entry_count := jsonb_array_length(old_entries); new_entry_count := jsonb_array_length(new_entries);
  if new_entry_count < old_entry_count then raise exception 'Existing history cannot be removed' using errcode = '42501'; end if;
  if old_entry_count > 0 and exists (
    select 1 from jsonb_array_elements(old_entries) with ordinality o(entry, ord)
    join jsonb_array_elements(new_entries) with ordinality n(entry, ord) using (ord)
    where n.entry is distinct from o.entry
  ) then raise exception 'Existing history cannot be changed' using errcode = '42501'; end if;
  expected_entry_role := case current_profile.role::text when 'L1_MANAGER' then 'owner' when 'L2_BRANCH_ADMIN' then 'branch'
    when 'L3_CM_OPERATOR' then 'cm' when 'L4_SUPPLIER' then 'foodiva' else null end;
  if exists (
    select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
    where n.ord > old_entry_count and n.entry ->> 'actor' is distinct from
      case when current_profile.role::text = 'L1_MANAGER' then 'manager' end
  ) then raise exception 'Entry actor does not match signed-in account' using errcode = '42501'; end if;
  if expected_entry_role is not null and new_entry_count > old_entry_count then
    if exists (
      select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
      where n.ord > old_entry_count and n.entry ->> 'role' is distinct from expected_entry_role
    ) then raise exception 'Entry role does not match signed-in account' using errcode = '42501'; end if;
    if current_profile.role::text = 'L2_BRANCH_ADMIN' and exists (
      select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
      where n.ord > old_entry_count and not coalesce(n.entry ->> 'branch' = any (public.account_branches(auth.uid())), false)
    ) then raise exception 'Entry branch does not match signed-in account' using errcode = '42501'; end if;
    if not runs_business then
      -- `ownership` in store/mutate.ts, plus editRequest and link. Keep in step with append_entries.
      allowed_kinds := case expected_entry_role
        when 'branch' then array['receive', 'thaw', 'supplyPurchase', 'supplyIssue', 'ricePurchase', 'chiliPurchase',
          'riceIssue', 'chiliIssue', 'rice', 'riceCarry', 'sale', 'influencerBox', 'materials', 'materialConfirm',
          'closeDay', 'editRequest', 'link']
        when 'cm' then array['smokingInvoice', 'smokeOrderAccept', 'cmReceive', 'prepare', 'smoke', 'closeLot',
          'chefEdit', 'editRequest', 'link']
        when 'foodiva' then array['foodivaConfirm', 'packingList', 'foodivaReturnReceive', 'dispatch', 'editRequest',
          'link'] end;
      if exists (
        select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
        where n.ord > old_entry_count and not coalesce(n.entry ->> 'kind' = any(allowed_kinds), false)
      ) then raise exception 'Entry kind is not allowed for this account' using errcode = '42501'; end if;
      if exists (
        select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
        where n.ord > old_entry_count and (coalesce(n.entry ->> 'id', '') = ''
          or (select count(*) from jsonb_array_elements(new_entries) e where e ->> 'id' = n.entry ->> 'id') > 1)
      ) then raise exception 'Entry id must be unique' using errcode = '42501'; end if;
      if exists (
        select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
        where n.ord > old_entry_count and coalesce(n.entry ->> 'lotId', '') not in ('', '-')
          and not exists (select 1 from jsonb_array_elements(new_lots) l where l ->> 'id' = n.entry ->> 'lotId')
      ) then raise exception 'Entry lot does not exist' using errcode = '42501'; end if;
      config_branch := case when state_row.payload -> 'config' ->> 'branch' in ('ศาลาแดง', 'มีนบุรี')
        then state_row.payload -> 'config' ->> 'branch' else 'ศาลาแดง' end;
      if expected_entry_role in ('cm', 'foodiva') and exists (
        select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
        where n.ord > old_entry_count and n.entry ->> 'branch' is not null and n.entry ->> 'branch' <> config_branch
      ) then raise exception 'Entry branch does not match signed-in account' using errcode = '42501'; end if;
    end if;
  end if;
  if not runs_business then
    if jsonb_array_length(new_lots) < jsonb_array_length(old_lots) then
      raise exception 'Only an owner can add or remove lots' using errcode = '42501'; end if;
    -- A lot keeps its identity; only its values move (DM-09).
    if exists (
      select 1 from jsonb_array_elements(old_lots) with ordinality o(lot, ord)
      join jsonb_array_elements(new_lots) with ordinality n(lot, ord) using (ord)
      where (n.lot - 'values') is distinct from (o.lot - 'values')
        or jsonb_typeof(n.lot -> 'values') is distinct from 'object'
    ) then raise exception 'Lot changes must follow the workflow' using errcode = '42501'; end if;
    -- GEN-09: the only lot a non-owner adds is a new shipment batch, with an id not already used.
    if exists (
      select 1 from jsonb_array_elements(new_lots) with ordinality n(lot, ord)
      where n.ord > jsonb_array_length(old_lots) and (not public.is_new_batch(n.lot)
        or (select count(*) from jsonb_array_elements(new_lots) x where x ->> 'id' = n.lot ->> 'id') > 1)
    ) then raise exception 'Only an owner can add or remove lots' using errcode = '42501'; end if;
  end if;
  return query update public.app_state set payload = p_payload, revision = app_state.revision + 1, updated_at = now(), updated_by = auth.uid()
    where singleton returning app_state.revision, app_state.updated_at;
end; $$;
revoke all on function public.save_app_state(jsonb, bigint) from public, anon;
grant execute on function public.save_app_state(jsonb, bigint) to authenticated;

-- 0028's append_entries without the stage checks and the server-side sale cost.
--   p_entries  new entries only: object `values`, no actor, the account's role, a kind that role
--              creates (plus editRequest, link), a new unique id, a lotId naming a stored lot or a
--              batch opened in p_lots (or '' / '-'), and the account's branch. meatCost /
--              wasteCost (also to./from.) are dropped (BR-05).
--   p_lots     changed lots, as the client holds them. For a stored lot only `values` is taken,
--              merged over the stored ones (keys the role never received survive). A lot not
--              stored must be a new shipment batch (is_new_batch) and is appended.
create or replace function public.append_entries(p_expected_revision bigint, p_entries jsonb, p_lots jsonb default '[]'::jsonb)
returns bigint language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  current_profile public.profiles%rowtype; state_row public.app_state%rowtype;
  current_revision bigint; entry_role text; allowed_kinds text[]; config_branch text;
  old_entries jsonb; old_lots jsonb; new_lots jsonb; added jsonb := '[]'::jsonb;
  e jsonb; l jsonb; old_lot jsonb; lot_index integer;
  cost_keys constant text[] := array['meatCost', 'wasteCost'];
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if coalesce(pg_column_size(p_entries), 0) + coalesce(pg_column_size(p_lots), 0) > 2097152 then
    raise sqlstate 'PT413' using message = 'Payload too large'; end if;
  select * into current_profile from public.profiles where id = auth.uid() and is_active;
  if not found then raise exception 'Account is not active' using errcode = '42501'; end if;
  entry_role := case current_profile.role::text when 'L2_BRANCH_ADMIN' then 'branch'
    when 'L3_CM_OPERATOR' then 'cm' when 'L4_SUPPLIER' then 'foodiva' end;
  if entry_role is null then
    raise exception 'Only branch, Foodiva and Chef House accounts append entries' using errcode = '42501'; end if;
  p_lots := coalesce(p_lots, '[]'::jsonb);
  if jsonb_typeof(p_entries) is distinct from 'array' or jsonb_typeof(p_lots) <> 'array'
    or exists (select 1 from jsonb_array_elements(p_entries) x
      where jsonb_typeof(x) <> 'object' or jsonb_typeof(x -> 'values') is distinct from 'object')
    or exists (select 1 from jsonb_array_elements(p_lots) x where jsonb_typeof(x) <> 'object')
  then raise exception 'Invalid application state'; end if;
  select s.revision into current_revision from public.app_state s where s.singleton;
  if not found then
    raise exception 'Only an owner can initialize application state' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision <> current_revision then
    raise sqlstate 'PT409' using message = 'State changed on another device. Reload and try again.'; end if;
  select * into state_row from public.app_state where singleton for update;
  if p_expected_revision <> state_row.revision then
    raise sqlstate 'PT409' using message = 'State changed on another device. Reload and try again.'; end if;
  old_entries := state_row.payload -> 'entries'; old_lots := state_row.payload -> 'lots'; new_lots := old_lots;

  if exists (select 1 from jsonb_array_elements(p_entries) n where n ->> 'actor' is not null) then
    raise exception 'Entry actor does not match signed-in account' using errcode = '42501'; end if;
  if exists (select 1 from jsonb_array_elements(p_entries) n where n ->> 'role' is distinct from entry_role) then
    raise exception 'Entry role does not match signed-in account' using errcode = '42501'; end if;
  if entry_role = 'branch' and exists (select 1 from jsonb_array_elements(p_entries) n
    where not coalesce(n ->> 'branch' = any (public.account_branches(auth.uid())), false)
  ) then raise exception 'Entry branch does not match signed-in account' using errcode = '42501'; end if;
  allowed_kinds := case entry_role
    when 'branch' then array['receive', 'thaw', 'supplyPurchase', 'supplyIssue', 'ricePurchase', 'chiliPurchase',
      'riceIssue', 'chiliIssue', 'rice', 'riceCarry', 'sale', 'influencerBox', 'materials', 'materialConfirm',
      'closeDay', 'editRequest', 'link']
    when 'cm' then array['smokingInvoice', 'smokeOrderAccept', 'cmReceive', 'prepare', 'smoke', 'closeLot',
      'chefEdit', 'editRequest', 'link']
    when 'foodiva' then array['foodivaConfirm', 'packingList', 'foodivaReturnReceive', 'dispatch', 'editRequest',
      'link'] end;
  if exists (select 1 from jsonb_array_elements(p_entries) n
    where not coalesce(n ->> 'kind' = any (allowed_kinds), false)
  ) then raise exception 'Entry kind is not allowed for this account' using errcode = '42501'; end if;
  if exists (select 1 from jsonb_array_elements(p_entries) n
    where coalesce(n ->> 'id', '') = ''
      or (select count(*) from jsonb_array_elements(p_entries) x where x ->> 'id' = n ->> 'id') > 1
      or exists (select 1 from jsonb_array_elements(old_entries) o where o ->> 'id' = n ->> 'id')
  ) then raise exception 'Entry id must be unique' using errcode = '42501'; end if;
  config_branch := case when state_row.payload -> 'config' ->> 'branch' in ('ศาลาแดง', 'มีนบุรี')
    then state_row.payload -> 'config' ->> 'branch' else 'ศาลาแดง' end;
  if entry_role in ('cm', 'foodiva') and exists (select 1 from jsonb_array_elements(p_entries) n
    where n ->> 'branch' is not null and n ->> 'branch' <> config_branch
  ) then raise exception 'Entry branch does not match signed-in account' using errcode = '42501'; end if;

  if (select count(*) <> count(distinct x ->> 'id') from jsonb_array_elements(p_lots) x) then
    raise exception 'Lot changes must follow the workflow' using errcode = '42501'; end if;
  for l in select x from jsonb_array_elements(p_lots) with ordinality t(x, ord) order by ord loop
    old_lot := null;
    select o, (ord - 1)::integer into old_lot, lot_index
      from jsonb_array_elements(old_lots) with ordinality t(o, ord) where o ->> 'id' = l ->> 'id' limit 1;
    if old_lot is null then
      if not public.is_new_batch(l) then
        raise exception 'Only an owner can add or remove lots' using errcode = '42501'; end if;
      new_lots := new_lots || jsonb_build_array(l || jsonb_build_object('values', coalesce(l -> 'values', '{}'::jsonb)));
      continue;
    end if;
    if jsonb_typeof(coalesce(l -> 'values', '{}'::jsonb)) <> 'object' then
      raise exception 'Lot changes must follow the workflow' using errcode = '42501'; end if;
    new_lots := jsonb_set(new_lots, array[lot_index::text],
      old_lot || jsonb_build_object('values', coalesce(old_lot -> 'values', '{}'::jsonb) || coalesce(l -> 'values', '{}'::jsonb)));
  end loop;

  -- After the lots: a batch opened in this save counts. mutate() writes '' for an entry with no lot.
  if exists (select 1 from jsonb_array_elements(p_entries) n
    where coalesce(n ->> 'lotId', '') not in ('', '-')
      and not exists (select 1 from jsonb_array_elements(new_lots) o where o ->> 'id' = n ->> 'lotId')
  ) then raise exception 'Entry lot does not exist' using errcode = '42501'; end if;

  for e in select x from jsonb_array_elements(p_entries) with ordinality t(x, ord) order by ord loop
    added := added || jsonb_build_array(jsonb_set(e, '{values}', public.scope_strip_values(e -> 'values', cost_keys)));
  end loop;

  update public.app_state
    set payload = jsonb_set(jsonb_set(payload, '{entries}', old_entries || added), '{lots}', new_lots),
      revision = app_state.revision + 1, updated_at = now(), updated_by = auth.uid()
    where singleton returning app_state.revision into current_revision;
  return current_revision;
end $$;
revoke all on function public.append_entries(bigint, jsonb, jsonb) from public, anon;
grant execute on function public.append_entries(bigint, jsonb, jsonb) to authenticated;

drop function if exists public.lot_cost_per_kg(jsonb, jsonb, text);

-- SRV-04 / D6: v8 history cannot be read as v9 (no stages, new smoke PO shape). Clear lots and
-- entries, keep the settings. Open clients hold the old revision, so their next save reloads.
-- ⚠️ Deletes all UAT history. Attachments already in the bucket stay behind as unreferenced files.
update public.app_state
set payload = jsonb_build_object('version', 9, 'lots', '[]'::jsonb, 'entries', '[]'::jsonb,
      'config', coalesce(payload -> 'config', '{}'::jsonb)),
    revision = revision + 1,
    updated_at = now();

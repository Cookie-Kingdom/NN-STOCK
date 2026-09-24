-- Security review 24-09-2026 (Report/review-24-09-2026): APP-01 / DB-03, and the save side of PERF-02.
--
-- Until now load_app_state handed every role but the Account Manager the whole payload: purchase
-- prices, meat cost, Foodiva invoices and payments, every branch's sales. visibleEntries /
-- visibleDatabase in store.ts only narrowed the screens, so any Branch, Foodiva or Chef House
-- session could read it all by calling the RPC (or selecting app_state) itself.
--
-- * Reads: load_app_state gives L2_BRANCH_ADMIN, L3_CM_OPERATOR and L4_SUPPLIER only their
--   role-scoped copy (scope_app_state, rules in app_state_scope_rules). L1_OWNER is unchanged;
--   L1_MANAGER still gets the payload with sale money stripped (0021). Direct select on
--   app_state is now the Owner's only.
-- * Saves: a scoped copy cannot be sent back whole, so those three roles append instead:
--   append_entries(p_expected_revision, p_entries, p_lots) takes just the new entries and the
--   lots they changed, and applies save_app_state's non-owner rules (0023) to them. The Owner
--   and the Account Manager keep save_app_state with the whole payload.
-- * A branch no longer receives the prices lotCost() needs, so its browser cannot work out a
--   sale's meatCost / wasteCost any more: append_entries drops whatever a non-owner sends for
--   those keys and stamps them itself on branch sale / influencerBox entries (lot_cost_per_kg,
--   a port of lotCost in store.ts).
--
-- JS port (local SQLite backend, pnpm test:e2e:local): src/lib/role-scope.ts (scope rules and
-- scopeDatabase) and appendState in src/lib/local-db.server.ts. Keep them in step;
-- tests/unit/roleScope.test.ts fails when the rule JSON below and scopeRules differ.
-- Errors are raise exception or PT4xx only, never 40001 / 40P01 (PostgREST retries those forever).

-- The rule table. Must equal `scopeRules` in src/lib/role-scope.ts (see the comment there).
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
    "kinds": ["foodivaConfirm", "packingList", "foodivaReturnReceive", "dispatch", "purchase", "shipmentRequest",
      "shipmentRequestEdit", "smokeOrder", "return", "ownerWasteReceive", "meatPayment", "smoke", "chefEdit",
      "steakTransfer"],
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

-- `p_values` without the keys in `p_hidden`, also as an edit's to./from. key.
create or replace function public.scope_strip_values(p_values jsonb, p_hidden text[]) returns jsonb
language sql immutable set search_path = pg_catalog as $$
  select case when jsonb_typeof(p_values) = 'object' then coalesce((
    select jsonb_object_agg(key, value) from jsonb_each(p_values)
    where regexp_replace(key, '^(to|from)\.', '') <> all (p_hidden)
  ), '{}'::jsonb) else p_values end
$$;

-- `p_config` with only the keys in `p_keys`; a key ending in * keeps every key with that prefix.
create or replace function public.scope_config(p_config jsonb, p_keys text[]) returns jsonb
language sql immutable set search_path = pg_catalog as $$
  select case when jsonb_typeof(p_config) = 'object' then coalesce((
    select jsonb_object_agg(c.key, c.value) from jsonb_each(p_config) c
    where c.key = any (p_keys)
      or exists (select 1 from unnest(p_keys) k where right(k, 1) = '*' and starts_with(c.key, left(k, -1)))
  ), '{}'::jsonb) else '{}'::jsonb end
$$;

-- The copy of `p_payload` a `p_role` account ('branch', 'cm', 'foodiva') receives. `p_branches`
-- is a branch account's own branch(es). Any other role gets an empty log. See role-scope.ts.
create or replace function public.scope_app_state(p_payload jsonb, p_role text, p_branches text[])
returns jsonb language plpgsql stable set search_path = pg_catalog, public as $$
declare
  rule jsonb := public.app_state_scope_rules() -> p_role;
  all_entries jsonb := coalesce(p_payload -> 'entries', '[]'::jsonb);
  all_lots jsonb := coalesce(p_payload -> 'lots', '[]'::jsonb);
  kinds text[]; hidden text[]; config_keys text[]; own_branch boolean; lot_rule text;
  voided text[]; cancelled text[]; smoked text[]; allocated text[]; lot_ids text[];
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

  -- Only the Owner voids (entryIndex in store.ts).
  voided := array(select e -> 'values' ->> 'targetId' from jsonb_array_elements(all_entries) e
    where e ->> 'kind' = 'void' and e ->> 'role' = 'owner');
  cancelled := array(select e ->> 'lotId' from jsonb_array_elements(all_entries) e
    where e ->> 'kind' = 'shipmentRequest' and coalesce(e ->> 'id' = any (voided), false));
  smoked := array(select e ->> 'lotId' from jsonb_array_elements(all_entries) e
    where e ->> 'kind' = 'smokeOrder' and not coalesce(e ->> 'id' = any (voided), false));
  allocated := array(select e ->> 'lotId' from jsonb_array_elements(all_entries) e
    where e ->> 'kind' = 'allocate' and coalesce(e ->> 'branch' = any (p_branches), false));

  select coalesce(jsonb_agg(l || jsonb_build_object(
      'values', public.scope_strip_values(coalesce(l -> 'values', '{}'::jsonb), hidden),
      'config', public.scope_config(l -> 'config', config_keys)) order by ord), '[]'::jsonb),
    coalesce(array_agg(l ->> 'id'), '{}'::text[])
  into scoped_lots, lot_ids
  from jsonb_array_elements(all_lots) with ordinality t(l, ord)
  where lot_rule = 'all'
    or (lot_rule = 'allocated' and coalesce(l ->> 'id' = any (allocated), false))
    or (lot_rule = 'smoked' and l ->> 'kind' = 'shipment' and not coalesce(l ->> 'id' = any (cancelled), false)
      and coalesce(l ->> 'id' = any (smoked), false));

  -- Entries of the listed kinds, then every void / edit / edit request / decision naming one.
  with log as (
    select e, ord from jsonb_array_elements(all_entries) with ordinality t(e, ord)
  ), direct as (
    select e, ord from log
    where e ->> 'kind' = any (kinds)
      and (not own_branch or coalesce(e ->> 'branch' = any (p_branches), false))
      and (lot_rule <> 'smoked' or coalesce(e ->> 'lotId' = any (lot_ids), false))
  ), follow as (
    select e, ord from log
    where e ->> 'kind' in ('void', 'entryEdit', 'editRequest', 'editDecision')
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

-- A branch account's branch(es), named the way the app and save_app_state name them.
create or replace function public.account_branches(p_profile uuid) returns text[]
language sql stable set search_path = pg_catalog, public as $$
  select coalesce(array_agg(distinct case when l.name_th like '%มีนบุรี%' then 'มีนบุรี' else 'ศาลาแดง' end), '{}'::text[])
  from public.user_locations ul join public.locations l on l.id = ul.location_id
  where ul.profile_id = p_profile
$$;

-- lotCost(db, lot).perKg || 0 in store.ts: (meat + smoke PO + freight) / centralKg.
create or replace function public.lot_cost_per_kg(p_lots jsonb, p_entries jsonb, p_lot_id text)
returns double precision language plpgsql immutable set search_path = pg_catalog, public as $$
declare
  lot jsonb; line jsonb; lines jsonb; po jsonb;
  requested double precision := 0; base double precision; kg double precision;
  meat double precision := 0; smoke double precision; central double precision;
begin
  select l into lot from jsonb_array_elements(p_lots) l where l ->> 'id' = p_lot_id limit 1;
  if lot is null then return 0; end if;
  central := public.sale_money_number(lot -> 'values' ->> 'centralKg');
  if not central > 0 then return 0; end if;
  lines := coalesce(nullif(lot -> 'values' ->> 'lines', ''), '[]')::jsonb;
  -- shipmentShares: each PO's share of the received kg (requested kg before weigh-in) at its price.
  for line in select x from jsonb_array_elements(lines) with ordinality t(x, ord) order by ord loop
    requested := requested + public.sale_money_number(line ->> 'kg');
  end loop;
  base := coalesce(nullif(public.sale_money_number(lot -> 'values' ->> 'receivedKg'), 0), requested);
  for line in select x from jsonb_array_elements(lines) with ordinality t(x, ord) order by ord loop
    kg := case when requested > 0 then (base * public.sale_money_number(line ->> 'kg')) / requested else 0 end;
    select l into po from jsonb_array_elements(p_lots) l where l ->> 'id' = line ->> 'lotId' limit 1;
    meat := meat + kg * public.sale_money_number(po -> 'values' ->> 'price');
  end loop;
  select public.sale_money_number(e -> 'values' ->> 'estimatedCost') into smoke
  from jsonb_array_elements(p_entries) with ordinality t(e, ord)
  where e ->> 'kind' = 'smokeOrder' and e ->> 'lotId' = p_lot_id
    and not exists (select 1 from jsonb_array_elements(p_entries) v
      where v ->> 'kind' = 'void' and v ->> 'role' = 'owner' and v -> 'values' ->> 'targetId' = e ->> 'id')
  order by ord desc limit 1;
  -- Same order of additions as lotCost: meat + smoke + (outbound + return freight).
  return (meat + coalesce(smoke, 0) + (public.sale_money_number(lot -> 'values' ->> 'outboundCost')
    + public.sale_money_number(lot -> 'values' ->> 'returnCost'))) / central;
end $$;

revoke all on function public.app_state_scope_rules(), public.scope_strip_values(jsonb, text[]),
  public.scope_config(jsonb, text[]), public.scope_app_state(jsonb, text, text[]),
  public.account_branches(uuid), public.lot_cost_per_kg(jsonb, jsonb, text)
  from public, anon, authenticated;

create or replace function public.load_app_state()
returns table(payload jsonb, revision bigint) language plpgsql stable security definer
set search_path = pg_catalog, public as $$
declare profile_role text;
begin
  select p.role::text into profile_role from public.profiles p where p.id = auth.uid() and p.is_active;
  if not found then raise exception 'Account is not active' using errcode = '42501'; end if;
  return query select case profile_role
      when 'L1_OWNER' then s.payload
      when 'L1_MANAGER' then jsonb_set(s.payload, '{entries}', public.strip_sale_money_entries(s.payload -> 'entries'))
      else public.scope_app_state(s.payload,
        case profile_role when 'L2_BRANCH_ADMIN' then 'branch' when 'L3_CM_OPERATOR' then 'cm'
          when 'L4_SUPPLIER' then 'foodiva' end,
        case when profile_role = 'L2_BRANCH_ADMIN' then public.account_branches(auth.uid()) end)
    end, s.revision
    from public.app_state s where s.singleton;
end $$;
revoke all on function public.load_app_state() from public, anon;
grant execute on function public.load_app_state() to authenticated;

-- Direct reads bypassed load_app_state: only the Owner, who gets the whole payload anyway, keeps one.
drop policy if exists app_state_read_active on public.app_state;
create policy app_state_read_active on public.app_state for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active
    and p.role::text = 'L1_OWNER')
);

-- A Branch, Foodiva or Chef House save: the entries it added and the lots it changed, checked by
-- save_app_state's non-owner rules (0023, same messages) and appended to the stored payload.
--   p_entries  new entries only. Each: an object with object `values`, no actor, the account's
--              role, a kind that role creates (plus editRequest), an id not in the log or twice
--              in p_entries, a lotId naming a stored lot (or '' / '-'), and the account's branch
--              (a branch account's own; for cm/foodiva config.branch as normalize() reads it).
--              meatCost / wasteCost (also to./from.) are dropped; on a branch sale / influencerBox
--              they are worked out here from the full payload.
--   p_lots     changed lots only, as the client holds them. Only `stage` and `values` are taken:
--              values merge over the stored ones (so keys the role never received survive), stage
--              stays or moves +1, and either changes only on a lot whose stage the role owns.
-- Returns the new revision. A stale p_expected_revision is PT409 with save_app_state's message.
create or replace function public.append_entries(p_expected_revision bigint, p_entries jsonb, p_lots jsonb default '[]'::jsonb)
returns bigint language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  current_profile public.profiles%rowtype; state_row public.app_state%rowtype;
  current_revision bigint; entry_role text; allowed_kinds text[]; config_branch text;
  old_entries jsonb; old_lots jsonb; new_lots jsonb; added jsonb := '[]'::jsonb;
  e jsonb; l jsonb; old_lot jsonb; lot_index integer; merged_values jsonb; vals jsonb; per_kg double precision;
  -- stageRole in store.ts: who performs the step that leaves each stage (index = stage + 1).
  stage_role constant text[] := array['owner', 'foodiva', 'cm', 'cm', 'cm', 'cm', 'owner', 'owner', 'owner'];
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
  -- Cheap stale check first: reads only the revision column, takes no lock.
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
  -- `ownership` in store.ts, plus editRequest (every non-approver files one). Keep in step with 0023.
  allowed_kinds := case entry_role
    when 'branch' then array['receive', 'thaw', 'supplyPurchase', 'supplyIssue', 'ricePurchase', 'chiliPurchase',
      'riceIssue', 'chiliIssue', 'rice', 'riceCarry', 'sale', 'influencerBox', 'materials', 'materialConfirm',
      'closeDay', 'editRequest']
    when 'cm' then array['smokingInvoice', 'smokeOrderAccept', 'cmReceive', 'prepare', 'smoke', 'closeLot',
      'chefEdit', 'editRequest']
    when 'foodiva' then array['foodivaConfirm', 'packingList', 'foodivaReturnReceive', 'dispatch', 'editRequest'] end;
  if exists (select 1 from jsonb_array_elements(p_entries) n
    where not coalesce(n ->> 'kind' = any (allowed_kinds), false)
  ) then raise exception 'Entry kind is not allowed for this account' using errcode = '42501'; end if;
  if exists (select 1 from jsonb_array_elements(p_entries) n
    where coalesce(n ->> 'id', '') = ''
      or (select count(*) from jsonb_array_elements(p_entries) x where x ->> 'id' = n ->> 'id') > 1
      or exists (select 1 from jsonb_array_elements(old_entries) o where o ->> 'id' = n ->> 'id')
  ) then raise exception 'Entry id must be unique' using errcode = '42501'; end if;
  -- mutate() writes '' for an entry with no lot. Non-owners never add lots.
  if exists (select 1 from jsonb_array_elements(p_entries) n
    where coalesce(n ->> 'lotId', '') not in ('', '-')
      and not exists (select 1 from jsonb_array_elements(old_lots) o where o ->> 'id' = n ->> 'lotId')
  ) then raise exception 'Entry lot does not exist' using errcode = '42501'; end if;
  -- cm/foodiva entries carry config.branch (mutate), read the way normalize() reads it.
  config_branch := case when state_row.payload -> 'config' ->> 'branch' in ('ศาลาแดง', 'มีนบุรี')
    then state_row.payload -> 'config' ->> 'branch' else 'ศาลาแดง' end;
  if entry_role in ('cm', 'foodiva') and exists (select 1 from jsonb_array_elements(p_entries) n
    where n ->> 'branch' is not null and n ->> 'branch' <> config_branch
  ) then raise exception 'Entry branch does not match signed-in account' using errcode = '42501'; end if;

  if (select count(*) <> count(distinct x ->> 'id') from jsonb_array_elements(p_lots) x) then
    raise exception 'Lot changes must follow the workflow' using errcode = '42501'; end if;
  for l in select x from jsonb_array_elements(p_lots) x loop
    old_lot := null;
    select o, (ord - 1)::integer into old_lot, lot_index
      from jsonb_array_elements(old_lots) with ordinality t(o, ord) where o ->> 'id' = l ->> 'id' limit 1;
    if old_lot is null then raise exception 'Only an owner can add or remove lots' using errcode = '42501'; end if;
    if jsonb_typeof(l -> 'stage') is distinct from 'number' or jsonb_typeof(coalesce(l -> 'values', '{}'::jsonb)) <> 'object'
      or (l ->> 'stage')::numeric % 1 <> 0
      or (l ->> 'stage')::numeric not between (old_lot ->> 'stage')::numeric and (old_lot ->> 'stage')::numeric + 1
    then raise exception 'Lot changes must follow the workflow' using errcode = '42501'; end if;
    merged_values := coalesce(old_lot -> 'values', '{}'::jsonb) || coalesce(l -> 'values', '{}'::jsonb);
    if ((l ->> 'stage')::numeric <> (old_lot ->> 'stage')::numeric or merged_values is distinct from old_lot -> 'values')
      and stage_role[(old_lot ->> 'stage')::int + 1] is distinct from entry_role
    then raise exception 'Lot changes must follow the workflow' using errcode = '42501'; end if;
    new_lots := jsonb_set(new_lots, array[lot_index::text],
      old_lot || jsonb_build_object('stage', (l ->> 'stage')::numeric, 'values', merged_values));
  end loop;

  for e in select x from jsonb_array_elements(p_entries) with ordinality t(x, ord) order by ord loop
    vals := public.scope_strip_values(e -> 'values', array['meatCost', 'wasteCost']);
    if entry_role = 'branch' and e ->> 'kind' in ('sale', 'influencerBox') then
      per_kg := public.lot_cost_per_kg(new_lots, old_entries, e ->> 'lotId');
      vals := vals || jsonb_build_object('meatCost', (public.sale_money_number(vals ->> 'soldKg') * per_kg)::text);
      if e ->> 'kind' = 'sale' then
        vals := vals || jsonb_build_object('wasteCost', (public.sale_money_number(vals ->> 'wasteKg') * per_kg)::text);
      end if;
    end if;
    added := added || jsonb_build_array(jsonb_set(e, '{values}', vals));
  end loop;

  update public.app_state
    set payload = jsonb_set(jsonb_set(payload, '{entries}', old_entries || added), '{lots}', new_lots),
      revision = app_state.revision + 1, updated_at = now(), updated_by = auth.uid()
    where singleton returning app_state.revision into current_revision;
  return current_revision;
end $$;
revoke all on function public.append_entries(bigint, jsonb, jsonb) from public, anon;
grant execute on function public.append_entries(bigint, jsonb, jsonb) to authenticated;

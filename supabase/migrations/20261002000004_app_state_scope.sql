-- What each account receives of the app state, and what it may send back (vault:
-- Spec/Account Stocking v2/Spec v2.md V2-ACC-01..08). Helpers only: no client may call them,
-- load_app_state, save_app_state and append_entries (file 5) do.
--
-- * A branch (app_state_scope_rules, scope_app_state) receives every Lot รมควัน, its own entries
--   (role "branch", stamped with its branch) and, cut down to what stock needs, the payments
--   the Owner or the Account Manager stamped with its branch (V2-PAY-05), plus the edits and
--   deletes naming any of those. Nothing of another branch. hiddenKeys are stripped from the
--   branch's own entries and the Lots, so `fullAmount` is not one: a branch types it on its own
--   payment (V2-ACC-07). The Owner's never reaches a branch, stockKeys being the only keys a
--   stock line keeps. The same way it gets what an `expense` bought straight into its warehouse
--   (what, how many, never the amount or the vendor), and, whole, every `transfer` out of or into
--   its stock (wholeKinds: no money in one) with its own receipts. Of `rawRiceBranches` it gets its own branch's name or an empty list: whether
--   it counts raw rice, not whether the other branch does (V2-BR-08).
-- * The Account Manager (manager_*) gets a copy with no sale money (also under a `sales.`
--   channel key) and every payroll payment as a stub: its category and what it names, no
--   amount, name or payer.
--
-- JS ports for the local SQLite mode: src/lib/role-scope.ts, src/lib/manager-scope.ts
-- (tests/unit/server.test.ts reads the rule JSON below). Keep them in step.

-- The rule table. Must equal `branchScope` in src/lib/role-scope.ts.
create or replace function public.app_state_scope_rules() returns jsonb
language sql immutable set search_path = pg_catalog as $$ select $rules$
{
  "kinds": ["receive", "sale", "influencerBox", "materials", "meatCount", "pay", "transferReceive"],
  "hiddenKeys": ["price", "invoiceAmount", "netPayable", "lines", "estimatedCost", "serviceRate", "outboundCost",
    "returnCost", "meatCost", "wasteCost"],
  "configKeys": ["packKg", "materialList", "salesChannels", "payCategories", "rawRiceBranches"],
  "stockKinds": ["pay", "expense"],
  "stockKeys": ["category", "item", "qty", "branch", "sku", "warehouse", "purpose", "project", "status", "targetId",
    "targetKind", "to.category", "to.item", "to.qty", "to.sku", "to.warehouse", "to.purpose", "to.project",
    "to.status", "fromDate", "toDate"],
  "wholeKinds": ["transfer"]
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

-- A branch account's branch, named the way the app names it. A profile linked to several
-- locations gets one, the one on the lowest location_id, which is the one the app opens
-- (session.ts).
create or replace function public.account_branches(p_profile uuid) returns text[]
language sql stable set search_path = pg_catalog, public as $$
  select coalesce((
    select array[case when l.name_th like '%มีนบุรี%' then 'มีนบุรี' else 'ศาลาแดง' end]
    from public.user_locations ul join public.locations l on l.id = ul.location_id
    where ul.profile_id = p_profile
    order by ul.location_id limit 1), '{}'::text[])
$$;

-- isVoided in src/lib/store/derived.ts: a delete counts when its author may change the entry
-- (the Owner any entry, a branch its own branch's) and while it is not deleted itself: deleting
-- a delete puts the entry back. mutate() never lets a chain go deeper than void -> void -> entry,
-- so two levels are read here.
create or replace function public.entry_voided(p_log jsonb, p_entry jsonb) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select exists (select 1 from jsonb_array_elements(p_log) v
    where v ->> 'kind' = 'void' and v -> 'values' ->> 'targetId' = p_entry ->> 'id'
      and (v ->> 'role' = 'owner' or (v ->> 'role' = 'branch' and p_entry ->> 'role' = 'branch'
        and p_entry ->> 'branch' = v ->> 'branch'))
      -- Not undone: no void that counts, by the same rule, names this one.
      and not exists (select 1 from jsonb_array_elements(p_log) w
        where w ->> 'kind' = 'void' and w -> 'values' ->> 'targetId' = v ->> 'id'
          and (w ->> 'role' = 'owner' or (w ->> 'role' = 'branch' and v ->> 'role' = 'branch'
            and v ->> 'branch' = w ->> 'branch'))))
$$;

-- scopeDatabase in src/lib/role-scope.ts.
create or replace function public.scope_app_state(p_payload jsonb, p_branches text[])
returns jsonb language plpgsql stable set search_path = pg_catalog, public as $$
declare
  rule jsonb := public.app_state_scope_rules();
  all_entries jsonb := coalesce(p_payload -> 'entries', '[]'::jsonb);
  all_lots jsonb := coalesce(p_payload -> 'lots', '[]'::jsonb);
  kinds text[] := array(select jsonb_array_elements_text(rule -> 'kinds'));
  hidden text[] := array(select jsonb_array_elements_text(rule -> 'hiddenKeys'));
  config_keys text[] := array(select jsonb_array_elements_text(rule -> 'configKeys'));
  stock_kinds text[] := array(select jsonb_array_elements_text(rule -> 'stockKinds'));
  stock_keys text[] := array(select jsonb_array_elements_text(rule -> 'stockKeys'));
  whole_kinds text[] := array(select jsonb_array_elements_text(rule -> 'wholeKinds'));
  scoped_lots jsonb; scoped_entries jsonb; scoped_config jsonb; rice text;
begin
  p_branches := coalesce(p_branches, '{}'::text[]);

  -- Every Lot รมควัน: the receive form lists them all. No PO เนื้อ (its price).
  select coalesce(jsonb_agg(l || jsonb_build_object(
      'values', public.scope_strip_values(coalesce(l -> 'values', '{}'::jsonb), hidden),
      'config', public.scope_config(l -> 'config', config_keys) - 'rawRiceBranches') order by ord), '[]'::jsonb)
  into scoped_lots
  from jsonb_array_elements(all_lots) with ordinality t(l, ord)
  where coalesce(l ->> 'kind' = 'shipment', false);

  -- Own entries (hiddenKeys stripped), stock lines (stockKeys only) and the transfers whose `from`
  -- or `to` names the branch, as saved or as an edit put it (whole), then every edit or delete
  -- naming one, cut like its target, then a delete naming one of those (an undone edit, a
  -- restored delete; no chain is longer, see entry_voided).
  with log as (
    select e, ord, e ->> 'role' is not distinct from 'branch' as branch_role
    from jsonb_array_elements(all_entries) with ordinality t(e, ord)
  ), direct as (
    select e, ord, branch_role as own from log
    where coalesce(e ->> 'branch' = any (p_branches), false)
      and case when branch_role then e ->> 'kind' = any (kinds) else e ->> 'kind' = any (stock_kinds) end
    union all
    select e, ord, true from log
    where not coalesce(e ->> 'branch' = any (p_branches), false)
      and not branch_role and coalesce(e ->> 'kind' = any (whole_kinds), false)
      and (coalesce(e -> 'values' ->> 'from' = any (p_branches), false)
        or coalesce(e -> 'values' ->> 'to' = any (p_branches), false)
        or exists (select 1 from log x where x.e ->> 'kind' = 'entryEdit'
          and x.e -> 'values' ->> 'targetId' = log.e ->> 'id'
          and (coalesce(x.e -> 'values' ->> 'to.from' = any (p_branches), false)
            or coalesce(x.e -> 'values' ->> 'to.to' = any (p_branches), false))))
  ), follow as (
    select l.e, l.ord, d.own from log l
    join direct d on d.e ->> 'id' = l.e -> 'values' ->> 'targetId'
    where l.e ->> 'kind' in ('void', 'entryEdit')
  ), undo as (
    select l.e, l.ord, f.own from log l
    join follow f on f.e ->> 'id' = l.e -> 'values' ->> 'targetId'
    where l.e ->> 'kind' = 'void'
  ), picked as (
    -- An entry is sent once, as the first of these it is (the JS reads them in this order).
    select distinct on (ord) e, ord, own from (select *, 0 as pass from direct
      union all select *, 1 from follow union all select *, 2 from undo) s
    order by ord, pass
  )
  select coalesce(jsonb_agg(case
      when not p.own then jsonb_set(p.e, '{values}', public.scope_config(p.e -> 'values', stock_keys))
      when jsonb_typeof(p.e -> 'values') = 'object'
        then jsonb_set(p.e, '{values}', public.scope_strip_values(p.e -> 'values', hidden))
      else p.e end
      order by p.ord), '[]'::jsonb)
  into scoped_entries
  from picked p;

  -- Of the branches that count raw rice, only its own. An unreadable list is dropped, so the app
  -- reads the seed's, as the Owner's copy does.
  scoped_config := public.scope_config(p_payload -> 'config', config_keys);
  rice := scoped_config ->> 'rawRiceBranches';
  scoped_config := scoped_config - 'rawRiceBranches';
  if rice is json array then
    scoped_config := scoped_config || jsonb_build_object('rawRiceBranches', (
      select coalesce(jsonb_agg(b order by ord), '[]'::jsonb)::text
      from jsonb_array_elements(rice::jsonb) with ordinality t(b, ord)
      where jsonb_typeof(b) = 'string' and b #>> '{}' = any (p_branches)));
  end if;

  return jsonb_build_object('version', p_payload -> 'version', 'lots', scoped_lots, 'entries', scoped_entries,
    'config', scoped_config);
end $$;

-- managerHidden in src/lib/store/visibility.ts: a sale, a payroll payment, a change about a sale,
-- or a change whose target is one of those. A null `target` (or `e`) hides nothing.
create or replace function public.manager_hidden(e jsonb, target jsonb) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select coalesce(bool_or(coalesce(x ->> 'kind' = 'sale', false)
      or coalesce(x -> 'values' ->> 'category' = 'payroll', false)
      or coalesce(x -> 'values' ->> 'to.category' = 'payroll', false)
      or coalesce(x -> 'values' ->> 'from.category' = 'payroll', false)
      or coalesce(x -> 'values' ->> 'targetKind' = 'sale', false)), false)
  from unnest(array[e, target]) x
$$;

-- isSaleMoneyKey in src/lib/store/visibility.ts, also as the `to.` / `from.` keys an edit stores.
create or replace function public.manager_strip_values(v jsonb) returns jsonb
language sql immutable set search_path = pg_catalog as $$
  select case when jsonb_typeof(v) = 'object' then coalesce((
    select jsonb_object_agg(key, value) from jsonb_each(v)
    where regexp_replace(key, '^(to|from)\.', '') <> all (array['revenue', 'lineMan', 'menuTotal'])
      and not starts_with(regexp_replace(key, '^(to|from)\.', ''), 'sales.')
  ), '{}'::jsonb) else v end
$$;

-- stripForManager in src/lib/manager-scope.ts. A payroll payment, and an edit carrying its
-- category, stays in its place in the log as a stub, so the manager's whole-payload save lines up.
create or replace function public.manager_strip_entries(entries jsonb) returns jsonb
language sql immutable set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(case
      when jsonb_typeof(e -> 'values') is distinct from 'object' then e
      when 'payroll' in (e -> 'values' ->> 'category', e -> 'values' ->> 'to.category', e -> 'values' ->> 'from.category')
        then jsonb_set(e, '{values}', public.scope_config(e -> 'values', array['category', 'to.category',
          'from.category', 'targetId', 'targetKind', 'targetDate', 'targetRole', 'targetBranch']))
      else jsonb_set(e, '{values}', public.manager_strip_values(e -> 'values')) end
    order by ord), '[]'::jsonb)
  from jsonb_array_elements(entries) with ordinality t(e, ord)
$$;

-- restoreForManager in src/lib/manager-scope.ts: a stored entry that matches the incoming one once
-- both are stripped is replaced by the stored one; any other difference is left for the
-- append-only check to refuse. Nothing is filled in for new entries.
create or replace function public.manager_restore_entries(p_old jsonb, p_new jsonb) returns jsonb
language sql immutable set search_path = pg_catalog, public as $$
  select case when jsonb_array_length(p_new) < jsonb_array_length(p_old) then p_new else coalesce((
    select jsonb_agg(case when o.e is not null
        and public.manager_strip_entries(jsonb_build_array(o.e)) = public.manager_strip_entries(jsonb_build_array(n.e))
      then o.e else n.e end order by ord)
    from jsonb_array_elements(p_new) with ordinality n(e, ord)
    left join jsonb_array_elements(p_old) with ordinality o(e, ord) using (ord)
  ), '[]'::jsonb) end
$$;

revoke all on function public.app_state_scope_rules(), public.scope_strip_values(jsonb, text[]),
  public.scope_config(jsonb, text[]), public.account_branches(uuid), public.entry_voided(jsonb, jsonb),
  public.scope_app_state(jsonb, text[]), public.manager_hidden(jsonb, jsonb),
  public.manager_strip_values(jsonb), public.manager_strip_entries(jsonb),
  public.manager_restore_entries(jsonb, jsonb)
  from public, anon, authenticated;

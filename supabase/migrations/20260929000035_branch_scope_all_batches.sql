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
  ), picked as (
    -- An entry both sent and following a sent one goes once, as sent (the JS keeps the first).
    select distinct on (ord) e, ord, own from (select *, 0 as pass from direct union all select *, 1 from follow) s
    order by ord, pass
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

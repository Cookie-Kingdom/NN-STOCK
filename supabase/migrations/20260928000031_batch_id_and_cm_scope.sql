-- Free-ledger follow-ups to 20260928000030 (no data change).
--
-- 1. Batch ids (GEN-09). mutate() numbers a new batch `S<yymmdd>-NNN` from the batches the client
--    can see. Chef House and a branch see a subset, so the number can repeat a batch they cannot
--    see, and append_entries then merged the "new" batch's values into that stored lot. A new
--    batch id now ends in 4 random hex chars, `S<yymmdd>-NNN-xxxx` (newBatch in store/mutate.ts,
--    isShipmentLot in local-db.server.ts), so it cannot collide. `SH-YYYY-NNNN` stays the
--    display number and may repeat in that rare case.
-- 2. VIS-02: Chef House also gets a shipment batch Foodiva opened (a `dispatch` or `packingList`
--    on it) before any smoke PO, so Chef records on it instead of opening a duplicate. Entries
--    sent and hidden keys are unchanged (app_state_scope_rules() in 0030 still holds; `lines`,
--    `price`, `outboundCost`, `returnCost` and purchase lots stay hidden from cm).
--
-- JS ports: role-scope.ts (scopeDatabase), store/visibility.ts (visibleLots). Errors are raise
-- exception or PTxxx only, never 40001 / 40P01.

create or replace function public.is_new_batch(p_lot jsonb) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select coalesce(jsonb_typeof(p_lot) = 'object' and p_lot ->> 'kind' = 'shipment'
    and jsonb_typeof(p_lot -> 'id') = 'string' and p_lot ->> 'id' ~ '^S\d{6}-\d{3}-[0-9a-f]{4}$'
    and jsonb_typeof(p_lot -> 'poId') = 'string' and p_lot ->> 'poId' ~ '^SH-\d{4}-\d{4}$'
    and jsonb_typeof(coalesce(p_lot -> 'values', '{}'::jsonb)) = 'object', false)
$$;
revoke all on function public.is_new_batch(jsonb) from public, anon, authenticated;

-- 0030's scope_app_state; only `smoked` changes (VIS-02).
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

  -- VIS-02: Chef House's batches (smoke PO, Foodiva's dispatch / Packing List, or any cm entry).
  -- BR-07: a branch's lots.
  smoked := array(select e ->> 'lotId' from jsonb_array_elements(all_entries) e
    where e ->> 'kind' in ('smokeOrder', 'dispatch', 'packingList') or e ->> 'role' = 'cm');
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
revoke all on function public.scope_app_state(jsonb, text, text[]) from public, anon, authenticated;

-- Branch scope simplified (card C4). Since 0032 the branch is the only scoped role, so:
--
-- * app_state_scope_rules() returns the branch rule itself, not a one-key {"branch": ...} table,
--   and drops `ownBranch` (always true) and `lots` (always "allocated").
-- * scope_app_state(payload, branches) replaces scope_app_state(payload, role, branches) (0031):
--   the branch path only (own-branch entries on allocated lots). The "all" / "smoked" paths and
--   the empty copy for an unknown role were unreachable after 0032.
-- * load_app_state (0032) calls the new signature. Nothing else changes: same entries, lots,
--   hidden keys and config keys for a branch; Owner and Manager untouched.
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
    "cookedRicePar", "cookedRiceUnitPrice", "material*"]
}
$rules$::jsonb $$;
revoke all on function public.app_state_scope_rules() from public, anon, authenticated;

-- 0031's scope_app_state, branch path only.
create or replace function public.scope_app_state(p_payload jsonb, p_branches text[])
returns jsonb language plpgsql stable set search_path = pg_catalog, public as $$
declare
  rule jsonb := public.app_state_scope_rules();
  all_entries jsonb := coalesce(p_payload -> 'entries', '[]'::jsonb);
  all_lots jsonb := coalesce(p_payload -> 'lots', '[]'::jsonb);
  kinds text[] := array(select jsonb_array_elements_text(rule -> 'kinds'));
  hidden text[] := array(select jsonb_array_elements_text(rule -> 'hiddenKeys'));
  config_keys text[] := array(select jsonb_array_elements_text(rule -> 'configKeys'));
  allocated text[]; lot_ids text[];
  scoped_lots jsonb; scoped_entries jsonb;
begin
  p_branches := coalesce(p_branches, '{}'::text[]);

  -- BR-07: a branch's lots.
  allocated := array(select e ->> 'lotId' from jsonb_array_elements(all_entries) e
    where coalesce(e ->> 'branch' = any (p_branches), false)
      and (e ->> 'kind' = 'allocate' or e ->> 'role' = 'branch'));

  select coalesce(jsonb_agg(l || jsonb_build_object(
      'values', public.scope_strip_values(coalesce(l -> 'values', '{}'::jsonb), hidden),
      'config', public.scope_config(l -> 'config', config_keys)) order by ord), '[]'::jsonb),
    coalesce(array_agg(l ->> 'id'), '{}'::text[])
  into scoped_lots, lot_ids
  from jsonb_array_elements(all_lots) with ordinality t(l, ord)
  where coalesce(l ->> 'id' = any (allocated), false);

  -- The branch's own entries of the listed kinds (its "no lot" entries too), then every void /
  -- edit / edit request / decision / link naming one.
  with log as (
    select e, ord from jsonb_array_elements(all_entries) with ordinality t(e, ord)
  ), direct as (
    select e, ord from log
    where e ->> 'kind' = any (kinds)
      and coalesce(e ->> 'branch' = any (p_branches), false)
      and (coalesce(e ->> 'lotId', '') = '' or coalesce(e ->> 'lotId' = any (lot_ids), false))
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
revoke all on function public.scope_app_state(jsonb, text[]) from public, anon, authenticated;

-- 0032's load_app_state with the two-argument scope_app_state.
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
      when 'L1_MANAGER' then jsonb_set(s.payload, '{entries}', public.strip_sale_money_entries(s.payload -> 'entries'))
      else public.scope_app_state(s.payload, public.account_branches(auth.uid()))
    end, s.revision
    from public.app_state s where s.singleton;
end $$;
revoke all on function public.load_app_state() from public, anon;
grant execute on function public.load_app_state() to authenticated;

drop function if exists public.scope_app_state(jsonb, text, text[]);

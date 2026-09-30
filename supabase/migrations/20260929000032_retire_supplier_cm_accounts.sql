-- Merge roles (plan 28-09-2026, card M1): Foodiva and Chef House are partners, not users. The Owner
-- and the Account Manager record their work from /owner, so the entry keeps role "foodiva" / "cm"
-- (whose document) and `actor` says who typed it (M0: recordRole in store/mutate.ts).
--
-- * L3_CM_OPERATOR / L4_SUPPLIER profiles are deactivated, and load_app_state, save_app_state and
--   append_entries refuse them even when re-activated ("Account is not active"): each now selects
--   its profile from an allow-list of roles, so no case arm can fall through to "no check".
-- * save_app_state: a new entry's actor is
--     Owner    none, or "owner" on a foodiva / cm entry;
--     Manager  "manager", on an owner / foodiva / cm entry;
--     branch   none (append_entries refuses any actor too).
--   The non-owner checks are the branch's only: allowed_kinds and the config.branch rule for
--   cm / foodiva go.
-- * append_entries is branch only. Its lot rules (values merge, GEN-09 new batch) are unchanged.
-- * app_state_scope_rules() keeps only "branch"; scope_app_state (0031) is unchanged, its
--   "all" / "smoked" paths are simply never reached.
-- * Storage: the L3 / L4 arms of the attachment policies go (owner / manager already write and
--   read every folder).
-- * app_state is not touched.
--
-- JS ports: loadState / saveState / appendState in src/lib/local-db.server.ts, scopeRules in
-- src/lib/role-scope.ts (tests/unit/roleScope.test.ts reads the rule JSON below). Errors are raise
-- exception or PTxxx only, never 40001 / 40P01.

update public.profiles set is_active = false where role::text in ('L3_CM_OPERATOR', 'L4_SUPPLIER') and is_active;

comment on function private.handle_new_user() is
  'New auth users get an inactive L4_SUPPLIER profile: a placeholder only (L3/L4 are retired, 0032). '
  'An owner assigns L1_OWNER / L1_MANAGER / L2_BRANCH_ADMIN and activates it.';

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
  }
}
$rules$::jsonb $$;
revoke all on function public.app_state_scope_rules() from public, anon, authenticated;

-- 0028's load_app_state, L3 / L4 refused and the branch the only scoped role.
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
      else public.scope_app_state(s.payload, 'branch', public.account_branches(auth.uid()))
    end, s.revision
    from public.app_state s where s.singleton;
end $$;
revoke all on function public.load_app_state() from public, anon;
grant execute on function public.load_app_state() to authenticated;

-- 0030's save_app_state with the actor / role rules above and the branch the only non-owner.
create or replace function public.save_app_state(p_payload jsonb, p_expected_revision bigint default null)
returns table(revision bigint, updated_at timestamptz) language plpgsql security definer
set search_path = pg_catalog, public as $$
declare current_profile public.profiles%rowtype; state_row public.app_state%rowtype;
  old_entries jsonb; new_entries jsonb; old_lots jsonb; new_lots jsonb;
  old_entry_count integer; new_entry_count integer;
  runs_business boolean; current_revision bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if pg_column_size(p_payload) > 2097152 then
    raise sqlstate 'PT413' using message = 'Payload too large'; end if;
  select * into current_profile from public.profiles where id = auth.uid() and is_active
    and role::text in ('L1_OWNER', 'L1_MANAGER', 'L2_BRANCH_ADMIN');
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
  -- M0 / M1: the Owner may stamp "owner" on a partner's entry it typed; the Manager stamps every one.
  if exists (
    select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
    where n.ord > old_entry_count and not coalesce(case current_profile.role::text
      when 'L1_MANAGER' then n.entry ->> 'actor' = 'manager'
      when 'L1_OWNER' then n.entry ->> 'actor' is null
        or (n.entry ->> 'actor' = 'owner' and n.entry ->> 'role' in ('foodiva', 'cm'))
      else n.entry ->> 'actor' is null end, false)
  ) then raise exception 'Entry actor does not match signed-in account' using errcode = '42501'; end if;
  if current_profile.role::text = 'L1_MANAGER' and exists (
    select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
    where n.ord > old_entry_count and not coalesce(n.entry ->> 'role' in ('owner', 'foodiva', 'cm'), false)
  ) then raise exception 'Entry role does not match signed-in account' using errcode = '42501'; end if;
  if not runs_business and new_entry_count > old_entry_count then
    if exists (
      select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
      where n.ord > old_entry_count and n.entry ->> 'role' is distinct from 'branch'
    ) then raise exception 'Entry role does not match signed-in account' using errcode = '42501'; end if;
    if exists (
      select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
      where n.ord > old_entry_count and not coalesce(n.entry ->> 'branch' = any (public.account_branches(auth.uid())), false)
    ) then raise exception 'Entry branch does not match signed-in account' using errcode = '42501'; end if;
    -- `ownership` in store/mutate.ts, plus editRequest and link. Keep in step with append_entries.
    if exists (
      select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
      where n.ord > old_entry_count and not coalesce(n.entry ->> 'kind' = any(array['receive', 'thaw', 'supplyPurchase',
        'supplyIssue', 'ricePurchase', 'chiliPurchase', 'riceIssue', 'chiliIssue', 'rice', 'riceCarry', 'sale',
        'influencerBox', 'materials', 'materialConfirm', 'closeDay', 'editRequest', 'link']), false)
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

-- 0030's append_entries for a branch account only.
create or replace function public.append_entries(p_expected_revision bigint, p_entries jsonb, p_lots jsonb default '[]'::jsonb)
returns bigint language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  current_profile public.profiles%rowtype; state_row public.app_state%rowtype;
  current_revision bigint;
  old_entries jsonb; old_lots jsonb; new_lots jsonb; added jsonb := '[]'::jsonb;
  e jsonb; l jsonb; old_lot jsonb; lot_index integer;
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
  if exists (select 1 from jsonb_array_elements(p_entries) n where n ->> 'role' is distinct from 'branch') then
    raise exception 'Entry role does not match signed-in account' using errcode = '42501'; end if;
  if exists (select 1 from jsonb_array_elements(p_entries) n
    where not coalesce(n ->> 'branch' = any (public.account_branches(auth.uid())), false)
  ) then raise exception 'Entry branch does not match signed-in account' using errcode = '42501'; end if;
  if exists (select 1 from jsonb_array_elements(p_entries) n
    where not coalesce(n ->> 'kind' = any (array['receive', 'thaw', 'supplyPurchase', 'supplyIssue', 'ricePurchase',
      'chiliPurchase', 'riceIssue', 'chiliIssue', 'rice', 'riceCarry', 'sale', 'influencerBox', 'materials',
      'materialConfirm', 'closeDay', 'editRequest', 'link']), false)
  ) then raise exception 'Entry kind is not allowed for this account' using errcode = '42501'; end if;
  if exists (select 1 from jsonb_array_elements(p_entries) n
    where coalesce(n ->> 'id', '') = ''
      or (select count(*) from jsonb_array_elements(p_entries) x where x ->> 'id' = n ->> 'id') > 1
      or exists (select 1 from jsonb_array_elements(old_entries) o where o ->> 'id' = n ->> 'id')
  ) then raise exception 'Entry id must be unique' using errcode = '42501'; end if;

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

-- 0027's attachment read rule and 0024's insert rule without the L3 / L4 arms.
-- Guarded so the plain-postgres migration test (no storage schema) still passes.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present, skipping attachments policies';
    return;
  end if;
  drop policy if exists attachments_read_by_role on storage.objects;
  drop policy if exists attachments_insert_by_role on storage.objects;
  execute $p$
    create policy attachments_read_by_role on storage.objects for select to authenticated using (
      bucket_id = 'attachments'
      and exists (
        select 1 from public.profiles p
         where p.id = (select auth.uid()) and p.is_active
           and (p.role::text in ('L1_OWNER', 'L1_MANAGER') or objects.owner_id = (select auth.uid())::text)
      )
    )
  $p$;
  execute $p$
    create policy attachments_insert_by_role on storage.objects for insert to authenticated with check (
      bucket_id = 'attachments'
      and exists (
        select 1 from public.profiles p
         where p.id = (select auth.uid()) and p.is_active and p.role::text in ('L1_OWNER', 'L1_MANAGER')
           and (storage.foldername(objects.name))[1] in
             ('foodivaConfirm', 'packingList', 'smokingInvoice', 'invoicePayment', 'meatPayment', 'legacy')
      )
    )
  $p$;
end $$;

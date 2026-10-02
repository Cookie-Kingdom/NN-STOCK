-- v2 note-taking 02-10-2026 (vault: Design/Account Stocking/v2 build plan.md section 3,
-- Spec/Account Stocking v2/Spec v2.md V2-ACC-01..08).
--
-- APPLY TOGETHER WITH THE v2 APP RELEASE. After it the old app's branch saves are refused (its
-- kinds are retired), and before it the v2 app's `pay` and `meatCount` are. Safe to run twice:
-- every statement is `create or replace` or `drop ... if exists`.
--
-- * app_state_scope_rules / scope_app_state (0040, 0039): a branch receives every Lot รมควัน,
--   its own entries (role "branch", stamped with its branch) and, cut down to what stock needs,
--   the payments the Owner or the Account Manager stamped with its branch (V2-PAY-05), plus the
--   edits and deletes naming any of those. Nothing of another branch: central stock is gone.
--   hiddenKeys are stripped from the branch's own entries and the Lots, so `fullAmount` is not
--   one: a branch types it on its own payment (V2-ACC-07). The Owner's never reaches a branch,
--   stockKeys being the only keys a stock line keeps.
-- * manager_hidden / manager_strip_values / manager_strip_entries / manager_restore_entries take
--   the place of the sale-money helpers of 0021 and 0039. The Account Manager's copy has no sale
--   money (also under a `sales.` channel key) and every payroll payment as a stub: its category
--   and what it names, no amount, name or payer.
-- * load_app_state (0033): the Account Manager's copy goes through manager_strip_entries.
-- * save_app_state (0034): the Account Manager's stored history is put back from the server's
--   copy, and it may not append a sale, a payroll payment, a change about one, or settings (a
--   `config` entry, or a payload whose config differs). The Owner and the Account Manager may jot
--   a branch's notes for it: role "branch" with actor "owner" / "manager".
-- * append_entries (0040): the branch kinds are the v2 ones; a payment stays in the branch's four
--   categories; an edit names a live note of the branch and only a `receive` changes Lot.
-- * Storage: receipts of `purchase` and `pay`; payroll receipts sit in their own folder that only
--   the Owner writes and reads.
-- * Dropped: the sale-money helpers and branch_day_closed (no caller since 0037).
--
-- JS ports for the local SQLite mode: src/lib/role-scope.ts, src/lib/manager-scope.ts,
-- src/lib/local-db.server.ts (tests/unit/server.test.ts reads the rule JSON below).
-- Errors are raise exception or PTxxx only, never 40001 / 40P01.

create or replace function public.app_state_scope_rules() returns jsonb
language sql immutable set search_path = pg_catalog as $$ select $rules$
{
  "kinds": ["receive", "sale", "influencerBox", "materials", "meatCount", "pay"],
  "hiddenKeys": ["price", "invoiceAmount", "netPayable", "lines", "estimatedCost", "serviceRate", "outboundCost",
    "returnCost", "meatCost", "wasteCost"],
  "configKeys": ["packKg", "materialList", "salesChannels", "payCategories"],
  "stockKinds": ["pay"],
  "stockKeys": ["category", "item", "qty", "branch", "targetId", "targetKind", "to.category", "to.item", "to.qty",
    "fromDate", "toDate"]
}
$rules$::jsonb $$;
revoke all on function public.app_state_scope_rules() from public, anon, authenticated;

-- scopeDatabase in src/lib/role-scope.ts. scope_strip_values and scope_config are 0028's.
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
  scoped_lots jsonb; scoped_entries jsonb;
begin
  p_branches := coalesce(p_branches, '{}'::text[]);

  -- Every Lot รมควัน: the receive form lists them all. No PO เนื้อ (its price).
  select coalesce(jsonb_agg(l || jsonb_build_object(
      'values', public.scope_strip_values(coalesce(l -> 'values', '{}'::jsonb), hidden),
      'config', public.scope_config(l -> 'config', config_keys)) order by ord), '[]'::jsonb)
  into scoped_lots
  from jsonb_array_elements(all_lots) with ordinality t(l, ord)
  where coalesce(l ->> 'kind' = 'shipment', false);

  -- Own entries (hiddenKeys stripped) and stock lines (stockKeys only), then every edit or delete
  -- naming one, cut like its target, then a delete naming one of those (an undone edit, a
  -- restored delete; no chain is longer, see entry_voided).
  with log as (
    select e, ord, e ->> 'role' is not distinct from 'branch' as branch_role
    from jsonb_array_elements(all_entries) with ordinality t(e, ord)
  ), direct as (
    select e, ord, branch_role as own from log
    where coalesce(e ->> 'branch' = any (p_branches), false)
      and case when branch_role then e ->> 'kind' = any (kinds) else e ->> 'kind' = any (stock_kinds) end
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

  return jsonb_build_object('version', p_payload -> 'version', 'lots', scoped_lots, 'entries', scoped_entries,
    'config', public.scope_config(p_payload -> 'config', config_keys));
end $$;
revoke all on function public.scope_app_state(jsonb, text[]) from public, anon, authenticated;

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
revoke all on function public.manager_hidden(jsonb, jsonb), public.manager_strip_values(jsonb),
  public.manager_strip_entries(jsonb), public.manager_restore_entries(jsonb, jsonb) from public, anon, authenticated;

-- 0033's load_app_state with the v2 manager copy.
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

-- 0034's save_app_state with the v2 Account Manager rules. The first save (no row yet) goes
-- through the same checks against an empty history.
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
  -- someone else (a branch kind, an old partner step).
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
  if not has_row then
    return query insert into public.app_state(singleton, payload, revision, updated_by) values (true, p_payload, 1, auth.uid())
      returning app_state.revision, app_state.updated_at; return;
  end if;
  return query update public.app_state set payload = p_payload, revision = app_state.revision + 1, updated_at = now(), updated_by = auth.uid()
    where singleton returning app_state.revision, app_state.updated_at;
end; $$;
revoke all on function public.save_app_state(jsonb, bigint) from public, anon;
grant execute on function public.save_app_state(jsonb, bigint) to authenticated;

-- 0040's append_entries for the v2 kinds. p_lots stays in the signature and must be empty.
-- entry_voided is 0039's.
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

-- Attachments (0032): the folder is the entry kind, except a payroll receipt, which goes to
-- `payroll`.
--
--   folder                           written by              read by
--   purchase, pay, smokingInvoice,   Owner, Account Manager  Owner, Account Manager, the uploader
--   packingList, the retired kinds
--   pay                              also a branch           Owner, Account Manager, the uploader
--   payroll                          Owner                   Owner
--
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
           and (p.role::text = 'L1_OWNER'
             or (p.role::text = 'L1_MANAGER' and (storage.foldername(objects.name))[1] is distinct from 'payroll')
             or objects.owner_id = (select auth.uid())::text)
      )
    )
  $p$;
  execute $p$
    create policy attachments_insert_by_role on storage.objects for insert to authenticated with check (
      bucket_id = 'attachments'
      and exists (
        select 1 from public.profiles p
         where p.id = (select auth.uid()) and p.is_active
           and ((p.role::text in ('L1_OWNER', 'L1_MANAGER') and (storage.foldername(objects.name))[1] in
               ('purchase', 'pay', 'foodivaConfirm', 'packingList', 'smokingInvoice', 'invoicePayment', 'meatPayment', 'legacy'))
             or (p.role::text = 'L1_OWNER' and (storage.foldername(objects.name))[1] = 'payroll')
             or (p.role::text = 'L2_BRANCH_ADMIN' and (storage.foldername(objects.name))[1] = 'pay'))
      )
    )
  $p$;
end $$;

-- No caller left: the sale-money helpers (0021, 0039) and branch_day_closed (0034; append_entries
-- stopped reading it in 0037).
drop function if exists public.restore_sale_money(jsonb, jsonb, jsonb);
drop function if exists public.current_sale_money(jsonb, text);
drop function if exists public.sale_money_number(text);
drop function if exists public.strip_sale_money_entries(jsonb);
drop function if exists public.strip_sale_money(jsonb);
drop function if exists public.branch_day_closed(jsonb, text, text);

-- Account Manager (C4, feedback 20-09 item 11): sale money never reaches its browser.
-- 20260922000020 hid it on screen only, since app_state is one payload every active profile read.
--
-- A sale's money in is the value keys revenue, lineMan and menuTotal, also as the `to.`/`from.`
-- keys an edit stores (store.ts saleMoneyKeys). Costs and waste stay visible.
--
-- * Reads: load_app_state() hands L1_MANAGER the payload with that money stripped from every
--   entry, and app_state_revision() is the cheap poll. The select policy on app_state no longer
--   lets L1_MANAGER read the table directly. Other roles keep their direct read (older clients).
-- * Saves: the manager sends back its stripped copy. save_app_state first puts the money back
--   (restore_sale_money): a stored entry that matches once both are stripped is replaced by the
--   stored one, any other change is left for the append-only check to refuse; money the manager
--   sends in new entries is dropped, and a direct edit or approved request gets its from./to.
--   money from the stored copy (a sale's to.menuTotal is worked out again from its counts, as
--   mutate() does). So a manager save can never erase or change sale money for anyone else.
-- JS port for the local SQLite backend: src/lib/sale-money.ts. Keep the two in step.

create or replace function public.strip_sale_money(p_values jsonb) returns jsonb
language sql immutable set search_path = pg_catalog as $$
  select case when jsonb_typeof(p_values) = 'object' then coalesce((
    select jsonb_object_agg(key, value) from jsonb_each(p_values)
    where regexp_replace(key, '^(to|from)\.', '') <> all (array['revenue', 'lineMan', 'menuTotal'])
  ), '{}'::jsonb) else p_values end
$$;

create or replace function public.strip_sale_money_entries(p_entries jsonb) returns jsonb
language sql immutable set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(
    case when jsonb_typeof(e -> 'values') = 'object'
      then jsonb_set(e, '{values}', public.strip_sale_money(e -> 'values')) else e end
    order by ord), '[]'::jsonb)
  from jsonb_array_elements(p_entries) with ordinality t(e, ord)
$$;

-- `p_target`'s sale money as it stands in `p_log`: its own values with approved edits overlaid,
-- like entries() in store.ts.
create or replace function public.current_sale_money(p_log jsonb, p_target text) returns jsonb
language plpgsql immutable set search_path = pg_catalog as $$
declare target_values jsonb; money jsonb := '{}'; edit_values jsonb; k text;
begin
  select x -> 'values' into target_values from jsonb_array_elements(p_log) x where x ->> 'id' = p_target limit 1;
  if jsonb_typeof(target_values) is distinct from 'object' then return money; end if;
  foreach k in array array['revenue', 'lineMan', 'menuTotal'] loop
    if target_values ? k then money := money || jsonb_build_object(k, target_values -> k); end if;
  end loop;
  for edit_values in
    select x -> 'values' from jsonb_array_elements(p_log) with ordinality t(x, ord)
    where x ->> 'role' = 'owner' and jsonb_typeof(x -> 'values') = 'object'
      and x -> 'values' ->> 'targetId' = p_target
      and (x ->> 'kind' = 'entryEdit' or (x ->> 'kind' = 'editDecision' and x -> 'values' ->> 'decision' = 'อนุมัติ'))
      and not exists (select 1 from jsonb_array_elements(p_log) v
        where v ->> 'kind' = 'void' and v ->> 'role' = 'owner' and v -> 'values' ->> 'targetId' = x ->> 'id')
    order by ord
  loop
    foreach k in array array['revenue', 'lineMan', 'menuTotal'] loop
      if edit_values ? ('to.' || k) then money := money || jsonb_build_object(k, edit_values -> ('to.' || k)); end if;
    end loop;
  end loop;
  return money;
end $$;

-- store.ts n(): Number(value || 0).
create or replace function public.sale_money_number(p_value text) returns double precision
language sql immutable set search_path = pg_catalog as $$
  select coalesce(nullif(trim(p_value), ''), '0')::double precision
$$;

create or replace function public.restore_sale_money(p_old jsonb, p_new jsonb, p_config jsonb) returns jsonb
language plpgsql immutable set search_path = pg_catalog, public as $$
declare merged jsonb := '[]'; old_count integer := jsonb_array_length(p_old);
  e jsonb; ord bigint; stored jsonb; vals jsonb; request_values jsonb; money jsonb; to_value jsonb; k text;
begin
  if jsonb_array_length(p_new) < old_count then return p_new; end if;
  for e, ord in select x, o from jsonb_array_elements(p_new) with ordinality t(x, o) loop
    if ord <= old_count then
      stored := p_old -> (ord::integer - 1);
      merged := merged || jsonb_build_array(case
        when public.strip_sale_money_entries(jsonb_build_array(stored)) = public.strip_sale_money_entries(jsonb_build_array(e))
        then stored else e end);
      continue;
    end if;
    if jsonb_typeof(e -> 'values') is distinct from 'object' then
      merged := merged || jsonb_build_array(e); continue;
    end if;
    vals := public.strip_sale_money(e -> 'values');
    if vals ? 'targetId' and (e ->> 'kind' = 'entryEdit'
      or (e ->> 'kind' = 'editDecision' and vals ->> 'decision' = 'อนุมัติ')) then
      money := public.current_sale_money(merged, vals ->> 'targetId');
      request_values := null;
      if e ->> 'kind' = 'editDecision' then
        select x -> 'values' into request_values from jsonb_array_elements(merged) x
        where x ->> 'id' = vals ->> 'requestId' and x ->> 'kind' = 'editRequest' limit 1;
      end if;
      foreach k in array array['revenue', 'lineMan', 'menuTotal'] loop
        if money ? k then vals := vals || jsonb_build_object('from.' || k, money -> k); end if;
        to_value := coalesce(case when jsonb_typeof(request_values) = 'object' then request_values -> ('to.' || k) end, money -> k);
        if to_value is not null then vals := vals || jsonb_build_object('to.' || k, to_value); end if;
      end loop;
      if vals ->> 'targetKind' = 'sale' then
        if vals ? 'to.lineMan' then vals := vals || jsonb_build_object('to.revenue', vals -> 'to.lineMan'); end if;
        -- float8 prints like JS String(number).
        vals := vals || jsonb_build_object('to.menuTotal', (
          public.sale_money_number(vals ->> 'to.boxes') * public.sale_money_number(p_config ->> 'boxPrice')
          + public.sale_money_number(vals ->> 'to.addons') * public.sale_money_number(p_config ->> 'addonPrice')
          + public.sale_money_number(vals ->> 'to.chiliAddons') * public.sale_money_number(p_config ->> 'chiliPrice')
        )::text);
      end if;
    end if;
    merged := merged || jsonb_build_array(jsonb_set(e, '{values}', vals));
  end loop;
  return merged;
end $$;

revoke all on function public.strip_sale_money(jsonb), public.strip_sale_money_entries(jsonb),
  public.current_sale_money(jsonb, text), public.sale_money_number(text),
  public.restore_sale_money(jsonb, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.load_app_state()
returns table(payload jsonb, revision bigint) language plpgsql stable security definer
set search_path = pg_catalog, public as $$
declare profile_role text;
begin
  select p.role::text into profile_role from public.profiles p where p.id = auth.uid() and p.is_active;
  if not found then raise exception 'Account is not active' using errcode = '42501'; end if;
  return query select case when profile_role = 'L1_MANAGER'
      then jsonb_set(s.payload, '{entries}', public.strip_sale_money_entries(s.payload -> 'entries'))
      else s.payload end, s.revision
    from public.app_state s where s.singleton;
end $$;
revoke all on function public.load_app_state() from public, anon;
grant execute on function public.load_app_state() to authenticated;

create or replace function public.app_state_revision() returns bigint
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare current_revision bigint;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active) then
    raise exception 'Account is not active' using errcode = '42501'; end if;
  select s.revision into current_revision from public.app_state s where s.singleton;
  return current_revision;
end $$;
revoke all on function public.app_state_revision() from public, anon;
grant execute on function public.app_state_revision() to authenticated;

drop policy if exists app_state_read_active on public.app_state;
create policy app_state_read_active on public.app_state for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active
    and p.role::text <> 'L1_MANAGER')
);

-- 20260922000020 plus the restore step for L1_MANAGER.
drop function if exists public.save_app_state(jsonb, bigint);
create function public.save_app_state(p_payload jsonb, p_expected_revision bigint default null)
returns table(revision bigint, updated_at timestamptz) language plpgsql security definer
set search_path = pg_catalog, public as $$
declare current_profile public.profiles%rowtype; state_row public.app_state%rowtype;
  old_entries jsonb; new_entries jsonb; old_lots jsonb; new_lots jsonb;
  old_entry_count integer; new_entry_count integer; expected_entry_role text;
  runs_business boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into current_profile from public.profiles where id = auth.uid() and is_active;
  if not found then raise exception 'Account is not active' using errcode = '42501'; end if;
  runs_business := current_profile.role::text in ('L1_OWNER', 'L1_MANAGER');
  if jsonb_typeof(p_payload) <> 'object' or jsonb_typeof(p_payload -> 'entries') <> 'array'
    or jsonb_typeof(p_payload -> 'lots') <> 'array' or jsonb_typeof(p_payload -> 'config') <> 'object'
  then raise exception 'Invalid application state'; end if;
  select * into state_row from public.app_state where singleton for update;
  if not found then
    if not runs_business then raise exception 'Only an owner can initialize application state' using errcode = '42501'; end if;
    -- A first save has nothing to restore; strip it so the manager cannot seed sale money.
    if current_profile.role::text = 'L1_MANAGER' then
      p_payload := jsonb_set(p_payload, '{entries}', public.strip_sale_money_entries(p_payload -> 'entries')); end if;
    return query insert into public.app_state(singleton, payload, revision, updated_by) values (true, p_payload, 1, auth.uid())
      returning app_state.revision, app_state.updated_at; return;
  end if;
  if p_expected_revision is null or p_expected_revision <> state_row.revision then
    raise exception 'State changed on another device. Reload and try again.' using errcode = '40001'; end if;
  if not runs_business and p_payload -> 'config' is distinct from state_row.payload -> 'config' then
    raise exception 'Only an owner can change configuration' using errcode = '42501'; end if;
  -- The manager's copy has no sale money: put the stored money back before any check.
  if current_profile.role::text = 'L1_MANAGER' then
    p_payload := jsonb_set(p_payload, '{entries}', public.restore_sale_money(
      state_row.payload -> 'entries', p_payload -> 'entries', p_payload -> 'config'));
  end if;
  -- Extract once. Every later reference is to these locals, never back into the payload.
  old_entries := state_row.payload -> 'entries'; new_entries := p_payload -> 'entries';
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
      where n.ord > old_entry_count and not exists (
        select 1 from public.user_locations ul join public.locations l on l.id = ul.location_id
        where ul.profile_id = auth.uid()
          and case when l.name_th like '%มีนบุรี%' then 'มีนบุรี' else 'ศาลาแดง' end = n.entry ->> 'branch'
      )
    ) then raise exception 'Entry branch does not match signed-in account' using errcode = '42501'; end if;
  end if;
  if not runs_business then
    old_lots := state_row.payload -> 'lots'; new_lots := p_payload -> 'lots';
    if jsonb_array_length(new_lots) <> jsonb_array_length(old_lots) then
      raise exception 'Only an owner can add or remove lots' using errcode = '42501'; end if;
    if exists (
      select 1 from jsonb_array_elements(old_lots) with ordinality o(lot, ord)
      join jsonb_array_elements(new_lots) with ordinality n(lot, ord) using (ord)
      where n.lot ->> 'id' is distinct from o.lot ->> 'id' or n.lot ->> 'poId' is distinct from o.lot ->> 'poId'
        or n.lot -> 'config' is distinct from o.lot -> 'config'
        or jsonb_typeof(n.lot -> 'stage') is distinct from 'number'
        or (n.lot ->> 'stage')::numeric not between (o.lot ->> 'stage')::numeric and (o.lot ->> 'stage')::numeric + 1
    ) then raise exception 'Lot changes must follow the workflow' using errcode = '42501'; end if;
  end if;
  return query update public.app_state set payload = p_payload, revision = app_state.revision + 1, updated_at = now(), updated_by = auth.uid()
    where singleton returning app_state.revision, app_state.updated_at;
end; $$;
revoke all on function public.save_app_state(jsonb, bigint) from public, anon;
grant execute on function public.save_app_state(jsonb, bigint) to authenticated;

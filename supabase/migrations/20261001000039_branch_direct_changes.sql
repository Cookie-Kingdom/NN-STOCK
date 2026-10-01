-- Edit, delete and undo without approval 01-10-2026 (EDT-22, EDT-23): a branch changes its own
-- entries directly, and every change is an appended entry the Owner reads back.
--
-- * entry_voided (0036): a delete counts when its author may change the entry (canChange in
--   store/model.ts: the Owner any entry, a branch its own branch's), and only while it is not
--   deleted itself: deleting a delete puts the entry back. mutate() never lets a chain go deeper
--   than void -> void -> entry (an undo is not undone, voidBlock in store/visibility.ts), so two
--   levels are read here; entryIndex() in store/derived.ts walks any depth.
-- * append_entries (0037): `editRequest` is retired (retiredKinds) and `entryEdit` takes its
--   place. A branch edits and deletes only live entries of its own branch, of the kinds mutate()
--   edits (editableKinds) and deletes (voidableKinds). Its edit moves no entry to another lot (a
--   branch entry changes lot with `link`) and to no day after today. Deleting its own delete
--   restores the entry, and that undo is not undone. Before, a branch `void` was only the
--   withdrawal of its pending edit request; the one-request-per-entry check goes with it.
--   The stock checks and "latest edit first" stay in mutate(), like every other domain rule.
--   Everything else is 0037's.
-- * scope_app_state (0035): the void of a followed entry is sent for another branch's
--   central-stock entry too, cut to centralKeys like that entry. Before, only for an own entry
--   (a withdrawn edit request), so a receive the other branch deleted and restored, or edited
--   and un-edited, stayed deleted or edited in this branch's copy and centralStock() read
--   differently from the Owner's.
-- * current_sale_money (0021), the money restore_sale_money puts into an Account Manager's edit:
--   an edit counts by isEditOverlay in store/model.ts (the Owner's, a branch's on an entry of its
--   own branch, an old request the Owner approved) while entry_voided does not name it. Before,
--   only role owner edits and role owner voids counted, so after a branch corrected its sale's
--   LINE MAN amount the manager's next edit of that sale put the old amount back.
-- * restore_sale_money (0021): a sale edit's to.menuTotal is boxes x boxPrice + chiliAddons x
--   chiliPrice, as mutate() and the JS port work it out since the sealed-meat Add-on stopped
--   being sold (0038). Before, it still added to.addons x addonPrice, so an edit carrying an old
--   Add-on count got a different total here than on the local backend. Nothing else changes.
-- * MAT-02, a material transfer is confirmed once, also holds for an edit: append_entries
--   refuses a branch `entryEdit` whose to.transferId names a transfer another live confirm
--   holds, as it refuses that link. transfer_confirmed (0036) reads a confirm's transfer as
--   entryIndex() in store/derived.ts does: the latest live edit or link naming it, in log order,
--   else its own. Before, it read links only, so a confirm edited onto a free transfer left that
--   transfer open to a second confirm.
-- * save_app_state, load_app_state and app_state_scope_rules are unchanged.
--
-- JS ports: appendState in src/lib/local-db.server.ts, scopeDatabase in src/lib/role-scope.ts,
-- isVoided in src/lib/store/derived.ts, currentMoney and restoreSaleMoney in
-- src/lib/sale-money.ts.
-- Errors are raise exception or PTxxx only, never 40001 / 40P01.

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
revoke all on function public.entry_voided(jsonb, jsonb) from public, anon, authenticated;

-- Whether a live materialConfirm other than p_except confirms p_transfer: the transferId the
-- latest live change naming it gives it (an edit's to.transferId, isEditOverlay; a link's
-- transferId, canLink), else its own, as entries() in store/derived.ts reads it.
-- ponytail: quadratic in the log per call, fine at this app's size; index by id if saves slow.
create or replace function public.transfer_confirmed(p_log jsonb, p_transfer text, p_except text)
returns boolean language sql immutable set search_path = pg_catalog, public as $$
  with log as (select e, ord from jsonb_array_elements(p_log) with ordinality t(e, ord))
  select exists (select 1 from log c
    where c.e ->> 'kind' = 'materialConfirm' and c.e ->> 'id' is distinct from p_except
      and not public.entry_voided(p_log, c.e)
      and coalesce((select case when l.e ->> 'kind' = 'link' then l.e -> 'values' ->> 'transferId'
          else coalesce(l.e -> 'values' ->> 'to.transferId', '') end
        from log l
        where l.e -> 'values' ->> 'targetId' = c.e ->> 'id'
          and ((l.e ->> 'kind' = 'link' and coalesce(l.e -> 'values' ->> 'transferId', '') <> ''
              and (l.e ->> 'role' = 'owner' or (l.e ->> 'role' = 'branch' and c.e ->> 'role' = 'branch'
                and c.e ->> 'branch' = l.e ->> 'branch')))
            or (l.e ->> 'kind' = 'entryEdit' and l.e -> 'values' ? 'to.transferId'
              and (l.e ->> 'role' = 'owner' or (l.e ->> 'role' = 'branch' and c.e ->> 'role' = 'branch'
                and c.e ->> 'branch' = l.e ->> 'branch')))
            or (l.e ->> 'kind' = 'editDecision' and l.e -> 'values' ? 'to.transferId'
              and l.e ->> 'role' = 'owner' and l.e -> 'values' ->> 'decision' = 'อนุมัติ'))
          and not public.entry_voided(p_log, l.e)
        order by l.ord desc limit 1), c.e -> 'values' ->> 'transferId') = p_transfer)
$$;
revoke all on function public.transfer_confirmed(jsonb, text, text) from public, anon, authenticated;

-- `p_target`'s sale money as it stands in `p_log`: its own values with the live edits overlaid,
-- like entries() in store.ts.
create or replace function public.current_sale_money(p_log jsonb, p_target text) returns jsonb
language plpgsql immutable set search_path = pg_catalog as $$
declare target jsonb; target_values jsonb; money jsonb := '{}'; edit_values jsonb; k text;
begin
  select x into target from jsonb_array_elements(p_log) x where x ->> 'id' = p_target limit 1;
  target_values := target -> 'values';
  if jsonb_typeof(target_values) is distinct from 'object' then return money; end if;
  foreach k in array array['revenue', 'lineMan', 'menuTotal'] loop
    if target_values ? k then money := money || jsonb_build_object(k, target_values -> k); end if;
  end loop;
  for edit_values in
    select x -> 'values' from jsonb_array_elements(p_log) with ordinality t(x, ord)
    where jsonb_typeof(x -> 'values') = 'object' and x -> 'values' ->> 'targetId' = p_target
      -- isEditOverlay in store/model.ts.
      and ((x ->> 'kind' = 'entryEdit' and (x ->> 'role' = 'owner' or (x ->> 'role' = 'branch'
          and target ->> 'role' = 'branch' and target ->> 'branch' = x ->> 'branch')))
        or (x ->> 'kind' = 'editDecision' and x ->> 'role' = 'owner' and x -> 'values' ->> 'decision' = 'อนุมัติ'))
      and not public.entry_voided(p_log, x)
    order by ord
  loop
    foreach k in array array['revenue', 'lineMan', 'menuTotal'] loop
      if edit_values ? ('to.' || k) then money := money || jsonb_build_object(k, edit_values -> ('to.' || k)); end if;
    end loop;
  end loop;
  return money;
end $$;
revoke all on function public.current_sale_money(jsonb, text) from public, anon, authenticated;

-- 0021's, less the Add-on term of to.menuTotal.
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
          + public.sale_money_number(vals ->> 'to.chiliAddons') * public.sale_money_number(p_config ->> 'chiliPrice')
        )::text);
      end if;
    end if;
    merged := merged || jsonb_build_array(jsonb_set(e, '{values}', vals));
  end loop;
  return merged;
end $$;
revoke all on function public.restore_sale_money(jsonb, jsonb, jsonb) from public, anon, authenticated;

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
    -- 0039: a void of a followed entry, own or not: an undone edit or link, a restored delete.
    -- No chain is longer (see entry_voided).
    select l.e, l.ord, f.own from log l
    join follow f on f.e ->> 'id' = l.e -> 'values' ->> 'targetId'
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

create or replace function public.append_entries(p_expected_revision bigint, p_entries jsonb, p_lots jsonb default '[]'::jsonb)
returns bigint language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  current_profile public.profiles%rowtype; state_row public.app_state%rowtype;
  current_revision bigint;
  old_entries jsonb; old_lots jsonb; added jsonb := '[]'::jsonb; e jsonb; target jsonb;
  today constant text := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD');
  cost_keys constant text[] := array['meatCost', 'wasteCost'];
  -- store/model.ts (tests/unit/appendEntries.test.ts reads the two lists): kinds no edit names,
  -- and kinds no delete names.
  not_editable constant text[] := array['chefEdit', 'materials', 'config', 'void', 'entryEdit', 'editRequest', 'editDecision', 'link', 'steakTransfer'];
  not_voidable constant text[] := array['config', 'editRequest', 'editDecision'];
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
  -- 0036: no supplyPurchase, supplyIssue, chiliPurchase or chiliIssue; 0039: no editRequest
  -- (retiredKinds), entryEdit instead.
  if exists (select 1 from jsonb_array_elements(p_entries) n
    where not coalesce(n ->> 'kind' = any (array['receive', 'thaw', 'ricePurchase', 'riceIssue', 'rice',
      'riceCarry', 'sale', 'influencerBox', 'materials', 'materialConfirm', 'closeDay', 'entryEdit', 'link',
      'void']), false)
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
    target := null;
    select x into target from jsonb_array_elements(old_entries || added) x
      where x ->> 'id' = e -> 'values' ->> 'targetId' limit 1;
    -- canLink in store/model.ts.
    if e ->> 'kind' = 'link'
      and not coalesce(target ->> 'role' = 'branch' and target ->> 'branch' = e ->> 'branch', false) then
      raise exception 'Link target is not an entry of this branch' using errcode = '42501'; end if;
    -- 0039, editBlock in store/visibility.ts: a branch edits a live entry of its own branch.
    if e ->> 'kind' = 'entryEdit' then
      if not coalesce(target ->> 'role' = 'branch' and target ->> 'branch' = e ->> 'branch'
          and not target ->> 'kind' = any (not_editable), false) then
        raise exception 'Edit target is not an entry of this branch' using errcode = '42501'; end if;
      if public.entry_voided(old_entries || added, target) then
        raise exception 'Entry is already deleted' using errcode = '42501'; end if;
      -- EDT-24: a branch entry changes lot with `link`, and no edit dates one after today.
      if coalesce(e -> 'values' ->> 'toLotId', '') <> '' then
        raise exception 'Edit cannot move an entry to another lot' using errcode = '42501'; end if;
      if coalesce(e -> 'values' ->> 'toDate', '') <> '' and not coalesce(
          e -> 'values' ->> 'toDate' ~ '^\d{4}-\d{2}-\d{2}$' and e -> 'values' ->> 'toDate' <= today, false) then
        raise exception 'Entry date is invalid or after today' using errcode = '42501'; end if;
    end if;
    -- 0039, voidBlock in store/visibility.ts: a branch deletes a live entry of its own branch. Of
    -- an edit or a link that undoes it, of a delete it puts the entry back, and that is as far as
    -- it goes: a delete naming a void, an edit or a link is not deleted in turn.
    if e ->> 'kind' = 'void' then
      if not coalesce(target ->> 'role' = 'branch' and target ->> 'branch' = e ->> 'branch'
          and not target ->> 'kind' = any (not_voidable), false) then
        raise exception 'Void target is not an entry of this branch' using errcode = '42501'; end if;
      if public.entry_voided(old_entries || added, target) then
        raise exception 'Entry is already deleted' using errcode = '42501'; end if;
      if target ->> 'kind' = 'void' and not coalesce((
          select x ->> 'kind' not in ('void', 'entryEdit', 'link') from jsonb_array_elements(old_entries || added) x
          where x ->> 'id' = target -> 'values' ->> 'targetId' limit 1), false) then
        raise exception 'An undo cannot be undone' using errcode = '42501'; end if;
    end if;
    -- 0036, MAT-02: a material transfer is confirmed once (materialConfirm and link in mutate.ts).
    -- 0039: an edit that puts a confirm on a transfer (to.transferId) is checked like that link.
    if (e ->> 'kind' in ('materialConfirm', 'link') and coalesce(e -> 'values' ->> 'transferId', '') <> ''
        and public.transfer_confirmed(old_entries || added, e -> 'values' ->> 'transferId', e -> 'values' ->> 'targetId'))
      or (e ->> 'kind' = 'entryEdit' and coalesce(e -> 'values' ->> 'to.transferId', '') <> ''
        and public.transfer_confirmed(old_entries || added, e -> 'values' ->> 'to.transferId', e -> 'values' ->> 'targetId')) then
      raise exception 'Material transfer is already confirmed' using errcode = '42501'; end if;
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

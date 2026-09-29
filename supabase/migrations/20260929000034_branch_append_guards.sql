-- Branch append guards (security review 29-09-2026). A branch account could call append_entries
-- directly and get past rules that only the browser's mutate() checked:
--
-- * Lots: a branch never changes a lot (no branch kind opens a batch or writes the lot cache), yet
--   append_entries merged p_lots values into any stored lot, e.g. outboundCost / returnCost /
--   centralKg that lotCost() reads for the Owner. Now any p_lots from a branch is refused.
-- * save_app_state refuses a branch account outright: since 0028 the app sends every branch save
--   to append_entries (setSaveAppendOnly in persistence.ts), so its branch arms are gone.
-- * link: its target must be an entry of the link's own branch with role "branch" (canLink in
--   store/model.ts; entries() in store/derived.ts ignores any other link).
-- * Dates: an entry dated after today (Asia/Bangkok) is refused, and so is one landing on a
--   closed branch day (isClosed in store/derived.ts: the latest live closeDay of that branch and
--   date comes after its latest live unlock), except an editRequest (mutate lets a closed day
--   take one).
--
-- JS port: saveState / appendState in src/lib/local-db.server.ts. Errors are raise exception or
-- PTxxx only, never 40001 / 40P01.

-- isClosed in store/derived.ts: log order; a void counts only when the Owner wrote it.
create or replace function public.branch_day_closed(p_entries jsonb, p_branch text, p_date text)
returns boolean language sql immutable set search_path = pg_catalog as $$
  with log as (
    select e, ord from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) with ordinality t(e, ord)
  ), live as (
    select l.e, l.ord from log l
    where l.e ->> 'kind' in ('closeDay', 'unlock') and l.e ->> 'branch' = p_branch and l.e ->> 'date' = p_date
      and not exists (select 1 from log v where v.e ->> 'kind' = 'void' and v.e ->> 'role' = 'owner'
        and v.e -> 'values' ->> 'targetId' = l.e ->> 'id')
  )
  select coalesce(max(ord) filter (where e ->> 'kind' = 'closeDay'), 0)
    > coalesce(max(ord) filter (where e ->> 'kind' = 'unlock'), 0) from live
$$;
revoke all on function public.branch_day_closed(jsonb, text, text) from public, anon, authenticated;

-- 0032's save_app_state for the Owner and the Account Manager only.
create or replace function public.save_app_state(p_payload jsonb, p_expected_revision bigint default null)
returns table(revision bigint, updated_at timestamptz) language plpgsql security definer
set search_path = pg_catalog, public as $$
declare current_profile public.profiles%rowtype; state_row public.app_state%rowtype;
  old_entries jsonb; new_entries jsonb;
  old_entry_count integer; new_entry_count integer;
  current_revision bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if pg_column_size(p_payload) > 2097152 then
    raise sqlstate 'PT413' using message = 'Payload too large'; end if;
  select * into current_profile from public.profiles where id = auth.uid() and is_active
    and role::text in ('L1_OWNER', 'L1_MANAGER', 'L2_BRANCH_ADMIN');
  if not found then raise exception 'Account is not active' using errcode = '42501'; end if;
  if current_profile.role::text = 'L2_BRANCH_ADMIN' then
    raise exception 'Branch accounts save through append_entries' using errcode = '42501'; end if;
  if jsonb_typeof(p_payload) <> 'object' or jsonb_typeof(p_payload -> 'entries') <> 'array'
    or jsonb_typeof(p_payload -> 'lots') <> 'array' or jsonb_typeof(p_payload -> 'config') <> 'object'
  then raise exception 'Invalid application state'; end if;
  select s.revision into current_revision from public.app_state s where s.singleton;
  if found and (p_expected_revision is null or p_expected_revision <> current_revision) then
    raise sqlstate 'PT409' using message = 'State changed on another device. Reload and try again.'; end if;
  select * into state_row from public.app_state where singleton for update;
  if not found then
    if current_profile.role::text = 'L1_MANAGER' then
      p_payload := jsonb_set(p_payload, '{entries}', public.strip_sale_money_entries(p_payload -> 'entries')); end if;
    return query insert into public.app_state(singleton, payload, revision, updated_by) values (true, p_payload, 1, auth.uid())
      returning app_state.revision, app_state.updated_at; return;
  end if;
  if p_expected_revision is null or p_expected_revision <> state_row.revision then
    raise sqlstate 'PT409' using message = 'State changed on another device. Reload and try again.'; end if;
  if current_profile.role::text = 'L1_MANAGER' then
    p_payload := jsonb_set(p_payload, '{entries}', public.restore_sale_money(
      state_row.payload -> 'entries', p_payload -> 'entries', p_payload -> 'config'));
  end if;
  old_entries := state_row.payload -> 'entries'; new_entries := p_payload -> 'entries';
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
      else n.entry ->> 'actor' is null
        or (n.entry ->> 'actor' = 'owner' and n.entry ->> 'role' in ('foodiva', 'cm')) end, false)
  ) then raise exception 'Entry actor does not match signed-in account' using errcode = '42501'; end if;
  if current_profile.role::text = 'L1_MANAGER' and exists (
    select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
    where n.ord > old_entry_count and not coalesce(n.entry ->> 'role' in ('owner', 'foodiva', 'cm'), false)
  ) then raise exception 'Entry role does not match signed-in account' using errcode = '42501'; end if;
  return query update public.app_state set payload = p_payload, revision = app_state.revision + 1, updated_at = now(), updated_by = auth.uid()
    where singleton returning app_state.revision, app_state.updated_at;
end; $$;
revoke all on function public.save_app_state(jsonb, bigint) from public, anon;
grant execute on function public.save_app_state(jsonb, bigint) to authenticated;

-- 0032's append_entries with the guards above. p_lots stays in the signature and must be empty.
create or replace function public.append_entries(p_expected_revision bigint, p_entries jsonb, p_lots jsonb default '[]'::jsonb)
returns bigint language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  current_profile public.profiles%rowtype; state_row public.app_state%rowtype;
  current_revision bigint;
  old_entries jsonb; old_lots jsonb; added jsonb := '[]'::jsonb; e jsonb; target jsonb;
  today constant text := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD');
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
    if e ->> 'kind' <> 'editRequest'
      and public.branch_day_closed(old_entries || added, e ->> 'branch', e ->> 'date') then
      raise exception 'Branch day is closed' using errcode = '42501'; end if;
    if e ->> 'kind' = 'link' then
      select x into target from jsonb_array_elements(old_entries || added) x
        where x ->> 'id' = e -> 'values' ->> 'targetId' limit 1;
      -- canLink in store/model.ts.
      if not coalesce(target ->> 'role' = 'branch' and target ->> 'branch' = e ->> 'branch', false) then
        raise exception 'Link target is not an entry of this branch' using errcode = '42501'; end if;
    end if;
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

-- Nothing calls it now: neither function lets a non-owner open a batch.
drop function if exists public.is_new_batch(jsonb);

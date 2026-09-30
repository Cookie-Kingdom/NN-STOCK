-- Audit leftovers 29-09-2026.
--
-- * append_entries (0035) refuses the retired branch kinds supplyPurchase, supplyIssue,
--   chiliPurchase and chiliIssue: mutate() records no new ones (retiredKinds in store/model.ts).
--   Old ones still count in stock and a branch still reads them (app_state_scope_rules keeps
--   them).
-- * The duplicates mutate() refuses from a branch: an edit request on an entry that already has
--   one waiting for a decision (openEditRequest), and a materialConfirm, or a link, naming a
--   material transfer another live materialConfirm already confirms (MAT-02). Everything else
--   in append_entries is 0035's.
-- * account_branches: a branch profile linked to several locations gets one branch, the one on
--   the lowest location_id, which is the one the app opens (session.ts). Before, the server
--   scoped reads to, and took writes for, all of them.
--
-- JS port: appendState in src/lib/local-db.server.ts (a local account has one branch already).
-- Errors are raise exception or PTxxx only, never 40001 / 40P01.

create or replace function public.account_branches(p_profile uuid) returns text[]
language sql stable set search_path = pg_catalog, public as $$
  select coalesce((
    select array[case when l.name_th like '%มีนบุรี%' then 'มีนบุรี' else 'ศาลาแดง' end]
    from public.user_locations ul join public.locations l on l.id = ul.location_id
    where ul.profile_id = p_profile
    order by ul.location_id limit 1), '{}'::text[])
$$;
revoke all on function public.account_branches(uuid) from public, anon, authenticated;

-- A void that counts (entryIndex in store/derived.ts): the Owner's, or a branch withdrawing its
-- own edit request.
create or replace function public.entry_voided(p_log jsonb, p_entry jsonb) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select exists (select 1 from jsonb_array_elements(p_log) v
    where v ->> 'kind' = 'void' and v -> 'values' ->> 'targetId' = p_entry ->> 'id'
      and (v ->> 'role' = 'owner' or (v ->> 'role' = 'branch' and p_entry ->> 'kind' = 'editRequest'
        and p_entry ->> 'role' = 'branch' and p_entry ->> 'branch' = v ->> 'branch')))
$$;
revoke all on function public.entry_voided(jsonb, jsonb) from public, anon, authenticated;

-- Whether a live materialConfirm other than p_except confirms p_transfer: its own transferId, or
-- the one its latest live link (canLink) gives it, as entries() in store/derived.ts reads it.
-- ponytail: quadratic in the log per call, fine at this app's size; index by id if saves slow.
create or replace function public.transfer_confirmed(p_log jsonb, p_transfer text, p_except text)
returns boolean language sql immutable set search_path = pg_catalog, public as $$
  with log as (select e, ord from jsonb_array_elements(p_log) with ordinality t(e, ord))
  select exists (select 1 from log c
    where c.e ->> 'kind' = 'materialConfirm' and c.e ->> 'id' is distinct from p_except
      and not public.entry_voided(p_log, c.e)
      and coalesce((select l.e -> 'values' ->> 'transferId' from log l
        where l.e ->> 'kind' = 'link' and l.e -> 'values' ->> 'targetId' = c.e ->> 'id'
          and coalesce(l.e -> 'values' ->> 'transferId', '') <> ''
          and (l.e ->> 'role' = 'owner' or (c.e ->> 'role' = 'branch' and c.e ->> 'branch' = l.e ->> 'branch'))
          and not public.entry_voided(p_log, l.e)
        order by l.ord desc limit 1), c.e -> 'values' ->> 'transferId') = p_transfer)
$$;
revoke all on function public.transfer_confirmed(jsonb, text, text) from public, anon, authenticated;

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
  -- 0036: no supplyPurchase, supplyIssue, chiliPurchase or chiliIssue (retiredKinds).
  if exists (select 1 from jsonb_array_elements(p_entries) n
    where not coalesce(n ->> 'kind' = any (array['receive', 'thaw', 'ricePurchase', 'riceIssue', 'rice',
      'riceCarry', 'sale', 'influencerBox', 'materials', 'materialConfirm', 'closeDay', 'editRequest', 'link',
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
    if e ->> 'kind' not in ('editRequest', 'void', 'link')
      and public.branch_day_closed(old_entries || added, e ->> 'branch', e ->> 'date') then
      raise exception 'Branch day is closed' using errcode = '42501'; end if;
    target := null;
    select x into target from jsonb_array_elements(old_entries || added) x
      where x ->> 'id' = e -> 'values' ->> 'targetId' limit 1;
    -- canLink in store/model.ts.
    if e ->> 'kind' = 'link'
      and not coalesce(target ->> 'role' = 'branch' and target ->> 'branch' = e ->> 'branch', false) then
      raise exception 'Link target is not an entry of this branch' using errcode = '42501'; end if;
    -- mutate.ts: a branch voids only its own edit request still waiting for a decision.
    if e ->> 'kind' = 'void' and not coalesce(target ->> 'kind' = 'editRequest' and target ->> 'role' = 'branch'
        and target ->> 'branch' = e ->> 'branch'
        and not exists (select 1 from jsonb_array_elements(old_entries || added) x
          where (x ->> 'kind' = 'editDecision' and x -> 'values' ->> 'requestId' = target ->> 'id')
            or (x ->> 'kind' = 'void' and x -> 'values' ->> 'targetId' = target ->> 'id')), false) then
      raise exception 'Void target is not a pending edit request of this branch' using errcode = '42501'; end if;
    -- 0036, openEditRequest in store/visibility.ts: one request at a time per entry.
    if e ->> 'kind' = 'editRequest' and exists (select 1 from jsonb_array_elements(old_entries || added) x
        where x ->> 'kind' = 'editRequest' and x -> 'values' ->> 'targetId' = e -> 'values' ->> 'targetId'
          and not public.entry_voided(old_entries || added, x)
          and not exists (select 1 from jsonb_array_elements(old_entries || added) d
            where d ->> 'kind' = 'editDecision' and d -> 'values' ->> 'requestId' = x ->> 'id'
              and not public.entry_voided(old_entries || added, d))) then
      raise exception 'Entry already has a pending edit request' using errcode = '42501'; end if;
    -- 0036, MAT-02: a material transfer is confirmed once (materialConfirm and link in mutate.ts).
    if e ->> 'kind' in ('materialConfirm', 'link') and coalesce(e -> 'values' ->> 'transferId', '') <> ''
      and public.transfer_confirmed(old_entries || added, e -> 'values' ->> 'transferId', e -> 'values' ->> 'targetId') then
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

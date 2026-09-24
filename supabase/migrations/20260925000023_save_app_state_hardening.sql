-- Security review 24-09-2026 (Report/review-24-09-2026): DB-01, DB-02, DB-04, DB-05, DB-06, DB-07,
-- DB-08 / APP-02, APP-03, APP-05. save_app_state stops trusting the client payload where mutate()
-- is the only thing standing between a signed-in account and the log, and the drift that let
-- anon reach a SECURITY DEFINER function is closed.

-- DB-07: a hand-made backup of the prod payload, outside the migration chain, with full grants to
-- anon/authenticated. Backups do not belong in public.
drop table if exists public.app_state_backup_20260923;

-- DB-06: document-module helper that takes the actor from the caller and writes stock_ledger past
-- RLS. The app never calls it; nobody but the owner of the schema should.
revoke execute on function public.confirm_stock_transfer_line(uuid, public.item_type, numeric, uuid, uuid, uuid, text)
  from public, anon, authenticated;

-- Sweep: no SECURITY DEFINER function in public is meant for anon. Catches prod-only drift too.
-- Guarded per function: one the migration role does not own must not stop the chain.
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
  loop
    begin execute format('revoke execute on function %s from public, anon', f);
    exception when insufficient_privilege then raise notice 'could not revoke execute on %', f; end;
  end loop;
end $$;

-- DB-08: Supabase's default ACL hands anon/authenticated everything on each new object in public,
-- which is how the two above leaked. New objects now start closed; grant each one explicitly.
-- (Function EXECUTE to PUBLIC is a global default a per-schema revoke cannot remove: keep writing
-- `revoke all on function ... from public, anon` after every create function.)
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

-- Body is 20260924000022's save_app_state plus:
--   DB-01/APP-05  a 2 MB payload cap and an unlocked revision read before `for update`, so a
--                 stale or oversized save is refused without taking the row lock or detoasting
--                 the stored payload. The locked re-check stays (a save can land in between).
--   DB-02/APP-02  a non-owner keeps version 8 and every top-level key but entries/lots as stored
--                 (version 9 made every client fall back to the seed).
--   DB-04/APP-03  a non-owner's new entries: kind the role may create (ownership in store.ts, plus
--                 editRequest), unique non-empty id, lotId naming a real lot, and for cm/foodiva the
--                 branch mutate() gives them (config.branch, as normalize() reads it).
--   DB-05/APP-02  a non-owner changes a lot only through stage and values, and only on a lot whose
--                 current stage its role owns (stageRole in store.ts).
-- Owner and manager (runs_business) are unchanged. Conflict stays PT409, never 40001/40P01:
-- PostgREST retries those forever. Same signature, so grants survive (re-stated below anyway).
create or replace function public.save_app_state(p_payload jsonb, p_expected_revision bigint default null)
returns table(revision bigint, updated_at timestamptz) language plpgsql security definer
set search_path = pg_catalog, public as $$
declare current_profile public.profiles%rowtype; state_row public.app_state%rowtype;
  old_entries jsonb; new_entries jsonb; old_lots jsonb; new_lots jsonb;
  old_entry_count integer; new_entry_count integer; expected_entry_role text;
  runs_business boolean; current_revision bigint; allowed_kinds text[]; config_branch text;
  -- stageRole in store.ts: who performs the step that leaves each stage (index = stage + 1).
  stage_role constant text[] := array['owner', 'foodiva', 'cm', 'cm', 'cm', 'cm', 'owner', 'owner', 'owner'];
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  -- ~10x today's prod payload. PT413 maps to HTTP 413 and is not retried.
  if pg_column_size(p_payload) > 2097152 then
    raise sqlstate 'PT413' using message = 'Payload too large'; end if;
  select * into current_profile from public.profiles where id = auth.uid() and is_active;
  if not found then raise exception 'Account is not active' using errcode = '42501'; end if;
  runs_business := current_profile.role::text in ('L1_OWNER', 'L1_MANAGER');
  if jsonb_typeof(p_payload) <> 'object' or jsonb_typeof(p_payload -> 'entries') <> 'array'
    or jsonb_typeof(p_payload -> 'lots') <> 'array' or jsonb_typeof(p_payload -> 'config') <> 'object'
  then raise exception 'Invalid application state'; end if;
  -- Cheap stale check: reads only the revision column, takes no lock, leaves the payload in TOAST.
  select s.revision into current_revision from public.app_state s where s.singleton;
  if found and (p_expected_revision is null or p_expected_revision <> current_revision) then
    raise sqlstate 'PT409' using message = 'State changed on another device. Reload and try again.'; end if;
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
    raise sqlstate 'PT409' using message = 'State changed on another device. Reload and try again.'; end if;
  if not runs_business and p_payload -> 'config' is distinct from state_row.payload -> 'config' then
    raise exception 'Only an owner can change configuration' using errcode = '42501'; end if;
  if not runs_business and (p_payload -> 'version' is distinct from '8'::jsonb
    or (p_payload - 'entries' - 'lots') is distinct from (state_row.payload - 'entries' - 'lots'))
  then raise exception 'Only an owner can change application state' using errcode = '42501'; end if;
  -- The manager's copy has no sale money: put the stored money back before any check.
  if current_profile.role::text = 'L1_MANAGER' then
    p_payload := jsonb_set(p_payload, '{entries}', public.restore_sale_money(
      state_row.payload -> 'entries', p_payload -> 'entries', p_payload -> 'config'));
  end if;
  -- Extract once. Every later reference is to these locals, never back into the payload.
  old_entries := state_row.payload -> 'entries'; new_entries := p_payload -> 'entries';
  old_lots := state_row.payload -> 'lots'; new_lots := p_payload -> 'lots';
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
    if not runs_business then
      -- `ownership` in store.ts, plus editRequest (every non-approver files one). Keep in step.
      allowed_kinds := case expected_entry_role
        when 'branch' then array['receive', 'thaw', 'supplyPurchase', 'supplyIssue', 'ricePurchase', 'chiliPurchase',
          'riceIssue', 'chiliIssue', 'rice', 'riceCarry', 'sale', 'influencerBox', 'materials', 'materialConfirm',
          'closeDay', 'editRequest']
        when 'cm' then array['smokingInvoice', 'smokeOrderAccept', 'cmReceive', 'prepare', 'smoke', 'closeLot',
          'chefEdit', 'editRequest']
        when 'foodiva' then array['foodivaConfirm', 'packingList', 'foodivaReturnReceive', 'dispatch', 'editRequest'] end;
      if exists (
        select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
        where n.ord > old_entry_count and not coalesce(n.entry ->> 'kind' = any(allowed_kinds), false)
      ) then raise exception 'Entry kind is not allowed for this account' using errcode = '42501'; end if;
      -- Only new ids are compared, so an old duplicate cannot lock anyone out.
      if exists (
        select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
        where n.ord > old_entry_count and (coalesce(n.entry ->> 'id', '') = ''
          or (select count(*) from jsonb_array_elements(new_entries) e where e ->> 'id' = n.entry ->> 'id') > 1)
      ) then raise exception 'Entry id must be unique' using errcode = '42501'; end if;
      -- mutate() writes '' for an entry with no lot.
      if exists (
        select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
        where n.ord > old_entry_count and coalesce(n.entry ->> 'lotId', '') not in ('', '-')
          and not exists (select 1 from jsonb_array_elements(new_lots) l where l ->> 'id' = n.entry ->> 'lotId')
      ) then raise exception 'Entry lot does not exist' using errcode = '42501'; end if;
      -- cm/foodiva entries carry config.branch (mutate), read the way normalize() reads it.
      config_branch := case when state_row.payload -> 'config' ->> 'branch' in ('ศาลาแดง', 'มีนบุรี')
        then state_row.payload -> 'config' ->> 'branch' else 'ศาลาแดง' end;
      if expected_entry_role in ('cm', 'foodiva') and exists (
        select 1 from jsonb_array_elements(new_entries) with ordinality n(entry, ord)
        where n.ord > old_entry_count and n.entry ->> 'branch' is not null and n.entry ->> 'branch' <> config_branch
      ) then raise exception 'Entry branch does not match signed-in account' using errcode = '42501'; end if;
    end if;
  end if;
  if not runs_business then
    if jsonb_array_length(new_lots) <> jsonb_array_length(old_lots) then
      raise exception 'Only an owner can add or remove lots' using errcode = '42501'; end if;
    -- Everything but stage and values stays; stage moves 0 or +1; either changes only on a lot
    -- whose current stage this role owns (dispatch, cmReceive, prepare, smoke, closeLot, chefEdit).
    if exists (
      select 1 from jsonb_array_elements(old_lots) with ordinality o(lot, ord)
      join jsonb_array_elements(new_lots) with ordinality n(lot, ord) using (ord)
      where (n.lot - 'stage' - 'values') is distinct from (o.lot - 'stage' - 'values')
        or jsonb_typeof(n.lot -> 'stage') is distinct from 'number'
        or (n.lot ->> 'stage')::numeric not between (o.lot ->> 'stage')::numeric and (o.lot ->> 'stage')::numeric + 1
        or ((n.lot -> 'stage' is distinct from o.lot -> 'stage' or n.lot -> 'values' is distinct from o.lot -> 'values')
          and stage_role[(o.lot ->> 'stage')::int + 1] is distinct from expected_entry_role)
    ) then raise exception 'Lot changes must follow the workflow' using errcode = '42501'; end if;
  end if;
  return query update public.app_state set payload = p_payload, revision = app_state.revision + 1, updated_at = now(), updated_by = auth.uid()
    where singleton returning app_state.revision, app_state.updated_at;
end; $$;
revoke all on function public.save_app_state(jsonb, bigint) from public, anon;
grant execute on function public.save_app_state(jsonb, bigint) to authenticated;

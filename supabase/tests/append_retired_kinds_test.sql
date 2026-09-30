-- Migration 20260929000036: append_entries refuses the retired branch kinds, and a branch profile
-- linked to several locations has one branch, the one on the lowest location_id.
-- Run:  psql "$DATABASE_URL" -f supabase/tests/append_retired_kinds_test.sql

do $$
declare
  v_owner  uuid := gen_random_uuid();
  v_branch uuid := gen_random_uuid();
  v_low    uuid;
  v_high   uuid;
  v_rev    bigint;
  v_err    text;
  v_kind   text;
  v_mine   text;
  v_other  text;
begin
  create or replace function auth.uid() returns uuid language sql stable
    as $f$ select nullif(current_setting('test.uid', true), '')::uuid $f$;
  insert into auth.users (id, email) values (v_owner, 'owner@example.invalid'), (v_branch, 'two@example.invalid');
  insert into profiles (id, display_name, role, is_active) values
    (v_owner, 'owner', 'L1_OWNER', true), (v_branch, 'two', 'L2_BRANCH_ADMIN', true)
    on conflict (id) do update set role = excluded.role, is_active = true;
  insert into locations (code, name_th, kind) values ('RK-MB', 'สาขามีนบุรี', 'BRANCH'), ('RK-SD', 'สาขาศาลาแดง', 'BRANCH');
  select id into v_low from locations where code in ('RK-MB', 'RK-SD') order by id limit 1;
  select id into v_high from locations where code in ('RK-MB', 'RK-SD') order by id desc limit 1;
  insert into user_locations (profile_id, location_id) values (v_branch, v_low), (v_branch, v_high);
  select case when name_th like '%มีนบุรี%' then 'มีนบุรี' else 'ศาลาแดง' end into v_mine from locations where id = v_low;
  v_other := case when v_mine = 'มีนบุรี' then 'ศาลาแดง' else 'มีนบุรี' end;

  assert public.account_branches(v_branch) = array[v_mine],
    format('one branch, lowest location_id: %s', public.account_branches(v_branch));

  perform set_config('test.uid', v_owner::text, true);
  select s.revision into v_rev from public.save_app_state(jsonb_build_object('version', 9, 'config', '{}'::jsonb,
    'lots', '[]'::jsonb, 'entries', '[]'::jsonb), null) s;
  perform set_config('test.uid', v_branch::text, true);

  foreach v_kind in array array['supplyPurchase', 'supplyIssue', 'chiliPurchase', 'chiliIssue'] loop
    v_err := null;
    begin perform public.append_entries(v_rev, jsonb_build_array(jsonb_build_object('id', 'x1', 'kind', v_kind,
      'role', 'branch', 'lotId', '', 'branch', v_mine, 'date', '2026-09-01', 'values', '{}'::jsonb)));
    exception when others then v_err := sqlerrm; end;
    assert v_err = 'Entry kind is not allowed for this account', format('%s: %s', v_kind, v_err);
  end loop;

  -- The other location's branch is not this account's any more.
  v_err := null;
  begin perform public.append_entries(v_rev, jsonb_build_array(jsonb_build_object('id', 'x1', 'kind', 'receive',
    'role', 'branch', 'lotId', '', 'branch', v_other, 'date', '2026-09-01', 'values', '{}'::jsonb)));
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Entry branch does not match signed-in account', format('other location: %s', v_err);

  select public.append_entries(v_rev, jsonb_build_array(jsonb_build_object('id', 'x1', 'kind', 'receive',
    'role', 'branch', 'lotId', '', 'branch', v_mine, 'date', '2026-09-01', 'values', '{}'::jsonb))) into v_rev;

  -- One edit request at a time per entry; a withdrawn one frees the entry.
  select public.append_entries(v_rev, jsonb_build_array(jsonb_build_object('id', 'q1', 'kind', 'editRequest',
    'role', 'branch', 'lotId', '', 'branch', v_mine, 'date', '2026-09-01', 'values', '{"targetId":"x1"}'::jsonb)))
    into v_rev;
  v_err := null;
  begin perform public.append_entries(v_rev, jsonb_build_array(jsonb_build_object('id', 'q2', 'kind', 'editRequest',
    'role', 'branch', 'lotId', '', 'branch', v_mine, 'date', '2026-09-01', 'values', '{"targetId":"x1"}'::jsonb)));
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Entry already has a pending edit request', format('second request: %s', v_err);
  select public.append_entries(v_rev, jsonb_build_array(
    jsonb_build_object('id', 'w1', 'kind', 'void', 'role', 'branch', 'lotId', '', 'branch', v_mine,
      'date', '2026-09-01', 'values', '{"targetId":"q1"}'::jsonb),
    jsonb_build_object('id', 'q2', 'kind', 'editRequest', 'role', 'branch', 'lotId', '', 'branch', v_mine,
      'date', '2026-09-01', 'values', '{"targetId":"x1"}'::jsonb))) into v_rev;

  -- A material transfer is confirmed once, directly or through a link.
  select public.append_entries(v_rev, jsonb_build_array(
    jsonb_build_object('id', 'm1', 'kind', 'materialConfirm', 'role', 'branch', 'lotId', '', 'branch', v_mine,
      'date', '2026-09-01', 'values', '{"transferId":"t1"}'::jsonb),
    jsonb_build_object('id', 'm2', 'kind', 'materialConfirm', 'role', 'branch', 'lotId', '', 'branch', v_mine,
      'date', '2026-09-01', 'values', '{}'::jsonb))) into v_rev;
  v_err := null;
  begin perform public.append_entries(v_rev, jsonb_build_array(jsonb_build_object('id', 'm3', 'kind',
    'materialConfirm', 'role', 'branch', 'lotId', '', 'branch', v_mine, 'date', '2026-09-01',
    'values', '{"transferId":"t1"}'::jsonb)));
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Material transfer is already confirmed', format('second confirm: %s', v_err);
  v_err := null;
  begin perform public.append_entries(v_rev, jsonb_build_array(jsonb_build_object('id', 'l1', 'kind', 'link',
    'role', 'branch', 'lotId', '', 'branch', v_mine, 'date', '2026-09-01',
    'values', '{"targetId":"m2","transferId":"t1"}'::jsonb)));
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Material transfer is already confirmed', format('link to confirmed: %s', v_err);
  select public.append_entries(v_rev, jsonb_build_array(jsonb_build_object('id', 'l1', 'kind', 'link',
    'role', 'branch', 'lotId', '', 'branch', v_mine, 'date', '2026-09-01',
    'values', '{"targetId":"m2","transferId":"t2"}'::jsonb))) into v_rev;
  v_err := null;
  begin perform public.append_entries(v_rev, jsonb_build_array(jsonb_build_object('id', 'm3', 'kind',
    'materialConfirm', 'role', 'branch', 'lotId', '', 'branch', v_mine, 'date', '2026-09-01',
    'values', '{"transferId":"t2"}'::jsonb)));
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Material transfer is already confirmed', format('confirmed by link: %s', v_err);

  raise exception 'APPEND_RETIRED_KINDS_TEST_PASSED';
end $$;

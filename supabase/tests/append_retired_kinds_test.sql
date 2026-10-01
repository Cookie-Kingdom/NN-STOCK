-- Migration 20260929000036: append_entries refuses the retired branch kinds, and a branch profile
-- linked to several locations has one branch, the one on the lowest location_id.
-- Migration 20261001000040: a branch appends what it received (chiliReceive, materialConfirm), never
-- the removed Owner kinds, and transfer_confirmed is gone.
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

  -- 0039: editRequest too (every account edits its own entries directly). 0040: the Owner's
  -- chiliAllocate and materialTransfer are no kinds at all any more.
  foreach v_kind in array array['supplyPurchase', 'supplyIssue', 'chiliPurchase', 'chiliIssue', 'editRequest',
    'chiliAllocate', 'materialTransfer'] loop
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

  -- 0040 (STK-43, MAT-01): the branch writes down the chili and the material it received.
  select public.append_entries(v_rev, jsonb_build_array(
    jsonb_build_object('id', 'c1', 'kind', 'chiliReceive', 'role', 'branch', 'lotId', '', 'branch', v_mine,
      'date', '2026-09-01', 'values', '{"chiliTubes":"20","receiver":"x"}'::jsonb),
    jsonb_build_object('id', 'm1', 'kind', 'materialConfirm', 'role', 'branch', 'lotId', '', 'branch', v_mine,
      'date', '2026-09-01', 'values', '{"material":"ถุงซีลเนื้อ","receivedQuantity":"5","receiver":"x"}'::jsonb),
    jsonb_build_object('id', 'm2', 'kind', 'materialConfirm', 'role', 'branch', 'lotId', '', 'branch', v_mine,
      'date', '2026-09-01', 'values', '{"material":"ถุงซีลเนื้อ","receivedQuantity":"5","receiver":"x"}'::jsonb)
    )) into v_rev;
  assert (select count(*) from public.app_state s, jsonb_array_elements(s.payload -> 'entries') e
    where e ->> 'id' in ('c1', 'm1', 'm2')) = 3, 'chiliReceive and two materialConfirm stored';
  -- Its copy holds them (app_state_scope_rules).
  assert (select count(*) from jsonb_array_elements(
      public.scope_app_state((select payload from public.app_state), array[v_mine]) -> 'entries') e
    where e ->> 'kind' in ('chiliReceive', 'materialConfirm')) = 3, 'a branch reads its receipts back';
  assert not public.app_state_scope_rules() -> 'kinds' ?| array['chiliAllocate', 'materialTransfer'],
    'the removed kinds are in no scope rule';
  assert to_regprocedure('public.transfer_confirmed(jsonb, text, text)') is null, 'transfer_confirmed is gone';

  raise exception 'APPEND_RETIRED_KINDS_TEST_PASSED';
end $$;

-- Failure-case test: save_app_state refuses branch accounts and mismatched actors / roles.
-- M1: Foodiva / Chef House work is typed by the Owner (actor "owner"); L3 / L4 accounts and the
-- retired Account Manager (L1_MANAGER) are refused even when active.
-- v2: the Owner jots no branch's note (role "branch").
-- Run:  psql "$DATABASE_URL" -f supabase/tests/save_app_state_guard_test.sql

do $$
declare
  v_owner  uuid := gen_random_uuid();
  v_branch uuid := gen_random_uuid();
  v_cm     uuid := gen_random_uuid();
  v_food   uuid := gen_random_uuid();
  v_mgr    uuid := gen_random_uuid();
  v_loc   uuid;
  v_rev    bigint;
  v_uid    uuid;
  v_err    text;
  lot1     constant jsonb := '{"id":"L1","poId":"P1","config":{},"values":{}}';
  v_e12    constant text := '{"id":"e1","kind":"pay","role":"owner"},{"id":"e2","kind":"packingList","role":"foodiva","actor":"owner"}';
begin
  -- The harness auth.uid() always returns null; let each step pick the signed-in user.
  create or replace function auth.uid() returns uuid language sql stable
    as $f$ select nullif(current_setting('test.uid', true), '')::uuid $f$;

  insert into auth.users (id, email) values
    (v_owner, 'owner@example.invalid'), (v_branch, 'minburi@example.invalid'), (v_cm, 'cm@example.invalid'),
    (v_food, 'foodiva@example.invalid'), (v_mgr, 'manager@example.invalid');
  -- handle_new_user() already made a profile per user; set the roles this test needs.
  insert into profiles (id, display_name, role, is_active) values
    (v_owner, 'owner', 'L1_OWNER', true), (v_branch, 'minburi', 'L2_BRANCH_ADMIN', true), (v_cm, 'cm', 'L3_CM_OPERATOR', true),
    (v_food, 'foodiva', 'L4_SUPPLIER', true), (v_mgr, 'manager', 'L1_MANAGER', true)
    on conflict (id) do update set role = excluded.role, is_active = true;
  insert into locations (code, name_th, kind) values ('MB-TEST', 'สาขามีนบุรี', 'BRANCH') returning id into v_loc;
  insert into user_locations (profile_id, location_id) values (v_branch, v_loc);

  perform set_config('test.uid', v_owner::text, true);
  select s.revision into v_rev from public.save_app_state(
    jsonb_build_object('version', 9, 'entries', '[]'::jsonb, 'lots', jsonb_build_array(lot1), 'config', '{}'::jsonb), null) s;

  -- A branch account never uses save_app_state, even for its own entry (append_entries only).
  perform set_config('test.uid', v_branch::text, true);
  v_err := null;
  begin
    perform public.save_app_state(jsonb_build_object('version', 9, 'lots', jsonb_build_array(lot1), 'config', '{}'::jsonb,
      'entries', '[{"id":"e1","kind":"sale","role":"branch","branch":"มีนบุรี"}]'::jsonb), v_rev);
  exception when others then v_err := sqlerrm;
  end;
  assert v_err = 'Branch accounts save through append_entries', format('branch save: got %s', v_err);

  -- M1: the Owner types Foodiva's Packing List (role foodiva, actor owner), but may not stamp
  -- "owner" on its own entry.
  perform set_config('test.uid', v_owner::text, true);
  v_err := null;
  begin
    perform public.save_app_state(jsonb_build_object('version', 9, 'lots', jsonb_build_array(lot1), 'config', '{}'::jsonb,
      'entries', '[{"id":"e1","kind":"pay","role":"owner"},{"id":"e2","kind":"central","role":"owner","actor":"owner"}]'::jsonb), v_rev);
  exception when others then v_err := sqlerrm;
  end;
  assert v_err = 'Entry actor does not match signed-in account', format('owner actor on owner entry: got %s', v_err);
  select s.revision into v_rev from public.save_app_state(jsonb_build_object('version', 9, 'lots', jsonb_build_array(lot1),
    'config', '{}'::jsonb, 'entries', ('[' || v_e12 || ']')::jsonb), v_rev) s;
  -- A branch's note is not the Owner's to jot, even with no stamp on it.
  v_err := null;
  begin
    perform public.save_app_state(jsonb_build_object('version', 9, 'lots', jsonb_build_array(lot1), 'config', '{}'::jsonb,
      'entries', ('[' || v_e12 || ',{"id":"e3","kind":"sale","role":"branch","branch":"มีนบุรี"}]')::jsonb), v_rev);
  exception when others then v_err := sqlerrm;
  end;
  assert v_err = 'Only a branch account writes a branch''s notes', format('owner as branch: got %s', v_err);

  -- L3 / L4 and L1_MANAGER are retired: refused up front even when active (this test activated them).
  foreach v_uid in array array[v_cm, v_food, v_mgr] loop
    perform set_config('test.uid', v_uid::text, true);
    v_err := null;
    begin perform public.save_app_state(jsonb_build_object('version', 9, 'lots', jsonb_build_array(lot1),
      'config', '{}'::jsonb, 'entries', ('[' || v_e12 || ']')::jsonb), v_rev);
    exception when others then v_err := sqlerrm; end;
    assert v_err = 'Account is not active', format('retired save: got %s', v_err);
    v_err := null;
    begin perform public.load_app_state();
    exception when others then v_err := sqlerrm; end;
    assert v_err = 'Account is not active', format('retired load: got %s', v_err);
    v_err := null;
    begin perform public.append_entries(v_rev, '[]'::jsonb, '[]'::jsonb);
    exception when others then v_err := sqlerrm; end;
    assert v_err = 'Account is not active', format('retired append: got %s', v_err);
  end loop;

  -- No new entry carries the retired "manager" stamp.
  perform set_config('test.uid', v_owner::text, true);
  v_err := null;
  begin
    perform public.save_app_state(jsonb_build_object('version', 9, 'lots', jsonb_build_array(lot1),
      'config', '{}'::jsonb, 'entries', ('[' || v_e12 || ',{"id":"e4","role":"owner","actor":"manager"}]')::jsonb), v_rev);
  exception when others then v_err := sqlerrm;
  end;
  assert v_err = 'Entry actor does not match signed-in account', format('owner as manager: got %s', v_err);

  raise exception 'SAVE_APP_STATE_GUARD_TEST_PASSED';
end $$;

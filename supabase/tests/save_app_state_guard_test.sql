-- Failure-case test: save_app_state refuses non-owner lot tampering and cross-branch entries.
-- Run:  psql "$DATABASE_URL" -f supabase/tests/save_app_state_guard_test.sql

do $$
declare
  v_owner  uuid := gen_random_uuid();
  v_branch uuid := gen_random_uuid();
  v_cm     uuid := gen_random_uuid();
  v_food   uuid := gen_random_uuid();
  v_loc    uuid;
  v_rev    bigint;
  v_err    text;
  lot1     constant jsonb := '{"id":"L1","poId":"P1","stage":1,"config":{},"values":{}}';
begin
  -- The harness auth.uid() always returns null; let each step pick the signed-in user.
  create or replace function auth.uid() returns uuid language sql stable
    as $f$ select nullif(current_setting('test.uid', true), '')::uuid $f$;

  insert into auth.users (id, email) values
    (v_owner, 'owner@example.invalid'), (v_branch, 'minburi@example.invalid'), (v_cm, 'cm@example.invalid'),
    (v_food, 'foodiva@example.invalid');
  -- handle_new_user() already made a profile per user; set the roles this test needs.
  insert into profiles (id, display_name, role, is_active) values
    (v_owner, 'owner', 'L1_OWNER', true), (v_branch, 'minburi', 'L2_BRANCH_ADMIN', true), (v_cm, 'cm', 'L3_CM_OPERATOR', true),
    (v_food, 'foodiva', 'L4_SUPPLIER', true)
    on conflict (id) do update set role = excluded.role, is_active = true;
  insert into locations (code, name_th, kind) values ('MB-TEST', 'สาขามีนบุรี', 'BRANCH') returning id into v_loc;
  insert into user_locations (profile_id, location_id) values (v_branch, v_loc);

  perform set_config('test.uid', v_owner::text, true);
  select s.revision into v_rev from public.save_app_state(
    jsonb_build_object('entries', '[]'::jsonb, 'lots', jsonb_build_array(lot1), 'config', '{}'::jsonb), null) s;

  -- A มีนบุรี account posting as ศาลาแดง is refused.
  perform set_config('test.uid', v_branch::text, true);
  v_err := null;
  begin
    perform public.save_app_state(jsonb_build_object('lots', jsonb_build_array(lot1), 'config', '{}'::jsonb,
      'entries', '[{"id":"e1","role":"branch","branch":"ศาลาแดง"}]'::jsonb), v_rev);
  exception when others then v_err := sqlerrm;
  end;
  assert v_err = 'Entry branch does not match signed-in account', format('cross-branch entry: got %s', v_err);

  -- Its own branch is accepted.
  select s.revision into v_rev from public.save_app_state(jsonb_build_object('lots', jsonb_build_array(lot1),
    'config', '{}'::jsonb, 'entries', '[{"id":"e1","role":"branch","branch":"มีนบุรี"}]'::jsonb), v_rev) s;

  -- The supplier role the client writes is "foodiva"; the function spelled it "fooddiva"
  -- for two migrations and refused every Foodiva save.
  perform set_config('test.uid', v_food::text, true);
  select s.revision into v_rev from public.save_app_state(jsonb_build_object('lots', jsonb_build_array(lot1),
    'config', '{}'::jsonb, 'entries', '[{"id":"e1","role":"branch","branch":"มีนบุรี"},{"id":"e2","role":"foodiva"}]'::jsonb), v_rev) s;

  perform set_config('test.uid', v_cm::text, true);
  v_err := null;
  begin
    perform public.save_app_state(jsonb_build_object('lots', '[]'::jsonb, 'config', '{}'::jsonb,
      'entries', '[{"id":"e1","role":"branch","branch":"มีนบุรี"},{"id":"e2","role":"foodiva"}]'::jsonb), v_rev);
  exception when others then v_err := sqlerrm;
  end;
  assert v_err = 'Only an owner can add or remove lots', format('lot removal: got %s', v_err);

  v_err := null;
  begin
    perform public.save_app_state(jsonb_build_object('lots', jsonb_build_array(lot1 || '{"stage":3}'),
      'config', '{}'::jsonb, 'entries', '[{"id":"e1","role":"branch","branch":"มีนบุรี"},{"id":"e2","role":"foodiva"}]'::jsonb), v_rev);
  exception when others then v_err := sqlerrm;
  end;
  assert v_err = 'Lot changes must follow the workflow', format('stage jump: got %s', v_err);

  -- One step forward is the normal workflow.
  perform public.save_app_state(jsonb_build_object('lots', jsonb_build_array(lot1 || '{"stage":2}'),
    'config', '{}'::jsonb, 'entries', '[{"id":"e1","role":"branch","branch":"มีนบุรี"},{"id":"e2","role":"foodiva"}]'::jsonb), v_rev);

  raise exception 'SAVE_APP_STATE_GUARD_TEST_PASSED';
end $$;

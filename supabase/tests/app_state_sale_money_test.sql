-- Account Manager (feedback 20-09 item 11): sale money never reaches its session, and its saves
-- (made from the stripped copy) never erase or change that money for anyone else.
-- Run:  psql "$DATABASE_URL" -f supabase/tests/app_state_sale_money_test.sql

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_mgr   uuid := gen_random_uuid();
  v_rev   bigint;
  v_n     bigint;
  v_err   text;
  v_state jsonb;
  v_seen  jsonb;
  v_cfg   constant jsonb := '{"boxPrice":"350","addonPrice":"320","chiliPrice":"30"}';
  v_sale  constant jsonb := '{"id":"s1","kind":"sale","role":"branch","branch":"มีนบุรี","values":{"boxes":"2","addons":"0","chiliAddons":"0","lineMan":"700","revenue":"700","menuTotal":"700","meatCost":"100"}}';
  v_req   constant jsonb := '{"id":"r1","kind":"editRequest","role":"branch","branch":"มีนบุรี","values":{"targetId":"s1","targetKind":"sale","from.lineMan":"700","to.boxes":"3","to.lineMan":"650","to.revenue":"650","to.menuTotal":"1050"}}';
  v_mgr_entries jsonb;
begin
  create or replace function auth.uid() returns uuid language sql stable
    as $f$ select nullif(current_setting('test.uid', true), '')::uuid $f$;
  insert into auth.users (id, email) values (v_owner, 'owner@example.invalid'), (v_mgr, 'manager@example.invalid');
  insert into profiles (id, display_name, role, is_active) values
    (v_owner, 'owner', 'L1_OWNER', true), (v_mgr, 'manager', 'L1_MANAGER', true)
    on conflict (id) do update set role = excluded.role, is_active = true;

  -- The Owner stores a sale and a branch's request to change its LINE MAN amount.
  perform set_config('test.uid', v_owner::text, true);
  select s.revision into v_rev from public.save_app_state(jsonb_build_object('lots', '[]'::jsonb,
    'config', v_cfg, 'entries', jsonb_build_array(v_sale, v_req)), null) s;

  -- Reads: the Owner gets the money, the manager does not (costs stay).
  select l.payload into v_seen from public.load_app_state() l;
  assert v_seen::text like '%"lineMan"%', 'owner load lost sale money';
  perform set_config('test.uid', v_mgr::text, true);
  select l.payload into v_seen from public.load_app_state() l;
  assert v_seen::text !~ '"(to\.|from\.)?(revenue|lineMan|menuTotal)"', format('manager load leaks sale money: %s', v_seen);
  assert v_seen -> 'entries' -> 0 -> 'values' ->> 'meatCost' = '100', 'manager load lost costs';
  assert public.app_state_revision() = v_rev, 'app_state_revision';

  -- The manager has no direct read on the table; the Owner still has.
  set local role authenticated;
  select count(*) into v_n from public.app_state;
  assert v_n = 0, 'manager can select app_state directly';
  perform set_config('test.uid', v_owner::text, true);
  select count(*) into v_n from public.app_state;
  assert v_n = 1, 'owner lost its direct read on app_state';
  reset role;

  -- The manager approves the request from its stripped copy and sneaks a LINE MAN amount into
  -- both the old sale and the approval. Stored money stays; the approval takes the request's.
  perform set_config('test.uid', v_mgr::text, true);
  v_mgr_entries := jsonb_set(v_seen -> 'entries', '{0,values,lineMan}', '"1"') || jsonb_build_array(
    '{"id":"d1","kind":"editDecision","role":"owner","actor":"manager","values":{"requestId":"r1","decision":"อนุมัติ","targetId":"s1","targetKind":"sale","to.boxes":"3","to.addons":"0","to.chiliAddons":"0","to.lineMan":"1"}}'::jsonb);
  select s.revision into v_rev from public.save_app_state(jsonb_build_object('lots', '[]'::jsonb,
    'config', v_cfg, 'entries', v_mgr_entries), v_rev) s;
  select payload into v_state from public.app_state;
  assert v_state -> 'entries' -> 0 = v_sale, format('stored sale changed: %s', v_state -> 'entries' -> 0);
  assert v_state -> 'entries' -> 1 = v_req, 'stored request changed';
  assert v_state -> 'entries' -> 2 -> 'values' ->> 'to.lineMan' = '650', format('approval: %s', v_state -> 'entries' -> 2);
  assert v_state -> 'entries' -> 2 -> 'values' ->> 'to.revenue' = '650', 'approval to.revenue';
  assert v_state -> 'entries' -> 2 -> 'values' ->> 'from.lineMan' = '700', 'approval from.lineMan';
  assert v_state -> 'entries' -> 2 -> 'values' ->> 'to.menuTotal' = '1050', 'approval to.menuTotal';

  -- A direct edit keeps the (now approved) money and works out menuTotal again from the counts.
  select l.payload into v_seen from public.load_app_state() l;
  select s.revision into v_rev from public.save_app_state(jsonb_build_object('lots', '[]'::jsonb,
    'config', v_cfg, 'entries', (v_seen -> 'entries') || jsonb_build_array(
    '{"id":"x1","kind":"entryEdit","role":"owner","actor":"manager","values":{"targetId":"s1","targetKind":"sale","to.boxes":"1","to.addons":"1","to.chiliAddons":"0"}}'::jsonb)), v_rev) s;
  select payload into v_state from public.app_state;
  assert v_state -> 'entries' -> 3 -> 'values' ->> 'from.lineMan' = '650', format('edit: %s', v_state -> 'entries' -> 3);
  assert v_state -> 'entries' -> 3 -> 'values' ->> 'to.lineMan' = '650', 'edit to.lineMan';
  assert v_state -> 'entries' -> 3 -> 'values' ->> 'to.menuTotal' = '670', 'edit to.menuTotal';
  assert v_state -> 'entries' -> 0 = v_sale, 'stored sale changed by the edit';

  -- Anything else the manager changes in stored history is still refused.
  select l.payload into v_seen from public.load_app_state() l;
  v_err := null;
  begin
    perform public.save_app_state(jsonb_build_object('lots', '[]'::jsonb, 'config', v_cfg,
      'entries', jsonb_set(v_seen -> 'entries', '{0,values,boxes}', '"9"')), v_rev);
  exception when others then v_err := sqlerrm;
  end;
  assert v_err = 'Existing history cannot be changed', format('history change: got %s', v_err);

  raise exception 'APP_STATE_SALE_MONEY_TEST_PASSED';
end $$;

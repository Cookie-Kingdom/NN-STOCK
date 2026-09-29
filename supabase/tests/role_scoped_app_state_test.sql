-- APP-01 / DB-03 (migration 20260925000028), free ledger (20260928000030, card A1), retired
-- partner accounts (20260929000032, card M1): load_app_state hands a branch only its role-scoped
-- copy (role-scope.ts) and refuses Foodiva / Chef House; branch saves go through append_entries,
-- which checks no workflow stage and (0034) takes no lot change.
-- Run:  psql "$DATABASE_URL" -f supabase/tests/role_scoped_app_state_test.sql

do $$
declare
  v_owner  uuid := gen_random_uuid();
  v_branch uuid := gen_random_uuid();
  v_cm     uuid := gen_random_uuid();
  v_food   uuid := gen_random_uuid();
  v_loc    uuid;
  v_rev    bigint;
  v_n      bigint;
  v_err    text;
  v_uid    uuid;
  v_state  text;
  v_seen   jsonb;
  v_text   text;
  v_stored jsonb;
  v_cfg    constant jsonb := '{"branch":"ศาลาแดง","boxPrice":"350","addonPrice":"320","chiliPrice":"30","outboundFee":"1200","companyName":"NN","chefHouseAddress":"CM"}';
  v_lots   constant jsonb := '[
    {"id":"P1","poId":"PO-1","config":{"boxPrice":"350","companyName":"NN"},"values":{"price":"250","orderedKg":"50"}},
    {"id":"S1","poId":"SH-1","kind":"shipment","config":{"boxPrice":"350"},
     "values":{"lines":"[{\"lotId\":\"P1\",\"kg\":50}]","requestedKg":"50","receivedKg":"49","centralKg":"35","outboundCost":"1200","returnCost":"0"}},
    {"id":"S2","poId":"SH-2","kind":"shipment","config":{},
     "values":{"lines":"[{\"lotId\":\"P1\",\"kg\":10}]","requestedKg":"10","outboundCost":"1200"}}
  ]';
  v_entries constant jsonb := '[
    {"id":"e-po","kind":"purchase","role":"owner","lotId":"P1","branch":"ศาลาแดง","date":"2026-09-01","values":{"price":"250"}},
    {"id":"e-inv","kind":"foodivaConfirm","role":"foodiva","lotId":"P1","branch":"ศาลาแดง","date":"2026-09-01","values":{"invoiceAmount":"12500"}},
    {"id":"e-pl","kind":"packingList","role":"foodiva","lotId":"S1","branch":"ศาลาแดง","date":"2026-09-02","values":{"boxes":"49"}},
    {"id":"e-so","kind":"smokeOrder","role":"owner","lotId":"S1","branch":"ศาลาแดง","date":"2026-09-02","values":{"rawKg":"50","estimatedCost":"9000","serviceRate":"180"}},
    {"id":"e-ret","kind":"return","role":"owner","lotId":"S1","branch":"ศาลาแดง","date":"2026-09-03","values":{"returnKg":"36","returnCost":"0"}},
    {"id":"e-al1","kind":"allocate","role":"owner","lotId":"S1","branch":"มีนบุรี","date":"2026-09-04","values":{"kg":"20"}},
    {"id":"e-al2","kind":"allocate","role":"owner","lotId":"S1","branch":"ศาลาแดง","date":"2026-09-04","values":{"kg":"15"}},
    {"id":"e-mb","kind":"sale","role":"branch","lotId":"S1","branch":"มีนบุรี","date":"2026-09-05","values":{"soldKg":"1","revenue":"700","meatCost":"641"}},
    {"id":"e-sd","kind":"sale","role":"branch","lotId":"S1","branch":"ศาลาแดง","date":"2026-09-05","values":{"soldKg":"2","revenue":"1400","meatCost":"1282"}},
    {"id":"e-v1","kind":"void","role":"owner","lotId":"S1","branch":"ศาลาแดง","date":"2026-09-06","values":{"targetId":"e-mb","targetBranch":"มีนบุรี"}},
    {"id":"e-v2","kind":"void","role":"owner","lotId":"S1","branch":"ศาลาแดง","date":"2026-09-06","values":{"targetId":"e-sd","targetBranch":"ศาลาแดง"}},
    {"id":"e-rcv","kind":"receive","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-06","values":{"kg":"3"}},
    {"id":"e-lk","kind":"link","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-06","values":{"targetId":"e-rcv","lotId":"S1"}},
    {"id":"e-dsp","kind":"dispatch","role":"foodiva","lotId":"S2","branch":"ศาลาแดง","date":"2026-09-06","values":{"trip":"1"}}
  ]';
begin
  create or replace function auth.uid() returns uuid language sql stable
    as $f$ select nullif(current_setting('test.uid', true), '')::uuid $f$;
  insert into auth.users (id, email) values (v_owner, 'owner@example.invalid'), (v_branch, 'minburi@example.invalid'),
    (v_cm, 'cm@example.invalid'), (v_food, 'foodiva@example.invalid');
  insert into profiles (id, display_name, role, is_active) values
    (v_owner, 'owner', 'L1_OWNER', true), (v_branch, 'minburi', 'L2_BRANCH_ADMIN', true),
    (v_cm, 'cm', 'L3_CM_OPERATOR', true), (v_food, 'foodiva', 'L4_SUPPLIER', true)
    on conflict (id) do update set role = excluded.role, is_active = true;
  insert into locations (code, name_th, kind) values ('MB-SCOPE', 'สาขามีนบุรี', 'BRANCH') returning id into v_loc;
  insert into user_locations (profile_id, location_id) values (v_branch, v_loc);

  perform set_config('test.uid', v_owner::text, true);
  select s.revision into v_rev from public.save_app_state(
    jsonb_build_object('version', 9, 'lots', v_lots, 'entries', v_entries, 'config', v_cfg), null) s;
  select l.payload into v_seen from public.load_app_state() l;
  assert jsonb_array_length(v_seen -> 'entries') = 14 and v_seen -> 'config' = v_cfg, 'owner load changed';

  -- Branch (มีนบุรี): its own sale and allocation, the void of its sale, its receive with no lot
  -- and the link naming it; no other branch, no purchase, no Foodiva invoice, no cost or price,
  -- only the lot allocated to it (BR-07).
  perform set_config('test.uid', v_branch::text, true);
  select l.payload into v_seen from public.load_app_state() l;
  select string_agg(e ->> 'id', ',' order by ord) into v_text from jsonb_array_elements(v_seen -> 'entries') with ordinality t(e, ord);
  assert v_text = 'e-al1,e-mb,e-v1,e-rcv,e-lk', format('branch entries: %s', v_text);
  assert (select string_agg(l ->> 'id', ',') from jsonb_array_elements(v_seen -> 'lots') l) = 'S1', 'branch lots';
  assert v_seen::text !~ '"(price|lines|meatCost|wasteCost|outboundCost|returnCost|estimatedCost|invoiceAmount)"',
    format('branch load leaks cost: %s', v_seen);
  assert v_seen -> 'entries' -> 1 -> 'values' ->> 'revenue' = '700', 'branch lost its own sale money';
  assert v_seen -> 'config' ->> 'boxPrice' = '350' and not (v_seen -> 'config' ? 'outboundFee'), format('branch config: %s', v_seen -> 'config');
  assert v_seen -> 'lots' -> 0 -> 'config' = '{"boxPrice":"350"}', 'branch lot config';
  assert v_seen ->> 'version' = '9', 'branch version';

  -- M1: Foodiva and Chef House accounts are retired, even when active.
  foreach v_uid in array array[v_food, v_cm] loop
    perform set_config('test.uid', v_uid::text, true);
    v_err := null;
    begin perform public.load_app_state();
    exception when others then v_err := sqlerrm; end;
    assert v_err = 'Account is not active', format('retired load: %s', v_err);
  end loop;

  -- Nobody but the Owner selects app_state directly.
  set local role authenticated;
  select count(*) into v_n from public.app_state;
  assert v_n = 0, 'a non-owner can select app_state directly';
  perform set_config('test.uid', v_owner::text, true);
  select count(*) into v_n from public.app_state;
  assert v_n = 1, 'owner lost its direct read on app_state';
  reset role;

  assert not has_function_privilege('anon', 'public.append_entries(bigint, jsonb, jsonb)', 'execute'), 'anon can append';
  assert has_function_privilege('authenticated', 'public.append_entries(bigint, jsonb, jsonb)', 'execute'), 'authenticated cannot append';
  assert not has_function_privilege('authenticated', 'public.scope_app_state(jsonb, text[])', 'execute'), 'scope_app_state is callable';
  assert to_regprocedure('public.scope_app_state(jsonb, text, text[])') is null, 'old scope_app_state still there';
  assert public.app_state_scope_rules() ?& array['kinds', 'hiddenKeys', 'configKeys']
    and not public.app_state_scope_rules() ?| array['branch', 'ownBranch', 'lots'], 'scope rule has the old shape';
  assert not exists (select 1 from pg_proc where proname = 'lot_cost_per_kg'), 'lot_cost_per_kg still there';

  -- append_entries: the Owner keeps save_app_state.
  v_err := null;
  begin perform public.append_entries(v_rev, '[]'::jsonb, '[]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Only branch accounts append entries', format('owner append: %s', v_err);

  -- A stale revision is PT409 with save_app_state's message, never 40001.
  perform set_config('test.uid', v_branch::text, true);
  v_err := null;
  begin perform public.append_entries(v_rev - 1, '[]'::jsonb, '[]'::jsonb);
  exception when others then get stacked diagnostics v_err = message_text, v_state = returned_sqlstate; end;
  assert v_state = 'PT409' and v_err = 'State changed on another device. Reload and try again.', format('stale: %s %s', v_state, v_err);

  -- A0 acceptance, wrong-role kind or role: still refused; a branch never stamps an actor.
  v_err := null;
  begin perform public.append_entries(v_rev,
    '[{"id":"n1","kind":"cmReceive","role":"branch","lotId":"S1","branch":"มีนบุรี","values":{}}]'::jsonb, '[]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Entry kind is not allowed for this account', format('branch cmReceive: %s', v_err);
  v_err := null;
  begin perform public.append_entries(v_rev,
    '[{"id":"n1","kind":"smokeOrder","role":"cm","lotId":"S2","branch":"มีนบุรี","values":{}}]'::jsonb, '[]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Entry role does not match signed-in account', format('branch as cm: %s', v_err);
  v_err := null;
  begin perform public.append_entries(v_rev,
    '[{"id":"n1","kind":"receive","role":"branch","actor":"owner","lotId":"S1","branch":"มีนบุรี","values":{}}]'::jsonb, '[]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Entry actor does not match signed-in account', format('branch as owner: %s', v_err);
  v_err := null;
  begin perform public.append_entries(v_rev,
    '[{"id":"e-pl","kind":"receive","role":"branch","lotId":"S2","branch":"มีนบุรี","values":{}}]'::jsonb, '[]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Entry id must be unique', format('duplicate id: %s', v_err);
  v_err := null;
  begin perform public.append_entries(v_rev,
    '[{"id":"n1","kind":"receive","role":"branch","lotId":"S9","branch":"มีนบุรี","values":{}}]'::jsonb, '[]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Entry lot does not exist', format('unknown lot: %s', v_err);
  -- 0034: a branch changes no lot, stored or new: lotCost reads outboundCost / returnCost /
  -- centralKg from lot values, and no branch kind writes them.
  v_err := null;
  begin perform public.append_entries(v_rev, '[]'::jsonb, '[{"id":"S1","values":{"outboundCost":"0","centralKg":"999"}}]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Only an owner can change lots', format('stored lot values: %s', v_err);
  v_err := null;
  begin perform public.append_entries(v_rev, '[]'::jsonb, '[{"id":"S260907-001-a1b2","kind":"shipment","poId":"SH-2026-0003","config":{},"values":{}}]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Only an owner can change lots', format('new batch: %s', v_err);

  -- A1: a branch entry on a lot, nothing but the entry stored.
  select public.append_entries(v_rev,
    '[{"id":"n2","kind":"receive","role":"branch","lotId":"S2","branch":"มีนบุรี","date":"2026-09-07","values":{"kg":"9.8"}}]'::jsonb,
    '[]'::jsonb) into v_rev;
  select payload into v_stored from public.app_state;
  assert v_stored -> 'lots' = v_lots, format('lots changed: %s', v_stored -> 'lots');
  assert v_stored -> 'entries' -> 14 ->> 'id' = 'n2' and jsonb_array_length(v_stored -> 'entries') = 15, 'branch entry not appended';
  -- A branch sale: the browser's meatCost / wasteCost are dropped, not stamped (BR-05).
  v_err := null;
  begin perform public.append_entries(v_rev,
    '[{"id":"n4","kind":"sale","role":"branch","lotId":"S1","branch":"ศาลาแดง","values":{}}]'::jsonb, '[]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Entry branch does not match signed-in account', format('other branch: %s', v_err);
  select public.append_entries(v_rev,
    '[{"id":"n4","kind":"sale","role":"branch","lotId":"S1","branch":"มีนบุรี","date":"2026-09-08","values":{"soldKg":"1","wasteKg":"0.5","meatCost":"1","to.meatCost":"2"}}]'::jsonb,
    '[]'::jsonb) into v_rev;
  select payload into v_stored from public.app_state;
  assert v_stored -> 'entries' -> 15 -> 'values' = '{"soldKg":"1","wasteKg":"0.5"}'::jsonb,
    format('sale cost kept: %s', v_stored -> 'entries' -> 15);

  -- A1 acceptance: the Owner saves central on S2, which has no return.
  perform set_config('test.uid', v_owner::text, true);
  select s.revision into v_rev from public.save_app_state(jsonb_set(v_stored, '{entries}', (v_stored -> 'entries') ||
    '[{"id":"n5","kind":"central","role":"owner","lotId":"S2","branch":"ศาลาแดง","date":"2026-09-09","values":{"centralKg":"7"}}]'::jsonb), v_rev) s;
  select payload into v_stored from public.app_state;
  assert v_stored -> 'entries' -> 16 ->> 'kind' = 'central', 'owner central not saved';

  raise exception 'ROLE_SCOPED_APP_STATE_TEST_PASSED';
end $$;

-- APP-01 / DB-03 (migration 20260925000028): load_app_state hands Branch, Foodiva and Chef House
-- only their role-scoped copy, and their saves go through append_entries.
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
  v_state  text;
  v_seen   jsonb;
  v_text   text;
  v_stored jsonb;
  v_cfg    constant jsonb := '{"branch":"ศาลาแดง","boxPrice":"350","addonPrice":"320","chiliPrice":"30","outboundFee":"1200","companyName":"NN","chefHouseAddress":"CM"}';
  v_lots   constant jsonb := '[
    {"id":"P1","poId":"PO-1","stage":1,"config":{"boxPrice":"350","companyName":"NN"},"values":{"price":"250","orderedKg":"50"}},
    {"id":"S1","poId":"SH-1","kind":"shipment","stage":8,"config":{"boxPrice":"350"},
     "values":{"lines":"[{\"lotId\":\"P1\",\"kg\":50}]","requestedKg":"50","receivedKg":"49","centralKg":"35","outboundCost":"1200","returnCost":"0"}},
    {"id":"S2","poId":"SH-2","kind":"shipment","stage":2,"config":{},
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
    {"id":"e-v2","kind":"void","role":"owner","lotId":"S1","branch":"ศาลาแดง","date":"2026-09-06","values":{"targetId":"e-sd","targetBranch":"ศาลาแดง"}}
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
    jsonb_build_object('version', 8, 'lots', v_lots, 'entries', v_entries, 'config', v_cfg), null) s;
  select l.payload into v_seen from public.load_app_state() l;
  assert jsonb_array_length(v_seen -> 'entries') = 11 and v_seen -> 'config' = v_cfg, 'owner load changed';

  -- Branch (มีนบุรี): its own sale and allocation and the void of its sale; no other branch, no
  -- purchase, no Foodiva invoice, no cost or price anywhere, only the lot allocated to it.
  perform set_config('test.uid', v_branch::text, true);
  select l.payload into v_seen from public.load_app_state() l;
  select string_agg(e ->> 'id', ',' order by ord) into v_text from jsonb_array_elements(v_seen -> 'entries') with ordinality t(e, ord);
  assert v_text = 'e-al1,e-mb,e-v1', format('branch entries: %s', v_text);
  assert (select string_agg(l ->> 'id', ',') from jsonb_array_elements(v_seen -> 'lots') l) = 'S1', 'branch lots';
  assert v_seen::text !~ '"(price|lines|meatCost|wasteCost|outboundCost|returnCost|estimatedCost|invoiceAmount)"',
    format('branch load leaks cost: %s', v_seen);
  assert v_seen -> 'entries' -> 1 -> 'values' ->> 'revenue' = '700', 'branch lost its own sale money';
  assert v_seen -> 'config' ->> 'boxPrice' = '350' and not (v_seen -> 'config' ? 'outboundFee'), format('branch config: %s', v_seen -> 'config');
  assert v_seen -> 'lots' -> 0 -> 'config' = '{"boxPrice":"350"}', 'branch lot config';
  assert v_seen ->> 'version' = '8', 'branch version';

  -- Foodiva: purchase (its own selling price), its invoice, Packing List, return without its cost;
  -- no sale, no allocation, no smoke PO cost.
  perform set_config('test.uid', v_food::text, true);
  select l.payload into v_seen from public.load_app_state() l;
  select string_agg(e ->> 'id', ',' order by ord) into v_text from jsonb_array_elements(v_seen -> 'entries') with ordinality t(e, ord);
  assert v_text = 'e-po,e-inv,e-pl,e-so,e-ret', format('foodiva entries: %s', v_text);
  assert v_seen::text !~ '"(revenue|lineMan|menuTotal|meatCost|returnCost|estimatedCost)"', format('foodiva load leaks: %s', v_seen);
  assert v_seen -> 'entries' -> 0 -> 'values' ->> 'price' = '250', 'foodiva lost the PO price';
  assert jsonb_array_length(v_seen -> 'lots') = 3, 'foodiva lots';
  assert not (v_seen -> 'config' ? 'boxPrice') and v_seen -> 'config' ->> 'outboundFee' = '1200', format('foodiva config: %s', v_seen -> 'config');

  -- Chef House: only the shipment with a smoke PO, without purchase lines, prices or freight.
  perform set_config('test.uid', v_cm::text, true);
  select l.payload into v_seen from public.load_app_state() l;
  select string_agg(e ->> 'id', ',' order by ord) into v_text from jsonb_array_elements(v_seen -> 'entries') with ordinality t(e, ord);
  assert v_text = 'e-pl,e-so', format('cm entries: %s', v_text);
  assert (select string_agg(l ->> 'id', ',') from jsonb_array_elements(v_seen -> 'lots') l) = 'S1', 'cm lots';
  assert v_seen::text !~ '"(price|lines|outboundCost|returnCost|meatCost|revenue)"', format('cm load leaks: %s', v_seen);
  assert v_seen -> 'entries' -> 1 -> 'values' ->> 'estimatedCost' = '9000', 'cm lost its smoke PO';
  assert v_seen -> 'config' ->> 'chefHouseAddress' = 'CM' and not (v_seen -> 'config' ? 'boxPrice'), 'cm config';

  -- Nobody but the Owner selects app_state directly.
  set local role authenticated;
  select count(*) into v_n from public.app_state;
  assert v_n = 0, 'cm can select app_state directly';
  perform set_config('test.uid', v_owner::text, true);
  select count(*) into v_n from public.app_state;
  assert v_n = 1, 'owner lost its direct read on app_state';
  reset role;

  assert not has_function_privilege('anon', 'public.append_entries(bigint, jsonb, jsonb)', 'execute'), 'anon can append';
  assert has_function_privilege('authenticated', 'public.append_entries(bigint, jsonb, jsonb)', 'execute'), 'authenticated cannot append';
  assert not has_function_privilege('authenticated', 'public.scope_app_state(jsonb, text, text[])', 'execute'), 'scope_app_state is callable';

  -- append_entries: the Owner keeps save_app_state.
  v_err := null;
  begin perform public.append_entries(v_rev, '[]'::jsonb, '[]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Only branch, Foodiva and Chef House accounts append entries', format('owner append: %s', v_err);

  -- A stale revision is PT409 with save_app_state's message, never 40001.
  perform set_config('test.uid', v_cm::text, true);
  v_err := null;
  begin perform public.append_entries(v_rev - 1, '[]'::jsonb, '[]'::jsonb);
  exception when others then get stacked diagnostics v_err = message_text, v_state = returned_sqlstate; end;
  assert v_state = 'PT409' and v_err = 'State changed on another device. Reload and try again.', format('stale: %s %s', v_state, v_err);

  v_err := null;
  begin perform public.append_entries(v_rev,
    '[{"id":"n1","kind":"sale","role":"cm","lotId":"S1","branch":"ศาลาแดง","values":{}}]'::jsonb, '[]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Entry kind is not allowed for this account', format('cm sale: %s', v_err);
  v_err := null;
  begin perform public.append_entries(v_rev,
    '[{"id":"e-pl","kind":"cmReceive","role":"cm","lotId":"S2","branch":"ศาลาแดง","values":{}}]'::jsonb, '[]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Entry id must be unique', format('duplicate id: %s', v_err);
  v_err := null;
  begin perform public.append_entries(v_rev, '[]'::jsonb, '[{"id":"P1","stage":2,"values":{}}]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Lot changes must follow the workflow', format('cm moves a Foodiva stage: %s', v_err);
  v_err := null;
  begin perform public.append_entries(v_rev, '[]'::jsonb, '[{"id":"S2","stage":4,"values":{}}]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Lot changes must follow the workflow', format('stage jump: %s', v_err);
  v_err := null;
  begin perform public.append_entries(v_rev, '[]'::jsonb, '[{"id":"S9","stage":1,"values":{}}]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Only an owner can add or remove lots', format('new lot: %s', v_err);

  -- Chef House weighs S2 in from its scoped copy (no lines): stage +1, lines kept, price untouched.
  select public.append_entries(v_rev,
    '[{"id":"n2","kind":"cmReceive","role":"cm","lotId":"S2","branch":"ศาลาแดง","date":"2026-09-07","values":{"receivedKg":"9.8"}}]'::jsonb,
    '[{"id":"S2","poId":"x","stage":3,"config":{},"values":{"requestedKg":"10","receivedKg":"9.8"}}]'::jsonb) into v_rev;
  select payload into v_stored from public.app_state;
  assert v_stored -> 'lots' -> 2 = '{"id":"S2","poId":"SH-2","kind":"shipment","stage":3,"config":{},"values":{"lines":"[{\"lotId\":\"P1\",\"kg\":10}]","requestedKg":"10","receivedKg":"9.8","outboundCost":"1200"}}'::jsonb,
    format('merged lot: %s', v_stored -> 'lots' -> 2);
  assert v_stored -> 'entries' -> 11 ->> 'id' = 'n2' and jsonb_array_length(v_stored -> 'entries') = 12, 'cm entry not appended';

  -- A branch sale: whatever cost the browser sends is replaced by lotCost on the full payload,
  -- (49 kg x 250 + 9000 smoke PO + 1200 freight) / 35 kg per kg.
  perform set_config('test.uid', v_branch::text, true);
  v_err := null;
  begin perform public.append_entries(v_rev,
    '[{"id":"n3","kind":"sale","role":"branch","lotId":"S1","branch":"ศาลาแดง","values":{}}]'::jsonb, '[]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Entry branch does not match signed-in account', format('other branch: %s', v_err);
  select public.append_entries(v_rev,
    '[{"id":"n3","kind":"sale","role":"branch","lotId":"S1","branch":"มีนบุรี","date":"2026-09-08","values":{"soldKg":"1","wasteKg":"0.5","meatCost":"1","to.meatCost":"2"}}]'::jsonb,
    '[]'::jsonb) into v_rev;
  select payload into v_stored from public.app_state;
  assert v_stored -> 'entries' -> 12 -> 'values' = '{"soldKg":"1","wasteKg":"0.5","meatCost":"641.4285714285714","wasteCost":"320.7142857142857"}'::jsonb,
    format('server meat cost: %s', v_stored -> 'entries' -> 12);

  raise exception 'ROLE_SCOPED_APP_STATE_TEST_PASSED';
end $$;

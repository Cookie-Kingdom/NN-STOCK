-- Migrations 20261002000004 and 20261002000005 (v2 note-taking): what a branch and the Account Manager receive, and
-- what each may write.
--   * scope_app_state: a branch gets its own entries, every Lot รมควัน and the stock lines of what
--     was bought for it, cut down; nothing of another branch, no PO เนื้อ, no cost.
--   * manager_strip_entries / load_app_state: no sale money, payroll payments as stubs.
--   * append_entries: the v2 branch kinds, the four payment categories, changes to its own notes.
--   * save_app_state: the Account Manager writes no sale, no payroll payment, no change about
--     one and no settings; its save keeps the stored sale money and payroll amounts. Neither it
--     nor the Owner writes a branch's notes: no new one, no change to one, no undo of a change.
--   * Nobody but the Owner selects app_state directly.
-- tests/unit/server.test.ts runs the JS ports (src/lib/role-scope.ts, manager-scope.ts,
-- local-db.server.ts) on the same state and cases, read from this file by their dollar-quote tags.
-- Run:  psql "$DATABASE_URL" -f supabase/tests/v2_app_state_test.sql

do $$
declare
  v_owner  uuid := gen_random_uuid();
  v_mgr    uuid := gen_random_uuid();
  v_branch uuid := gen_random_uuid();
  v_loc    uuid;
  v_rev    bigint := 1;
  v_n      bigint;
  v_err    text;
  v_case   jsonb;
  v_seen   jsonb;
  v_want   jsonb;
  -- ov deletes r0; pw is a payroll payment, pe an edit of it, pv its delete; ps is what the Account
  -- Manager bought for มีนบุรี, pse an edit of that and psv the undo; pd is bought for ศาลาแดง; oe
  -- is the Owner's edit of มีนบุรี's sale; mc the Owner jotted for มีนบุรี; tw is a retired kind.
  v_state constant jsonb := $state$
  {"version": 9,
   "config": {"boxPrice":"350","packKg":"0.12","packCost":"25","materialList":"[]","rawRiceBranches":"[\"ศาลาแดง\",\"มีนบุรี\"]","companyName":"x"},
   "lots": [
    {"id":"F1","poId":"PO-1","config":{},"values":{"price":"700","supplier":"Foodiva"}},
    {"id":"S1","poId":"SH-1","kind":"shipment","config":{"boxPrice":"350","packKg":"0.12"},"values":{"netPayable":"9","note":"x"}},
    {"id":"S2","poId":"SH-2","kind":"shipment","config":{},"values":{}}],
   "entries": [
    {"id":"s1","kind":"sale","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-01","values":{"boxes":"2","lineMan":"700","sales.grab":"50","meatCost":"9"}},
    {"id":"s2","kind":"sale","role":"branch","lotId":"","branch":"ศาลาแดง","date":"2026-09-01","values":{"boxes":"1","lineMan":"350"}},
    {"id":"r1","kind":"receive","role":"branch","lotId":"S1","branch":"มีนบุรี","date":"2026-09-01","values":{"kg":"3"}},
    {"id":"r0","kind":"receive","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-01","values":{"kg":"1"}},
    {"id":"ov","kind":"void","role":"owner","lotId":"","branch":"","date":"2026-09-01","values":{"targetId":"r0","targetKind":"receive"}},
    {"id":"m0","kind":"materials","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-01","values":{"count.m1":"5"}},
    {"id":"pw","kind":"pay","role":"owner","lotId":"","branch":"","date":"2026-09-01","values":{"category":"payroll","amount":"25000","employee":"A","payer":"บริษัท"}},
    {"id":"pe","kind":"entryEdit","role":"owner","lotId":"","branch":"","date":"2026-09-01","values":{"targetId":"pw","targetKind":"pay","targetRole":"owner","targetBranch":"","from.category":"payroll","from.amount":"25000","to.amount":"26000"}},
    {"id":"pv","kind":"void","role":"owner","lotId":"","branch":"","date":"2026-09-01","values":{"targetId":"pw","targetKind":"pay"}},
    {"id":"ps","kind":"pay","role":"owner","actor":"manager","lotId":"","branch":"มีนบุรี","date":"2026-09-01","values":{"category":"packaging","amount":"100","item":"m1","qty":"60","branch":"มีนบุรี","supplier":"x","fullAmount":"200","payer":"บริษัท"}},
    {"id":"pse","kind":"entryEdit","role":"owner","lotId":"","branch":"","date":"2026-09-01","values":{"targetId":"ps","targetKind":"pay","from.qty":"60","to.qty":"50","from.amount":"100","to.amount":"90"}},
    {"id":"psv","kind":"void","role":"owner","lotId":"","branch":"","date":"2026-09-01","values":{"targetId":"pse","targetKind":"entryEdit","reason":"x"}},
    {"id":"pd","kind":"pay","role":"owner","lotId":"","branch":"ศาลาแดง","date":"2026-09-01","values":{"category":"ingredient","amount":"9","item":"chili","qty":"7","branch":"ศาลาแดง"}},
    {"id":"pb","kind":"pay","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-01","values":{"category":"ingredient","amount":"120","item":"rice","qty":"20","payer":"A","fullAmount":"150"}},
    {"id":"oe","kind":"entryEdit","role":"owner","lotId":"","branch":"","date":"2026-09-01","values":{"targetId":"s1","targetKind":"sale","from.lineMan":"700","to.lineMan":"650","to.sales.grab":"40","to.meatCost":"8","to.boxes":"3"}},
    {"id":"mc","kind":"meatCount","role":"branch","actor":"owner","lotId":"","branch":"มีนบุรี","date":"2026-09-01","values":{"kg":"5"}},
    {"id":"po","kind":"purchase","role":"owner","lotId":"F1","branch":"","date":"2026-09-01","values":{"price":"700","orderedKg":"10"}},
    {"id":"tw","kind":"thaw","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-01","values":{"kg":"1"}},
    {"id":"cf","kind":"config","role":"owner","lotId":"","branch":"","date":"2026-09-01","values":{"boxPrice":"350"}}
  ]}
  $state$;
  -- [id, values]: the entries มีนบุรี receives, in log order, each with the values it keeps.
  v_branch_sees constant jsonb := $branch$
  [
    ["s1", {"boxes":"2","lineMan":"700","sales.grab":"50"}],
    ["r1", {"kg":"3"}],
    ["r0", {"kg":"1"}],
    ["ov", {"targetId":"r0","targetKind":"receive"}],
    ["m0", {"count.m1":"5"}],
    ["ps", {"category":"packaging","item":"m1","qty":"60","branch":"มีนบุรี"}],
    ["pse", {"targetId":"ps","targetKind":"pay","to.qty":"50"}],
    ["psv", {"targetId":"pse","targetKind":"entryEdit"}],
    ["pb", {"category":"ingredient","amount":"120","item":"rice","qty":"20","payer":"A","fullAmount":"150"}],
    ["oe", {"targetId":"s1","targetKind":"sale","from.lineMan":"700","to.lineMan":"650","to.sales.grab":"40","to.boxes":"3"}],
    ["mc", {"kg":"5"}]
  ]
  $branch$;
  -- id -> values: the entries the Account Manager receives changed; every other one is whole.
  v_manager_sees constant jsonb := $manager$
  {
    "s1": {"boxes":"2","meatCost":"9"},
    "s2": {"boxes":"1"},
    "pw": {"category":"payroll"},
    "pe": {"targetId":"pw","targetKind":"pay","targetRole":"owner","targetBranch":"","from.category":"payroll"},
    "oe": {"targetId":"s1","targetKind":"sale","to.meatCost":"8","to.boxes":"3"}
  }
  $manager$;
  -- [id, kind, lotId, values, error]: appended one by one as มีนบุรี dated 2026-09-10; '' is accepted.
  v_appends constant jsonb := $appends$
  [
    ["a1", "pay", "", {"category": "ingredient", "amount": "5"}, ""],
    ["a2", "pay", "", {"category": "", "amount": "5", "missing": "category"}, ""],
    ["x", "pay", "", {"category": "meat", "amount": "5"}, "Payment category is not allowed for this account"],
    ["x", "pay", "", {"category": "payroll", "amount": "5"}, "Payment category is not allowed for this account"],
    ["a3", "meatCount", "", {"kg": "4"}, ""],
    ["a4", "receive", "S1", {"kg": "2"}, ""],
    ["x", "receive", "S9", {"kg": "2"}, "Entry lot does not exist"],
    ["x", "thaw", "", {"kg": "1"}, "Entry kind is not allowed for this account"],
    ["x", "purchase", "", {"price": "1"}, "Entry kind is not allowed for this account"],
    ["x", "config", "", {"boxPrice": "1"}, "Entry kind is not allowed for this account"],
    ["e1", "entryEdit", "", {"targetId": "a1", "to.category": "other"}, ""],
    ["x", "entryEdit", "", {"targetId": "a1", "to.category": "meat"}, "Payment category is not allowed for this account"],
    ["x", "entryEdit", "", {"targetId": "ps", "to.qty": "1"}, "Edit target is not an entry of this branch"],
    ["x", "entryEdit", "", {"targetId": "s2", "to.boxes": "9"}, "Edit target is not an entry of this branch"],
    ["x", "entryEdit", "", {"targetId": "m0"}, "Edit target is not an entry of this branch"],
    ["x", "entryEdit", "", {"targetId": "tw"}, "Edit target is not an entry of this branch"],
    ["x", "entryEdit", "", {"targetId": "e1"}, "Edit target is not an entry of this branch"],
    ["x", "entryEdit", "", {"targetId": "nope"}, "Edit target is not an entry of this branch"],
    ["x", "entryEdit", "", {"targetId": "r0"}, "Entry is already deleted"],
    ["e2", "entryEdit", "S2", {"targetId": "r1", "fromLotId": "S1", "toLotId": "S2"}, ""],
    ["x", "entryEdit", "", {"targetId": "r1", "toLotId": "S9"}, "Edit cannot move an entry to another lot"],
    ["x", "entryEdit", "", {"targetId": "s1", "toLotId": "S2"}, "Edit cannot move an entry to another lot"],
    ["x", "entryEdit", "", {"targetId": "r1", "toDate": "2999-01-01"}, "Entry date is invalid or after today"],
    ["x", "void", "", {"targetId": "s2"}, "Void target is not an entry of this branch"],
    ["x", "void", "", {"targetId": "ov"}, "Void target is not an entry of this branch"],
    ["x", "void", "", {"targetId": "ps"}, "Void target is not an entry of this branch"],
    ["x", "void", "", {"targetId": "nope"}, "Void target is not an entry of this branch"],
    ["x", "void", "", {"targetId": "r0"}, "Entry is already deleted"],
    ["v1", "void", "", {"targetId": "mc"}, ""],
    ["x", "void", "", {"targetId": "mc"}, "Entry is already deleted"],
    ["v2", "void", "", {"targetId": "v1"}, ""],
    ["x", "void", "", {"targetId": "v2"}, "An undo cannot be undone"],
    ["v3", "void", "", {"targetId": "e1"}, ""],
    ["x", "void", "", {"targetId": "v3"}, "An undo cannot be undone"],
    ["v4", "void", "", {"targetId": "tw"}, ""]
  ]
  $appends$;
  -- [entry, error]: appended one by one by the Account Manager to the copy it loaded.
  v_saves constant jsonb := $saves$
  [
    [{"id": "n1", "kind": "pay", "role": "owner", "values": {"category": "rent", "amount": "1"}}, ""],
    [{"id": "x", "kind": "sale", "role": "branch", "branch": "มีนบุรี", "values": {"boxes": "1"}}, "Entry kind is not allowed for this account"],
    [{"id": "x", "kind": "pay", "role": "owner", "values": {"category": "payroll", "amount": "1"}}, "Entry kind is not allowed for this account"],
    [{"id": "x", "kind": "entryEdit", "role": "owner", "values": {"targetId": "n1", "targetKind": "pay", "to.category": "payroll"}}, "Entry kind is not allowed for this account"],
    [{"id": "x", "kind": "entryEdit", "role": "owner", "values": {"targetId": "s1", "targetKind": "sale", "to.boxes": "3"}}, "Entry kind is not allowed for this account"],
    [{"id": "x", "kind": "entryEdit", "role": "owner", "values": {"targetId": "s1", "to.boxes": "3"}}, "Entry kind is not allowed for this account"],
    [{"id": "x", "kind": "void", "role": "owner", "values": {"targetId": "pw", "targetKind": "pay"}}, "Entry kind is not allowed for this account"],
    [{"id": "x", "kind": "void", "role": "owner", "values": {"targetId": "pv", "targetKind": "void"}}, "Entry kind is not allowed for this account"],
    [{"id": "x", "kind": "void", "role": "owner", "values": {"targetId": "oe", "targetKind": "entryEdit"}}, "Entry kind is not allowed for this account"],
    [{"id": "x", "kind": "config", "role": "owner", "values": {"boxPrice": "1"}}, "Only the Owner changes settings"],
    [{"id": "x", "kind": "meatCount", "role": "branch", "branch": "มีนบุรี", "values": {"kg": "2"}}, "Only a branch account writes a branch's notes"],
    [{"id": "x", "kind": "entryEdit", "role": "owner", "values": {"targetId": "r1", "targetKind": "receive", "to.kg": "4"}}, "Only a branch account writes a branch's notes"],
    [{"id": "x", "kind": "void", "role": "owner", "values": {"targetId": "mc", "targetKind": "meatCount"}}, "Only a branch account writes a branch's notes"],
    [{"id": "x", "kind": "void", "role": "owner", "values": {"targetId": "ov", "targetKind": "void"}}, "Only a branch account writes a branch's notes"],
    [{"id": "n3", "kind": "void", "role": "owner", "values": {"targetId": "ps", "targetKind": "pay"}}, ""]
  ]
  $saves$;
begin
  create or replace function auth.uid() returns uuid language sql stable
    as $f$ select nullif(current_setting('test.uid', true), '')::uuid $f$;
  insert into auth.users (id, email) values (v_owner, 'owner@example.invalid'),
    (v_mgr, 'manager@example.invalid'), (v_branch, 'minburi@example.invalid');
  insert into profiles (id, display_name, role, is_active) values
    (v_owner, 'owner', 'L1_OWNER', true), (v_mgr, 'manager', 'L1_MANAGER', true),
    (v_branch, 'minburi', 'L2_BRANCH_ADMIN', true)
    on conflict (id) do update set role = excluded.role, is_active = true;
  insert into locations (code, name_th, kind) values ('MB-TEST', 'สาขามีนบุรี', 'BRANCH') returning id into v_loc;
  insert into user_locations (profile_id, location_id) values (v_branch, v_loc);
  -- The log as both accounts left it: written straight to the table, since no one account's
  -- save holds entries of both the Owner and the Account Manager.
  insert into public.app_state (singleton, payload, revision, updated_by) values (true, v_state, v_rev, v_owner);

  -- scope_app_state: only what the branch may see, cut down.
  select jsonb_agg(jsonb_set(o, '{values}', b.pair -> 1) order by b.ord) into v_want
    from jsonb_array_elements(v_branch_sees) with ordinality b(pair, ord)
    join jsonb_array_elements(v_state -> 'entries') o on o ->> 'id' = b.pair ->> 0;
  v_seen := public.scope_app_state(v_state, array['มีนบุรี']);
  assert v_seen -> 'entries' = v_want, format('branch entries: %s', v_seen -> 'entries');
  assert v_seen -> 'lots' = '[
    {"id":"S1","poId":"SH-1","kind":"shipment","config":{"packKg":"0.12"},"values":{"note":"x"}},
    {"id":"S2","poId":"SH-2","kind":"shipment","config":{},"values":{}}]'::jsonb, format('branch lots: %s', v_seen -> 'lots');
  assert v_seen -> 'config' = '{"packKg":"0.12","materialList":"[]","rawRiceBranches":"[\"มีนบุรี\"]"}'::jsonb, format('branch config: %s', v_seen -> 'config');
  assert v_seen ->> 'version' = '9', 'branch version';
  -- Of the branches that count raw rice it is told its own alone (above), so nothing names the other.
  assert v_seen::text not like '%ศาลาแดง%', 'the branch copy names the other branch';
  assert public.scope_app_state(v_state, array['ศาลาแดง']) -> 'config' ->> 'rawRiceBranches' = '["ศาลาแดง"]', 'the other branch''s own flag';
  assert public.scope_app_state(v_state, '{}'::text[]) -> 'config' ->> 'rawRiceBranches' = '[]', 'no branch, no flag';
  assert not public.scope_app_state(jsonb_set(v_state, '{config,rawRiceBranches}', '"x"'), array['มีนบุรี']) -> 'config' ? 'rawRiceBranches',
    'an unreadable list is dropped';
  assert public.scope_app_state(v_state, '{}'::text[]) -> 'entries' = '[]'::jsonb, 'an account with no branch sees entries';
  perform set_config('test.uid', v_branch::text, true);
  assert (select l.payload from public.load_app_state() l) = v_seen, 'branch load is not its scoped copy';

  -- manager_strip_entries: no sale money, payroll as stubs, everything else whole.
  select jsonb_agg(jsonb_set(o, '{values}', coalesce(v_manager_sees -> (o ->> 'id'), o -> 'values')) order by ord) into v_want
    from jsonb_array_elements(v_state -> 'entries') with ordinality t(o, ord);
  v_seen := public.manager_strip_entries(v_state -> 'entries');
  assert v_seen = v_want, format('manager entries: %s', v_seen);
  perform set_config('test.uid', v_mgr::text, true);
  select l.payload into v_seen from public.load_app_state() l;
  assert v_seen = jsonb_set(v_state, '{entries}', v_want), 'manager load is not its stripped copy';
  assert v_seen::text !~ '"(to\.|from\.)?(revenue|lineMan|menuTotal|sales\.[^"]*)"', format('manager load leaks sale money: %s', v_seen);
  assert v_seen::text !~ '25000|26000|"employee"', format('manager load leaks payroll: %s', v_seen);
  perform set_config('test.uid', v_owner::text, true);
  assert (select l.payload from public.load_app_state() l) = v_state, 'owner load changed';

  -- manager_hidden: managerHidden in store/visibility.ts.
  assert public.manager_hidden('{"kind":"sale"}', null) and public.manager_hidden('{"kind":"pay","values":{"category":"payroll"}}', null)
    and public.manager_hidden('{"kind":"entryEdit","values":{"from.category":"payroll"}}', null)
    and public.manager_hidden('{"kind":"void","values":{"targetKind":"sale"}}', null)
    and public.manager_hidden('{"kind":"void","values":{}}', '{"kind":"pay","values":{"category":"payroll"}}'), 'manager_hidden misses one';
  assert not public.manager_hidden('{"kind":"pay","values":{"category":"rent"}}', null)
    and not public.manager_hidden('{"kind":"void","values":{}}', '{"kind":"pay","values":{"category":"rent"}}')
    and not public.manager_hidden(null, null), 'manager_hidden hides too much';

  -- append_entries, as มีนบุรี.
  perform set_config('test.uid', v_branch::text, true);
  for v_case in select x from jsonb_array_elements(v_appends) with ordinality t(x, ord) order by ord loop
    v_err := '';
    begin
      v_rev := public.append_entries(v_rev, jsonb_build_array(jsonb_build_object('id', v_case ->> 0, 'kind', v_case ->> 1,
        'role', 'branch', 'lotId', v_case ->> 2, 'branch', 'มีนบุรี', 'date', '2026-09-10', 'values', v_case -> 3)));
    exception when others then v_err := sqlerrm;
    end;
    assert v_err = v_case ->> 4, format('append %s: got %s', v_case, v_err);
  end loop;
  -- Who it says it is from is the account's: no actor, its role, its own branch, no lot.
  foreach v_case in array array[
    '[{"actor":"owner"}, "Entry actor does not match signed-in account"]',
    '[{"role":"owner"}, "Entry role does not match signed-in account"]',
    '[{"branch":"ศาลาแดง"}, "Entry branch does not match signed-in account"]',
    '[{"date":"2999-01-01"}, "Entry date is invalid or after today"]']::jsonb[] loop
    v_err := '';
    begin
      perform public.append_entries(v_rev, jsonb_build_array('{"id":"z1","kind":"meatCount","role":"branch","lotId":"",
        "branch":"มีนบุรี","date":"2026-09-10","values":{"kg":"1"}}'::jsonb || (v_case -> 0)));
    exception when others then v_err := sqlerrm;
    end;
    assert v_err = v_case ->> 1, format('append %s: got %s', v_case, v_err);
  end loop;
  v_err := '';
  begin
    perform public.append_entries(v_rev, '[]'::jsonb, '[{"id":"S1","values":{"note":"mine"}}]'::jsonb);
  exception when others then v_err := sqlerrm;
  end;
  assert v_err = 'Only an owner can change lots', format('branch lot change: got %s', v_err);
  select l.payload into v_seen from public.load_app_state() l;
  assert (select string_agg(e ->> 'id', ',' order by ord) from jsonb_array_elements(v_seen -> 'entries') with ordinality t(e, ord))
    = 's1,r1,r0,ov,m0,ps,pse,psv,pb,oe,mc,a1,a2,a3,a4,e1,e2,v1,v2,v3', format('branch load after its appends: %s', v_seen -> 'entries');

  -- save_app_state, as the Account Manager, from the copy it loads.
  perform set_config('test.uid', v_mgr::text, true);
  for v_case in select x from jsonb_array_elements(v_saves) with ordinality t(x, ord) order by ord loop
    select l.payload into v_seen from public.load_app_state() l;
    v_err := '';
    begin
      select s.revision into v_rev from public.save_app_state(jsonb_set(v_seen, '{entries}', (v_seen -> 'entries')
        || jsonb_build_array('{"lotId":"","branch":"","date":"2026-09-10"}'::jsonb || (v_case -> 0) || '{"actor":"manager"}'::jsonb)), v_rev) s;
    exception when others then v_err := sqlerrm;
    end;
    assert v_err = v_case ->> 1, format('manager save %s: got %s', v_case, v_err);
  end loop;
  select l.payload into v_seen from public.load_app_state() l;
  -- Settings are the Owner's, and stored history is not the manager's to change.
  v_err := '';
  begin
    perform public.save_app_state(jsonb_set(v_seen, '{config,boxPrice}', '"1"'), v_rev);
  exception when others then v_err := sqlerrm;
  end;
  assert v_err = 'Only the Owner changes settings', format('manager config: got %s', v_err);
  v_err := '';
  begin
    perform public.save_app_state(jsonb_set(v_seen, '{entries,0,values,boxes}', '"9"'), v_rev);
  exception when others then v_err := sqlerrm;
  end;
  assert v_err = 'Existing history cannot be changed', format('manager history: got %s', v_err);
  v_err := '';
  begin
    perform public.save_app_state(jsonb_set(v_seen, '{entries,6,values,category}', '"rent"'), v_rev);
  exception when others then v_err := sqlerrm;
  end;
  assert v_err = 'Existing history cannot be changed', format('manager payroll stub: got %s', v_err);

  -- The manager's saves kept what its copy did not hold.
  perform set_config('test.uid', v_owner::text, true);
  select l.payload into v_seen from public.load_app_state() l;
  assert v_seen -> 'entries' -> 0 = v_state -> 'entries' -> 0 and v_seen -> 'entries' -> 6 = v_state -> 'entries' -> 6
    and v_seen -> 'entries' -> 14 = v_state -> 'entries' -> 14, 'a manager save changed sale money or a payroll payment';
  assert (select string_agg(e ->> 'id', ',' order by ord) from jsonb_array_elements(v_seen -> 'entries') with ordinality t(e, ord))
    like '%,cf,a1,a2,a3,a4,e1,e2,v1,v2,v3,v4,n1,n3', 'the log is not what was appended';
  v_err := '';
  begin
    perform public.save_app_state(jsonb_set(v_seen, '{entries}', (v_seen -> 'entries') || '[
      {"id":"o4","kind":"pay","role":"owner","actor":"owner","lotId":"","branch":"","date":"2026-09-10","values":{}}]'::jsonb), v_rev);
  exception when others then v_err := sqlerrm;
  end;
  assert v_err = 'Entry actor does not match signed-in account', format('owner actor on its own entry: got %s', v_err);
  -- A branch's notes are the branch's: the Owner jots none (stamped "owner" or not), changes none
  -- and undoes no change to one (oe is its old edit of s1).
  foreach v_case in array array[
    '{"kind":"sale","role":"branch","actor":"owner","branch":"ศาลาแดง","values":{"boxes":"1","lineMan":"350"}}',
    '{"kind":"receive","role":"branch","branch":"ศาลาแดง","values":{"kg":"1"}}',
    '{"kind":"entryEdit","role":"owner","values":{"targetId":"s1","targetKind":"sale","to.boxes":"3"}}',
    '{"kind":"void","role":"owner","values":{"targetId":"mc","targetKind":"meatCount"}}',
    '{"kind":"void","role":"owner","values":{"targetId":"oe","targetKind":"entryEdit"}}']::jsonb[] loop
    v_err := '';
    begin
      perform public.save_app_state(jsonb_set(v_seen, '{entries}', (v_seen -> 'entries')
        || jsonb_build_array('{"id":"o1","lotId":"","branch":"","date":"2026-09-10"}'::jsonb || v_case)), v_rev);
    exception when others then v_err := sqlerrm;
    end;
    assert v_err = 'Only a branch account writes a branch''s notes', format('owner save %s: got %s', v_case, v_err);
  end loop;
  -- Its own notes and settings it saves.
  select s.revision into v_rev from public.save_app_state(jsonb_set(jsonb_set(v_seen, '{config,boxPrice}', '"360"'), '{entries}', (v_seen -> 'entries') || '[
    {"id":"o2","kind":"pay","role":"owner","lotId":"","branch":"","date":"2026-09-10","values":{"category":"payroll","amount":"9"}},
    {"id":"o3","kind":"config","role":"owner","lotId":"","branch":"","date":"2026-09-10","values":{"boxPrice":"360"}}]'::jsonb), v_rev) s;

  -- Nobody but the Owner selects app_state directly.
  set local role authenticated;
  select count(*) into v_n from public.app_state;
  assert v_n = 1, 'owner lost its direct read on app_state';
  perform set_config('test.uid', v_mgr::text, true);
  select count(*) into v_n from public.app_state;
  assert v_n = 0, 'manager can select app_state directly';
  perform set_config('test.uid', v_branch::text, true);
  select count(*) into v_n from public.app_state;
  assert v_n = 0, 'branch can select app_state directly';
  reset role;

  assert not has_function_privilege('authenticated', 'public.scope_app_state(jsonb, text[])', 'execute')
    and not has_function_privilege('authenticated', 'public.manager_hidden(jsonb, jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.manager_strip_values(jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.manager_strip_entries(jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.manager_restore_entries(jsonb, jsonb)', 'execute'), 'a helper is callable';
  assert not has_function_privilege('anon', 'public.append_entries(bigint, jsonb, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.save_app_state(jsonb, bigint)', 'execute')
    and not has_function_privilege('anon', 'public.load_app_state()', 'execute'), 'anon can call an RPC';
  assert has_function_privilege('authenticated', 'public.append_entries(bigint, jsonb, jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.save_app_state(jsonb, bigint)', 'execute')
    and has_function_privilege('authenticated', 'public.load_app_state()', 'execute'), 'authenticated cannot call an RPC';
  assert to_regprocedure('public.strip_sale_money(jsonb)') is null and to_regprocedure('public.strip_sale_money_entries(jsonb)') is null
    and to_regprocedure('public.restore_sale_money(jsonb, jsonb, jsonb)') is null
    and to_regprocedure('public.current_sale_money(jsonb, text)') is null and to_regprocedure('public.sale_money_number(text)') is null
    and to_regprocedure('public.branch_day_closed(jsonb, text, text)') is null, 'a dropped helper is still there';

  raise exception 'V2_APP_STATE_TEST_PASSED';
end $$;

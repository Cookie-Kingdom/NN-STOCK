-- Migration 20261001000039: a branch edits, deletes and restores its own live entries directly,
-- nobody else's, and an undo is not undone; entry_voided reads a restored delete as live.
-- tests/unit/localDbBranchVoid.test.ts runs appendState (the JS port) on the same state and cases,
-- read from this file by their dollar-quote tags.
-- Run:  psql "$DATABASE_URL" -f supabase/tests/branch_direct_changes_test.sql

do $$
declare
  v_owner  uuid := gen_random_uuid();
  v_branch uuid := gen_random_uuid();
  v_loc    uuid;
  v_rev    bigint;
  v_err    text;
  v_text   text;
  v_case   jsonb;
  v_log    jsonb;
  -- r0 is deleted by the Owner (ov); q0 is a request from before 0039.
  v_state constant jsonb := $state$
  {"lots": [{"id":"S1","poId":"SH-1","kind":"shipment","config":{},"values":{}}],
   "entries": [
    {"id":"r1","kind":"receive","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-01","values":{"kg":"3"}},
    {"id":"r0","kind":"receive","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-01","values":{"kg":"1"}},
    {"id":"sd","kind":"receive","role":"branch","lotId":"","branch":"ศาลาแดง","date":"2026-09-01","values":{"kg":"3"}},
    {"id":"o1","kind":"allocate","role":"owner","lotId":"S1","branch":"มีนบุรี","date":"2026-09-01","values":{"kg":"3"}},
    {"id":"m0","kind":"materials","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-01","values":{}},
    {"id":"q0","kind":"editRequest","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-01","values":{"targetId":"r1"}},
    {"id":"ov","kind":"void","role":"owner","lotId":"","branch":"มีนบุรี","date":"2026-09-01","values":{"targetId":"r0"}}
  ]}
  $state$;
  -- [id, kind, values, error]: appended one by one as มีนบุรี dated 2026-09-10; '' is accepted.
  v_cases constant jsonb := $cases$
  [
    ["cd1", "closeDay", {"confirm": "x"}, ""],
    ["ed1", "entryEdit", {"targetId": "r1", "to.kg": "2"}, ""],
    ["x", "entryEdit", {"targetId": "sd", "to.kg": "2"}, "Edit target is not an entry of this branch"],
    ["x", "entryEdit", {"targetId": "o1", "to.kg": "2"}, "Edit target is not an entry of this branch"],
    ["x", "entryEdit", {"targetId": "m0"}, "Edit target is not an entry of this branch"],
    ["x", "entryEdit", {"targetId": "ed1"}, "Edit target is not an entry of this branch"],
    ["x", "entryEdit", {"targetId": "nope"}, "Edit target is not an entry of this branch"],
    ["x", "entryEdit", {}, "Edit target is not an entry of this branch"],
    ["x", "entryEdit", {"targetId": "r0"}, "Entry is already deleted"],
    ["x", "entryEdit", {"targetId": "r1", "toLotId": "S1"}, "Edit cannot move an entry to another lot"],
    ["x", "entryEdit", {"targetId": "r1", "toDate": "2999-01-01"}, "Entry date is invalid or after today"],
    ["x", "entryEdit", {"targetId": "r1", "toDate": "yesterday"}, "Entry date is invalid or after today"],
    ["ed2", "entryEdit", {"targetId": "r1", "to.kg": "1", "toDate": "2026-09-09", "toLotId": ""}, ""],
    ["x", "void", {"targetId": "sd"}, "Void target is not an entry of this branch"],
    ["x", "void", {"targetId": "o1"}, "Void target is not an entry of this branch"],
    ["x", "void", {"targetId": "ov"}, "Void target is not an entry of this branch"],
    ["x", "void", {"targetId": "q0"}, "Void target is not an entry of this branch"],
    ["x", "void", {"targetId": "nope"}, "Void target is not an entry of this branch"],
    ["x", "void", {"targetId": "r0"}, "Entry is already deleted"],
    ["un2", "void", {"targetId": "ed2"}, ""],
    ["x", "void", {"targetId": "ed2"}, "Entry is already deleted"],
    ["x", "void", {"targetId": "un2"}, "An undo cannot be undone"],
    ["lk1", "link", {"targetId": "r1", "lotId": "S1"}, ""],
    ["un3", "void", {"targetId": "lk1"}, ""],
    ["x", "void", {"targetId": "un3"}, "An undo cannot be undone"],
    ["dl1", "void", {"targetId": "r1"}, ""],
    ["x", "void", {"targetId": "r1"}, "Entry is already deleted"],
    ["x", "entryEdit", {"targetId": "r1", "to.kg": "2"}, "Entry is already deleted"],
    ["bk1", "void", {"targetId": "dl1"}, ""],
    ["x", "void", {"targetId": "dl1"}, "Entry is already deleted"],
    ["x", "void", {"targetId": "bk1"}, "An undo cannot be undone"],
    ["ed3", "entryEdit", {"targetId": "r1", "to.kg": "2"}, ""],
    ["dl2", "void", {"targetId": "r1"}, ""],
    ["dl0", "void", {"targetId": "m0"}, ""],
    ["x", "editRequest", {"targetId": "r1"}, "Entry kind is not allowed for this account"],
    ["m1", "materialConfirm", {"transferId": "t1"}, ""],
    ["m2", "materialConfirm", {}, ""],
    ["x", "entryEdit", {"targetId": "m2", "to.transferId": "t1"}, "Material transfer is already confirmed"],
    ["em2", "entryEdit", {"targetId": "m2", "to.transferId": "t2"}, ""],
    ["x", "materialConfirm", {"transferId": "t2"}, "Material transfer is already confirmed"],
    ["x", "link", {"targetId": "m1", "transferId": "t2"}, "Material transfer is already confirmed"],
    ["em1", "entryEdit", {"targetId": "m1", "to.transferId": "t1"}, ""],
    ["un4", "void", {"targetId": "em2"}, ""],
    ["m3", "materialConfirm", {"transferId": "t2"}, ""],
    ["x", "entryEdit", {"targetId": "m2", "to.transferId": "t2"}, "Material transfer is already confirmed"]
  ]
  $cases$;
begin
  create or replace function auth.uid() returns uuid language sql stable
    as $f$ select nullif(current_setting('test.uid', true), '')::uuid $f$;
  insert into auth.users (id, email) values (v_owner, 'owner@example.invalid'), (v_branch, 'minburi@example.invalid');
  insert into profiles (id, display_name, role, is_active) values
    (v_owner, 'owner', 'L1_OWNER', true), (v_branch, 'minburi', 'L2_BRANCH_ADMIN', true)
    on conflict (id) do update set role = excluded.role, is_active = true;
  insert into locations (code, name_th, kind) values ('MB-DIRECT', 'สาขามีนบุรี', 'BRANCH') returning id into v_loc;
  insert into user_locations (profile_id, location_id) values (v_branch, v_loc);

  perform set_config('test.uid', v_owner::text, true);
  select s.revision into v_rev from public.save_app_state(
    jsonb_build_object('version', 9, 'config', '{}'::jsonb) || v_state, null) s;
  perform set_config('test.uid', v_branch::text, true);

  for v_case in select x from jsonb_array_elements(v_cases) with ordinality t(x, ord) order by ord loop
    v_err := '';
    begin
      select public.append_entries(v_rev, jsonb_build_array(jsonb_build_object('id', v_case ->> 0,
        'kind', v_case ->> 1, 'role', 'branch', 'lotId', '', 'branch', 'มีนบุรี', 'date', '2026-09-10',
        'values', v_case -> 2))) into v_rev;
    exception when others then v_err := sqlerrm; end;
    assert v_err = v_case ->> 3, format('%s: %s', v_case, v_err);
  end loop;

  -- What reads as deleted afterwards (isVoided in the unit test): r1 by dl2, not by the restored dl1.
  select payload -> 'entries' into v_log from public.app_state;
  select string_agg(e ->> 'id', ',' order by ord) into v_text
    from jsonb_array_elements(v_log) with ordinality t(e, ord) where public.entry_voided(v_log, e);
  assert v_text = 'r1,r0,m0,ed2,lk1,dl1,em2', format('voided: %s', v_text);

  raise exception 'BRANCH_DIRECT_CHANGES_TEST_PASSED';
end $$;

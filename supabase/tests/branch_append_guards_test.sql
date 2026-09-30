-- Migration 20260929000034: append_entries refuses a branch entry dated after today, one on a
-- closed branch day (an edit request excepted) and a link to an entry that is not its branch's.
-- Run:  psql "$DATABASE_URL" -f supabase/tests/branch_append_guards_test.sql

do $$
declare
  v_owner  uuid := gen_random_uuid();
  v_branch uuid := gen_random_uuid();
  v_loc    uuid;
  v_rev    bigint;
  v_err    text;
  v_stored jsonb;
  v_entries constant jsonb := '[
    {"id":"o1","kind":"central","role":"owner","lotId":"S1","branch":"ศาลาแดง","date":"2026-09-01","values":{}},
    {"id":"sd","kind":"receive","role":"branch","lotId":"","branch":"ศาลาแดง","date":"2026-09-01","values":{"kg":"3"}},
    {"id":"mb","kind":"receive","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-01","values":{"kg":"3"}}
  ]';
begin
  create or replace function auth.uid() returns uuid language sql stable
    as $f$ select nullif(current_setting('test.uid', true), '')::uuid $f$;
  insert into auth.users (id, email) values (v_owner, 'owner@example.invalid'), (v_branch, 'minburi@example.invalid');
  insert into profiles (id, display_name, role, is_active) values
    (v_owner, 'owner', 'L1_OWNER', true), (v_branch, 'minburi', 'L2_BRANCH_ADMIN', true)
    on conflict (id) do update set role = excluded.role, is_active = true;
  insert into locations (code, name_th, kind) values ('MB-GUARD', 'สาขามีนบุรี', 'BRANCH') returning id into v_loc;
  insert into user_locations (profile_id, location_id) values (v_branch, v_loc);

  perform set_config('test.uid', v_owner::text, true);
  select s.revision into v_rev from public.save_app_state(jsonb_build_object('version', 9, 'config', '{}'::jsonb,
    'lots', '[{"id":"S1","poId":"SH-1","kind":"shipment","config":{},"values":{}}]'::jsonb, 'entries', v_entries), null) s;
  perform set_config('test.uid', v_branch::text, true);

  -- No date after today (Asia/Bangkok), and none that is not a day.
  v_err := null;
  begin perform public.append_entries(v_rev,
    '[{"id":"f1","kind":"receive","role":"branch","lotId":"","branch":"มีนบุรี","date":"2999-01-01","values":{}}]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Entry date is invalid or after today', format('future date: %s', v_err);
  v_err := null;
  begin perform public.append_entries(v_rev,
    '[{"id":"f1","kind":"receive","role":"branch","lotId":"","branch":"มีนบุรี","values":{}}]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Entry date is invalid or after today', format('no date: %s', v_err);

  -- A link only to the branch's own entry: not another branch's, not the Owner's.
  v_err := null;
  begin perform public.append_entries(v_rev,
    '[{"id":"l1","kind":"link","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-02","values":{"targetId":"sd","lotId":"S1"}}]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Link target is not an entry of this branch', format('link other branch: %s', v_err);
  v_err := null;
  begin perform public.append_entries(v_rev,
    '[{"id":"l1","kind":"link","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-02","values":{"targetId":"o1","lotId":"S1"}}]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Link target is not an entry of this branch', format('link owner entry: %s', v_err);
  select public.append_entries(v_rev,
    '[{"id":"l1","kind":"link","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-02","values":{"targetId":"mb","lotId":"S1"}}]'::jsonb)
    into v_rev;

  -- A closed day takes nothing but an edit request, also within the same save; an unlock reopens it.
  v_err := null;
  begin perform public.append_entries(v_rev, '[
    {"id":"c1","kind":"closeDay","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-03","values":{}},
    {"id":"r1","kind":"receive","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-03","values":{}}]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Branch day is closed', format('closed in same save: %s', v_err);
  select public.append_entries(v_rev,
    '[{"id":"c1","kind":"closeDay","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-03","values":{}}]'::jsonb)
    into v_rev;
  v_err := null;
  begin perform public.append_entries(v_rev,
    '[{"id":"r1","kind":"receive","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-03","values":{}}]'::jsonb);
  exception when others then v_err := sqlerrm; end;
  assert v_err = 'Branch day is closed', format('closed day: %s', v_err);
  select public.append_entries(v_rev,
    '[{"id":"q1","kind":"editRequest","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-03","values":{"targetId":"mb"}}]'::jsonb)
    into v_rev;
  select public.append_entries(v_rev,
    '[{"id":"r2","kind":"receive","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-04","values":{}}]'::jsonb)
    into v_rev;

  perform set_config('test.uid', v_owner::text, true);
  select payload into v_stored from public.app_state;
  select s.revision into v_rev from public.save_app_state(jsonb_set(v_stored, '{entries}', (v_stored -> 'entries') ||
    '[{"id":"u1","kind":"unlock","role":"owner","lotId":"","branch":"มีนบุรี","date":"2026-09-03","values":{}}]'::jsonb), v_rev) s;
  perform set_config('test.uid', v_branch::text, true);
  select public.append_entries(v_rev,
    '[{"id":"r1","kind":"receive","role":"branch","lotId":"","branch":"มีนบุรี","date":"2026-09-03","values":{}}]'::jsonb)
    into v_rev;

  raise exception 'BRANCH_APPEND_GUARDS_TEST_PASSED';
end $$;

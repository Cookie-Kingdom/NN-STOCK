-- Failure-case test: no function in public raises a serialization/deadlock SQLSTATE.
--
-- PostgREST 14 treats 40001 (serialization_failure) and 40P01 (deadlock_detected) as
-- retryable and re-runs the whole transaction. A function that raises one of them on purpose
-- (save_app_state's stale-revision check did) fails the same way on every retry, so the
-- request never ends and pins the database CPU. Raise a PostgREST custom code such as PT409
-- instead (migration 20260924000022).
--
-- Run:  psql "$DATABASE_URL" -f supabase/tests/no_serialization_errcode_test.sql

do $$
declare
  v_bad text;
  v_n   bigint;
begin
  select string_agg(format('%s(%s)', p.proname, pg_get_function_identity_arguments(p.oid)), ', '
                    order by p.proname), count(*)
    into v_bad, v_n
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and (p.prosrc like '%40001%' or p.prosrc like '%40P01%');
  assert v_n = 0,
    format('PostgREST retries 40001/40P01 forever; %s function(s) raise one: %s', v_n, v_bad);

  raise exception 'NO_SERIALIZATION_ERRCODE_TEST_PASSED';   -- the only clean way back out
end $$;

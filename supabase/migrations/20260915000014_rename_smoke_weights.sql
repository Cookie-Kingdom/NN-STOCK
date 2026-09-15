-- Smoke weights renamed in stored history: "preKg" -> "preSmokeKg", "outputKg" -> "postSmokeKg".
-- Keys live in entry/lot values and, JSON-escaped, inside chefEdit "batches" strings.
-- Ship together with the app build that uses the new names: each build only reads its own spelling.
-- ponytail: plain text replace, same as 20260915000011; a user-typed note containing exactly "preKg" would change too.

update public.app_state
set payload = replace(replace(replace(replace(payload::text,
      '"preKg"', '"preSmokeKg"'),
      '\"preKg\"', '\"preSmokeKg\"'),
      '"outputKg"', '"postSmokeKg"'),
      '\"outputKg\"', '\"postSmokeKg\"')::jsonb,
    -- Open clients hold the old revision, so their next save reloads instead of writing old names back.
    revision = revision + 1,
    updated_at = now()
where payload::text like '%preKg%' or payload::text like '%outputKg%';

do $$ begin
  if exists (select 1 from public.app_state where payload::text like '%preKg\\"%' or payload::text like '%outputKg\\"%'
                                               or payload::text like '%"preKg"%' or payload::text like '%"outputKg"%') then
    raise exception 'Smoke weight rename left old keys in app_state';
  end if;
end $$;

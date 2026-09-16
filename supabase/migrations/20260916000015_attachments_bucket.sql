-- Invoice attachments used to live only in the uploader's browser (IndexedDB),
-- so "ดาวน์โหลด" on any other device found nothing (QA-REPORT BUG-5). The
-- `attachments` bucket is the shared copy; objects are named `<uuid>/<file name>`.
-- Guarded so the plain-postgres migration test (no storage schema) still passes.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present, skipping attachments bucket';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit)
  values ('attachments', 'attachments', false, 20971520)
  on conflict (id) do nothing;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'attachments_read_active') then
    execute $p$
      create policy attachments_read_active on storage.objects for select to authenticated using (
        bucket_id = 'attachments'
        and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active)
      )
    $p$;
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'attachments_insert_active') then
    execute $p$
      create policy attachments_insert_active on storage.objects for insert to authenticated with check (
        bucket_id = 'attachments'
        and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active)
      )
    $p$;
  end if;
end $$;

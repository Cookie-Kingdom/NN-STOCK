-- Review 24-09-2026 PERF-01 / DB-09 / INC-03: the company logo was a data URL in
-- `config.logoData` (up to ~1.4 MB), copied into every `config` entry of the
-- append-only log and into `lot.config` of every new PO and shipment.
--
-- New logos go to the `attachments` bucket as `branding/<uuid>/<file name>`
-- (src/lib/attachment-store.ts `saveLogo`) and config keeps only that key.
--
--   folder     written by        read by
--   branding   owner, manager    every active profile (POs are printed by
--                                owner, Foodiva and Chef House alike)
--
-- These policies sit beside the ones from 0024; permissive policies are OR'd, so
-- 0024 is left as it is. The bucket's allowed_mime_types (0024) already limit
-- uploads to png/jpeg/webp for images; the client accepts only those for a logo
-- (no SVG). No UPDATE/DELETE policy: a new logo is a new object.
-- Guarded so the plain-postgres migration test (no storage schema) still passes.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present, skipping branding policies';
    return;
  end if;

  drop policy if exists attachments_branding_read on storage.objects;
  drop policy if exists attachments_branding_insert on storage.objects;

  execute $p$
    create policy attachments_branding_read on storage.objects for select to authenticated using (
      bucket_id = 'attachments'
      and (storage.foldername(objects.name))[1] = 'branding'
      and exists (
        select 1 from public.profiles p
         where p.id = (select auth.uid()) and p.is_active
      )
    )
  $p$;

  execute $p$
    create policy attachments_branding_insert on storage.objects for insert to authenticated with check (
      bucket_id = 'attachments'
      and (storage.foldername(objects.name))[1] = 'branding'
      and lower(storage.extension(objects.name)) in ('png', 'jpg', 'jpeg', 'webp')
      and exists (
        select 1 from public.profiles p
         where p.id = (select auth.uid()) and p.is_active
           and p.role::text in ('L1_OWNER', 'L1_MANAGER')
      )
    )
  $p$;
end $$;

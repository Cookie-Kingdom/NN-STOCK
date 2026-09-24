-- Review 24-09-2026 APP-04, APP-08, DB-11: the `attachments` bucket took any file
-- type up to 20 MB, and every active profile could list and read every invoice,
-- packing list and payment slip in it.
--
-- New objects are named `<entry kind>/<uuid>/<file name>` (src/lib/attachment-store.ts),
-- so the first path segment says whose document it is. Who may write and read:
--
--   folder           written by               read by
--   foodivaConfirm   Foodiva (meat invoice)    owner, manager, Foodiva
--   packingList      Foodiva                   owner, manager, Foodiva, Chef House
--   smokingInvoice   Chef House                owner, manager, Chef House
--   invoicePayment   owner, manager (slips)    owner, manager, Chef House
--   meatPayment      owner, manager (slips)    owner, manager
--   legacy           owner, manager            owner, manager
--
-- Owner and manager may write any of those folders and read everything, including
-- objects from before this migration (`<uuid>/<file name>`). Anyone may still read
-- an object they uploaded themselves. Branches upload nothing and read nothing else.
-- No UPDATE/DELETE policy, as before: files cannot be overwritten or removed.
-- Guarded so the plain-postgres migration test (no storage schema) still passes.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present, skipping attachments policies';
    return;
  end if;

  -- The types src/lib/attachment-store.ts uploads as. No HTML or SVG.
  update storage.buckets
     set allowed_mime_types = array[
           'application/pdf',
           'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
           'text/csv',
           'application/vnd.ms-excel',
           'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
         ],
         file_size_limit = 10485760
   where id = 'attachments';

  drop policy if exists attachments_read_active on storage.objects;
  drop policy if exists attachments_insert_active on storage.objects;
  drop policy if exists attachments_read_by_role on storage.objects;
  drop policy if exists attachments_insert_by_role on storage.objects;

  execute $p$
    create policy attachments_read_by_role on storage.objects for select to authenticated using (
      bucket_id = 'attachments'
      and exists (
        select 1 from public.profiles p
         where p.id = (select auth.uid()) and p.is_active
           and (
             p.role::text in ('L1_OWNER', 'L1_MANAGER')
             or objects.owner_id = (select auth.uid())::text
             or (p.role::text = 'L3_CM_OPERATOR'
                 and (storage.foldername(objects.name))[1] in ('packingList', 'smokingInvoice', 'invoicePayment'))
             or (p.role::text = 'L4_SUPPLIER'
                 and (storage.foldername(objects.name))[1] in ('foodivaConfirm', 'packingList'))
           )
      )
    )
  $p$;

  execute $p$
    create policy attachments_insert_by_role on storage.objects for insert to authenticated with check (
      bucket_id = 'attachments'
      and exists (
        select 1 from public.profiles p
         where p.id = (select auth.uid()) and p.is_active
           and (
             (p.role::text in ('L1_OWNER', 'L1_MANAGER')
              and (storage.foldername(objects.name))[1] in
                ('foodivaConfirm', 'packingList', 'smokingInvoice', 'invoicePayment', 'meatPayment', 'legacy'))
             or (p.role::text = 'L3_CM_OPERATOR'
                 and (storage.foldername(objects.name))[1] = 'smokingInvoice')
             or (p.role::text = 'L4_SUPPLIER'
                 and (storage.foldername(objects.name))[1] in ('foodivaConfirm', 'packingList'))
           )
      )
    )
  $p$;
end $$;

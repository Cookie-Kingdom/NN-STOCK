-- The `attachments` bucket: receipts and documents of the notes, and the company logo.
-- Private, 10 MB a file, the types src/lib/attachment-store.ts uploads as (no HTML or SVG).
-- Objects are named `<folder>/<uuid>/<file name>`; the folder is the entry kind, except a
-- payroll receipt, which goes to `payroll`, and a logo, which goes to `branding`.
--
--   folder                           written by              read by
--   purchase, pay, smokingInvoice,   Owner                   Owner, the uploader
--   packingList, the retired kinds
--   pay                              also a branch           Owner, the uploader
--   payroll                          Owner                   Owner
--   branding                         Owner                   every active profile
--
-- Permissive policies are OR'd. No UPDATE / DELETE policy: a file is never overwritten or
-- removed, a new logo is a new object.
-- Guarded so the plain-postgres migration test (no storage schema) still passes.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present, skipping the attachments bucket';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('attachments', 'attachments', false, 10485760, array[
           'application/pdf',
           'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
           'text/csv',
           'application/vnd.ms-excel',
           'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
         ])
  on conflict (id) do nothing;

  drop policy if exists attachments_read_by_role on storage.objects;
  drop policy if exists attachments_insert_by_role on storage.objects;
  drop policy if exists attachments_branding_read on storage.objects;
  drop policy if exists attachments_branding_insert on storage.objects;

  execute $p$
    create policy attachments_read_by_role on storage.objects for select to authenticated using (
      bucket_id = 'attachments'
      and exists (
        select 1 from public.profiles p
         where p.id = (select auth.uid()) and p.is_active
           and (p.role::text = 'L1_OWNER'
             or objects.owner_id = (select auth.uid())::text)
      )
    )
  $p$;
  execute $p$
    create policy attachments_insert_by_role on storage.objects for insert to authenticated with check (
      bucket_id = 'attachments'
      and exists (
        select 1 from public.profiles p
         where p.id = (select auth.uid()) and p.is_active
           and ((p.role::text = 'L1_OWNER' and (storage.foldername(objects.name))[1] in
               ('purchase', 'pay', 'foodivaConfirm', 'packingList', 'smokingInvoice', 'invoicePayment', 'meatPayment', 'legacy'))
             or (p.role::text = 'L1_OWNER' and (storage.foldername(objects.name))[1] = 'payroll')
             or (p.role::text = 'L2_BRANCH_ADMIN' and (storage.foldername(objects.name))[1] = 'pay'))
      )
    )
  $p$;

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
           and p.role::text = 'L1_OWNER'
      )
    )
  $p$;
end $$;

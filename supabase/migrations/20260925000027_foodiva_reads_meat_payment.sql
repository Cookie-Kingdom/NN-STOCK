-- Product owner decision 25-09-2026: the meat payment slip is evidence for both
-- sides, so Foodiva may read the Owner's slips for its meat invoices. Only the
-- read rule of 0024 changes; the insert rule stays (owner and manager are still
-- the only writers of `meatPayment/`).
--
--   folder           written by               read by
--   foodivaConfirm   Foodiva (meat invoice)    owner, manager, Foodiva
--   packingList      Foodiva                   owner, manager, Foodiva, Chef House
--   smokingInvoice   Chef House                owner, manager, Chef House
--   invoicePayment   owner, manager (slips)    owner, manager, Chef House
--   meatPayment      owner, manager (slips)    owner, manager, Foodiva      <- was owner, manager
--   legacy           owner, manager            owner, manager
--
-- Chef House and branches still read nothing under `meatPayment/`.
-- Guarded so the plain-postgres migration test (no storage schema) still passes.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present, skipping attachments read policy';
    return;
  end if;

  drop policy if exists attachments_read_by_role on storage.objects;

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
                 and (storage.foldername(objects.name))[1] in ('foodivaConfirm', 'packingList', 'meatPayment'))
           )
      )
    )
  $p$;
end $$;

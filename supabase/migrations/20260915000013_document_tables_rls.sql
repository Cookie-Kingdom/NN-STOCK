-- Migration 0008 created these four document tables after 0005 looped RLS over the existing
-- tables, so they were left readable/writable through the Data API. Restore deny-all (ADR-004);
-- the app reads and writes app_state only, so nothing depends on direct access.

alter table public.supplier_invoices enable row level security;
alter table public.supplier_tax_documents enable row level security;
alter table public.smoke_service_orders enable row level security;
alter table public.smoking_service_invoices enable row level security;

revoke all on public.supplier_invoices, public.supplier_tax_documents,
  public.smoke_service_orders, public.smoking_service_invoices from anon, authenticated;

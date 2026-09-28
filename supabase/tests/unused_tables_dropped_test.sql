-- Migration 0029 dropped the unused ERP tables. This checks none of them came back and
-- that the four tables the app actually uses are still there.
-- Run:  psql "$DATABASE_URL" -f supabase/tests/unused_tables_dropped_test.sql

do $$
declare
  v_bad text;
  v_n   bigint;
begin
  select string_agg(table_name, ', ' order by table_name), count(*)
    into v_bad, v_n
    from information_schema.tables
   where table_schema = 'public'
     and table_name in (
       'attendance', 'audit_log', 'branch_expenses', 'config_settings', 'daily_reports',
       'influencer_shipments', 'lot_bags', 'lot_receipts', 'lots', 'notifications', 'owner_expenses',
       'packaging_full_stock', 'packaging_items', 'physical_counts', 'po_deliveries', 'product_prices',
       'products', 'purchase_orders', 'rice_records', 'sales_lines', 'smoke_daily_log_sources',
       'smoke_daily_logs', 'smoke_date_groups', 'smoke_fee_tiers', 'smoke_service_orders',
       'smoking_service_invoices', 'staff', 'stock_ledger', 'supplier_invoices', 'supplier_tax_documents',
       'suppliers', 'thaw_records', 'transport_lines', 'transport_runs', 'unlock_requests', 'waste_records');
  assert v_n = 0, format('0029: %s dropped table(s) still exist: %s', v_n, v_bad);

  select count(*) into v_n
    from information_schema.tables
   where table_schema = 'public'
     and table_name in ('profiles', 'user_locations', 'locations', 'app_state');
  assert v_n = 4, format('0029: expected the 4 app tables, found %s', v_n);

  raise exception 'UNUSED_TABLES_DROPPED_PASSED';   -- the only clean way back out
end $$;

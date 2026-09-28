-- Drop the normalized ERP tables from migrations 0002-0005 and 0008. The app stores all
-- state as one JSON payload in app_state and only reads profiles, user_locations and
-- locations; every table below is empty and nothing in the app or in save_app_state /
-- append_entries references it. Their triggers, policies and FKs go with `cascade`.

drop table if exists
  attendance, audit_log, branch_expenses, config_settings, daily_reports,
  influencer_shipments, lot_bags, lot_receipts, lots, notifications, owner_expenses,
  packaging_full_stock, packaging_items, physical_counts, po_deliveries, product_prices,
  products, purchase_orders, rice_records, sales_lines, smoke_daily_log_sources,
  smoke_daily_logs, smoke_date_groups, smoke_fee_tiers, smoke_service_orders,
  smoking_service_invoices, staff, stock_ledger, supplier_invoices, supplier_tax_documents,
  suppliers, thaw_records, transport_lines, transport_runs, unlock_requests, waste_records
  cascade;

-- Functions that only served those tables (trigger functions and the transfer helper).
drop function if exists public.confirm_stock_transfer_line(uuid, public.item_type, numeric, uuid, uuid, uuid, text);
drop function if exists public.fn_stock_ledger_append_only();
drop function if exists public.fn_rollup_smoke_log_input();
drop function if exists public.fn_require_lot_for_meat();

-- Enums with no remaining column or function. user_role (profiles), location_kind and
-- rice_model (locations) stay.
drop type if exists
  unlock_target, unlock_status, transport_route, stock_state, report_status,
  notification_kind, movement_type, lot_state, item_type, freight_alloc, expense_kind;

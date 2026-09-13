-- Document module. Reuses purchase_orders, lots, transport_runs/lines,
-- smoke_daily_logs and the append-only stock_ledger as the source of truth.

alter type user_role add value if not exists 'L4_SUPPLIER';
alter type location_kind add value if not exists 'SUPPLIER_STORAGE';
alter type location_kind add value if not exists 'STEAK_PRODUCTION';
alter type item_type add value if not exists 'RAW_MEAT';
alter type item_type add value if not exists 'STEAK_RAW_MATERIAL';
alter type transport_route add value if not exists 'FOODIVA_TO_STEAK';

alter table suppliers
  add column if not exists address text,
  add column if not exists tax_id text,
  add column if not exists phone text;

alter table purchase_orders
  add column if not exists status text not null default 'DRAFT'
    check (status in ('DRAFT','APPROVED','SENT','PARTIAL_RECEIVED','COMPLETED','CANCELLED')),
  add column if not exists expected_delivery_date date,
  add column if not exists delivery_location_id uuid references locations(id),
  add column if not exists payment_terms text,
  add column if not exists vat_thb numeric(12,2) not null default 0 check (vat_thb >= 0),
  add column if not exists subtotal_thb numeric(12,2) check (subtotal_thb >= 0),
  add column if not exists grand_total_thb numeric(12,2) check (grand_total_thb >= 0),
  add column if not exists approved_by uuid references profiles(id),
  add column if not exists approved_at timestamptz,
  add column if not exists updated_by uuid references profiles(id),
  add column if not exists updated_at timestamptz;

-- Existing transport_runs/transport_lines are the stock transfer document.
alter table transport_runs
  add column if not exists transfer_number text unique,
  add column if not exists status text not null default 'DRAFT'
    check (status in ('DRAFT','IN_TRANSIT','RECEIVED','CANCELLED')),
  add column if not exists transfer_reason text,
  add column if not exists driver_name text,
  add column if not exists driver_phone text,
  add column if not exists vehicle_plate text,
  add column if not exists approved_by uuid references profiles(id),
  add column if not exists approved_at timestamptz,
  add column if not exists updated_by uuid references profiles(id),
  add column if not exists updated_at timestamptz;

create table if not exists supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  supplier_invoice_number text not null,
  invoice_date date not null,
  supplier_id uuid not null references suppliers(id),
  po_id uuid not null references purchase_orders(id),
  quantity_kg numeric(12,2) not null check (quantity_kg >= 0),
  amount_before_vat_thb numeric(12,2) not null default 0 check (amount_before_vat_thb >= 0),
  vat_thb numeric(12,2) not null default 0 check (vat_thb >= 0),
  total_amount_thb numeric(12,2) not null default 0 check (total_amount_thb >= 0),
  due_date date,
  payment_status text not null default 'UNPAID' check (payment_status in ('UNPAID','PARTIAL','PAID')),
  payment_date date,
  attachment_url text,
  note text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_by uuid references profiles(id),
  updated_at timestamptz,
  voided_at timestamptz,
  voided_by uuid references profiles(id),
  void_reason text,
  unique (supplier_id, supplier_invoice_number)
);

create table if not exists supplier_tax_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('TAX_INVOICE','RECEIPT','TAX_INVOICE_AND_RECEIPT')),
  document_number text not null,
  document_date date not null,
  supplier_id uuid not null references suppliers(id),
  supplier_invoice_id uuid references supplier_invoices(id),
  amount_thb numeric(12,2) not null default 0 check (amount_thb >= 0),
  vat_thb numeric(12,2) not null default 0 check (vat_thb >= 0),
  attachment_url text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references profiles(id),
  void_reason text,
  unique (supplier_id, document_number)
);

create table if not exists smoke_service_orders (
  id uuid primary key default gen_random_uuid(),
  smoke_order_number text not null unique,
  order_date date not null,
  smoker_name text not null,
  transport_line_id uuid references transport_lines(id),
  lot_id uuid not null references lots(id),
  raw_meat_quantity_kg numeric(12,2) not null check (raw_meat_quantity_kg > 0),
  requested_smoke_date date,
  service_rate_thb_per_kg numeric(12,2) not null default 0 check (service_rate_thb_per_kg >= 0),
  estimated_service_cost_thb numeric(12,2) not null default 0 check (estimated_service_cost_thb >= 0),
  special_instruction text,
  expected_finished_date date,
  status text not null default 'DRAFT'
    check (status in ('DRAFT','SENT','RECEIVED_BY_SMOKER','IN_PRODUCTION','COMPLETED','CANCELLED')),
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  updated_by uuid references profiles(id),
  updated_at timestamptz,
  voided_at timestamptz,
  voided_by uuid references profiles(id),
  void_reason text
);

alter table smoke_daily_logs
  add column if not exists smoke_batch_number text,
  add column if not exists smoke_order_id uuid references smoke_service_orders(id),
  add column if not exists updated_by uuid references profiles(id),
  add column if not exists updated_at timestamptz;
create unique index if not exists smoke_daily_logs_batch_number
  on smoke_daily_logs(smoke_batch_number) where smoke_batch_number is not null;

create table if not exists smoking_service_invoices (
  id uuid primary key default gen_random_uuid(),
  service_invoice_number text not null,
  invoice_date date not null,
  service_provider text not null,
  smoke_order_id uuid not null references smoke_service_orders(id),
  service_quantity_kg numeric(12,2) not null check (service_quantity_kg >= 0),
  service_rate_thb_per_kg numeric(12,2) not null default 0 check (service_rate_thb_per_kg >= 0),
  amount_before_vat_thb numeric(12,2) not null default 0 check (amount_before_vat_thb >= 0),
  vat_thb numeric(12,2) not null default 0 check (vat_thb >= 0),
  withholding_tax_thb numeric(12,2) not null default 0 check (withholding_tax_thb >= 0),
  net_payable_thb numeric(12,2) not null default 0 check (net_payable_thb >= 0),
  payment_status text not null default 'UNPAID' check (payment_status in ('UNPAID','PARTIAL','PAID')),
  payment_date date,
  attachment_url text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references profiles(id),
  void_reason text,
  unique (service_provider, service_invoice_number)
);

-- A confirmed transfer posts paired movement rows. Applications call this once
-- after the recipient confirms receipt; an idempotency key keeps retries safe.
create or replace function confirm_stock_transfer_line(
  p_line_id uuid,
  p_item_type item_type,
  p_received_weight_kg numeric,
  p_actor uuid,
  p_idempotency_out uuid,
  p_idempotency_in uuid,
  p_reason text default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_line transport_lines%rowtype; v_run transport_runs%rowtype;
begin
  select * into v_line from transport_lines where id = p_line_id for update;
  if not found then raise exception 'TRANSFER_LINE_NOT_FOUND'; end if;
  select * into v_run from transport_runs where id = v_line.run_id for update;
  if v_run.status = 'CANCELLED' then raise exception 'TRANSFER_CANCELLED'; end if;
  if v_line.received_weight_kg is not null then raise exception 'TRANSFER_ALREADY_RECEIVED'; end if;
  if p_received_weight_kg < 0 then raise exception 'NEGATIVE_RECEIPT'; end if;
  update transport_lines set received_weight_kg = p_received_weight_kg, received_by = p_actor, received_at = now(), variance_reason = case when p_received_weight_kg <> dispatched_weight_kg then p_reason else null end where id = p_line_id;
  insert into stock_ledger (idempotency_key,item_type,lot_id,smoke_date_group_id,location_id,stock_state,movement_type,qty_delta,business_date,event_at,source_table,source_id,reason,created_by)
  values (p_idempotency_out,p_item_type,v_line.lot_id,v_line.smoke_date_group_id,v_line.from_location_id,'IN_TRANSIT','TRANSFER_OUT',-v_line.dispatched_weight_kg,v_run.event_date,now(),'transport_lines',p_line_id,p_reason,p_actor),
         (p_idempotency_in,p_item_type,v_line.lot_id,v_line.smoke_date_group_id,v_line.to_location_id,'IN_TRANSIT','TRANSFER_IN',p_received_weight_kg,v_run.event_date,now(),'transport_lines',p_line_id,p_reason,p_actor);
  update transport_runs set status = 'RECEIVED', approved_by = p_actor, approved_at = now(), updated_by = p_actor, updated_at = now() where id = v_run.id;
end $$;

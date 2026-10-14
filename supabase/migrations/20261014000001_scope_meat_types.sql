-- A branch also receives `meatTypes` (Settings 「รายการเนื้อ」): the kinds of meat its Stock sheet
-- counts apart, one row each, and what a receipt with no Lot is of. No cost in it.
--
-- The rule table of 20261010000002_scope_products.sql, with that one config key more. Must equal
-- `branchScope` in src/lib/role-scope.ts (tests/unit/server.test.ts reads the JSON below).
create or replace function public.app_state_scope_rules() returns jsonb
language sql immutable set search_path = pg_catalog as $$ select $rules$
{
  "kinds": ["receive", "sale", "influencerBox", "materials", "meatCount", "pay", "transferReceive", "daily",
    "opening"],
  "hiddenKeys": ["price", "invoiceAmount", "netPayable", "lines", "estimatedCost", "serviceRate", "outboundCost",
    "returnCost", "meatCost", "wasteCost"],
  "configKeys": ["packKg", "materialList", "materialListAfter", "skuHigh", "salesChannels", "payCategories",
    "rawRiceBranches", "boxRecipe", "products", "meatTypes"],
  "stockKinds": ["pay", "expense"],
  "stockKeys": ["category", "item", "qty", "branch", "sku", "warehouse", "purpose", "project", "status", "targetId",
    "targetKind", "to.category", "to.item", "to.qty", "to.sku", "to.warehouse", "to.purpose", "to.project",
    "to.status", "fromDate", "toDate"],
  "wholeKinds": ["transfer"],
  "sharedKinds": ["stockItem"]
}
$rules$::jsonb $$;

-- `create or replace` keeps the grants of file 4 (revoked from public, anon, authenticated); said
-- again so this file stands on its own.
revoke all on function public.app_state_scope_rules() from public, anon, authenticated;

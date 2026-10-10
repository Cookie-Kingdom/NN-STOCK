-- A branch also receives `boxRecipe` (Settings 「สูตรต่อกล่อง」): what a box sold or given away takes
-- from its stock (V2-CAL-10), so its daily sheet reads the same as the Owner's. No cost in it.
--
-- The rule table of 20261002000004_app_state_scope.sql, with that one config key more. Must equal
-- `branchScope` in src/lib/role-scope.ts (tests/unit/server.test.ts reads the JSON below).
create or replace function public.app_state_scope_rules() returns jsonb
language sql immutable set search_path = pg_catalog as $$ select $rules$
{
  "kinds": ["receive", "sale", "influencerBox", "materials", "meatCount", "pay", "transferReceive", "daily",
    "opening"],
  "hiddenKeys": ["price", "invoiceAmount", "netPayable", "lines", "estimatedCost", "serviceRate", "outboundCost",
    "returnCost", "meatCost", "wasteCost"],
  "configKeys": ["packKg", "materialList", "materialListAfter", "skuHigh", "salesChannels", "payCategories",
    "rawRiceBranches", "boxRecipe"],
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

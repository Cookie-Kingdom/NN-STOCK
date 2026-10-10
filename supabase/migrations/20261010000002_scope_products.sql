-- A branch also receives `products` (Settings 「รายการสินค้า」): what one piece of each product sold or
-- given away takes from its stock (V2-CAL-10), and the count fields of its sale form. No cost in it:
-- the prices and costs are in `productMoney`, which stays with the Owner.
--
-- The rule table of 20261010000001_scope_box_recipe.sql, with that one config key more. Must equal
-- `branchScope` in src/lib/role-scope.ts (tests/unit/server.test.ts reads the JSON below).
create or replace function public.app_state_scope_rules() returns jsonb
language sql immutable set search_path = pg_catalog as $$ select $rules$
{
  "kinds": ["receive", "sale", "influencerBox", "materials", "meatCount", "pay", "transferReceive", "daily",
    "opening"],
  "hiddenKeys": ["price", "invoiceAmount", "netPayable", "lines", "estimatedCost", "serviceRate", "outboundCost",
    "returnCost", "meatCost", "wasteCost"],
  "configKeys": ["packKg", "materialList", "materialListAfter", "skuHigh", "salesChannels", "payCategories",
    "rawRiceBranches", "boxRecipe", "products"],
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

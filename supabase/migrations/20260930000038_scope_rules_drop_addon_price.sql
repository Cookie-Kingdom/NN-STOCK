-- Branch scope rules without addonPrice: the sealed-meat Add-on is no longer sold (sale field
-- `addons` and config `addonPrice` removed), so a branch copy no longer keeps that config key.
-- Everything else is 0035's rule; scope_app_state() and append_entries are unchanged.
--
-- JS port: branchScope in src/lib/role-scope.ts (tests/unit/roleScope.test.ts reads the rule JSON
-- below). Errors are raise exception or PTxxx only, never 40001 / 40P01.

create or replace function public.app_state_scope_rules() returns jsonb
language sql immutable set search_path = pg_catalog as $$ select $rules$
{
  "kinds": ["receive", "thaw", "supplyPurchase", "supplyIssue", "ricePurchase", "chiliPurchase", "riceIssue",
    "chiliIssue", "rice", "riceCarry", "sale", "influencerBox", "materials", "materialConfirm", "closeDay",
    "allocate", "chiliAllocate", "materialTransfer", "unlock"],
  "hiddenKeys": ["meatCost", "wasteCost", "estimatedCost", "serviceRate", "lines", "price", "outboundCost", "returnCost"],
  "configKeys": ["branch", "boxPrice", "chiliPrice", "packKg", "rawRicePar", "rawRiceUnitPrice",
    "cookedRicePar", "cookedRiceUnitPrice", "material*"],
  "centralKinds": ["allocate", "receive"],
  "centralKeys": ["kg", "allocation", "complete", "targetId", "lotId", "decision", "to.kg", "to.allocation", "to.complete"]
}
$rules$::jsonb $$;
revoke all on function public.app_state_scope_rules() from public, anon, authenticated;

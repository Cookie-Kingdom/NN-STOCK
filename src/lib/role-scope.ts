import {
  type Database,
  type Entry,
  type Lot,
  type Role,
  type Values,
  type EntryKind,
} from "./store";

/* What a Branch, Foodiva or Chef House account receives from load_app_state (review APP-01 /
 * DB-03). Until migration 20260925000028 every role but the Account Manager got the whole
 * payload, and `visibleEntries`/`visibleDatabase` only narrowed the screens.
 *
 * `scopeRules` is the rule table. The same JSON sits in app_state_scope_rules() in that
 * migration, and tests/unit/roleScope.test.ts checks the two are equal, so change both.
 * `scopeDatabase` is the JS port of scope_app_state() there (GET /api/local-db uses it).
 *
 * Per role:
 *  - kinds       entry kinds sent. `void`, `entryEdit`, `editRequest` and `editDecision` are
 *                never listed: they are sent when the entry they name (`targetId`) is sent.
 *  - ownBranch   only entries whose `branch` is the account's own branch.
 *  - lots        "all", "allocated" (lots with an allocate entry to its branch, voided or not)
 *                or "smoked" (shipments not cancelled with a live smoke PO, as visibleDatabase;
 *                entries on other lots are not sent either).
 *  - hiddenKeys  value keys stripped from every entry and lot (also as an edit's to./from.).
 *  - configKeys  the config keys kept, in `config` and in every lot's config snapshot; a
 *                trailing `*` keeps every key with that prefix. normalize() fills the rest
 *                from the seed, which no screen of that role reads. */
export type ScopeRule = {
  kinds: EntryKind[];
  ownBranch: boolean;
  lots: "all" | "allocated" | "smoked";
  hiddenKeys: string[];
  configKeys: string[];
};
export type ScopedRole = Exclude<Role, "owner">;

/** Meat cost of a sale (lotCost) and what the smoke PO costs. */
const costKeys = ["meatCost", "wasteCost", "estimatedCost", "serviceRate"];
const documentConfig = [
  "branch",
  "companyName",
  "companyAddress",
  "attention",
  "companyPhone",
  "taxId",
  "logoData",
  "logoStorageKey",
  "logoName",
];

export const scopeRules: Record<ScopedRole, ScopeRule> = {
  branch: {
    kinds: [
      "receive",
      "thaw",
      "supplyPurchase",
      "supplyIssue",
      "ricePurchase",
      "chiliPurchase",
      "riceIssue",
      "chiliIssue",
      "rice",
      "riceCarry",
      "sale",
      "influencerBox",
      "materials",
      "materialConfirm",
      "closeDay",
      "allocate",
      "chiliAllocate",
      "materialTransfer",
      "unlock",
    ],
    ownBranch: true,
    lots: "allocated",
    hiddenKeys: [...costKeys, "lines", "price", "outboundCost", "returnCost"],
    configKeys: [
      "branch",
      "boxPrice",
      "addonPrice",
      "chiliPrice",
      "packKg",
      "rawRicePar",
      "rawRiceUnitPrice",
      "cookedRicePar",
      "cookedRiceUnitPrice",
      "material*",
    ],
  },
  foodiva: {
    kinds: [
      "foodivaConfirm",
      "packingList",
      "foodivaReturnReceive",
      "dispatch",
      "purchase",
      "shipmentRequest",
      "shipmentRequestEdit",
      "smokeOrder",
      "return",
      "ownerWasteReceive",
      "meatPayment",
      "smoke",
      "chefEdit",
      "steakTransfer",
    ],
    ownBranch: false,
    lots: "all",
    hiddenKeys: [...costKeys, "returnCost"],
    configKeys: [
      ...documentConfig,
      "foodivaContact",
      "foodivaAddress",
      "outboundFee",
      "roundFee",
    ],
  },
  cm: {
    kinds: [
      "smokingInvoice",
      "smokeOrderAccept",
      "cmReceive",
      "prepare",
      "smoke",
      "closeLot",
      "chefEdit",
      "smokeOrder",
      "packingList",
      "invoiceReview",
      "invoicePayment",
    ],
    ownBranch: false,
    lots: "smoked",
    hiddenKeys: [
      "meatCost",
      "wasteCost",
      "lines",
      "price",
      "outboundCost",
      "returnCost",
    ],
    configKeys: [...documentConfig, "chefHouseContact", "chefHouseAddress"],
  },
};

/** Kinds that follow the entry they name in `targetId`. */
export const followKinds = ["void", "entryEdit", "editRequest", "editDecision"];

const hide = (values: Values, hidden: string[]): Values =>
  values && typeof values === "object"
    ? Object.fromEntries(
        Object.entries(values).filter(
          ([key]) => !hidden.includes(key.replace(/^(to|from)\./, "")),
        ),
      )
    : values;
const pick = (config: Values, keys: string[]): Values =>
  Object.fromEntries(
    Object.entries(config ?? {}).filter(([key]) =>
      keys.some((k) =>
        k.endsWith("*") ? key.startsWith(k.slice(0, -1)) : key === k,
      ),
    ),
  );

/** The copy of `db` a `role` account receives. `branches` is a branch account's own branch(es). */
export function scopeDatabase(
  db: Database,
  role: ScopedRole,
  branches: string[] = [],
): Database {
  const rule = scopeRules[role];
  const all = db.entries ?? [];
  const voided = new Set(
    all
      .filter((e) => e?.kind === "void" && e.role === "owner")
      .map((e) => e.values?.targetId),
  );
  const live = (e: Entry) => !voided.has(e.id);
  const lotsWith = (
    kind: EntryKind,
    test: (e: Entry) => boolean = () => true,
  ) =>
    new Set(all.filter((e) => e?.kind === kind && test(e)).map((e) => e.lotId));
  const cancelled = new Set(
    all
      .filter((e) => e?.kind === "shipmentRequest" && !live(e))
      .map((e) => e.lotId),
  );
  const smoked = lotsWith("smokeOrder", live);
  const allocated = lotsWith("allocate", (e) => branches.includes(e.branch));
  const lots = (db.lots ?? []).filter(
    (lot: Lot) =>
      rule.lots === "all" ||
      (rule.lots === "allocated"
        ? allocated.has(lot?.id)
        : lot?.kind === "shipment" &&
          !cancelled.has(lot.id) &&
          smoked.has(lot.id)),
  );
  const lotIds = new Set(lots.map((lot) => lot.id));
  const direct = (e: Entry) =>
    rule.kinds.includes(e?.kind) &&
    (!rule.ownBranch || branches.includes(e.branch)) &&
    (rule.lots !== "smoked" || lotIds.has(e.lotId));
  const sent = new Set(all.filter(direct).map((e) => e.id));
  const entries = all.filter(
    (e) =>
      direct(e) ||
      (followKinds.includes(e?.kind) && sent.has(e.values?.targetId)),
  );
  return {
    version: db.version,
    lots: lots.map((lot) => ({
      ...lot,
      values: hide(lot.values ?? {}, rule.hiddenKeys),
      config: pick(lot.config, rule.configKeys),
    })),
    entries: entries.map((e) => ({
      ...e,
      values: hide(e.values, rule.hiddenKeys),
    })),
    config: pick(db.config, rule.configKeys),
  };
}

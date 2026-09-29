import {
  type Database,
  type Entry,
  type Lot,
  type Values,
  type EntryKind,
} from "./store";
import { omit } from "./store/visibility";

/* What a branch account receives from load_app_state (review APP-01 / DB-03). Until migration
 * 20260925000028 every role but the Account Manager got the whole payload, and
 * `visibleEntries`/`visibleDatabase` only narrowed the screens. Foodiva and Chef House accounts
 * are retired (20260929000032): the Owner and the Account Manager read everything, and the branch
 * is the only scoped account.
 *
 * `branchScope` is the rule. The same JSON sits in app_state_scope_rules() in migration
 * 20260929000033, and tests/unit/roleScope.test.ts checks the two are equal, so change both.
 * `scopeDatabase` is the JS port of scope_app_state() (20260929000033; GET /api/local-db uses it):
 * the branch's own entries, on lots with an entry whose `branch` is the account's and whose kind
 * is `allocate` or whose role is `branch` (BR-07), or on no lot. Voids are not consulted.
 *
 *  - kinds       entry kinds sent. `void`, `entryEdit`, `editRequest` and `editDecision` are
 *                never listed: they are sent when the entry they name (`targetId`) is sent.
 *  - hiddenKeys  value keys stripped from every entry and lot (also as an edit's to./from.).
 *  - configKeys  the config keys kept, in `config` and in every lot's config snapshot; a
 *                trailing `*` keeps every key with that prefix. normalize() fills the rest
 *                from the seed, which no branch screen reads. */

/** Meat cost of a sale (lotCost) and what the smoke PO costs. */
const costKeys = ["meatCost", "wasteCost", "estimatedCost", "serviceRate"];

export const branchScope: {
  kinds: EntryKind[];
  hiddenKeys: string[];
  configKeys: string[];
} = {
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
};

/** Kinds that follow the entry they name in `targetId`. */
const followKinds = [
  "void",
  "entryEdit",
  "editRequest",
  "editDecision",
  "link",
];

const hide = (values: Values, hidden: string[]): Values =>
  values && typeof values === "object" ? omit(values, hidden) : values;
const pick = (config: Values, keys: string[]): Values =>
  Object.fromEntries(
    Object.entries(config ?? {}).filter(([key]) =>
      keys.some((k) =>
        k.endsWith("*") ? key.startsWith(k.slice(0, -1)) : key === k,
      ),
    ),
  );

/** The copy of `db` a branch account receives. `branches` is its own branch(es). */
export function scopeDatabase(db: Database, branches: string[] = []): Database {
  const rule = branchScope;
  const all = db.entries ?? [];
  const lotsWith = (test: (e: Entry) => boolean) =>
    new Set(all.filter((e) => e && test(e)).map((e) => e.lotId));
  // BR-07: a branch's lots. Same rule as visibleLots().
  const allocated = lotsWith(
    (e) =>
      branches.includes(e.branch) &&
      (e.kind === "allocate" || e.role === "branch"),
  );
  const lots = (db.lots ?? []).filter((lot: Lot) => allocated.has(lot?.id));
  const lotIds = new Set(lots.map((lot) => lot.id));
  // A branch's own entries in its "ไม่ระบุ Lot" bucket (`lotId === ""`) are sent too.
  const direct = (e: Entry) =>
    rule.kinds.includes(e?.kind) &&
    branches.includes(e.branch) &&
    (!e.lotId || lotIds.has(e.lotId));
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

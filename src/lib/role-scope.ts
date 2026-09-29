import {
  type Database,
  type Entry,
  type Lot,
  type Values,
  type EntryKind,
} from "./store";
import { branchHiddenKeys, omit } from "./store/visibility";

/* What a branch account receives from load_app_state (review APP-01 / DB-03). Until migration
 * 20260925000028 every role but the Account Manager got the whole payload, and
 * `visibleEntries`/`visibleDatabase` only narrowed the screens. Foodiva and Chef House accounts
 * are retired (20260929000032): the Owner and the Account Manager read everything, and the branch
 * is the only scoped account.
 *
 * `branchScope` is the rule. The same JSON sits in app_state_scope_rules() in migration
 * 20260929000035, and tests/unit/roleScope.test.ts checks the two are equal, so change both.
 * `scopeDatabase` is the JS port of scope_app_state() (20260929000035; GET /api/local-db uses it):
 * every batch S (BR-08: the receive picker and the link dialog list them all) plus the lots of
 * BR-07, the branch's own entries on those lots or on no lot, and the other branches'
 * `allocate` / `receive` cut down to `centralKeys` so centralStock() (the "สต๊อกกลางไม่พอ"
 * warning, the link dialog) counts them. visibleEntries() keeps those out of the branch's screens.
 *
 *  - kinds       entry kinds sent. `void`, `entryEdit`, `editRequest` and `editDecision` are
 *                never listed: they are sent when the entry they name (`targetId`) is sent.
 *  - hiddenKeys  value keys stripped from every entry and lot (also as an edit's to./from.).
 *  - configKeys  the config keys kept, in `config` and in every lot's config snapshot; a
 *                trailing `*` keeps every key with that prefix. normalize() fills the rest
 *                from the seed, which no branch screen reads.
 *  - centralKinds  another branch's kinds sent for centralStock(), with their void / edit /
 *                decision / link (never an editRequest).
 *  - centralKeys the only value keys those keep: kg, allocation, complete, and what a void, edit,
 *                decision or link needs to apply (targetId, lotId, decision, to.*). */

export const branchScope: {
  kinds: EntryKind[];
  hiddenKeys: string[];
  configKeys: string[];
  centralKinds: EntryKind[];
  centralKeys: string[];
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
  hiddenKeys: branchHiddenKeys,
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
  centralKinds: ["allocate", "receive"],
  centralKeys: [
    "kg",
    "allocation",
    "complete",
    "targetId",
    "lotId",
    "decision",
    "to.kg",
    "to.allocation",
    "to.complete",
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
  // BR-08: plus every batch S.
  const lots = (db.lots ?? []).filter(
    (lot: Lot) => lot?.kind === "shipment" || allocated.has(lot?.id),
  );
  const lotIds = new Set(lots.map((lot) => lot.id));
  // Entries on those lots or on no lot ("ไม่ระบุ Lot", `lotId === ""`, maybe linked later).
  const onLots = (e: Entry) => !e.lotId || lotIds.has(e.lotId);
  const direct = (e: Entry) =>
    rule.kinds.includes(e?.kind) && branches.includes(e.branch) && onLots(e);
  const central = (e: Entry) =>
    rule.centralKinds.includes(e?.kind) &&
    !branches.includes(e.branch) &&
    onLots(e);
  const own = new Set(all.filter(direct).map((e) => e.id));
  const others = new Set(all.filter(central).map((e) => e.id));
  const target = (e: Entry) => e?.values?.targetId;
  const follows = (e: Entry) =>
    followKinds.includes(e?.kind) && own.has(target(e));
  const followed = new Set(all.filter(follows).map((e) => e.id));
  const entries = all.flatMap((e) => {
    // A void of a followed entry too: the branch withdrawing its own edit request.
    if (
      direct(e) ||
      follows(e) ||
      (e?.kind === "void" && followed.has(target(e)))
    )
      return [{ ...e, values: hide(e.values, rule.hiddenKeys) }];
    if (
      central(e) ||
      (followKinds.includes(e?.kind) &&
        e.kind !== "editRequest" &&
        others.has(target(e)))
    )
      return [{ ...e, values: pick(e.values, rule.centralKeys) }];
    return [];
  });
  return {
    version: db.version,
    lots: lots.map((lot) => ({
      ...lot,
      values: hide(lot.values ?? {}, rule.hiddenKeys),
      config: pick(lot.config, rule.configKeys),
    })),
    entries,
    config: pick(db.config, rule.configKeys),
  };
}

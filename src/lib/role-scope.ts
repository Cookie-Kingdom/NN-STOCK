import {
  changeKinds,
  type Database,
  type Entry,
  type EntryKind,
  type Values,
} from "./store";

/* What a branch account receives from load_app_state: its own entries, the Lots it may receive
 * from, and the stock lines of what the Owner or the Account Manager bought for it (V2-ACC-06,
 * V2-ACC-07). Nothing of another branch, no cost, no central stock.
 *
 * `branchScope` is the rule. The same JSON sits in app_state_scope_rules() in migration
 * 20261002000004_app_state_scope.sql, and tests/unit/server.test.ts checks the two are equal, so
 * change both.
 * `scopeDatabase` is the JS port of scope_app_state() there (GET /api/local-db uses it).
 *
 *  - kinds       the branch's own entries sent whole: `role: "branch"`, stamped with its branch.
 *  - hiddenKeys  value keys stripped from those and from every lot (also as an edit's to./from.).
 *                Not `fullAmount`: a branch types it on its own payment, and the Owner's never
 *                arrives (`stockKeys`).
 *  - configKeys  the settings kept, in `config` and in every lot's config. normalize() fills the
 *                rest from the seed, which no branch screen reads.
 *  - stockKinds  kinds of the Owner / Account Manager stamped with the branch that reach it for
 *                stock only: visibleEntries() never lists them.
 *  - stockKeys   the only value keys those keep: what was bought, how many, and what an edit or
 *                a delete of the line needs to apply.
 *
 * `entryEdit` and `void` are never listed: one is sent when the entry it names (`targetId`) is
 * sent, cut the same way, and so is a void naming one of those (an undone edit, a restored
 * delete; no chain is longer, see voidBlock). */
export const branchScope: {
  kinds: EntryKind[];
  hiddenKeys: string[];
  configKeys: string[];
  stockKinds: EntryKind[];
  stockKeys: string[];
} = {
  kinds: ["receive", "sale", "influencerBox", "materials", "meatCount", "pay"],
  hiddenKeys: [
    "price",
    "invoiceAmount",
    "netPayable",
    "lines",
    "estimatedCost",
    "serviceRate",
    "outboundCost",
    "returnCost",
    "meatCost",
    "wasteCost",
  ],
  configKeys: [
    "packKg",
    "materialList",
    "salesChannels",
    "payCategories",
    "rawRiceBranches",
  ],
  stockKinds: ["pay"],
  stockKeys: [
    "category",
    "item",
    "qty",
    "branch",
    "targetId",
    "targetKind",
    "to.category",
    "to.item",
    "to.qty",
    "fromDate",
    "toDate",
  ],
};

const isObject = (values: unknown): values is Values =>
  !!values && typeof values === "object";
const filterKeys = (values: Values, keep: (key: string) => boolean): Values =>
  Object.fromEntries(Object.entries(values).filter(([key]) => keep(key)));
/** scope_strip_values(): without the hidden keys, also as an edit's `to.` / `from.`. */
const hide = (values: Values, hidden: string[]): Values =>
  isObject(values)
    ? filterKeys(
        values,
        (key) => !hidden.includes(key.replace(/^(to|from)\./, "")),
      )
    : values;
/** scope_config(): only the named keys. */
const pick = (values: Values, keys: string[]): Values =>
  isObject(values) ? filterKeys(values, (key) => keys.includes(key)) : {};

/** The copy of `db` a branch account receives. `branches` is its own branch(es). */
export function scopeDatabase(db: Database, branches: string[] = []): Database {
  const rule = branchScope;
  const all = db.entries ?? [];
  const targetId = (e: Entry) => e?.values?.targetId;
  // Entry id → sent whole (an own entry) or cut down to `stockKeys` (a stock line).
  const direct = new Map<string, boolean>();
  for (const e of all)
    if (branches.includes(e?.branch)) {
      if (e.role === "branch" && rule.kinds.includes(e.kind))
        direct.set(e.id, true);
      else if (e.role !== "branch" && rule.stockKinds.includes(e.kind))
        direct.set(e.id, false);
    }
  // An edit or a delete naming one of those, whoever made it, cut like its target.
  const follow = new Map<string, boolean>();
  for (const e of all)
    if (changeKinds.includes(e?.kind) && direct.has(targetId(e)))
      follow.set(e.id, direct.get(targetId(e))!);
  // And a delete naming one of those changes: an undone edit, a restored delete.
  const undo = new Map<string, boolean>();
  for (const e of all)
    if (e?.kind === "void" && follow.has(targetId(e)))
      undo.set(e.id, follow.get(targetId(e))!);
  const entries = all.flatMap((e) => {
    const whole = direct.get(e?.id) ?? follow.get(e?.id) ?? undo.get(e?.id);
    if (whole === undefined) return [];
    return [
      {
        ...e,
        values: whole
          ? hide(e.values, rule.hiddenKeys)
          : pick(e.values, rule.stockKeys),
      },
    ];
  });
  return {
    version: db.version,
    // Every Lot รมควัน: the receive form lists them all. No PO เนื้อ (its price).
    lots: (db.lots ?? [])
      .filter((lot) => lot?.kind === "shipment")
      .map((lot) => ({
        ...lot,
        values: hide(lot.values ?? {}, rule.hiddenKeys),
        config: pick(lot.config, rule.configKeys),
      })),
    entries,
    config: pick(db.config, rule.configKeys),
  };
}

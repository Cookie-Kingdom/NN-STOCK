import {
  changeKinds,
  type Database,
  type Entry,
  type EntryKind,
  type Values,
} from "./store";

/* What a branch account receives from load_app_state: its own entries, the Lots it may receive
 * from, and the stock lines of what the Owner bought for it (V2-ACC-06, V2-ACC-07). Nothing of another branch, no cost, no central stock.
 *
 * `branchScope` is the rule. The same JSON sits in app_state_scope_rules(), as migration
 * 20261010000001_scope_box_recipe.sql last defined it, and tests/unit/server.test.ts checks the two are equal, so
 * change both.
 * `scopeDatabase` is the JS port of scope_app_state() there (GET /api/local-db uses it).
 *
 *  - kinds       the branch's own entries sent whole: `role: "branch"`, stamped with its branch.
 *  - hiddenKeys  value keys stripped from those and from every lot (also as an edit's to./from.).
 *                Not `fullAmount`: a branch types it on its own payment, and the Owner's never
 *                arrives (`stockKeys`).
 *  - configKeys  the settings kept, in `config` and in every lot's config. normalize() fills the
 *                rest from the seed, which no branch screen reads. Of `rawRiceBranches` a branch
 *                gets its own name or an empty list, never the other branch's (V2-BR-08).
 *  - stockKinds  kinds of the Owner stamped with the branch that reach it for stock only:
 *                visibleEntries() never lists them.
 *  - stockKeys   the only value keys those keep: what was bought, how many, into which
 *                warehouse, and what an edit or a delete of the line needs to apply. Never an
 *                amount, a vendor or a document.
 *  - wholeKinds  kinds of the Owner sent whole (they hold no money) when
 *                `from` or `to` names the branch, as saved or as an edit put it (`to.from`,
 *                `to.to`): a transfer out of or into its stock.
 *  - sharedKinds kinds of any branch sent whole to every branch account: a `stockItem`, a row
 *                of the one material list both branches read (so a copy names the other
 *                branch on those entries, and nowhere else).
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
  wholeKinds: EntryKind[];
  sharedKinds: EntryKind[];
} = {
  kinds: [
    "receive",
    "sale",
    "influencerBox",
    "materials",
    "meatCount",
    "pay",
    "transferReceive",
    "daily",
    "opening",
  ],
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
    "materialListAfter",
    "skuHigh",
    "salesChannels",
    "payCategories",
    "rawRiceBranches",
    "boxRecipe",
  ],
  stockKinds: ["pay", "expense"],
  stockKeys: [
    "category",
    "item",
    "qty",
    "branch",
    "sku",
    "warehouse",
    "purpose",
    "project",
    "status",
    "targetId",
    "targetKind",
    "to.category",
    "to.item",
    "to.qty",
    "to.sku",
    "to.warehouse",
    "to.purpose",
    "to.project",
    "to.status",
    "fromDate",
    "toDate",
  ],
  wholeKinds: ["transfer"],
  sharedKinds: ["stockItem"],
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
/** `config` with, of the branches that count raw rice, only `branches`. An unreadable list is
 *  dropped, so the app reads the seed's, as the Owner's copy does. */
function ownRice(config: Values, branches: string[]): Values {
  const { rawRiceBranches: stored, ...rest } = config;
  let list: unknown;
  try {
    list = JSON.parse(stored);
  } catch {}
  return Array.isArray(list)
    ? {
        ...rest,
        rawRiceBranches: JSON.stringify(
          list.filter((b) => branches.includes(b)),
        ),
      }
    : rest;
}

/** The copy of `db` a branch account receives. `branches` is its own branch(es). */
export function scopeDatabase(db: Database, branches: string[] = []): Database {
  const rule = branchScope;
  const all = db.entries ?? [];
  const targetId = (e: Entry) => e?.values?.targetId;
  const own = (...places: (string | undefined)[]) =>
    places.some((place) => branches.includes(place!));
  // The entries an edit moved to (or from) one of the branches.
  const moved = new Set(
    all
      .filter(
        (e) =>
          e?.kind === "entryEdit" &&
          own(e.values?.["to.from"], e.values?.["to.to"]),
      )
      .map(targetId),
  );
  // Entry id → sent whole (an own entry, a transfer) or cut down to `stockKeys` (a stock line).
  const direct = new Map<string, boolean>();
  for (const e of all)
    if (e?.role === "branch" && rule.sharedKinds.includes(e.kind)) {
      if (branches.length) direct.set(e.id, true);
    } else if (branches.includes(e?.branch)) {
      if (e.role === "branch" && rule.kinds.includes(e.kind))
        direct.set(e.id, true);
      else if (e.role !== "branch" && rule.stockKinds.includes(e.kind))
        direct.set(e.id, false);
    } else if (
      e?.role !== "branch" &&
      rule.wholeKinds.includes(e?.kind) &&
      (own(e.values?.from, e.values?.to) || moved.has(e.id))
    )
      direct.set(e.id, true);
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
        config: ownRice(pick(lot.config, rule.configKeys), []),
      })),
    entries,
    config: ownRice(pick(db.config, rule.configKeys), branches),
  };
}

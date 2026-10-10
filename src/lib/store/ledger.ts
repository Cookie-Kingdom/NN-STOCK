/** The Accounting page's purchase ledger (V2-LED-01): every PO เนื้อ and PO รมควัน and every
 *  money-out line of Finance (V2-LED-18) as a row worked out from the log, plus the `expense`
 *  notes jotted by hand and, as money in, the `income` notes (V2-LED-19). Nothing here is
 *  stored. */
import {
  branches,
  configMaterials,
  incomeTypes,
  ingredients,
  payCategories,
  places,
  salesChannels,
  seed,
  shopProject,
  type Database,
  type Entry,
  type Values,
} from "./model";
import {
  branchItem,
  byDateAt,
  entries,
  invoiceOf,
  liveEntries,
  materialList,
  outflows,
  purchaseLots,
  shipments,
  stockMoves,
} from "./derived";

/** The sources a note is jotted with: the `expense` and the `pay` forms offer the same ones. */
export const jotSources = {
  advance: "พนักงานสำรองจ่าย",
  transfer: "เงินโอน",
  credit: "บัตรเครดิต",
} as const;
export const ledgerSources = {
  po: "PO เนื้อ / รมควัน",
  ...jotSources,
} as const;
export type LedgerSource = keyof typeof ledgerSources;
export const ledgerPurposes = {
  company: "บริษัทส่วนกลาง",
  project: "โปรเจกต์",
} as const;
export const ledgerStatuses = {
  pending: "รอจ่าย",
  paid: "จ่ายแล้ว",
  cancelled: "ยกเลิก",
} as const;
export type LedgerStatus = keyof typeof ledgerStatuses;
/** The same three statuses as an `income` note names them. */
export const incomeStatuses: Record<LedgerStatus, string> = {
  pending: "รอรับ",
  paid: "รับแล้ว",
  cancelled: "ยกเลิก",
};
/** The ประเภทสินค้า of a Finance row whose pay category the ledger already has a type for;
 *  any other category goes by its own name (V2-LED-18). */
const categoryTypes: Record<string, string> = {
  packaging: "วัสดุบรรจุภัณฑ์",
  ingredient: "วัตถุดิบ",
  capex: "สินทรัพย์",
  other: "อื่นๆ",
};
/** The suggested types: those four, then the other pay categories of the seed. */
export const defaultLedgerTypes = [
  ...Object.values(categoryTypes),
  ...payCategories(seed.config)
    .filter((c) => !categoryTypes[c.id])
    .map((c) => c.name),
];
export { shopProject };

export type LedgerRow = {
  /** The PO's lot id, else the id of the entry the row is of (an `expense`, a Finance line). */
  id: string;
  date: string;
  at: string;
  /** Where the row is from: a PO, a money-out line of Finance (view only, V2-LED-18), or an
   *  `expense` or `income` note jotted by hand. */
  origin: "po" | "finance" | "manual";
  /** Money in (an `income` note: `paid` is what was received, `vendor` who paid it) or out
   *  (every other row). */
  direction: "in" | "out";
  /** "" on a hand-jotted row with no source, or one no longer offered (the retired `petty`).
   *  A Finance row: the `pay` note's source, เงินโอน when it has none. */
  source: LedgerSource | "";
  /** The source as the table names it: a PO row by its kind (PO เนื้อ, PO รมควัน). */
  sourceLabel: string;
  /** A PO row: its lot (the link to the Lots page). */
  lotId?: string;
  /** A hand-jotted row: its entry (edit, delete, attachment). A Finance row has none. */
  entry?: Entry;
  /** A Finance row of a `pay` note: that note (its attached file; the row stays view only). */
  payNote?: Entry;
  reference: string;
  itemType: string;
  /** The name the item goes by now (`skuCatalogue`), not always the one typed. */
  item: string;
  sku: string;
  detail: string;
  vendor: string;
  purpose: keyof typeof ledgerPurposes;
  project: string;
  qty: number | null;
  unit: string;
  /** What the PO holds the budget for; null on a hand-jotted row. */
  poAmount: number | null;
  paid: number | null;
  status: LedgerStatus;
  /** The status as the table names it: `ledgerStatuses` out, `incomeStatuses` in. */
  statusLabel: string;
};

const numberOr = (v: Values, key: string) =>
  (v[key] ?? "") === "" ? null : Number(v[key]);
/** An item name as matched: trimmed, case-insensitive. */
const norm = (name = "") => name.trim().toLowerCase();

/* SKU (V2-LED-03): one sequence, `SKU-0001` up, for the materials of Settings and the items of
 * hand-jotted ledger rows. Nothing else has one (no meat, rice, chili or PO row). */
const skuNumber = (sku = "") => Number(/^SKU-(\d+)$/.exec(sku)?.[1] ?? 0);
const skuText = (n: number) => `SKU-${String(n).padStart(4, "0")}`;
/** The Owner's renames of ledger items (Settings 「รายการสินค้า (SKU)」): `[{ sku, name }]`. */
function skuNames(config: Values): Map<string, string> {
  try {
    const parsed: unknown = JSON.parse(config.skuNames || "[]");
    if (Array.isArray(parsed))
      return new Map(
        parsed.map((row) => [String(row?.sku), String(row?.name ?? "").trim()]),
      );
  } catch {}
  return new Map();
}
/** Every item with a SKU and the name it goes by: the materials (named in Settings), then the
 *  items of the live `expense` notes, oldest first, each under the Owner's rename if it has
 *  one, else the name first typed. A rename shows on every row of the SKU, old ones included.
 *  Last, a SKU only a `transfer` names, under the name stamped on it (`itemName`): a branch's
 *  copy holds no expense of the item sent to it. */
export function skuCatalogue(db: Database) {
  const items = new Map<
    string,
    { sku: string; name: string; material: boolean }
  >();
  for (const m of materialList(db))
    if (m.sku) items.set(m.sku, { sku: m.sku, name: m.name, material: true });
  const renamed = skuNames(db.config);
  for (const { values: v } of entries(db, "expense"))
    if (v.sku && !items.has(v.sku))
      items.set(v.sku, {
        sku: v.sku,
        name: renamed.get(v.sku) ?? (v.item ?? "").trim(),
        material: false,
      });
  for (const { values: v } of entries(db, "transfer"))
    if (v.sku && !items.has(v.sku))
      items.set(v.sku, {
        sku: v.sku,
        name: renamed.get(v.sku) ?? v.itemName ?? "",
        material: false,
      });
  return [...items.values()];
}
/** The name `sku` goes by now, else `typed` (a row with no SKU).
 *  ponytail: builds the catalogue per call; pass a Map around if a long ledger gets slow. */
export const skuName = (db: Database, sku: string | undefined, typed = "") =>
  (sku && skuCatalogue(db).find((item) => item.sku === sku)?.name) || typed;
/** The highest SKU ever issued: in the materials (the lists of earlier saves included), in
 *  every entry of the log (a branch's `stockItem` too), deleted and edited-away ones as well,
 *  and the one the Owner's last save knew of (`config.skuHigh`: a branch's copy holds no ledger
 *  item that never reached it). */
export function skuHigh(db: Database) {
  const issued = [
    db.config.skuHigh,
    ...configMaterials(db.config).map((m) => m.sku),
    ...db.entries.flatMap((e) => [
      e.values.sku,
      e.values["to.sku"],
      e.values["from.sku"],
      ...(e.kind === "config" && e.values.materialList
        ? configMaterials(e.values).map((m) => m.sku)
        : []),
    ]),
  ];
  return skuText(Math.max(0, ...issued.map(skuNumber)));
}
/** The next SKU: one past the highest, so a number is never given twice. The ones after it:
 *  `skuAfter`. */
export const nextSku = (db: Database) => skuAfter(skuHigh(db));
export const skuAfter = (sku: string) => skuText(skuNumber(sku) + 1);
/** The catalogue item a `transfer` of `name` moves: the one it already had (`kept`, an edit
 *  that kept the name, renamed since or not), else the one that goes by that name. */
export function skuItem(db: Database, name: string, kept: Values = {}) {
  const key = norm(name);
  return skuCatalogue(db).find((item) =>
    kept.sku && norm(kept.item) === key
      ? item.sku === kept.sku
      : norm(item.name) === key,
  );
}
/** The SKU an `expense` note of item `name` gets: the one it already had (`kept`, an edit that
 *  kept the name), the one of the item in the catalogue that goes by that name (a material
 *  included), or the next one (`isNew`). */
export function skuFor(db: Database, name: string, kept: Values = {}) {
  const key = norm(name);
  if (!key) return { sku: "", isNew: false };
  if (kept.sku && norm(kept.item) === key)
    return { sku: kept.sku, isNew: false };
  const same = skuCatalogue(db).find((item) => norm(item.name) === key);
  return same
    ? { sku: same.sku, isNew: false }
    : { sku: nextSku(db), isNew: true };
}
/** Why the catalogue of `db` cannot stand, or "": every item has a name, and no two share one. */
export function skuNameError(db: Database) {
  const items = skuCatalogue(db);
  const names = items.map((item) => norm(item.name));
  const twice = items.find((_, at) => names.indexOf(names[at]) !== at);
  return names.some((name) => !name)
    ? "รายการสินค้า (SKU): มีแถวที่ยังไม่ได้ใส่ชื่อ"
    : twice
      ? `รายการสินค้า (SKU): ชื่อ「${twice.name}」ซ้ำกัน`
      : "";
}
/** `first`, then every value typed under `key` on a note of `kind`, once each. */
export const ledgerChoices = (
  db: Database,
  key: string,
  first: string[] = [],
  kind: "expense" | "income" = "expense",
) => [
  ...new Set([
    ...first,
    ...entries(db, kind)
      .map((e) => e.values[key]?.trim())
      .filter(Boolean),
  ]),
];

/** A hand-jotted row's status, money out or in: the one picked, else paid once an amount is
 *  typed. */
const expenseStatus = (v: Values): LedgerStatus =>
  v.status in ledgerStatuses
    ? (v.status as LedgerStatus)
    : v.amount
      ? "paid"
      : "pending";

/** Every row of the ledger, newest first. */
export function ledgerRows(db: Database): LedgerRow[] {
  const rows: Omit<LedgerRow, "statusLabel">[] = [];
  const po = (
    lotId: string,
    e: Entry,
    reference: string,
    item: string,
    detail: string,
    vendor: string,
    qty: number | null,
    amount: number | null,
    sourceLabel: string,
  ): (typeof rows)[number] => ({
    id: lotId,
    date: e.date,
    at: e.at,
    origin: "po",
    direction: "out",
    source: "po",
    sourceLabel,
    lotId,
    reference,
    itemType: "วัตถุดิบ",
    item,
    sku: "",
    detail,
    vendor,
    purpose: "project",
    project: shopProject,
    qty,
    unit: "กก.",
    poAmount: amount,
    paid: 0,
    status: "pending",
  });
  // A deleted PO is gone from the ledger with it (liveLots).
  for (const lot of purchaseLots(db)) {
    const e = entries(db, "purchase", lot.id).at(-1);
    if (!e) continue;
    const v = e.values;
    const invoice = invoiceOf(db, lot.id)?.values;
    // The Foodiva invoice once there is one (what supplierBalances bills), else kg × price.
    const amount = invoice?.netPayable
      ? Number(invoice.netPayable)
      : v.orderedKg && v.price
        ? Number(v.orderedKg) * Number(v.price)
        : null;
    rows.push(
      po(
        lot.id,
        e,
        lot.poId,
        v.productName || "เนื้อ",
        [v.packSize, v.productCode].filter(Boolean).join(" · "),
        v.supplier,
        numberOr(v, "orderedKg"),
        amount,
        "PO เนื้อ",
      ),
    );
  }
  for (const lot of shipments(db)) {
    const e = entries(db, "smokeOrder", lot.id).at(-1);
    if (!e) continue;
    const v = e.values;
    const invoice = invoiceOf(db, lot.id)?.values;
    // The Chef House invoice once there is one, else the estimate (kg × rate).
    const amount = invoice?.netPayable
      ? Number(invoice.netPayable)
      : v.estimatedCost
        ? Number(v.estimatedCost)
        : null;
    rows.push(
      po(
        lot.id,
        e,
        lot.poId,
        "ค่ารมควัน",
        invoice?.invoiceNumber ? `Invoice ${invoice.invoiceNumber}` : "",
        v.smoker || "Chef House",
        numberOr(v, "rawKg"),
        amount,
        "PO รมควัน",
      ),
    );
  }
  /* A `pay` note names a supplier, not a PO: a supplier's payments, oldest first, fill its
   * POs oldest first, each up to its amount. Only the POs dated up to the payment: money
   * paid before a PO was made is not that PO's. What the POs did not take of a payment, and
   * every other money-out line of Finance (`outflows`), is a row of its own, so the rows'
   * ยอดจ่ายจริง add up to the money out, none of it twice (V2-LED-18). */
  const pos = rows.toSorted(byDateAt);
  const byId = new Map(liveEntries(db).map((e) => [e.id, e]));
  const categories = new Map(
    payCategories(db.config).map((c) => [c.id, c.name]),
  );
  const bought = [...materialList(db), ...ingredients];
  const lines = outflows(db)
    .map((o) => ({ o, e: byId.get(o.entryId)! }))
    .sort((a, b) => byDateAt(a.e, b.e));
  for (const { o, e } of lines) {
    const v = e.values;
    const pay = e.kind === "pay";
    let left = o.amount;
    if (pay && v.supplier)
      for (const row of pos) {
        if (row.vendor !== v.supplier || row.date > e.date) continue;
        const paid = row.paid ?? 0;
        const part = Math.max(0, Math.min(left, (row.poAmount ?? 0) - paid));
        row.paid = paid + part;
        left -= part;
      }
    // Under half a satang: nothing is left (float dust of the subtraction).
    if (Math.abs(left) < 0.005) continue;
    const category = categories.get(o.category) ?? o.category;
    // A `pay` note with no source (an old one), a sale's expense, a shipping fee: เงินโอน.
    const source =
      pay && v.source in jotSources
        ? (v.source as keyof typeof jotSources)
        : "transfer";
    rows.push({
      id: e.id,
      date: e.date,
      at: e.at,
      origin: "finance",
      direction: "out",
      source,
      sourceLabel: jotSources[source],
      payNote: pay ? e : undefined,
      reference: "",
      itemType: categoryTypes[o.category] ?? category,
      // Payroll: the employee. A stock payment: what was bought. Else the category.
      item: pay
        ? v.employee || bought.find((m) => m.id === v.item)?.name || category
        : e.kind === "sale"
          ? "ค่าใช้จ่ายสาขา"
          : "ค่าส่งกล่องแจก",
      sku: "",
      detail: [
        pay ? v.detail : v.influencer,
        o.branch,
        left !== o.amount &&
          `ส่วนที่ PO ไม่ได้ตัด จากยอดจ่าย ${o.amount.toLocaleString("en-US")} บาท`,
      ]
        .filter(Boolean)
        .join(" · "),
      vendor: v.supplier ?? "",
      // Finance is the shop project's book: every line of it is the project's.
      purpose: "project",
      project: shopProject,
      qty: pay ? numberOr(v, "qty") : null,
      unit: "",
      poAmount: null,
      paid: left,
      status: "paid",
    });
  }
  for (const row of pos)
    row.status =
      row.poAmount && (row.paid ?? 0) >= row.poAmount ? "paid" : "pending";
  const names = new Map(skuCatalogue(db).map((item) => [item.sku, item.name]));
  for (const e of entries(db, "expense")) {
    const v = e.values;
    rows.push({
      id: e.id,
      date: e.date,
      at: e.at,
      origin: "manual",
      direction: "out",
      source: v.source in ledgerSources ? (v.source as LedgerSource) : "",
      sourceLabel:
        v.source in ledgerSources
          ? ledgerSources[v.source as LedgerSource]
          : "",
      entry: e,
      reference: v.reference ?? "",
      itemType: v.itemType ?? "",
      item: names.get(v.sku) ?? v.item ?? "",
      sku: v.sku ?? "",
      detail: v.detail ?? "",
      vendor: v.vendor ?? "",
      purpose: v.purpose === "project" ? "project" : "company",
      project: v.purpose === "project" ? (v.project ?? "") : "",
      qty: numberOr(v, "qty"),
      unit: "",
      poAmount: null,
      paid: numberOr(v, "amount"),
      status: expenseStatus(v),
    });
  }
  // V2-LED-19: money in. A cancelled one is listed, like a cancelled expense.
  const channels = new Map(
    salesChannels(db.config).map((c) => [c.key, c.name]),
  );
  for (const e of entries(db, "income")) {
    const v = e.values;
    const sales = v.incomeType === "sales";
    rows.push({
      id: e.id,
      date: e.date,
      at: e.at,
      origin: "manual",
      direction: "in",
      source: "",
      sourceLabel: "",
      entry: e,
      reference: v.reference ?? "",
      // Accounting says what the money is: a channel pays the sale less its GP.
      itemType: sales ? "ค่าขาย (หลังหัก GP)" : incomeTypes.other,
      // A sales receipt with no item goes by its channel.
      item: v.item || (sales && channels.get(v.channel)) || "",
      sku: "",
      detail: v.detail ?? "",
      vendor: v.customer ?? "",
      purpose: v.purpose === "project" ? "project" : "company",
      project: v.purpose === "project" ? (v.project ?? "") : "",
      qty: null,
      unit: "",
      poAmount: null,
      paid: numberOr(v, "amount"),
      status: expenseStatus(v),
    });
  }
  return rows
    .sort(byDateAt)
    .reverse()
    .map((row) => ({
      ...row,
      statusLabel: (row.direction === "in" ? incomeStatuses : ledgerStatuses)[
        row.status
      ],
    }));
}

export type ProjectAsset = {
  /** The SKU, else the name as matched. */
  key: string;
  sku: string;
  item: string;
  /** Of the latest purchase. */
  detail: string;
  vendor: string;
  lastDate: string;
  /** Every purchase's quantity; null when none has one. */
  qty: number | null;
  /** What was paid for it so far. */
  paid: number;
  times: number;
};

/** What `project` owns (Inventory): the hand-jotted rows of the ledger bought for it (no PO
 *  row, no Finance row, no money in), a row
 *  per item (its SKU), in a group per ประเภทสินค้า, the suggested types first. A cancelled
 *  row is left out; the PO rows are the meat, which is on the Stock page.
 *  ponytail: what was bought, not what is left: nothing takes an item out again (used up,
 *  sold, broken). Needs a note of its own when the shop wants a balance. */
export function projectAssets(db: Database, project = shopProject) {
  const groups = new Map<string, Map<string, ProjectAsset>>(
    defaultLedgerTypes.map((type) => [type, new Map()]),
  );
  // Newest first: the first row of an item is its latest purchase.
  for (const row of ledgerRows(db)) {
    if (row.origin !== "manual" || row.direction === "in") continue;
    if (row.status === "cancelled") continue;
    if (row.purpose !== "project" || row.project.trim() !== project) continue;
    const type = row.itemType.trim();
    const items = groups.get(type) ?? new Map<string, ProjectAsset>();
    groups.set(type, items);
    const key = row.sku || norm(row.item);
    const asset = items.get(key) ?? {
      key,
      sku: row.sku,
      item: row.item,
      detail: row.detail,
      vendor: row.vendor,
      lastDate: row.date,
      qty: null,
      paid: 0,
      times: 0,
    };
    items.set(key, asset);
    if (row.qty !== null) asset.qty = (asset.qty ?? 0) + row.qty;
    asset.paid += row.paid ?? 0;
    asset.times += 1;
  }
  return [...groups]
    .filter(([, items]) => items.size)
    .map(([type, items]) => ({ type, rows: [...items.values()] }));
}

export type StockLine = {
  sku: string;
  name: string;
  /** The Settings material's id when the SKU is one, else "". */
  materialId: string;
  /** Balance per place: "central" and every branch name. */
  at: Record<string, number>;
  /** Sent with "confirm" and not yet received. */
  inTransit: number;
};
/** The stock of every SKU that an expense of the shop project or a transfer ever moved, plus
 *  every Settings material with a SKU: what came in less what went out, per place
 *  (`stockMoves`); a material's figure at a branch is what its daily sheet leaves on `today`
 *  (`branchItem`). A balance may be negative. On a branch's copy only its own branch's figure is true:
 *  it holds nothing of the other places. */
export function stockLines(db: Database, today: string): StockLine[] {
  const names = new Map(skuCatalogue(db).map((item) => [item.sku, item.name]));
  const lines = new Map<string, StockLine>();
  const line = (sku: string, materialId = "") => {
    const made = lines.get(sku) ?? {
      sku,
      name: names.get(sku) ?? "",
      materialId,
      at: Object.fromEntries(places.map((place) => [place, 0])),
      inTransit: 0,
    };
    lines.set(sku, made);
    return made;
  };
  for (const m of materialList(db)) if (m.sku) line(m.sku, m.id);
  const { moves, transit } = stockMoves(db);
  for (const move of moves) {
    const at = line(move.sku).at;
    at[move.place] = (at[move.place] ?? 0) + move.qty;
  }
  for (const e of transit) line(e.values.sku).inTransit += Number(e.values.qty);
  for (const made of lines.values())
    if (made.materialId)
      for (const branch of branches)
        made.at[branch] = branchItem(
          db,
          branch,
          made.materialId,
          today,
        ).remaining;
  return [...lines.values()];
}

/** The Accounting page's figures, from the rows: what the POs still waiting for payment hold
 *  the budget for, what was paid in `month` (`YYYY-MM`) and in the month before it (money out
 *  only), what was received in the two (money in with status รับแล้ว) and the money in still
 *  awaited (`pendingIn`, of any month). A cancelled row holds no money. */
export function ledgerSummary(rows: LedgerRow[], month: string) {
  const waiting = rows.filter(
    (row) => row.origin === "po" && row.status === "pending",
  );
  const before = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5) - 2, 1))
    .toISOString()
    .slice(0, 7);
  /* ponytail: a row's money counts in the month of the row (a PO's date, an expense's date),
   * not of each `pay` note: ledgerRows spreads a supplier's payments over its POs without
   * their dates. Carry the pay dates on the row if the month has to be exact. */
  const money = (list: LedgerRow[]) =>
    list.reduce((a, row) => a + (row.paid ?? 0), 0);
  const paidIn = (m: string) =>
    money(
      rows.filter(
        (row) =>
          row.direction === "out" &&
          row.status !== "cancelled" &&
          row.date.startsWith(m),
      ),
    );
  const receivedIn = (m: string) =>
    money(
      rows.filter(
        (row) =>
          row.direction === "in" &&
          row.status === "paid" &&
          row.date.startsWith(m),
      ),
    );
  const pendingIn = rows.filter(
    (row) => row.direction === "in" && row.status === "pending",
  );
  return {
    reserved: waiting.reduce((a, row) => a + (row.poAmount ?? 0), 0),
    waiting: waiting.length,
    paid: paidIn(month),
    paidBefore: paidIn(before),
    received: receivedIn(month),
    receivedBefore: receivedIn(before),
    pendingIn: { count: pendingIn.length, amount: money(pendingIn) },
  };
}

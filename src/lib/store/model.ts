/** The domain's shapes and fixed tables: types, entry kinds, titles, edit rules, settings, the seed. */
export type Role = "owner" | "foodiva" | "cm" | "branch";
/** Who can sign in and act: Foodiva and Chef House are stamps on old entries only. */
export type ActingRole = "owner" | "branch";
export type Values = Record<string, string>;
/** Every entry kind in the log, the retired ones included (old entries keep them). A kind
 *  outside this list is a compile error. */
const entryKinds = [
  "purchase",
  "meatPayment",
  "smokeOrder",
  "smokeOrderAccept",
  "smokingInvoice",
  "invoiceReview",
  "invoicePayment",
  "foodivaConfirm",
  "packingList",
  "foodivaReturnReceive",
  "dispatch",
  "cmReceive",
  "prepare",
  "smoke",
  "closeLot",
  "chefEdit",
  "return",
  "central",
  "allocate",
  "receive",
  "thaw",
  "supplyPurchase",
  "supplyIssue",
  "ricePurchase",
  "chiliPurchase",
  "chiliReceive",
  "riceIssue",
  "chiliIssue",
  "rice",
  "riceCarry",
  "sale",
  "influencerBox",
  "materials",
  "materialReceive",
  "ownerWasteReceive",
  "generalPurchase",
  "materialConfirm",
  "closeDay",
  "expense",
  "config",
  "unlock",
  "void",
  "entryEdit",
  "editRequest",
  "editDecision",
  "link",
  "steakTransfer",
  "pay",
  "meatCount",
  "smoked",
  "meatInvoice",
  "reimburse",
  "transfer",
  "transferReceive",
  "daily",
  "opening",
  "stockItem",
  "income",
] as const;
export type EntryKind = (typeof entryKinds)[number];
/** The kinds an account jots (v2), in the order the kind picker lists them. `central`,
 *  `prepare` and `smoke` are retired: `smoked` holds the weight after smoking. So are the
 *  counts (`meatCount`, `materials`): a branch's stock is its daily sheet (`daily`). */
export const noteKinds = [
  "purchase",
  "meatInvoice",
  "ownerWasteReceive",
  "smokeOrder",
  "dispatch",
  "cmReceive",
  "smoked",
  "return",
  "smokingInvoice",
  "pay",
  "reimburse",
  "packingList",
  "foodivaReturnReceive",
  "sale",
  "receive",
  "influencerBox",
  "transferReceive",
  "daily",
  "opening",
  "stockItem",
  "expense",
  "income",
  "transfer",
] as const;
export type NoteKind = (typeof noteKinds)[number];
export const isNoteKind = (kind: EntryKind): kind is NoteKind =>
  (noteKinds as readonly EntryKind[]).includes(kind);
/** The steps of a PO รมควัน after its own `smokeOrder` (which opens it), in order
 *  (V2-LOT-01). A `dispatch` is one round; `roundKinds` are jotted once per round; the
 *  invoice once per PO รมควัน. None is forced and any order is taken (lotInfo.missing). */
export const coreLotKinds = [
  "dispatch",
  "cmReceive",
  "smoked",
  "return",
  "smokingInvoice",
] as const;
export type CoreLotKind = (typeof coreLotKinds)[number];
/** The steps of one dispatch round: each names its round in `dispatchId`. */
export const roundKinds = ["cmReceive", "smoked", "return"] as const;
export type RoundKind = (typeof roundKinds)[number];
export const isRoundKind = (kind: EntryKind): kind is RoundKind =>
  (roundKinds as readonly EntryKind[]).includes(kind);
/** Kinds a lot holds at most one live entry of: a PO's invoice (one invoice, one PO). */
export const oncePerLotKinds: EntryKind[] = ["smokingInvoice", "meatInvoice"];
/** Where a kind sits in the picker and what lot it is jotted on: an existing PO รมควัน
 *  (`batch`, required), a PO เนื้อ (`po`), a PO รมควัน or none (`optional`), or no lot.
 *  `purchase` opens a PO เนื้อ and `smokeOrder` a PO รมควัน: nothing else opens a lot. */
export const kindInfo: Record<
  NoteKind,
  {
    group: "lot" | "money" | "extra" | "branch" | "ledger";
    lot?: "batch" | "po" | "optional";
  }
> = {
  purchase: { group: "lot" },
  meatInvoice: { group: "lot", lot: "po" },
  ownerWasteReceive: { group: "lot", lot: "po" },
  smokeOrder: { group: "lot" },
  dispatch: { group: "lot", lot: "batch" },
  cmReceive: { group: "lot", lot: "batch" },
  smoked: { group: "lot", lot: "batch" },
  return: { group: "lot", lot: "batch" },
  smokingInvoice: { group: "lot", lot: "batch" },
  pay: { group: "money" },
  reimburse: { group: "money" },
  income: { group: "money" },
  packingList: { group: "extra", lot: "batch" },
  foodivaReturnReceive: { group: "extra", lot: "batch" },
  sale: { group: "branch" },
  receive: { group: "branch", lot: "optional" },
  influencerBox: { group: "branch" },
  transferReceive: { group: "branch" },
  daily: { group: "branch" },
  opening: { group: "branch" },
  stockItem: { group: "branch" },
  expense: { group: "ledger" },
  transfer: { group: "ledger" },
};
/** The pages a note is jotted from (`Tab` in lib/nav.ts, minus the ones with no picker:
 *  Daily Log is for looking), each with its kinds in the order its buttons stand. */
export type NotePage =
  "lots" | "meatStock" | "stock" | "sales" | "finance" | "accounting";
const pageNoteKinds: Record<NotePage, NoteKind[]> = {
  lots: [
    "purchase",
    "meatInvoice",
    "ownerWasteReceive",
    "smokeOrder",
    "dispatch",
    "cmReceive",
    "smoked",
    "return",
    "smokingInvoice",
    "packingList",
    "foodivaReturnReceive",
  ],
  // A branch's Stock and Inventory. It has no Finance, so `pay` stands on both. The Owner's
  // two pages have none. The daily sheet, the opening stock and a list item (`daily`,
  // `opening`, `stockItem`) are saved by the sheet on the page, like `transferReceive`.
  meatStock: ["receive", "pay"],
  stock: ["pay"],
  // A branch's Sales (the Owner has no such page, and may jot neither).
  sales: ["sale", "influencerBox"],
  finance: ["pay", "reimburse", "income"],
  // The ledger's hand-jotted rows (the PO rows are worked out, never jotted).
  accounting: ["expense", "income"],
};
/** The kinds an account may jot (V2-ACC): a branch its own kinds and its payments (never an
 *  `expense` or an `income`: the ledger is the Owner's), the Owner everything but a branch's kinds. `mutate`
 *  refuses the rest. */
export const kindsFor = (by: Actor): NoteKind[] =>
  noteKinds.filter((kind) =>
    by.role === "branch"
      ? kindInfo[kind].group === "branch" || kind === "pay"
      : kindInfo[kind].group !== "branch",
  );
/** The kinds the picker of `page` offers `by`, in the page's order. Overview, Daily Log,
 *  Settings and any other page: none. */
export const kindsForPage = (by: Actor, page: string): NoteKind[] => {
  // The Owner's `pay` is jotted from Finance, not from the Stock and Inventory it only looks
  // at; on Inventory it moves stock between the warehouses. A branch's receipt of a transfer
  // (`transferReceive`) is on no page's buttons: the pending transfer has its own.
  if (page === "meatStock" && by.role !== "branch") return [];
  if (page === "stock" && by.role !== "branch") return ["transfer"];
  const may = kindsFor(by);
  return (pageNoteKinds[page as NotePage] ?? []).filter((kind) =>
    may.includes(kind),
  );
};
/** Who is acting: an `Account` is one. */
export type Actor = { role: ActingRole; branch?: string };
export type Entry = {
  id: string;
  kind: EntryKind;
  role: Role;
  lotId: string;
  branch: string;
  date: string;
  at: string;
  values: Values;
  /** "owner": the Owner jotted a branch kind for the branch, on old entries only (no account
   *  jots for a branch now). Absent: the role's own account. */
  actor?: "owner";
};
export type Lot = {
  id: string;
  poId: string;
  /** A PO: the live `purchase` entry's values, for the PO document. A Lot: empty. Either is
   *  `{ deleted: "1" }` once no live entry is left on it. Every figure is derived from `entries`. */
  values: Values;
  config: Values;
  /** "shipment" = one PO รมควัน; absent = a PO เนื้อ. */
  kind?: "shipment";
  /** Carried over from the shop's old workbook: listed on Old Lots, not Lots. */
  old?: true;
};
export type Database = {
  version: 9;
  lots: Lot[];
  entries: Entry[];
  config: Values;
};
const roleName = {
  owner: "Owner",
  foodiva: "Foodiva",
  cm: "Chef House",
  branch: "ผู้ดูแลสาขา",
};
/** Who wrote an entry, for the log: an entry jotted for someone else says so
 *  ("Owner · แทน ผู้ดูแลสาขา"). */
export const entryBy = (e: Pick<Entry, "role" | "actor">) =>
  `${roleName[e.actor ?? e.role]}${
    e.actor && e.role !== "owner" ? ` · แทน ${roleName[e.role]}` : ""
  }`;
export const branches = ["ศาลาแดง", "มีนบุรี"];
/** Where stock is kept (a "place"): the central warehouse, or a branch by its name. */
export const centralPlace = "central";
export const places = [centralPlace, ...branches];
/** Label of a place: "คลังกลาง" or `สาขา${branch}`. */
export const placeLabel = (place: string) =>
  place === centralPlace ? "คลังกลาง" : `สาขา${place}`;
/** The project every PO belongs to: the sidebar section of the shop's pages (nav.ts). What an
 *  `expense` buys for it is its stock (stockMoves). */
export const shopProject = "Nerdnuea x LINE MAN";
/** Kinds jotted on a PO รมควัน. Sent with `lotId === ""` they open a new one. */
export const batchKinds: EntryKind[] = noteKinds.filter(
  (kind) => kindInfo[kind].lot === "batch",
);
/** Title per entry kind: the picker button, the form heading and the row. A retired kind
 *  keeps the title it had. */
export const titles: Record<EntryKind, string> = {
  purchase: "PO เนื้อ",
  meatInvoice: "บันทึก Invoice Foodiva",
  smokeOrder: "PO รมควัน",
  dispatch: "ส่งไปรมควัน",
  cmReceive: "รับเนื้อที่ Chef House",
  smoked: "น้ำหนักหลังรมควัน",
  return: "ส่งกลับ",
  smokingInvoice: "บันทึก Invoice Chef House",
  pay: "จ่ายเงิน",
  reimburse: "คืนเงินพนักงาน",
  income: "บันทึกรายรับ",
  packingList: "Packing List",
  foodivaReturnReceive: "รับเข้าตู้ที่ Foodiva",
  ownerWasteReceive: "รับ Waste",
  sale: "ยอดขาย",
  receive: "รับเนื้อเข้าสาขา",
  influencerBox: "กล่องแจก",
  transfer: "จัดสรรสินค้า",
  transferReceive: "ยืนยันรับสินค้า",
  daily: "ใบสต๊อกรายวัน",
  opening: "ตั้งสต๊อกเริ่มต้น",
  stockItem: "รายการสินค้า",
  config: "บันทึกการตั้งค่า",
  void: "ลบรายการ",
  entryEdit: "แก้ไขรายการ",
  // Retired.
  meatCount: "นับเนื้อคงเหลือ",
  materials: "นับวัสดุคงเหลือ",
  central: "รับกลับเข้าสต๊อกกลาง",
  prepare: "น้ำหนักก่อนสโมค",
  smoke: "สโมค",
  meatPayment: "ชำระ Invoice เนื้อ Foodiva",
  smokeOrderAccept: "ยืนยันรับ PO รมควัน",
  invoiceReview: "ตรวจยอด Invoice ค่ารมควัน",
  invoicePayment: "ชำระ Invoice ค่ารมควัน",
  foodivaConfirm: "ออกและอัปโหลด Invoice เนื้อ",
  closeLot: "ยืนยันปิด Lot",
  chefEdit: "Edit ข้อมูลก่อนปิด Lot",
  allocate: "จัดสรรไปสาขา",
  thaw: "แบ่งละลายเนื้อ",
  supplyPurchase: "ซื้อข้าวเหนียวและน้ำพริกเข้าสต๊อก",
  supplyIssue: "บันทึกเบิกข้าวเหนียวและน้ำพริก",
  ricePurchase: "ซื้อข้าวเหนียวเข้าสต๊อก",
  chiliPurchase: "ซื้อน้ำพริกเข้าสต๊อก",
  chiliReceive: "รับน้ำพริกเข้าสาขา",
  riceIssue: "เบิกข้าวเหนียวดิบวันนี้",
  chiliIssue: "เบิกน้ำพริกวันนี้",
  rice: "ข้าวเหนียวช่วงเช้า",
  riceCarry: "ยืนยันข้าวเหนียวสุกคงเหลือ",
  materialReceive: "บันทึกซื้อวัสดุเข้าคลัง Owner",
  generalPurchase: "บันทึกการซื้ออื่น ๆ",
  materialConfirm: "รับวัสดุเข้าสาขา",
  closeDay: "ยืนยันปิดวัน",
  // V1 "ค่าใช้จ่าย Owner" retired; the kind now holds a hand-jotted row of the purchase ledger.
  expense: "บันทึกค่าใช้จ่าย",
  unlock: "ปลดล็อกวัน",
  editRequest: "ขอแก้ไขรายการ",
  editDecision: "พิจารณาคำขอแก้ไข",
  link: "ผูกรายการย้อนหลัง",
  // No title ever: the log showed the raw kind for it, and still does.
  steakTransfer: "steakTransfer",
};
/** Kinds whose values can be corrected after they were saved (V2-PG-03): every note but a
 *  list item, which is saved again (a `stockItem` naming its id), and a transfer's receipt,
 *  which is deleted instead. The edit is an `entryEdit` laid over the entry. */
export const editableKinds: EntryKind[] = noteKinds.filter(
  (kind) => kind !== "stockItem" && kind !== "transferReceive",
);
/** Kinds a `void` may name: all but the settings (saved again from their page). A delete
 *  included: that puts the entry back. */
export const voidableKinds: EntryKind[] = entryKinds.filter(
  (kind) => kind !== "config",
);
/** Values an edit may not change: the branch a payment's stock goes to. An entry's branch is
 *  fixed when it is saved (the other branch's account never receives it), so that is a
 *  delete and a new entry. */
export const editLockedKeys = ["branch"];
/** Kinds an edit may move to another lot (`toLotId`). A PO itself is its lot; a dispatch
 *  round and its steps stay on theirs (delete and jot again). */
export const lotMovableKinds: EntryKind[] = [
  ...batchKinds.filter((kind) => kind !== "dispatch" && !isRoundKind(kind)),
  "ownerWasteReceive",
  "meatInvoice",
  "receive",
];
/** Changes to other entries: an edit and a delete, each a row of its own in the Daily Log. */
export const changeKinds: EntryKind[] = ["entryEdit", "void"];
/** V2-RUL-02: a core field left empty is saved anyway and listed in the entry's `missing`
 *  (comma-separated keys), shown as this label. */
export const missingText = "ยังไม่ได้จด";
export const missingKeys = (v: Values) =>
  v.missing ? v.missing.split(",") : [];
/** An edit stores the corrected values as `to.<key>` and the ones it replaced as `from.<key>`:
 *  flat keys, so the server strips hidden ones from them like from any other entry. */
export const pack = (prefix: string, values: Values) =>
  Object.fromEntries(
    Object.entries(values)
      .filter(([key]) => key !== "attachmentData")
      .map(([key, value]) => [prefix + key, value]),
  );
export const unpack = (prefix: string, values: Values): Values =>
  Object.fromEntries(
    Object.entries(values)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value]),
  );
/** Whose change (edit, delete, undo) of an entry counts when the log is read: the Owner's of
 *  any, a branch's only of one stamped with its own branch. `entries()` ignores the rest, and
 *  so does append_entries. A new change is refused by `editBlock` / `voidBlock`, which are
 *  stricter: the Owner no longer changes a branch's note, but its old changes still apply. */
export const canChange = (
  by: { role: Role; branch?: string },
  target: Pick<Entry, "role" | "branch">,
) =>
  by.role === "owner" ||
  (by.role === "branch" &&
    target.role === "branch" &&
    target.branch === by.branch);
/** Entries whose `to.` values overlay their target: an edit by an account that may change the
 *  target. A forged edit of another account's entry changes nothing. */
export const isEditOverlay = (
  e: Entry,
  target?: Pick<Entry, "role" | "branch">,
) =>
  e.kind === "entryEdit" &&
  (e.role === "owner" || (!!target && canChange(e, target)));
/* Settings kept as JSON lists in `config` (Settings page). */
type Channel = { key: string; name: string; gp: number };
/** `id` is what entries name (`used.<id>`, a payment's `item`) and never changes; `sku` is the
 *  code people read, issued by `mutate` when the list is saved ("" until then); `unit` is what
 *  the item is counted in. */
export type Material = {
  id: string;
  sku: string;
  name: string;
  unit: string;
};
type PayCategory = { id: string; name: string };
const listDefaults = {
  salesChannels: JSON.stringify([
    { key: "lineMan", name: "LINE MAN", gp: "10" },
  ]),
  // The shop's daily stock sheet, in its order: name, unit.
  materialList: JSON.stringify(
    [
      ["กล่องบรรจุ", "กล่อง"],
      ["ซองเนื้อ", "ซอง"],
      ["ซองข้าวเหนียว", "ซอง"],
      ["ถุงกระดาษ", "ถุง"],
      ["น้ำพริกถุง (1kg)", "ถุง"],
      ["ถ้วยกระดาษ", "ถ้วย"],
      ["น้ำพริกพร้อมใช้ (ถ้วย)", "ถ้วย"],
      ["กระดาษรองกล่อง", "แพ็ค"],
      ["ถุงมือดำ", "กล่อง"],
      ["ทิชชู", "ห่อ"],
      ["ถุงซีล", "ถุง"],
      ["หมวกคลุมผม", "ชิ้น"],
      ["ถุงดำ", "ถุง"],
      ["เกลือ", "กล่อง"],
      ["น้ำยาล้างจาน", "แกลลอน"],
      ["สติ๊กเกอร์วิธีอุ่น", "แผ่น"],
      ["สติ๊กเกอร์น้ำพริก", "แผ่น"],
      ["สติ๊กเกอร์แถบยาว", "แผ่น"],
      ["กระดาษความร้อน", "ม้วน"],
      ["ถ่าน AA", "ก้อน"],
      ["ถ่าน AAA", "ก้อน"],
      ["หน้ากากอนามัย", "กล่อง"],
      ["ถุงหิ้วพลาสติกใส 12x20", "ห่อ"],
    ].map(([name, unit], index) => ({
      id: `m${index + 1}`,
      sku: `SKU-${String(index + 1).padStart(4, "0")}`,
      name,
      unit,
    })),
  ),
  payCategories: JSON.stringify([
    { id: "meat", name: "เนื้อ" },
    { id: "smoke", name: "ค่ารม" },
    { id: "packaging", name: "แพ็กเกจ/วัสดุ" },
    { id: "ingredient", name: "วัตถุดิบ" },
    { id: "payroll", name: "ค่าแรง" },
    { id: "rent", name: "ค่าเช่า/น้ำไฟ" },
    { id: "transport", name: "ขนส่ง" },
    { id: "marketing", name: "การตลาด" },
    { id: "capex", name: "อุปกรณ์/ลงทุน" },
    { id: "other", name: "อื่น ๆ" },
  ]),
  // Nothing until the Owner sets it: a box takes no stock.
  boxRecipe: "[]",
};
/** A list setting as stored; anything unreadable (or not there yet) is the default. */
function list(config: Values, key: keyof typeof listDefaults): Values[] {
  try {
    const parsed: unknown = JSON.parse(config[key] ?? listDefaults[key]);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return JSON.parse(listDefaults[key]);
}
/** The sale form has one money field per channel (`key`); `gp` is the channel's GP %. */
export const salesChannels = (config: Values): Channel[] =>
  list(config, "salesChannels").map((c) => ({
    key: c.key,
    name: c.name,
    gp: Number(c.gp) || 0,
  }));
/** V2-CAL-01: the money of a sale brought in from the shop's old books, already after the
 *  channel's GP: counted in the sales, GP 0. Not a channel of Settings (`checkConfig` refuses
 *  the key) and not a field of the sale form: nobody jots it, only imported entries carry it. */
export const legacySale = {
  key: "sales.legacy",
  name: "ยอดเดิม (หลัง GP แล้ว)",
};
/** What an `income` note is (V2-PAY-09): money beyond the branches' sales, which is revenue,
 *  or the cash a sales channel paid for sales already jotted, which is not (it would count
 *  twice). One with no type reads as `other`. */
export const incomeTypes = {
  other: "รายได้อื่น",
  sales: "รับเงินค่าขาย",
} as const;
/** A sale the old books give no branch for is stored with `branch: ""` and reads as this. */
export const noBranch = "ไม่ระบุสาขา";
/** The material list as Settings last saved it. The list in use is `materialList(db)`
 *  (derived.ts): this one with the branches' `stockItem` notes since laid over. A row saved
 *  before units has none: it reads as ชิ้น, what a count was in. */
export const configMaterials = (config: Values): Material[] =>
  list(config, "materialList").map((m) => ({
    id: m.id,
    sku: m.sku ?? "",
    name: m.name,
    unit: m.unit || "ชิ้น",
  }));
/** The items of the recipe typed in grams a box; a branch's sheet counts them in kg. */
export const gramItems = ["meat", "rice"];
/** 「สูตรต่อกล่อง」: what one box sold or given away takes from a branch's stock (V2-CAL-10), by
 *  item id (`meat`, `rice`, `chili`, a material's), as Settings holds it: grams for
 *  `gramItems`, tubes for the chili, a material's own unit. A row left empty or at 0 is not in
 *  it: boxes take none of that item. */
export const boxRecipe = (config: Values): Map<string, number> =>
  new Map(
    list(config, "boxRecipe")
      .map((row): [string, number] => [row.id, Number(row.qty) || 0])
      .filter(([, qty]) => qty > 0),
  );
export const payCategories = (config: Values): PayCategory[] =>
  list(config, "payCategories").map(({ id, name }) => ({ id, name }));
/* The ten category ids of the seed are fixed: these rules hang on them. */
export const payrollCategory = "payroll",
  rentCategory = "rent",
  capexCategory = "capex";
/** Categories whose payment may carry an item and a quantity that go into a branch's stock (V2-PAY-05). */
export const stockCategories = ["packaging", "ingredient"];
/** The categories a branch account pays in (V2-ACC-07). */
export const branchCategories = [
  "ingredient",
  "packaging",
  "transport",
  "other",
];
export const ingredients = [
  { id: "rice", name: "ข้าวเหนียว" },
  { id: "chili", name: "น้ำพริก" },
  { id: "brine", name: "น้ำดอง" },
];
/** A branch's two daily sheets: its Stock page (meat, raw rice, chili) and its Inventory page
 *  (the material list). */
export const sheets = ["meat", "materials"] as const;
export type Sheet = (typeof sheets)[number];
/** The branches that steam their own sticky rice, so keep raw rice on their sheet (V2-BR-08); the others
 *  buy it cooked and have no rice row anywhere. Anything unreadable is the seed's list. */
export const rawRiceBranches = (config: Values): string[] => {
  for (const stored of [config.rawRiceBranches, seed.config.rawRiceBranches])
    try {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  return [];
};
/** A payer that is not an advance (V2-PAY-07). */
export const companyPayer = "บริษัท";
export const seed: Database = {
  version: 9,
  lots: [],
  entries: [],
  config: {
    boxPrice: "350",
    packKg: "0.12",
    packCost: "25",
    /* A round trip to Chef House and back (both legs), the default of a `return` note's
     * shippingFee. The smoke service rate per kg: under 1,000 kg, from 1,000, from 1,500. */
    shippingFee: "6000",
    smokeRate: "220",
    smokeRate1000: "200",
    smokeRate1500: "180",
    ...listDefaults,
    // The old ERP's split: ศาลาแดง steams its rice, มีนบุรี buys it cooked.
    rawRiceBranches: JSON.stringify(["ศาลาแดง"]),
    /* The last `stockItem` entry the saved materialList already holds ("" = none): only the
     * ones after it are laid over the list (materialList in derived.ts). */
    materialListAfter: "",
    companyName: "บริษัท เนิร์ดเนื้อ จำกัด",
    companyAddress: "",
    attention: "",
    companyPhone: "",
    taxId: "",
    foodivaContact: "",
    foodivaAddress: "",
    chefHouseContact: "",
    chefHouseAddress: "",
    /* Legacy: a data URL kept only so logos saved before the move to storage still show.
     * New uploads set logoStorageKey (`branding/…`, see attachment-store.ts) instead. */
    logoData: "",
    logoStorageKey: "",
    logoName: "",
  },
};

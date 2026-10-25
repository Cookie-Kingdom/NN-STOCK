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
 *  counts (`meatCount`, `materials`): a branch's stock is its daily sheet (`daily`). And the
 *  opening stock (`opening`, retired 2026-10-14): a branch starts empty, and everything it
 *  holds comes in by a transfer, a receipt or its own payment. And the Packing List and the
 *  receipt into Foodiva's freezer (`packingList`, `foodivaReturnReceive`, retired 2026-10-20):
 *  a PO รมควัน that has a Packing List keeps its document. */
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
  "sale",
  "receive",
  "influencerBox",
  "transferReceive",
  "daily",
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
    group: "lot" | "money" | "branch" | "ledger";
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
  sale: { group: "branch" },
  receive: { group: "branch", lot: "optional" },
  influencerBox: { group: "branch" },
  transferReceive: { group: "branch" },
  daily: { group: "branch" },
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
  ],
  // A branch's Stock and Inventory. It has no Finance, so `pay` stands on both. The Owner's
  // two pages have none. The daily sheet and a list item (`daily`, `stockItem`) are saved by
  // the sheet on the page, like `transferReceive`.
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
  /** A PO: the live `purchase` entry's values, for the PO document. A Lot: its live
   *  `smokeOrder`'s `meatType` (a branch receives the Lots, not the order). Either is
   *  `{ deleted: "1" }` once no live entry is left on it. Every figure is derived from `entries`. */
  values: Values;
  config: Values;
  /** "shipment" = one PO รมควัน; absent = a PO เนื้อ. */
  kind?: "shipment";
  /** Carried over from the shop's old workbook: on no page, and not counted as stock. */
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
/** Where smoked meat is kept until a `transfer` on its PO รมควัน sends it to a branch: at
 *  Foodiva, with the waste meat. A meat transfer's `from`; no SKU is ever kept there. */
export const foodivaPlace = "foodiva";
/** Label of a place: "คลังกลาง", "Foodiva" or `สาขา${branch}`. */
export const placeLabel = (place: string) =>
  place === centralPlace
    ? "คลังกลาง"
    : place === foodivaPlace
      ? "Foodiva"
      : `สาขา${place}`;
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
  ownerWasteReceive: "รับเนื้อรอรับ",
  sale: "ยอดขาย",
  receive: "รับเนื้อเข้าสาขา",
  influencerBox: "กล่องแจก",
  transfer: "จัดสรรสินค้า",
  transferReceive: "ยืนยันรับสินค้า",
  daily: "ใบสต๊อกรายวัน",
  stockItem: "รายการสินค้า",
  config: "บันทึกการตั้งค่า",
  void: "ลบรายการ",
  entryEdit: "แก้ไขรายการ",
  // Retired.
  packingList: "Packing List",
  foodivaReturnReceive: "รับเข้าตู้ที่ Foodiva",
  opening: "ตั้งสต๊อกเริ่มต้น",
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
/* Settings kept as JSON lists in `config` (Settings page). A row deleted in Settings stays in
 * its list as `removed: "1"` (a product's `removed: true`): the readers still return it, so what
 * was jotted of it still counts and names it, but no Settings list, form or choice offers it
 * again (`live`), save on a note that already holds it. */
type Removed = { removed?: string };
/** The flag of a removed row, as the readers return it. */
const removedOf = (row: unknown): Removed =>
  (row as Values | undefined)?.removed ? { removed: "1" } : {};
/** The rows of a list not deleted in Settings. */
export const live = <T extends { removed?: unknown }>(rows: T[]) =>
  rows.filter((row) => !row.removed);
type Channel = { key: string; name: string; gp: number } & Removed;
/** `id` is what entries name (`used.<id>`, a payment's `item`) and never changes; `sku` is the
 *  code people read, issued by `mutate` when the list is saved ("" until then); `unit` is what
 *  the item is counted in. */
export type Material = {
  id: string;
  sku: string;
  name: string;
  unit: string;
} & Removed;
type PayCategory = { id: string; name: string } & Removed;
const listDefaults = {
  // รายการเนื้อ: one kind until the Owner adds another (meatTypes).
  meatTypes: JSON.stringify([{ id: "meat", code: "RM-0001", name: "เนื้อ" }]),
  // รายชื่อวัตถุดิบ: empty until Accounting buys one or the Owner adds one (ingredientList).
  ingredientList: "[]",
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
  // Read only until 「รายการสินค้า」 is saved (products): the standard box's components.
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
    ...removedOf(c),
  }));
/** V2-CAL-01: the money of a sale brought in from the shop's old books, already after the
 *  channel's GP: counted in the sales, GP 0. Not a channel of Settings (`checkConfig` refuses
 *  the key) and not a field of the sale form: nobody jots it, only imported entries carry it. */
/** A branch's sale: the day's total from its order machine, whatever the channels in Settings.
 *  Typed, it is the sale's money (`saleMoney`); the channels' fields only break it down. */
export const saleTotal = { key: "salesTotal", name: "ยอดขายรวม" };
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
    ...removedOf(m),
  }));
/** A code the web issues for a row of a Settings list: `<prefix>-0001` up, one sequence per
 *  prefix (`RM` a kind of meat, `ING` an ingredient), apart from the `SKU-` and `PRD-` ones. */
export const codeNumber = (prefix: string, code = "") =>
  Number(new RegExp(`^${prefix}-(\\d+)$`).exec(code)?.[1] ?? 0);
export const codeText = (prefix: string, n: number) =>
  `${prefix}-${String(n).padStart(4, "0")}`;
/** A kind of meat of 「รายการเนื้อ」, bought, smoked and stocked apart from the others (a
 *  breed, a cut: the name says which). `id` is what notes name: a PO's and a Lot's
 *  `meatType`, a product's component, a branch sheet's row. The first is `meat`, the meat
 *  every note saved before the list is of (never removed); one added later is `meat-<id>`,
 *  removable (Settings: `removed`, still read). `code` (`RM-0001` up) is only the code people
 *  read, issued by `mutate` when the list is saved ("" until then); `meat`'s is RM-0001. */
export type MeatType = { id: string; code: string; name: string } & Removed;
export const meatItem = "meat";
const firstMeatCode = "RM-0001";
export const isMeatItem = (id: string) =>
  id === meatItem || id.startsWith("meat-");
/** 「รายการเนื้อ」 as Settings holds it (`config.meatTypes`), `meat` always first. */
export const meatTypes = (config: Values): MeatType[] => {
  const rows = list(config, "meatTypes")
    .filter((row) => isMeatItem(String(row?.id ?? "")))
    .map((row) => ({
      id: String(row.id),
      code:
        String(row.code ?? "") || (row.id === meatItem ? firstMeatCode : ""),
      name: String(row.name ?? "").trim() || "เนื้อ",
      ...removedOf(row),
    }));
  const first = rows.find((row) => row.id === meatItem) ?? {
    id: meatItem,
    code: firstMeatCode,
    name: "เนื้อ",
  };
  return [first, ...rows.filter((row) => row.id !== meatItem)];
};
/** The kind of meat of a PO เนื้อ or a Lot รมควัน (`values.meatType`); one saved before the
 *  list is of `meat`. */
export const meatTypeOf = (lot?: Pick<Lot, "values">) =>
  lot?.values.meatType || meatItem;
/** A kind of meat's name; an id no longer in the list reads as itself. */
export const meatTypeName = (config: Values, id: string) =>
  meatTypes(config).find((type) => type.id === id)?.name ?? id;
/** An ingredient of 「รายชื่อวัตถุดิบ」 (`config.ingredientList`, rows `{ id, code, name, unit }`):
 *  bought on Accounting (ประเภท วัตถุดิบ, which adds it) and stocked like a material, but on a
 *  branch's Stock sheet beside the meat. Its `code` (`ING-0001` up, issued by `mutate`) is its
 *  SKU: what an expense, a transfer and the warehouses' moves name it by. `id` is `ing-<id>`,
 *  so `sheetOf` tells it apart with no list at hand. Read as a `Material` (`sku` = the code). */
export const isIngredientItem = (id: string) => id.startsWith("ing-");
/** The ประเภทสินค้า of an Accounting `expense` that buys an ingredient. */
export const ingredientType = "วัตถุดิบ";
export const ingredientList = (config: Values): Material[] =>
  list(config, "ingredientList")
    .filter((row) => isIngredientItem(String(row?.id ?? "")))
    .map((row) => ({
      id: row.id,
      sku: row.code ?? "",
      name: row.name,
      unit: row.unit || "ชิ้น",
      ...removedOf(row),
    }));
/** The components typed in grams a piece (each kind of meat); a sheet counts them in kg. */
export const isGramItem = isMeatItem;
/** A product of 「รายการสินค้า」: `items` is what one piece sold or given away takes from a
 *  branch's stock (V2-CAL-10), by item id (`meat`, `rice`, `chili`, a material's): grams for
 *  `gramItems`, tubes for the chili, a material's own unit. A component left empty or at 0 is
 *  not in it. `code` is the code people read, issued by `mutate` when the list is saved (""
 *  until then). `off` (หยุดขาย): no new sale or gift is offered it; what was jotted of it still
 *  counts everywhere. `removed` (deleted in Settings): the same, and it leaves the Settings list
 *  too. */
export type Product = {
  id: string;
  code: string;
  name: string;
  unit: string;
  off: boolean;
  removed: boolean;
  items: Map<string, number>;
};
/* รหัสสินค้า: `PRD-0001` up, a sequence of its own beside the materials' `SKU-`. */
export const productCodeNumber = (code = "") =>
  Number(/^PRD-(\d+)$/.exec(code)?.[1] ?? 0);
export const productCodeText = (n: number) =>
  `PRD-${String(n).padStart(4, "0")}`;
/** The standard box: the first product, renamed but never removed. */
export const boxProduct = "box";
/** The unit of a product with none typed: a row saved before units has none. */
export const productUnit = (id: string) =>
  id === boxProduct ? "กล่อง" : "ชิ้น";
const itemsOf = (rows: unknown): Map<string, number> =>
  new Map(
    (Array.isArray(rows) ? rows : [])
      .map((row): [string, number] => [row?.id, Number(row?.qty) || 0])
      .filter(([id, qty]) => id && qty > 0),
  );
/** 「รายการสินค้า」 as Settings holds it (`config.products`). Before any was saved it is the
 *  standard box alone, made of the old 「สูตรต่อกล่อง」 (`config.boxRecipe`, which nothing
 *  writes any more). */
export const products = (config: Values): Product[] => {
  let rows: unknown;
  try {
    rows = JSON.parse(config.products ?? "");
  } catch {}
  return Array.isArray(rows) && rows.length
    ? rows.map((row) => ({
        id: String(row?.id ?? ""),
        code: String(row?.code ?? ""),
        name: String(row?.name ?? ""),
        unit:
          String(row?.unit ?? "").trim() || productUnit(String(row?.id ?? "")),
        off: row?.off === true,
        removed: row?.removed === true,
        items: itemsOf(row?.items),
      }))
    : [
        {
          id: boxProduct,
          code: "",
          name: "กล่องมาตรฐาน",
          unit: productUnit(boxProduct),
          off: false,
          removed: false,
          items: itemsOf(list(config, "boxRecipe")),
        },
      ];
};
/** The value of a `sale` or an `influencerBox` note that holds its count of a product: the
 *  box's stays `boxes`, where every note saved before the list has it. */
export const productKey = (id: string) =>
  id === boxProduct ? "boxes" : `product.${id}`;
export const isProductKey = (key: string) =>
  key === "boxes" || key.startsWith("product.");
export const productQty = (product: Product, values: Values) =>
  Number(values[productKey(product.id)]) || 0;
/** The pieces of a `sale` or an `influencerBox` note, over every product of `list` (a product
 *  deleted in Settings included: it is still in the list, `removed`). */
export const pieces = (list: Product[], values: Values) =>
  list.reduce((a, product) => a + productQty(product, values), 0);
/** The word pieces are counted in: the product's own unit while it is the only one. */
export const pieceUnit = (list: Product[]) =>
  list.length > 1 ? "ชิ้น" : (list[0]?.unit ?? "กล่อง");
/** A product's selling price and its cost beside the meat, per piece (`config.productMoney`,
 *  the Owner's only); null where none is set. The box's default to the old `boxPrice` and
 *  `packCost` until it has a row. `prices`: its price per sales channel, by the channel's
 *  key, as typed (`channelPrice` reads one). */
export const productMoney = (config: Values, id: string) => {
  let rows: unknown;
  try {
    rows = JSON.parse(config.productMoney ?? "");
  } catch {}
  const row: Values | undefined = Array.isArray(rows)
    ? rows.find((row) => row?.id === id)
    : undefined;
  const figure = (value = "") => (value === "" ? null : Number(value) || 0);
  const typed: unknown = row?.prices;
  const prices: Values =
    typed && typeof typed === "object" ? (typed as Values) : {};
  return row || id !== boxProduct
    ? { price: figure(row?.price), cost: figure(row?.cost), prices }
    : {
        price: figure(config.boxPrice),
        cost: figure(config.packCost),
        prices,
      };
};
/** A product's price on the sales channel `key`: its own there, else its base price. */
export const channelPrice = (config: Values, id: string, key: string) => {
  const { price, prices } = productMoney(config, id);
  return (prices[key] ?? "") === "" ? price : Number(prices[key]) || 0;
};
/** The meat in one piece of a product, in kg: its meat components (every kind, or only
 *  `type`), typed in grams. The box with no meat at all falls back to the old `packKg`, which
 *  is of `meat`. */
export const productMeatKg = (
  config: Values,
  product: Product,
  type?: string,
) => {
  let grams = 0;
  let any = false;
  for (const [id, qty] of product.items)
    if (isMeatItem(id)) {
      any = true;
      if (!type || id === type) grams += qty;
    }
  return grams
    ? grams / 1000
    : !any && product.id === boxProduct && (!type || type === meatItem)
      ? Number(config.packKg) || 0
      : 0;
};
export const payCategories = (config: Values): PayCategory[] =>
  list(config, "payCategories").map((row) => ({
    id: row.id,
    name: row.name,
    ...removedOf(row),
  }));
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
/** A branch's two daily sheets: its Stock page (meat, ingredients) and its Inventory page
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

/** The highest รหัสสินค้า number any list saved so far held (a removed product's is never
 *  given again): `mutate` issues the next, and a new product's popup shows it. */
export const lastProductCode = (db: Database) =>
  Math.max(
    0,
    ...[db.config, ...db.entries.map((e) => e.values)].flatMap((saved) =>
      saved.products
        ? products(saved).map((p) => productCodeNumber(p.code))
        : [],
    ),
  );
/** The highest `prefix` code ever issued in the `key` list: in the settings now, in every save
 *  of the list, and stamped on any entry (an ingredient's code is an expense's `sku`, an
 *  edit's `to.sku` / `from.sku`). `mutate` issues the next, so a removed row's is never given
 *  again. */
export const lastCode = (
  db: Database,
  key: "meatTypes" | "ingredientList",
  prefix: string,
) =>
  Math.max(
    0,
    ...[db.config, ...db.entries.map((e) => e.values)]
      .flatMap((saved) => [
        ...(saved[key] ? list(saved, key).map((row) => row?.code) : []),
        saved.sku,
        saved["to.sku"],
        saved["from.sku"],
      ])
      .map((code) => codeNumber(prefix, code)),
  );

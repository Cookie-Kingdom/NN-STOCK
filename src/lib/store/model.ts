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
] as const;
export type EntryKind = (typeof entryKinds)[number];
/** The kinds an account jots (v2), in the order the kind picker lists them. `central`,
 *  `prepare` and `smoke` are retired: `smoked` holds the weight after smoking. */
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
  "packingList",
  "foodivaReturnReceive",
  "sale",
  "receive",
  "meatCount",
  "influencerBox",
  "materials",
  "expense",
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
  packingList: { group: "extra", lot: "batch" },
  foodivaReturnReceive: { group: "extra", lot: "batch" },
  sale: { group: "branch" },
  receive: { group: "branch", lot: "optional" },
  meatCount: { group: "branch" },
  influencerBox: { group: "branch" },
  materials: { group: "branch" },
  expense: { group: "ledger" },
};
/** The pages a note is jotted from (`Tab` in lib/nav.ts, minus the ones with no picker:
 *  Daily Log is for looking), each with its kinds in the order its buttons stand. */
export type NotePage = "lots" | "stock" | "finance" | "accounting";
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
  // A branch's Inventory: every kind it jots. The Owner's and the Manager's has none.
  stock: ["sale", "pay", "receive", "meatCount", "influencerBox", "materials"],
  finance: ["pay"],
  // The purchase ledger's hand-jotted rows (the PO rows are worked out, never jotted).
  accounting: ["expense"],
};
/** The kinds an account may jot (V2-ACC): a branch its own kinds and its payments (never an
 *  `expense`: the ledger is the Owner's and the Account Manager's), the Owner and the Account
 *  Manager everything but a branch's kinds. `mutate` refuses the rest. */
export const kindsFor = (by: Actor): NoteKind[] =>
  noteKinds.filter((kind) =>
    by.role === "branch"
      ? kindInfo[kind].group === "branch" || kind === "pay"
      : kindInfo[kind].group !== "branch",
  );
/** The kinds the picker of `page` offers `by`, in the page's order. Overview, Daily Log,
 *  Settings and any other page: none. */
export const kindsForPage = (by: Actor, page: string): NoteKind[] => {
  // The Owner's `pay` is jotted from Finance, not from the Inventory it only looks at.
  if (page === "stock" && by.role !== "branch") return [];
  const may = kindsFor(by);
  return (pageNoteKinds[page as NotePage] ?? []).filter((kind) =>
    may.includes(kind),
  );
};
/** Who is acting: an `Account` is one. `hidesSales` is the Account Manager. */
export type Actor = { role: ActingRole; branch?: string; hidesSales?: boolean };
export type Entry = {
  id: string;
  kind: EntryKind;
  role: Role;
  lotId: string;
  branch: string;
  date: string;
  at: string;
  values: Values;
  /** "manager": the Account Manager wrote it, stamped at save by persistence and checked by
   *  save_app_state. "owner": the Owner jotted a branch kind for the branch, on old entries
   *  only (no account jots for a branch now). Absent: the role's own account (for "owner",
   *  the Owner). */
  actor?: "manager" | "owner";
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
/** Who wrote an entry, for the log: the Account Manager is told apart from the Owner, and an
 *  entry jotted for someone else says so ("Owner · แทน ผู้ดูแลสาขา"). Both actors act as "owner". */
export const entryBy = (e: Pick<Entry, "role" | "actor">) =>
  `${e.actor === "manager" ? "Account Manager" : roleName[e.actor ?? e.role]}${
    e.actor && e.role !== "owner" ? ` · แทน ${roleName[e.role]}` : ""
  }`;
export const branches = ["ศาลาแดง", "มีนบุรี"];
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
  packingList: "Packing List",
  foodivaReturnReceive: "รับเข้าตู้ที่ Foodiva",
  ownerWasteReceive: "รับ Waste",
  sale: "ยอดขาย",
  receive: "รับเนื้อเข้าสาขา",
  meatCount: "นับเนื้อคงเหลือ",
  influencerBox: "กล่องแจก",
  materials: "นับวัสดุคงเหลือ",
  config: "บันทึกการตั้งค่า",
  void: "ลบรายการ",
  entryEdit: "แก้ไขรายการ",
  // Retired.
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
/** Kinds whose values can be corrected after they were saved (V2-PG-03): every note but the
 *  material count, which is saved again from the Stock page, each round kept. The edit is an
 *  `entryEdit` laid over the entry. */
export const editableKinds: EntryKind[] = noteKinds.filter(
  (kind) => kind !== "materials",
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
/** Changes to other entries: the kinds the change log lists, newest first. */
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
 *  stricter: the Owner no longer changes a branch's note, but its old changes still apply.
 *  What the Account Manager may not touch is `managerHidden`. */
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
/** `id` is what entries name (`count.<id>`, a payment's `item`) and never changes; `sku` is the
 *  code people read, issued by `mutate` when the list is saved ("" until then). */
type Material = {
  id: string;
  sku: string;
  name: string;
  perBox: number | null;
};
type PayCategory = { id: string; name: string };
const listDefaults = {
  salesChannels: JSON.stringify([
    { key: "lineMan", name: "LINE MAN", gp: "10" },
  ]),
  // The ten materials of the ERP before v2, in its order.
  materialList: JSON.stringify([
    { id: "m1", sku: "SKU-0001", name: "กล่องพิมพ์ลาย", perBox: "1" },
    { id: "m2", sku: "SKU-0002", name: "กระดาษรอง", perBox: "" },
    { id: "m3", sku: "SKU-0003", name: "ถุงซีลเนื้อ", perBox: "1" },
    { id: "m4", sku: "SKU-0004", name: "ถุงซีลข้าว", perBox: "" },
    { id: "m5", sku: "SKU-0005", name: "ถุงหิ้วกระดาษ", perBox: "" },
    { id: "m6", sku: "SKU-0006", name: "สติกเกอร์โลโก้", perBox: "1" },
    {
      id: "m7",
      sku: "SKU-0007",
      name: "การ์ด / สติกเกอร์วิธีอุ่น",
      perBox: "",
    },
    { id: "m8", sku: "SKU-0008", name: "ถ้วยพริก", perBox: "" },
    { id: "m9", sku: "SKU-0009", name: "สติกเกอร์พริก", perBox: "" },
    { id: "m10", sku: "SKU-0010", name: "สติกเกอร์ข้าวเหนียว", perBox: "" },
  ]),
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
/** `perBox`: pieces one box uses, what a sale takes off the shelf between counts; null = not estimated. */
export const materialList = (config: Values): Material[] =>
  list(config, "materialList").map((m) => ({
    id: m.id,
    sku: m.sku ?? "",
    name: m.name,
    perBox: Number(m.perBox) || null,
  }));
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
/** The branches that steam their own sticky rice, so count the raw rice (V2-BR-08); the others
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

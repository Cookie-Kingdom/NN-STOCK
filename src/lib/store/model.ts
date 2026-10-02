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
] as const;
export type EntryKind = (typeof entryKinds)[number];
/** The kinds an account jots (v2), in the order the kind picker lists them. */
export const noteKinds = [
  "purchase",
  "smokeOrder",
  "dispatch",
  "central",
  "smokingInvoice",
  "pay",
  "cmReceive",
  "prepare",
  "smoke",
  "packingList",
  "return",
  "foodivaReturnReceive",
  "ownerWasteReceive",
  "sale",
  "receive",
  "meatCount",
  "influencerBox",
  "materials",
] as const;
export type NoteKind = (typeof noteKinds)[number];
export const isNoteKind = (kind: EntryKind): kind is NoteKind =>
  (noteKinds as readonly EntryKind[]).includes(kind);
/** The four notes a Lot is complete with (V2-LOT-01); the rest of a Lot's kinds never colour it. */
export const coreLotKinds = [
  "smokeOrder",
  "dispatch",
  "central",
  "smokingInvoice",
] as const;
/** Where a kind sits in the picker and what lot it is jotted on: a Lot (`batch`, a new one
 *  when none is picked), a PO เนื้อ (`po`), a Lot or none (`optional`), or no lot at all. */
export const kindInfo: Record<
  NoteKind,
  {
    group: "lot" | "money" | "extra" | "branch";
    lot?: "batch" | "po" | "optional";
  }
> = {
  purchase: { group: "lot" },
  smokeOrder: { group: "lot", lot: "batch" },
  dispatch: { group: "lot", lot: "batch" },
  central: { group: "lot", lot: "batch" },
  smokingInvoice: { group: "lot", lot: "batch" },
  pay: { group: "money" },
  cmReceive: { group: "extra", lot: "batch" },
  prepare: { group: "extra", lot: "batch" },
  smoke: { group: "extra", lot: "batch" },
  packingList: { group: "extra", lot: "batch" },
  return: { group: "extra", lot: "batch" },
  foodivaReturnReceive: { group: "extra", lot: "batch" },
  ownerWasteReceive: { group: "extra", lot: "po" },
  sale: { group: "branch" },
  receive: { group: "branch", lot: "optional" },
  meatCount: { group: "branch" },
  influencerBox: { group: "branch" },
  materials: { group: "branch" },
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
   *  save_app_state. "owner": the Owner jotted a branch kind for the branch, stamped by
   *  mutate (recordRole). Absent: the role's own account (for "owner", the Owner). */
  actor?: "manager" | "owner";
};
export type Lot = {
  id: string;
  poId: string;
  /** A PO: the live `purchase` entry's values, for the PO document. A Lot: empty. Either is
   *  `{ deleted: "1" }` once no live entry is left on it. Every figure is derived from `entries`. */
  values: Values;
  config: Values;
  /** "shipment" = one Lot รมควัน; absent = a PO เนื้อ. */
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
/** Kinds jotted on a Lot รมควัน. Sent with `lotId === ""` they open a new Lot. */
export const batchKinds: EntryKind[] = noteKinds.filter(
  (kind) => kindInfo[kind].lot === "batch",
);
/** Title per entry kind: the picker button, the form heading and the row. A retired kind
 *  keeps the title it had. */
export const titles: Record<EntryKind, string> = {
  purchase: "PO เนื้อ",
  smokeOrder: "PO รมควัน",
  dispatch: "ส่งไปรม",
  central: "รับกลับเข้าสต๊อกกลาง",
  smokingInvoice: "ค่ารม",
  pay: "จ่ายเงิน",
  cmReceive: "ชั่งรับที่ Chef House",
  prepare: "น้ำหนักก่อนสโมค",
  smoke: "สโมค",
  packingList: "Packing List",
  return: "รถขากลับ",
  foodivaReturnReceive: "รับเข้าตู้ที่ Foodiva",
  ownerWasteReceive: "รับเนื้อส่วนที่เหลือ",
  sale: "ยอดขาย",
  receive: "รับเนื้อเข้าสาขา",
  meatCount: "นับเนื้อคงเหลือ",
  influencerBox: "กล่องแจก",
  materials: "นับวัสดุคงเหลือ",
  config: "บันทึกการตั้งค่า",
  void: "ลบรายการ",
  entryEdit: "แก้ไขรายการ",
  // Retired.
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
  expense: "ค่าใช้จ่าย Owner",
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
/** Kinds an edit may move to another lot (`toLotId`). A PO itself is its lot. */
export const lotMovableKinds: EntryKind[] = [
  ...batchKinds,
  "ownerWasteReceive",
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
/** Who may change (edit, delete, undo) an entry: the Owner any, a branch only one stamped
 *  with its own branch. `mutate` refuses the rest, `entries()` ignores them, and so does
 *  append_entries. What the Account Manager may not touch is `managerHidden`. */
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
type Material = { id: string; name: string; perBox: number | null };
type PayCategory = { id: string; name: string };
const listDefaults = {
  salesChannels: JSON.stringify([
    { key: "lineMan", name: "LINE MAN", gp: "10" },
  ]),
  materialList: JSON.stringify([
    { id: "m1", name: "กล่องใหม่", perBox: "1" },
    { id: "m2", name: "กล่องเก่า", perBox: "" },
    { id: "m3", name: "ฟรอยข้าวเหนียว", perBox: "1" },
    { id: "m4", name: "ถุงซีลเนื้อ", perBox: "1" },
    { id: "m5", name: "ถุงหิ้วกระดาษ", perBox: "" },
    { id: "m6", name: "สติกเกอร์โลโก้", perBox: "1" },
    { id: "m7", name: "ถ้วยพริก", perBox: "" },
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
    ...listDefaults,
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

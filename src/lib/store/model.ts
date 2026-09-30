/** The domain's shapes and fixed tables: types, entry kinds, titles, edit rules, the seed. */
export type Role = "owner" | "foodiva" | "cm" | "branch";
/** Who can sign in and act: Foodiva and Chef House are entry stamps only (partners, not users). */
export type ActingRole = "owner" | "branch";
export type Values = Record<string, string>;
/** Every entry kind in the log (all but the legacy one are what `mutate` records). A kind
 *  outside this list is a compile error. */
export const entryKinds = [
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
  "chiliAllocate",
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
  "materialTransfer",
  "materialConfirm",
  "closeDay",
  "expense",
  "config",
  "unlock",
  "void",
  "entryEdit",
  "editRequest",
  "editDecision",
  // Ties an entry recorded without one to a shipment batch or a material transfer (LNK-01..05).
  "link",
  // Legacy, read only: raw beef moved to Steak by early builds (see rawAtFoodiva).
  "steakTransfer",
] as const;
export type EntryKind = (typeof entryKinds)[number];
export type Entry = {
  id: string;
  kind: EntryKind;
  role: Role;
  lotId: string;
  branch: string;
  date: string;
  at: string;
  values: Values;
  /** "manager": the Account Manager wrote it (C4), stamped at save by persistence and checked by
   *  save_app_state. "owner": the Owner recorded a Foodiva/Chef House kind for them, stamped by
   *  mutate (recordRole). Absent: the role's own account (for "owner", the Owner). */
  actor?: "manager" | "owner";
};
export type Lot = {
  id: string;
  poId: string;
  /** Cache of the latest values recorded on the lot (DM-09); every figure is derived from `entries`. */
  values: Values;
  config: Values;
  /** "shipment" = one smoking batch (Foodiva → Chef House → central stock); absent = a purchase PO. */
  kind?: "shipment";
};
/** One purchase PO's share of a smoke PO (`smokeOrder.values.lines`). */
export type ShipmentLine = { lotId: string; kg: number };
export type Database = {
  version: 9;
  lots: Lot[];
  entries: Entry[];
  config: Values;
};
export const roleName = {
  owner: "Owner",
  foodiva: "Foodiva",
  cm: "Chef House",
  branch: "ผู้ดูแลสาขา",
};
/** Who wrote an entry, for the log: the Account Manager is told apart from the Owner, and an
 *  entry typed for a partner says so ("Owner · แทน Chef House"). Both actors act as "owner". */
export const entryBy = (e: Pick<Entry, "role" | "actor">) =>
  `${e.actor === "manager" ? "Account Manager" : roleName[e.actor ?? e.role]}${
    e.actor && e.role !== "owner" ? ` · แทน ${roleName[e.role]}` : ""
  }`;
export const materials = [
  "กล่องพิมพ์ลาย",
  "กระดาษรอง",
  "ถุงซีลเนื้อ",
  "ถุงซีลข้าว",
  "ถุงหิ้วกระดาษ",
  "สติกเกอร์โลโก้",
  "การ์ด / สติกเกอร์วิธีอุ่น",
  "ถ้วยพริก",
  "สติกเกอร์พริก",
  "สติกเกอร์ข้าวเหนียว",
];
export const branches = ["ศาลาแดง", "มีนบุรี"];
/** Kinds recorded on a shipment batch (Lot S). Sent with `lotId === ""` they open a new batch
 *  (GEN-09); `lotProgress` lists which of them a batch has. Order is the usual trip, for display. */
export const batchKinds: EntryKind[] = [
  "smokeOrder",
  "dispatch",
  "packingList",
  "smokeOrderAccept",
  "cmReceive",
  "prepare",
  "smoke",
  "closeLot",
  "chefEdit",
  "smokingInvoice",
  "invoiceReview",
  "invoicePayment",
  "return",
  "foodivaReturnReceive",
  "central",
  "allocate",
];
/** Branch meat kinds: `lotId` is a batch or `""`, the branch's "ไม่ระบุ Lot" bucket (DM-03). */
export const branchMeatKinds: EntryKind[] = [
  "receive",
  "thaw",
  "sale",
  "influencerBox",
];
/** Dialog heading per entry kind. Keep each one equal to the button that opens
 * it, or make the button its prefix: two names for one action reads as two actions. */
export const titles: Record<EntryKind, string> = {
  purchase: "สร้าง PO เนื้อ",
  meatPayment: "ชำระ Invoice เนื้อ Foodiva",
  smokeOrder: "ออก PO รมควันเนื้อ",
  smokeOrderAccept: "ยืนยันรับ PO รมควัน",
  smokingInvoice: "สร้าง / Submit ใบวางบิลค่ารมควัน",
  invoiceReview: "ตรวจยอด Invoice ค่ารมควัน",
  invoicePayment: "ชำระ Invoice ค่ารมควัน",
  foodivaConfirm: "ออกและอัปโหลด Invoice เนื้อ",
  packingList: "สร้าง Packing List",
  foodivaReturnReceive: "ยืนยันรับเข้าตู้ที่ Foodiva",
  dispatch: "ทำใบขนส่งขาไป",
  cmReceive: "ยืนยันรับเนื้อที่ Chef House",
  prepare: "น้ำหนักก่อนสโมค",
  smoke: "บันทึก Lot สโมครายวัน",
  closeLot: "ยืนยันปิด Lot",
  chefEdit: "Edit ข้อมูลก่อนปิด Lot",
  return: "เรียกรถขากลับ",
  central: "รับเข้าสต๊อกกลาง",
  allocate: "จัดสรรไปสาขา",
  receive: "รับของเข้าสาขา",
  thaw: "แบ่งละลายเนื้อ",
  supplyPurchase: "ซื้อข้าวเหนียวและน้ำพริกเข้าสต๊อก",
  supplyIssue: "บันทึกเบิกข้าวเหนียวและน้ำพริก",
  ricePurchase: "ซื้อข้าวเหนียวเข้าสต๊อก",
  chiliPurchase: "ซื้อน้ำพริกเข้าสต๊อก",
  chiliAllocate: "จัดสรรน้ำพริกไปสาขา",
  riceIssue: "เบิกข้าวเหนียวดิบวันนี้",
  chiliIssue: "เบิกน้ำพริกวันนี้",
  rice: "ข้าวเหนียวช่วงเช้า",
  riceCarry: "ยืนยันข้าวเหนียวสุกคงเหลือ",
  sale: "บันทึกยอดขาย / Waste",
  influencerBox: "อินฟลูเอนเซอร์",
  materials: `เช็ควัสดุ ${materials.length} รายการ`,
  materialReceive: "บันทึกซื้อวัสดุเข้าคลัง Owner",
  ownerWasteReceive: "รับเนื้อส่วนที่เหลือจาก Foodiva",
  generalPurchase: "บันทึกการซื้ออื่น ๆ",
  materialTransfer: "ส่งวัสดุไปสาขา",
  materialConfirm: "ยืนยันรับวัสดุที่สาขา",
  closeDay: "ยืนยันปิดวัน",
  expense: "ค่าใช้จ่าย Owner",
  config: "บันทึกการตั้งค่า",
  unlock: "ปลดล็อกวัน",
  void: "ยกเลิกรายการ",
  entryEdit: "แก้ไขรายการ",
  editRequest: "ขอแก้ไขรายการ",
  editDecision: "พิจารณาคำขอแก้ไข",
  link: "ผูกรายการย้อนหลัง",
  // No title ever: the log showed the raw kind for it, and still does.
  steakTransfer: "steakTransfer",
};
/** Kinds whose values can be corrected after they were saved (B5). An approver corrects any of
 *  them directly; the role that recorded one files an `editRequest`, closed day or not. Left out:
 *  Chef House's production steps (chefEdit fixes those before ปิด Lot); kinds fixed by saving
 *  again (materials, packingList); closeDay (Owner unlocks instead). `smokeOrder` is here so the
 *  Owner can change its purchase-PO `lines` later (SMK-05). */
export const editableKinds: EntryKind[] = [
  "smokeOrder",
  "receive",
  "thaw",
  "ricePurchase",
  "chiliPurchase",
  "riceIssue",
  "chiliIssue",
  "rice",
  "riceCarry",
  "sale",
  "influencerBox",
  "materialConfirm",
  "allocate",
  "chiliAllocate",
  "materialReceive",
  "generalPurchase",
  "materialTransfer",
  "expense",
  "foodivaConfirm",
  "smokingInvoice",
  // STK-03: a mistyped central kg is corrected here (it is recorded once per batch).
  "central",
];
/** Kinds the Owner may void ("แก้รายการผิดด้วยการยกเลิก"): mutate refuses the rest, and the
 *  Log only offers the button on these. */
export const voidableKinds: EntryKind[] = [
  "central",
  "allocate",
  "chiliAllocate",
  "receive",
  "thaw",
  "ricePurchase",
  "chiliPurchase",
  "riceIssue",
  "chiliIssue",
  "rice",
  "riceCarry",
  "sale",
  "influencerBox",
  "materials",
  "materialReceive",
  "generalPurchase",
  "materialTransfer",
  "materialConfirm",
  "closeDay",
  "expense",
  "unlock",
  "link",
  "entryEdit",
];
/** Branch kinds with no screen any more: old entries still count in stock (and the ones in
 *  `editableKinds` / `voidableKinds` can still be corrected), but mutate records no new ones. */
export const retiredKinds: EntryKind[] = [
  "supplyPurchase",
  "supplyIssue",
  "chiliPurchase",
  "chiliIssue",
];
export const editDecisions = { approve: "อนุมัติ", reject: "ไม่อนุมัติ" };
/** Values an edit may not change: they tie the entry to a branch or a day. Changing one is a
 *  void and a new entry; a reference to another entry (`allocation`, `transferId`) or the lot
 *  is changed with `link` instead (DM-08). */
export const editLockedKeys = ["branch", "purchaseDate"];
/** GEN-02: a field the rules want but the user left empty is saved anyway and listed in the
 *  entry's `missing` (comma-separated keys), shown as this label. */
export const missingText = "ยังไม่ได้กรอก";
export const missingKeys = (v: Values) =>
  v.missing ? v.missing.split(",") : [];
/** An edit stores the corrected values as `to.<key>` and the ones it replaced as `from.<key>`:
 *  flat keys, so `hide` strips prices from them like from any other entry. */
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
/** Entries whose `to.` values overlay their target: a direct edit, or an approved request.
 *  Only an approver's entry counts, so a forged branch-role edit changes nothing. */
export const isEditOverlay = (e: Entry) =>
  e.role === "owner" &&
  (e.kind === "entryEdit" ||
    (e.kind === "editDecision" && e.values.decision === editDecisions.approve));
/** LNK: the Owner links any entry, a branch only an entry of its own branch. `mutate` refuses
 *  the rest, `entries()` ignores them, and append_entries (migration 20260929000034) too. */
export const canLink = (
  link: Pick<Entry, "role" | "branch">,
  target: Pick<Entry, "role" | "branch">,
) =>
  link.role === "owner" ||
  (target.role === "branch" && target.branch === link.branch);
export const seed: Database = {
  version: 9,
  lots: [],
  entries: [],
  config: {
    boxPrice: "350",
    addonPrice: "320",
    packKg: "0.1015",
    chiliPrice: "30",
    rawRicePar: "20",
    rawRiceUnitPrice: "55",
    chiliPar: "100",
    chiliUnitPrice: "20",
    cookedRicePar: "30",
    cookedRiceUnitPrice: "45",
    outboundFee: "1200",
    returnFee: "1200",
    roundFee: "2000",
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
    branch: "ศาลาแดง",
    ...Object.fromEntries(
      materials.flatMap((_, i) => [
        ["material" + i, "0"],
        ["materialPrice" + i, "0"],
      ]),
    ),
  },
};

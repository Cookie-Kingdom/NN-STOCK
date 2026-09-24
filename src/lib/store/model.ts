/** The domain's shapes and fixed tables: types, entry kinds, stages, titles, edit rules, the seed. */
export type Role = "owner" | "foodiva" | "cm" | "branch";
export type Values = Record<string, string>;
/** Every entry kind in the log (all but the legacy one are what `mutate` records). A kind
 *  outside this list is a compile error. */
export const entryKinds = [
  "purchase",
  "shipmentRequest",
  "shipmentRequestEdit",
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
  /** "manager": the Account Manager wrote it as role "owner" (C4). Absent: the role's own
   *  account (for "owner", the Owner). Stamped at save by persistence, checked by save_app_state. */
  actor?: "manager";
};
export type Lot = {
  id: string;
  poId: string;
  stage: number;
  values: Values;
  config: Values;
  /** "shipment" = one trip to Chef House built from purchase POs; absent = a purchase PO, which stays at stage 1. */
  kind?: "shipment";
};
/** One purchase PO's share of a shipment request. */
export type ShipmentLine = { lotId: string; kg: number };
export type Database = {
  version: 8;
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
/** Who wrote an entry, for the log: the Account Manager is told apart from the Owner. */
export const entryBy = (e: Pick<Entry, "role" | "actor">) =>
  e.actor === "manager" ? "Account Manager" : roleName[e.role];
export const materials = [
  "กล่องพิมพ์ลาย",
  "กระดาษรอง",
  "ถุงซีลเนื้อ",
  "ถุงซีลข้าว",
  "ถุงหิ้วกระดาษ",
  "สติกเกอร์โลโก้",
  "การ์ด / สติกเกอร์วิธีอุ่น",
];
export const branches = ["ศาลาแดง", "มีนบุรี"];
export const stages = [
  "รอ Invoice จาก Foodiva",
  "ขนส่ง Foodiva → Chef House",
  "รับที่ Chef House",
  "ก่อนสโมค",
  "บันทึกสโมค",
  "ปิด Lot",
  "ขนส่ง Chef House → Foodiva",
  "Foodiva รับเนื้อรมควัน",
  "จัดสรร / ขาย",
];
export const stageRole: Role[] = [
  "owner",
  "foodiva",
  "cm",
  "cm",
  "cm",
  "cm",
  "owner",
  "owner",
  "owner",
];
export const stageAction: EntryKind[] = [
  "purchase",
  "dispatch",
  "cmReceive",
  "prepare",
  "smoke",
  "closeLot",
  "return",
  "central",
  "allocate",
];
/** `lot.stage` by name: the index in `stageAction` of the step a shipment waits for. So
 *  `lot.stage === STAGE.cmReceive` is on the truck, not yet received at Chef House, and
 *  `lot.stage >= STAGE.allocate` is in central stock (`allocate` does not advance it). */
export const STAGE = {
  purchase: 0,
  dispatch: 1,
  cmReceive: 2,
  prepare: 3,
  smoke: 4,
  closeLot: 5,
  return: 6,
  central: 7,
  allocate: 8,
} as const;
/** Dialog heading per entry kind. Keep each one equal to the button that opens
 * it, or make the button its prefix: two names for one action reads as two actions. */
export const titles: Record<EntryKind, string> = {
  purchase: "สร้าง PO เนื้อ",
  shipmentRequest: "สร้าง Request ส่งเนื้อไป Chef House",
  shipmentRequestEdit: "แก้ไข Request ส่งเนื้อไป Chef House",
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
  materials: "เช็ควัสดุ 7 รายการ",
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
  // No title ever: the log showed the raw kind for it, and still does.
  steakTransfer: "steakTransfer",
};
/** Roles that correct history directly and decide edit requests (spec 8.1). The Account Manager
 *  (C4) signs in as role "owner", so it is an approver through this entry; every check reads the
 *  list, none names "owner". */
export const editApprovers: Role[] = ["owner"];
/** Kinds whose values can be corrected after they were saved (B5). An approver corrects any of
 *  them directly; the role that recorded one files an `editRequest`, closed day or not. Left out:
 *  stage steps, whose numbers also live on the lot (chefEdit fixes those before ปิด Lot);
 *  kinds fixed by saving again (materials, packingList); closeDay (Owner unlocks instead). */
export const editableKinds: EntryKind[] = [
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
];
export const editDecisions = { approve: "อนุมัติ", reject: "ไม่อนุมัติ" };
/** Values an edit may not change: they tie the entry to a branch, a day or another entry.
 *  Changing one is a void and a new entry. */
export const editLockedKeys = [
  "branch",
  "allocation",
  "transferId",
  "purchaseDate",
];
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
  editApprovers.includes(e.role) &&
  (e.kind === "entryEdit" ||
    (e.kind === "editDecision" && e.values.decision === editDecisions.approve));
export const seed: Database = {
  version: 8,
  lots: [],
  entries: [],
  config: {
    boxPrice: "350",
    addonPrice: "320",
    packKg: "0.1015",
    ricePrice: "0",
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
    tolerance: "20",
    closeTime: "22:00",
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

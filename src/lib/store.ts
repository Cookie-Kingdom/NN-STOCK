/** Local demo domain. Every mutation is validated here; the UI never advances stages itself. */
import { fmt } from "./format";
import { newId } from "./id";
export type Role = "owner" | "foodiva" | "cm" | "branch";
export type Values = Record<string, string>;
export type Entry = {
  id: string;
  kind: string;
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
export const stageAction = [
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
/** Dialog heading per entry kind. Keep each one equal to the button that opens
 * it, or make the button its prefix: two names for one action reads as two actions. */
export const titles: Record<string, string> = {
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
  influencerBox: "บันทึกกล่องโปรโมทให้อินฟลูเอนเซอร์",
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
};
/** Roles that correct history directly and decide edit requests (spec 8.1). The Account Manager
 *  (C4) signs in as role "owner", so it is an approver through this entry; every check reads the
 *  list, none names "owner". */
export const editApprovers: Role[] = ["owner"];
/** Kinds whose values can be corrected after they were saved (B5). An approver corrects any of
 *  them directly; the role that recorded one files an `editRequest`, closed day or not. Left out:
 *  stage steps, whose numbers also live on the lot (chefEdit fixes those before ปิด Lot);
 *  kinds fixed by saving again (materials, packingList); closeDay (Owner unlocks instead). */
export const editableKinds = [
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
const pack = (prefix: string, values: Values) =>
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
const isEditOverlay = (e: Entry) =>
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
    logoData: "",
    logoName: "",
    systemStartDate: "",
    branch: "ศาลาแดง",
    ...Object.fromEntries(
      materials.flatMap((_, i) => [
        ["material" + i, "0"],
        ["materialPrice" + i, "0"],
      ]),
    ),
  },
};

/** Creates deterministic daily data for exercising the complete demo loop. */
function roleplay(endDate: string, dayCount: number): Database {
  let db = structuredClone(seed);
  const end = new Date(`${endDate}T00:00:00Z`);
  const dates = Array.from({ length: dayCount }, (_, index) => {
    const value = new Date(end);
    value.setUTCDate(value.getUTCDate() - (dayCount - 1 - index));
    return value.toISOString().slice(0, 10);
  });
  const rawKg = dayCount >= 30 ? 100 : 50;
  const packCount = rawKg * 10;
  const smokingAmount = rawKg * 220;
  const materialPerBranch = dayCount >= 30 ? 400 : 100;
  const materialPurchased = materialPerBranch * 2;
  for (let index = 0; index < materials.length; index++) {
    db.config[`material${index}`] = "100";
    db.config[`materialPrice${index}`] = "1";
  }
  let currentDate = dates[0];
  let currentBranch = branches[0];
  const run = (role: Role, kind: string, values: Values, lotId = "") => {
    db = mutate(db, role, kind, values, lotId, currentDate, currentBranch);
  };
  const packs = Array.from({ length: packCount }, () => "0.100").join("\n");
  run("owner", "generalPurchase", {
    purchaseDate: dates[0],
    purchaseCategory: "วัตถุดิบ",
    item: "น้ำพริกหลอด",
    quantity: String(dayCount * branches.length * 20),
    unit: "หลอด",
    unitPrice: "20",
    supplier: "ผู้ผลิตน้ำพริก",
    reference: "CHILI-DEMO-001",
  });
  run("owner", "purchase", {
    supplier: "Foodiva",
    customerName: "บริษัท เนิร์ดเนื้อ จำกัด",
    customerAddress: "กรุงเทพฯ",
    attention: "ฝ่ายจัดซื้อ",
    phone: "0800000000",
    taxId: "0100000000000",
    packSize: "6 ชิ้นต่อกล่อง",
    productName: "เนื้อวัว",
    orderedKg: String(rawKg),
    price: "250",
  });
  const poLotId = db.lots[0].id;
  run(
    "foodiva",
    "foodivaConfirm",
    {
      invoiceNo: "INV-DEMO-001",
      invoiceDate: dates[0],
      confirmedKg: String(rawKg),
      readyForChiangMaiKg: String(rawKg),
      reservedForOwnerKg: "0",
      invoiceAmount: String(rawKg * 250),
      attachment: "INV-DEMO-001.pdf",
      confirmedBy: "Foodiva Demo",
    },
    poLotId,
  );
  run(
    "owner",
    "meatPayment",
    {
      paymentDate: dates[0],
      paidAmount: String(rawKg * 250),
      paidBy: "Owner",
      paymentReference: "DEMO-MEAT-001",
    },
    poLotId,
  );
  run("owner", "shipmentRequest", {
    lines: JSON.stringify([{ lotId: poLotId, kg: String(rawKg) }]),
  });
  const lotId = db.lots.at(-1)!.id;
  // Packing List: 20 kg กล่องรับเข้า, the last one takes the remainder; Chef House weighs in the same.
  const boxes = Array.from({ length: Math.ceil(rawKg / 20) }, (_, i) =>
    String(Math.min(20, rawKg - i * 20)),
  ).join("\n");
  run(
    "foodiva",
    "dispatch",
    {
      pickupDate: dates[0],
      origin: "Foodiva · กรุงเทพฯ",
      destination: "Chef House · เชียงใหม่",
      trip: "ไปกลับ",
      pickupTime: "06:30",
      vehicleType: "รถห้องเย็น",
      plate: "DEMO-01",
      driverName: "คนขับทดสอบ",
      driverPhone: "0800000000",
    },
    lotId,
  );
  run(
    "foodiva",
    "packingList",
    {
      invoiceNo: "INV-DEMO-001",
      product: "เนื้อวัว",
      invWeightKg: String(rawKg),
      slicedLostKg: String(rawKg),
      boxes,
    },
    lotId,
  );
  run(
    "owner",
    "smokeOrder",
    {
      smoker: "Chef House",
      requestedSmokeDate: dates[0],
      expectedFinishedDate: dates[2],
    },
    lotId,
  );
  run("cm", "smokeOrderAccept", { acceptedBy: "Chef House Demo" }, lotId);
  run("cm", "cmReceive", { receivedBoxes: boxes, arrival: "08:00" }, lotId);
  run("cm", "prepare", { preSmokeKg: String(rawKg) }, lotId);
  run(
    "cm",
    "smoke",
    {
      smokeDate: dates[0],
      inputKg: String(rawKg),
      wasteKg: "0",
      packs,
    },
    lotId,
  );
  run("cm", "closeLot", { confirm: "Chef House" }, lotId);
  run(
    "cm",
    "smokingInvoice",
    {
      invoiceNumber: "CH-INV-DEMO-001",
      invoiceDate: dates[0],
      serviceProvider: "Chef House",
      serviceQuantity: String(rawKg),
      vat: String(smokingAmount * 0.07),
      withholdingTax: String(smokingAmount * 0.03),
      netPayable: String(smokingAmount * 1.04),
      attachment: "CH-INV-DEMO-001.pdf",
    },
    lotId,
  );
  const chefInvoice = db.entries.at(-1)?.id || "";
  run(
    "owner",
    "invoiceReview",
    { invoiceId: chefInvoice, decision: "รับยอด", reviewedBy: "Owner" },
    lotId,
  );
  run(
    "owner",
    "invoicePayment",
    {
      invoiceId: chefInvoice,
      paymentDate: dates[0],
      paidAmount: String(smokingAmount * 1.04),
      paidBy: "Owner",
      paymentReference: "DEMO-PAY-001",
    },
    lotId,
  );
  run(
    "owner",
    "return",
    {
      returnDate: dates[3],
      returnTime: "09:00",
      origin: "Chef House · เชียงใหม่",
      destination: "Foodiva · กรุงเทพฯ",
      vehicleType: "รถห้องเย็น",
      plate: "DEMO-02",
      driverName: "คนขับทดสอบ",
      driverPhone: "0800000000",
      returnKg: String(rawKg),
    },
    lotId,
  );
  run(
    "foodiva",
    "foodivaReturnReceive",
    {
      receivedDate: dates[4],
      receivedTime: "10:00",
      receivedKg: String(rawKg),
      receivedBags: String(packCount),
    },
    lotId,
  );
  run("owner", "central", { centralKg: String(rawKg) }, lotId);
  run(
    "owner",
    "allocate",
    { branch: "ศาลาแดง", deliveryDate: dates[0], kg: String(rawKg / 2) },
    lotId,
  );
  const salaAllocation = db.entries.at(-1)?.id || "";
  run(
    "owner",
    "allocate",
    { branch: "มีนบุรี", deliveryDate: dates[0], kg: String(rawKg / 2) },
    lotId,
  );
  const minburiAllocation = db.entries.at(-1)?.id || "";
  for (const material of materials) {
    run("owner", "materialReceive", {
      material,
      purchaseDate: dates[0],
      quantity: String(materialPurchased),
      unitPrice: "1",
      supplier: "ผู้ขายวัสดุทดสอบ",
      reference: `MATERIAL-DEMO-${materials.indexOf(material) + 1}`,
    });
    for (const branch of branches) {
      currentBranch = branch;
      run("owner", "materialTransfer", {
        material,
        branch,
        quantity: String(materialPerBranch),
        receiver: "ผู้ดูแลทดสอบ",
      });
      const transferId = db.entries.at(-1)?.id || "";
      run("branch", "materialConfirm", {
        transferId,
        receivedQuantity: String(materialPerBranch),
        receiver: "ผู้ดูแลทดสอบ",
      });
    }
  }
  for (const [dayIndex, workDate] of dates.entries()) {
    currentDate = workDate;
    for (const branch of branches) {
      currentBranch = branch;
      const materialValues = Object.fromEntries(
        materials.flatMap((_, index) => {
          const opening = branchMaterialStock(db, branch, index, workDate);
          const used = Math.min(10, opening);
          return [
            [`opening${index}`, String(opening)],
            [`used${index}`, String(used)],
            [`material${index}`, String(opening - used)],
          ];
        }),
      );
      if (dayIndex === 0) {
        run(
          "branch",
          "receive",
          {
            kg: String(rawKg / 2),
            allocation:
              branch === "ศาลาแดง" ? salaAllocation : minburiAllocation,
          },
          lotId,
        );
      }
      if (branch === "ศาลาแดง") {
        run("branch", "ricePurchase", {
          riceSource: riceSources[0],
          supplier: "ร้านข้าวทดสอบ",
          rawRiceKg: "5",
          rawRiceCost: "275",
        });
      } else {
        run("branch", "ricePurchase", {
          riceSource: riceSources[1],
          supplier: "ร้านข้าวทดสอบ",
          cookedRiceKg: "32",
          cookedRiceCost: "1440",
        });
      }
      run("owner", "chiliAllocate", {
        branch,
        chiliTubes: "20",
        receiver: `ผู้ดูแล${branch}`,
        reference: `CHILI-${workDate}`,
      });
      run("branch", "thaw", { kg: "1.521", bags: "1" }, lotId);
      run("branch", "materials", materialValues);
      if (branch === "ศาลาแดง") {
        run("branch", "riceIssue", {
          rawRiceIssuedKg: "3",
          receiver: "ผู้ดูแลทดสอบ",
        });
        run("branch", "rice", { rawUsedKg: "3", riceKg: "3" });
      }
      run(
        "branch",
        "sale",
        {
          boxes: "14",
          addons: "0",
          chiliAddons: "0",
          soldKg: "1.421",
          wasteKg: "0.100",
          riceWasteKg: "0",
          expense: "0",
          lineMan: "4900",
          reason: "ทดสอบปิดยอด",
        },
        lotId,
      );
      run("branch", "riceCarry", {
        leftoverKg: cookedRiceStock(db, branch).toFixed(3),
        reheat: "เก็บไว้อุ่นวันถัดไป",
      });
      run("branch", "closeDay", { confirm: "ผู้ดูแลทดสอบ" });
    }
  }
  return db;
}

export function sevenDayRoleplay(endDate: string): Database {
  return roleplay(endDate, 7);
}

export function thirtyDayRoleplay(endDate: string): Database {
  return roleplay(endDate, 30);
}

const num = (v: Values, key: string) => Number(v[key] || 0);
export const n = num;
const sum = (items: Entry[], key: string) =>
  items.reduce((a, e) => a + num(e.values, key), 0);
export function entries(
  db: Database,
  kind: string,
  lotId?: string,
  branch?: string,
  date?: string,
) {
  const voided = new Set(
    db.entries
      // Only the Owner voids; a void appended under another role changes nothing.
      .filter((entry) => entry.kind === "void" && entry.role === "owner")
      .map((entry) => entry.values.targetId),
  );
  // chefEdit is append-only: its corrections overlay the receive/prepare/smoke entries it names.
  const fixes = new Map<string, Values>();
  const fix = (id: string | undefined, values: Values) => {
    if (id) fixes.set(id, { ...fixes.get(id), ...values });
  };
  for (const e of db.entries) {
    if (voided.has(e.id)) continue;
    // B5 edits overlay the same way, in log order: a later edit wins.
    if (isEditOverlay(e)) fix(e.values.targetId, unpack("to.", e.values));
    if (e.kind !== "chefEdit") continue;
    fix(e.values.receiveId, {
      receivedKg: e.values.receivedKg,
      arrival: e.values.arrival,
      ...(e.values.receivedBoxes !== undefined && {
        receivedBoxes: e.values.receivedBoxes,
      }),
    });
    fix(e.values.prepareId, { preSmokeKg: e.values.preSmokeKg });
    for (const { id, ...batch } of JSON.parse(
      e.values.batches || "[]",
    ) as Values[])
      fix(id, batch);
  }
  return db.entries
    .filter(
      (e) =>
        e.kind === kind &&
        !voided.has(e.id) &&
        (!lotId || e.lotId === lotId) &&
        (!branch || e.branch === branch) &&
        (!date || e.date === date),
    )
    .map((e) => {
      const values = fixes.get(e.id);
      return values ? { ...e, values: { ...e.values, ...values } } : e;
    });
}
/** Bag total of one smoke batch. Batches written before the preKg/outputKg rename
 * carry no `postSmokeKg`, but `packs` was never renamed, so it recovers the weight. */
const smokeOutputKg = (values: Values) =>
  values.postSmokeKg !== undefined
    ? num(values, "postSmokeKg")
    : validPackWeights(values.packs).reduce((a, b) => a + b, 0);
export function produced(db: Database, lotId: string) {
  return entries(db, "smoke", lotId).reduce(
    (a, e) => a + smokeOutputKg(e.values),
    0,
  );
}
export function producedBags(db: Database, lotId: string) {
  return sum(entries(db, "smoke", lotId), "packCount");
}
/** Bag weights typed one per line or comma-separated. Bad tokens stay NaN so `mutate` can reject them. */
export const packWeights = (packs = "") =>
  packs
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
export const isPackWeight = (weight: number) =>
  Number.isFinite(weight) && weight > 0;
export const validPackWeights = (packs = "") =>
  packWeights(packs).filter(isPackWeight);
export function processed(db: Database, lotId: string) {
  return sum(entries(db, "smoke", lotId), "inputKg");
}
export function centralStock(db: Database, lotId: string) {
  const lot = db.lots.find((l) => l.id === lotId);
  return (
    num(lot?.values || {}, "centralKg") -
    sum(entries(db, "allocate", lotId), "kg")
  );
}
/** Raw beef is held by Foodiva until it is dispatched to the smoker or picked up by the Owner. */
export function rawAtFoodiva(db: Database, lot: Lot) {
  // A shipment's beef is counted on the purchase POs it draws from.
  if (lot.kind) return 0;
  const confirmation = entries(db, "foodivaConfirm", lot.id).at(-1);
  const invoicedKg = confirmation
    ? n(confirmation.values, "confirmedKg")
    : n(lot.values, "orderedKg");
  const smoker = drawnKg(db, lot.id, true);
  // Legacy: early builds could record "steakTransfer" (raw beef moved to Steak). No UI creates
  // it any more, but app_state history is append-only, so old transfers still leave Foodiva.
  const steak = sum(entries(db, "steakTransfer", lot.id), "quantityKg");
  const ownerReceived = ownerWasteReceived(db, lot.id);
  return Math.max(0, invoicedKg - smoker - steak - ownerReceived);
}
export function readyForChefHouse(db: Database, lotId: string) {
  const confirmation = entries(db, "foodivaConfirm", lotId).at(-1);
  if (!confirmation) return 0;
  return confirmation.values.readyForChiangMaiKg !== undefined
    ? n(confirmation.values, "readyForChiangMaiKg")
    : n(confirmation.values, "confirmedKg");
}
export const purchaseLots = (db: Database) =>
  db.lots.filter((lot) => !lot.kind);
export function shipmentLines(lot: Lot): ShipmentLine[] {
  return (JSON.parse(lot.values.lines || "[]") as Values[]).map((line) => ({
    lotId: line.lotId,
    kg: Number(line.kg),
  }));
}
/** Shipment lots whose Request was not voided. Reads only the log's voids, so it also works on visibleDatabase. */
export function shipments(db: Database) {
  const voided = new Set(
    entries(db, "void")
      .filter((e) => e.role === "owner")
      .map((e) => e.values.targetId),
  );
  const cancelled = new Set(
    db.entries
      .filter((e) => e.kind === "shipmentRequest" && voided.has(e.id))
      .map((e) => e.lotId),
  );
  return db.lots.filter(
    (lot) => lot.kind === "shipment" && !cancelled.has(lot.id),
  );
}
/** Kg of one purchase PO that shipments have requested (only those already trucked with `dispatchedOnly`). */
export function drawnKg(
  db: Database,
  purchaseLotId: string,
  dispatchedOnly = false,
) {
  return shipments(db)
    .filter((lot) => !dispatchedOnly || lot.stage >= 2)
    .flatMap(shipmentLines)
    .filter((line) => line.lotId === purchaseLotId)
    .reduce((total, line) => total + line.kg, 0);
}
/** What a purchase PO can still send to Chef House: Foodiva's ready-for-Chiang-Mai kg less every Request. */
export function poRemainingKg(db: Database, purchaseLotId: string) {
  return readyForChefHouse(db, purchaseLotId) - drawnKg(db, purchaseLotId);
}
export function latestPackingList(db: Database, lotId: string) {
  return entries(db, "packingList", lotId).at(-1);
}
/** What actually went to Chef House: the box total of the shipment's latest Packing List.
 *  `undefined` until Foodiva makes one; the Request kg is only what was asked for. */
export function packingListKg(db: Database, lotId: string) {
  const list = latestPackingList(db, lotId);
  return list ? n(list.values, "slicedNetKg") : undefined;
}
/** Foodiva's one outbound form: the transport document and its Packing List land in one save,
 *  the document first (packingList refuses a shipment with no dispatch). */
export const dispatchWithPackingList = (
  db: Database,
  lotId: string,
  trip: Values,
  packing: Values,
  date: string,
) =>
  mutate(
    mutate(db, "foodiva", "dispatch", trip, lotId, date),
    "foodiva",
    "packingList",
    packing,
    lotId,
    date,
  );
/** A shipment's kg and meat cost split back to its purchase POs, pro rata to what each was asked
 * for: on Chef House's received kg once weighed in, on the requested kg before that. */
export function shipmentShares(db: Database, shipment: Lot) {
  const lines = shipmentLines(shipment);
  const requested = lines.reduce((total, line) => total + line.kg, 0);
  const base = n(shipment.values, "receivedKg") || requested;
  return lines.map((line) => {
    const po = db.lots.find((lot) => lot.id === line.lotId);
    const kg = requested > 0 ? (base * line.kg) / requested : 0;
    const price = n(po?.values || {}, "price");
    return {
      lotId: line.lotId,
      poId: po?.poId || "",
      requestedKg: line.kg,
      kg,
      price,
      meat: kg * price,
    };
  });
}
/** One shipment end to end for the Owner: purchase POs → truck → Chef House's yellow total →
 *  smoked boxes → return truck → Foodiva's freezer. A step not reached yet is `undefined`. */
export function shipmentChain(db: Database, shipment: Lot) {
  const kg = (kind: string, key: string) => {
    const entry = entries(db, kind, shipment.id).at(-1);
    return entry ? n(entry.values, key) : undefined;
  };
  const smoked = entries(db, "smoke", shipment.id).length > 0;
  return {
    lines: shipmentShares(db, shipment),
    requestedKg: n(shipment.values, "requestedKg"),
    sentKg: packingListKg(db, shipment.id),
    chefReceivedKg: entries(db, "cmReceive", shipment.id).length
      ? n(shipment.values, "receivedKg")
      : undefined,
    smokedBoxes: smoked ? producedBags(db, shipment.id) : undefined,
    smokedKg: smoked ? produced(db, shipment.id) : undefined,
    returnKg: kg("return", "returnKg"),
    foodivaKg: kg("foodivaReturnReceive", "receivedKg"),
    foodivaBoxes: kg("foodivaReturnReceive", "receivedBags"),
  };
}
export function reservedForOwnerContent(db: Database, lotId: string) {
  const confirmation = entries(db, "foodivaConfirm", lotId).at(-1);
  return confirmation ? n(confirmation.values, "reservedForOwnerKg") : 0;
}
export function ownerWasteReceived(db: Database, lotId: string) {
  return sum(entries(db, "ownerWasteReceive", lotId), "receivedKg");
}
/** A8 — of the meat Foodiva keeps for the Owner on a purchase PO (`reservedForOwnerKg` on its
 *  latest invoice), what the Owner has not picked up yet (`ownerWasteReceive`). It is apart
 *  from `poRemainingKg`, which counts only the ready-for-Chiang-Mai kg. */
export function ownerWasteOutstanding(db: Database, lotId: string) {
  return Math.max(
    0,
    reservedForOwnerContent(db, lotId) - ownerWasteReceived(db, lotId),
  );
}
/** Trim between what Chef House weighed in and what went to pre-smoke prep. It is
 * loss, not stock: without naming it the remainder sat at the smoker forever. */
export function preSmokeTrimKg(db: Database, lot: Lot) {
  if (!entries(db, "prepare", lot.id).length) return 0;
  return Math.max(0, n(lot.values, "receivedKg") - n(lot.values, "preSmokeKg"));
}
export function rawAtSmoker(db: Database, lot: Lot) {
  return Math.max(
    0,
    n(lot.values, "receivedKg") -
      preSmokeTrimKg(db, lot) -
      processed(db, lot.id),
  );
}
/** Pre-smoke weight not yet through the smoker; never negative, even for lots whose old payload lacks the field. */
export function pendingSmokeKg(db: Database, lot: Lot) {
  return Math.max(0, n(lot.values, "preSmokeKg") - processed(db, lot.id));
}
export function processLoss(db: Database, lotId: string) {
  return Math.max(0, processed(db, lotId) - produced(db, lotId));
}
export function averageYield(db: Database) {
  const input = sum(entries(db, "smoke"), "inputKg");
  const output = entries(db, "smoke").reduce(
    (a, e) => a + smokeOutputKg(e.values),
    0,
  );
  return input > 0 ? (output / input) * 100 : 0;
}
/** Sales and influencer boxes both take finished product off the branch shelf.
 * Every branch stock number reads both, or the day will not tie out. */
export function offShelf(
  db: Database,
  lotId?: string,
  branch?: string,
  date?: string,
) {
  return [
    ...entries(db, "sale", lotId, branch, date),
    ...entries(db, "influencerBox", lotId, branch, date),
  ];
}
const usedKg = (items: Entry[]) => sum(items, "soldKg");
const wastedKg = (items: Entry[]) => sum(items, "wasteKg");
/** Branch meat of one lot, all dates. `ready` is thawed meat not yet used or wasted:
 * the chill the branch can still use, whatever day it was thawed. */
export function balance(db: Database, lotId: string, branch: string) {
  const received = sum(entries(db, "receive", lotId, branch), "kg"),
    thawed = sum(entries(db, "thaw", lotId, branch), "kg");
  const out = offShelf(db, lotId, branch);
  return {
    received,
    frozen: received - thawed,
    ready: thawed - usedKg(out) - wastedKg(out),
  };
}
/** One branch day of one lot. Thawed meat left at the end of a day stays in the chiller
 * and carries into the next day (`chillIn`); nothing forces it to zero at close.
 * chillIn + thawed = used + waste + chillOut. The end-of-day stock as of `date`:
 * `pending` still to receive, `received` so far, `frozen` (received − thawed),
 * and `usedTotal` so far (waste excluded). */
export function branchMeatDay(
  db: Database,
  lotId: string,
  branch: string,
  date: string,
) {
  const before = (items: Entry[]) => items.filter((e) => e.date < date);
  const thaws = entries(db, "thaw", lotId, branch);
  const out = offShelf(db, lotId, branch);
  const today = offShelf(db, lotId, branch, date);
  const chillIn =
    sum(before(thaws), "kg") - usedKg(before(out)) - wastedKg(before(out));
  const thawed = sum(entries(db, "thaw", lotId, branch, date), "kg");
  const used = usedKg(today),
    waste = wastedKg(today);
  const through = (items: Entry[]) => items.filter((e) => e.date <= date);
  const received = sum(through(entries(db, "receive", lotId, branch)), "kg");
  return {
    chillIn,
    thawed,
    used,
    waste,
    chillOut: chillIn + thawed - used - waste,
    pending: pendingReceiveKg(db, lotId, branch, date),
    received,
    frozen: received - sum(through(thaws), "kg"),
    usedTotal: usedKg(through(out)),
  };
}
/** Meat used per sealed pack outside 100–103 g: a warning for the form, never a
 * block — the branch types what it really used. "" when it is fine. */
export function packWeightWarning(v: Values) {
  const packs = num(v, "boxes") + num(v, "addons"),
    kg = num(v, "soldKg");
  if (!packs) return kg > 0 ? "มีน้ำหนักเนื้อที่ใช้ แต่ยังไม่มีจำนวนซีล" : "";
  const grams = (kg / packs) * 1000;
  return grams < 99.99 || grams > 103.01
    ? `เฉลี่ย ${grams.toFixed(1)} กรัมต่อซีล อยู่นอกช่วง 100–103 กรัม · บันทึกได้ แต่ควรตรวจน้ำหนักอีกครั้ง`
    : "";
}
/** Kg a branch still has to receive on one allocation, rounded to the 0.01 the user
 * sees and types; the allocation is done once that reaches 0, or once a receive was
 * marked `complete` (a shortfall the branch accepted, its reason on that receive). */
export function allocationOutstanding(
  db: Database,
  allocation: Entry,
  throughDate?: string,
) {
  const received = entries(
    db,
    "receive",
    allocation.lotId,
    allocation.branch,
  ).filter(
    (r) =>
      r.values.allocation === allocation.id &&
      (!throughDate || r.date <= throughDate),
  );
  if (received.some((r) => r.values.complete === "1")) return 0;
  const kg =
    Math.round((n(allocation.values, "kg") - sum(received, "kg")) * 100) / 100;
  return Math.max(0, kg);
}
/** Kg allocated to a branch and not yet received; with `throughDate`, as of the end
 * of that day (allocations and receives dated after it do not count). */
export function pendingReceiveKg(
  db: Database,
  lotId: string,
  branch: string,
  throughDate?: string,
) {
  return entries(db, "allocate", lotId, branch)
    .filter((a) => !throughDate || a.date <= throughDate)
    .reduce(
      (total, allocation) =>
        total + allocationOutstanding(db, allocation, throughDate),
      0,
    );
}
/** The two ways a branch gets its sticky rice, picked on every `ricePurchase` (B2). */
export const riceSources = ["นึ่งเอง (ซื้อข้าวดิบ)", "ซื้อข้าวสุกจากข้างนอก"];
/** Rice records a branch owes for `date`, from what it did rather than which branch it is:
 *  every day ends with a cooked-rice confirmation (`riceCarry`); a day that issued raw rice
 *  for cooking also owes the cook itself (`rice`). closeDay and the Owner's daily status
 *  both read this. */
export function requiredRiceKinds(db: Database, branch: string, date: string) {
  const issuedRaw = ["riceIssue", "supplyIssue"].some((kind) =>
    entries(db, kind, undefined, branch, date).some(
      (entry) => num(entry.values, "rawRiceIssuedKg") > 0,
    ),
  );
  return issuedRaw ? ["rice", "riceCarry"] : ["riceCarry"];
}
/** What closing `date` needs, in the order the close dialog lists it. mutate's closeDay
 *  refuses on the first required item not done, with its `message`, so the dialog and
 *  the save never disagree. `kind` is the form that fills the item, when it has one
 *  (materials are counted in the day screen's own table). The influencer-box line is
 *  optional (FB 20-09 ข้อ 17): only days that sent promo boxes record one, so it shows
 *  whether today's was entered and never blocks. The chill line is information only:
 *  thawed meat left over carries into tomorrow. */
export function closeDayChecklist(db: Database, branch: string, date: string) {
  const has = (kind: string) =>
    entries(db, kind, undefined, branch, date).length > 0;
  const chillOut = db.lots.reduce(
    (total, lot) => total + branchMeatDay(db, lot.id, branch, date).chillOut,
    0,
  );
  return [
    {
      key: "sale",
      label: "ยอดขายวันนี้",
      done: has("sale"),
      required: true,
      message: "ยังไม่มีรายการขายวันนี้",
      kind: "sale" as string | undefined,
    },
    {
      key: "materials",
      label: "เช็ควัสดุ",
      done: has("materials"),
      required: true,
      message: "ยังไม่เช็ควัสดุวันนี้",
      kind: undefined,
    },
    ...requiredRiceKinds(db, branch, date).map((kind) => ({
      key: kind,
      label: titles[kind],
      done: has(kind),
      required: true,
      message:
        kind === "rice"
          ? "เบิกข้าวเหนียวดิบวันนี้แล้ว ยังไม่บันทึกข้าวช่วงเช้า (หุงข้าว)"
          : "ยังไม่ยืนยันข้าวเหนียวสุกคงเหลือ",
      kind,
    })),
    {
      key: "influencerBox",
      label: "กล่องโปรโมทอินฟลูเอนเซอร์ · บันทึกเฉพาะวันที่ส่ง",
      done: has("influencerBox"),
      required: false,
      message: "",
      kind: "influencerBox",
    },
    {
      key: "chill",
      label: `เนื้อชิลยกไปวันถัดไป ${fmt(chillOut)} กก.`,
      done: true,
      required: false,
      message: "",
      kind: undefined,
    },
  ];
}
export type CloseDayItem = ReturnType<typeof closeDayChecklist>[number];
export function rawRiceStock(db: Database, branch: string) {
  return (
    sum(entries(db, "supplyPurchase", undefined, branch), "rawRiceKg") +
    sum(entries(db, "ricePurchase", undefined, branch), "rawRiceKg") -
    sum(entries(db, "supplyIssue", undefined, branch), "rawRiceIssuedKg") -
    sum(entries(db, "riceIssue", undefined, branch), "rawRiceIssuedKg")
  );
}
export function issuedRawRiceStock(db: Database, branch: string) {
  return (
    sum(entries(db, "supplyIssue", undefined, branch), "rawRiceIssuedKg") +
    sum(entries(db, "riceIssue", undefined, branch), "rawRiceIssuedKg") -
    sum(entries(db, "rice", undefined, branch), "rawUsedKg")
  );
}
export function cookedRiceStock(db: Database, branch: string) {
  return (
    sum(entries(db, "supplyPurchase", undefined, branch), "cookedRiceKg") +
    sum(entries(db, "ricePurchase", undefined, branch), "cookedRiceKg") +
    sum(entries(db, "rice", undefined, branch), "riceKg") -
    offShelf(db, undefined, branch).reduce(
      (total, entry) =>
        total +
        num(entry.values, "riceServings") * 0.2 +
        num(entry.values, "riceWasteKg"),
      0,
    )
  );
}
/** Chili tubes are issued to branches only by Owner. Sales reduce the branch balance. */
export function chiliAllocated(
  db: Database,
  branch: string,
  throughDate?: string,
) {
  const inRange = (entry: Entry) => !throughDate || entry.date <= throughDate;
  return (
    sum(
      entries(db, "chiliAllocate", undefined, branch).filter(inRange),
      "chiliTubes",
    ) +
    // Keep old demo records readable after the workflow changed to Owner allocation.
    sum(
      entries(db, "supplyPurchase", undefined, branch).filter(inRange),
      "chiliTubes",
    ) +
    sum(
      entries(db, "chiliPurchase", undefined, branch).filter(inRange),
      "chiliTubes",
    )
  );
}
/** Owner stock is purchased centrally, then reduced only by allocations to branches. */
export function ownerChiliStock(db: Database) {
  const purchased = entries(db, "generalPurchase")
    .filter((entry) => entry.values.item === "น้ำพริกหลอด")
    .reduce((total, entry) => total + n(entry.values, "quantity"), 0);
  const legacyBranchPurchases =
    sum(entries(db, "supplyPurchase"), "chiliTubes") +
    sum(entries(db, "chiliPurchase"), "chiliTubes");
  return (
    purchased +
    legacyBranchPurchases -
    sum(entries(db, "chiliAllocate"), "chiliTubes")
  );
}
export function chiliSold(db: Database, branch: string, throughDate?: string) {
  return sum(
    offShelf(db, undefined, branch).filter(
      (entry) => !throughDate || entry.date <= throughDate,
    ),
    "chiliSold",
  );
}
export function chiliStock(db: Database, branch: string, throughDate?: string) {
  return (
    chiliAllocated(db, branch, throughDate) - chiliSold(db, branch, throughDate)
  );
}
/** Kept for old components; it now means the current branch balance, not a branch issue. */
export function issuedChiliStock(db: Database, branch: string) {
  return chiliStock(db, branch);
}
export function materialSent(
  db: Database,
  material: string,
  branch?: string,
  date?: string,
) {
  return entries(db, "materialTransfer", undefined, branch, date)
    .filter((entry) => entry.values.material === material)
    .reduce((total, entry) => total + n(entry.values, "quantity"), 0);
}
export function ownerMaterialStock(db: Database, material: string) {
  const received = entries(db, "materialReceive")
    .filter((entry) => entry.values.material === material)
    .reduce((total, entry) => total + n(entry.values, "quantity"), 0);
  return received - materialSent(db, material);
}
export function branchMaterialStock(
  db: Database,
  branch: string,
  materialIndex: number,
  throughDate?: string,
) {
  const material = materials[materialIndex];
  const transferred = entries(db, "materialTransfer", undefined, branch)
    .filter(
      (entry) =>
        entry.values.material === material &&
        (!throughDate || entry.date <= throughDate),
    )
    .reduce((total, entry) => {
      if (!entry.values.requiresConfirm)
        return total + n(entry.values, "quantity");
      const confirmation = entries(
        db,
        "materialConfirm",
        undefined,
        branch,
      ).find((item) => item.values.transferId === entry.id);
      return (
        total + (confirmation ? n(confirmation.values, "receivedQuantity") : 0)
      );
    }, 0);
  /* A branch may save a day's count again to fix a typo, so only the newest record
   * of each day counts; the earlier ones stay in the log as the audit trail. */
  const counted = [
    ...new Map(
      entries(db, "materials", undefined, branch)
        .filter((entry) => !throughDate || entry.date < throughDate)
        .map((entry) => [entry.date, entry]),
    ).values(),
  ];
  const used = counted.reduce(
    (total, entry) => total + n(entry.values, "used" + materialIndex),
    0,
  );
  const adjustments = counted.reduce(
    (total, entry) =>
      total +
      n(entry.values, "material" + materialIndex) -
      (n(entry.values, "opening" + materialIndex) -
        n(entry.values, "used" + materialIndex)),
    0,
  );
  return transferred - used + adjustments;
}
export function materialPar(db: Database, branch: string, index: number) {
  return (
    n(db.config, `material${index}`) ||
    n(db.config, `material${index}_saladaeng`) ||
    n(db.config, `material${index}_minburi`)
  );
}
export function materialUnitPrice(db: Database, branch: string, index: number) {
  return (
    n(db.config, `materialPrice${index}`) ||
    n(db.config, `materialPrice${index}_saladaeng`) ||
    n(db.config, `materialPrice${index}_minburi`)
  );
}
export function isClosed(db: Database, branch: string, date: string) {
  return (
    !!entries(db, "closeDay", undefined, branch, date).length &&
    !entries(db, "unlock", undefined, branch, date).some(
      (e) =>
        e.at >
        (entries(db, "closeDay", undefined, branch, date).at(-1)?.at || ""),
    )
  );
}
export function lotCost(db: Database, lot: Lot) {
  const v = lot.values;
  const meat = shipmentShares(db, lot).reduce(
    (total, share) => total + share.meat,
    0,
  );
  const smoke = n(
    entries(db, "smokeOrder", lot.id).at(-1)?.values || {},
    "estimatedCost",
  );
  const freight = num(v, "outboundCost") + num(v, "returnCost");
  return {
    meat,
    smoke,
    freight,
    total: meat + smoke + freight,
    perKg:
      num(v, "centralKg") > 0
        ? (meat + smoke + freight) / num(v, "centralKg")
        : null,
  };
}
export function smokeServiceRate(quantityKg: number) {
  if (quantityKg >= 1500) return 180;
  if (quantityKg >= 1000) return 200;
  return 220;
}
export function smokingInvoiceStatus(db: Database, invoice: Entry) {
  if (
    entries(db, "invoicePayment", invoice.lotId).some(
      (entry) => entry.values.invoiceId === invoice.id,
    )
  )
    return "ชำระแล้ว";
  const review = entries(db, "invoiceReview", invoice.lotId)
    .filter((entry) => entry.values.invoiceId === invoice.id)
    .at(-1);
  if (review?.values.decision === "รับยอด") return "รอชำระ";
  if (review?.values.decision === "ส่งกลับแก้ไข") return "ส่งกลับแก้ไข";
  return "รอตรวจยอด";
}
/** The Owner's latest review of this invoice (either decision), if any. */
export function smokingInvoiceReview(db: Database, invoice: Entry) {
  return entries(db, "invoiceReview", invoice.lotId)
    .filter((entry) => entry.values.invoiceId === invoice.id)
    .at(-1);
}
/** The Owner's latest "ส่งกลับแก้ไข" review of this invoice, if that is its current state. */
export function smokingInvoiceRejection(db: Database, invoice: Entry) {
  if (smokingInvoiceStatus(db, invoice) !== "ส่งกลับแก้ไข") return undefined;
  return smokingInvoiceReview(db, invoice);
}
/** One smoking invoice per lot: the latest. Earlier ones were sent back and superseded by a resubmission. */
export function currentSmokingInvoices(db: Database) {
  const latest = new Map<string, Entry>();
  for (const invoice of entries(db, "smokingInvoice"))
    latest.set(invoice.lotId, invoice);
  return [...latest.values()];
}
/** Invoices the Owner has to act on: Foodiva meat invoices still unpaid, and current
 *  Chef House smoking invoices to review (`toReview`) or to pay (`toPay`). */
export function ownerPendingInvoices(db: Database) {
  const unpaidMeatLots = db.lots.filter(
    (lot) =>
      !lot.kind &&
      entries(db, "foodivaConfirm", lot.id).length &&
      !entries(db, "meatPayment", lot.id).length,
  );
  const smoking = currentSmokingInvoices(db);
  const toReview = smoking.filter(
    (invoice) => smokingInvoiceStatus(db, invoice) === "รอตรวจยอด",
  );
  const toPay = smoking.filter(
    (invoice) => smokingInvoiceStatus(db, invoice) === "รอชำระ",
  );
  return {
    unpaidMeatLots,
    toReview,
    toPay,
    total: unpaidMeatLots.length + toReview.length + toPay.length,
  };
}
export function revenue(db: Database) {
  return sum(entries(db, "sale"), "revenue");
}
/** Value keys a role must not see. Chef House also never sees purchase POs, meat prices or freight.
 *  It does see the Foodiva invoice number on the Packing List (`invoiceNo`). */
const hiddenKeys = (role: Role) =>
  role === "cm"
    ? ["meatCost", "wasteCost", "lines", "price", "outboundCost", "returnCost"]
    : ["meatCost", "wasteCost"];
const omit = (values: Values, keys: string[]) =>
  Object.fromEntries(
    Object.entries(values).filter(
      ([k]) => !keys.includes(k.replace(/^(to|from)\./, "")),
    ),
  );
const hide = (values: Values, role: Role) => omit(values, hiddenKeys(role));
/** A sale's money in: what the Account Manager must not see (C4). Its costs stay visible. */
export const saleMoneyKeys = ["revenue", "lineMan", "menuTotal"];
const editKinds = ["entryEdit", "editRequest", "editDecision"];
/** Owner entries Chef House works from: the smoke PO and Packing List it smokes, and the review and payment of its invoice. */
const chefHouseKinds = [
  "smokeOrder",
  "packingList",
  "invoiceReview",
  "invoicePayment",
];
/** `branch` is the signed-in branch account's own branch; a branch role sees nothing without it. */
export function visibleEntries(db: Database, role: Role, branch?: string) {
  const shipmentIds = new Set(shipments(db).map((lot) => lot.id));
  // Edits, requests and decisions about this role's own entries (its branch's, for a branch).
  const aboutMine = (e: Entry) =>
    editKinds.includes(e.kind) &&
    e.values.targetRole === role &&
    (role !== "branch" || e.values.targetBranch === branch);
  return db.entries
    .filter(
      (e) =>
        role === "owner" ||
        (role === "cm"
          ? shipmentIds.has(e.lotId) &&
            (e.role === "cm" || chefHouseKinds.includes(e.kind) || aboutMine(e))
          : (e.role === role && (role !== "branch" || e.branch === branch)) ||
            aboutMine(e)),
    )
    .map((e) =>
      role === "owner" ? e : { ...e, values: hide(e.values, role) },
    );
}
/** The database a role's screens read. Chef House gets only shipments with a smoke PO, stripped of
 * purchase POs and prices; other roles get `db` untouched. `hideSales` (Account Manager) also drops
 * every sale's money in (`saleMoneyKeys`, edits included). For the manager that is a no-op in the
 * app: the server already strips it (load_app_state, GET /api/local-db) and puts it back on save
 * (save_app_state, src/lib/sale-money.ts), so sale money never reaches its browser. */
export function visibleDatabase(
  db: Database,
  role: Role,
  branch?: string,
  hideSales = false,
): Database {
  if (hideSales)
    db = {
      ...db,
      entries: db.entries.map((e) => ({
        ...e,
        values: omit(e.values, saleMoneyKeys),
      })),
    };
  if (role !== "cm") return db;
  const lots = shipments(db)
    .filter((lot) => entries(db, "smokeOrder", lot.id).length)
    .map((lot) => ({ ...lot, values: hide(lot.values, role) }));
  const ids = new Set(lots.map((lot) => lot.id));
  return {
    ...db,
    lots,
    entries: visibleEntries(db, role, branch).filter((e) => ids.has(e.lotId)),
  };
}
/** Why `role` may not edit `target` ("" when it may). Approvers edit any editable entry;
 *  anyone else only their own (a branch: its own branch's), and only by request. */
export function editBlock(
  db: Database,
  target: Entry,
  role: Role,
  branch = "",
) {
  if (!editableKinds.includes(target.kind))
    return "รายการชนิดนี้แก้ไขย้อนหลังไม่ได้";
  if (!entries(db, target.kind).some((e) => e.id === target.id))
    return "รายการนี้ถูกยกเลิกแล้ว";
  if (
    target.kind === "smokingInvoice" &&
    smokingInvoiceStatus(db, target) === "ชำระแล้ว"
  )
    return "Invoice นี้ชำระแล้ว แก้ไขไม่ได้";
  if (
    !editApprovers.includes(role) &&
    (target.role !== role || (role === "branch" && target.branch !== branch))
  )
    return "แก้ไขได้เฉพาะรายการของบัญชีนี้";
  return "";
}
export const editDecisionOf = (db: Database, requestId: string) =>
  entries(db, "editDecision").find((e) => e.values.requestId === requestId);
/** The request on `targetId` still waiting for a decision. One at a time per entry. */
export const openEditRequest = (db: Database, targetId: string) =>
  entries(db, "editRequest").find(
    (e) => e.values.targetId === targetId && !editDecisionOf(db, e.id),
  );
/** Direct edits and approved requests applied to one entry, oldest first. */
export const entryEdits = (db: Database, targetId: string) =>
  db.entries.filter((e) => isEditOverlay(e) && e.values.targetId === targetId);
/** Every edit request in `db` with its decision: waiting ones first, then newest first.
 *  Pass a role's visible database to get only that role's own requests. */
export function editRequestRows(db: Database) {
  return entries(db, "editRequest")
    .map((request) => ({ request, decision: editDecisionOf(db, request.id) }))
    .sort(
      (a, b) =>
        Number(!!a.decision) - Number(!!b.decision) ||
        (b.decision?.at || b.request.at).localeCompare(
          a.decision?.at || a.request.at,
        ),
    );
}
/** Stock figures an edit must not push below zero, keyed `label#id`. */
function stockLevels(db: Database) {
  const levels = new Map<string, number>();
  for (const b of branches) {
    for (const lot of db.lots) {
      const x = balance(db, lot.id, b);
      levels.set(`เนื้อแช่แข็ง ${lot.id} สาขา${b}#`, x.frozen);
      levels.set(`เนื้อละลายแล้ว ${lot.id} สาขา${b}#`, x.ready);
    }
    levels.set(`ข้าวเหนียวดิบ สาขา${b}#`, rawRiceStock(db, b));
    levels.set(`ข้าวเหนียวดิบที่เบิก สาขา${b}#`, issuedRawRiceStock(db, b));
    levels.set(`ข้าวเหนียวสุก สาขา${b}#`, cookedRiceStock(db, b));
    levels.set(`น้ำพริก สาขา${b}#`, chiliStock(db, b));
  }
  for (const lot of db.lots) {
    levels.set(`สต๊อกกลาง ${lot.id}#`, centralStock(db, lot.id));
    if (!lot.kind)
      levels.set(`ยอดพร้อมส่ง ${lot.poId}#`, poRemainingKg(db, lot.id));
  }
  for (const a of entries(db, "allocate"))
    levels.set(
      `ยอดค้างรับใบจัดสรร ${a.lotId} สาขา${a.branch}#${a.id}`,
      n(a.values, "kg") -
        sum(
          entries(db, "receive", a.lotId, a.branch).filter(
            (r) => r.values.allocation === a.id,
          ),
          "kg",
        ),
    );
  levels.set("น้ำพริกในคลัง Owner#", ownerChiliStock(db));
  for (const m of materials)
    levels.set(`${m} ในคลัง Owner#`, ownerMaterialStock(db, m));
  return levels;
}
/** The target's values as `proposed` would leave them, normalised and checked by the target
 *  kind's own rules as if it were saved again now without the original (so its own kg are
 *  back in stock). Then no stock may go below zero that was not already there. */
function correctedValues(db: Database, target: Entry, proposed: Values) {
  for (const key of editLockedKeys)
    assert(
      proposed[key] === undefined ||
        proposed[key] === (target.values[key] ?? ""),
      "แก้สาขา วันที่ซื้อ หรือรายการอ้างอิงไม่ได้ · ให้ Owner ยกเลิกแล้วบันทึกใหม่",
    );
  const as = (kind: string, values: Values): Database => ({
    ...db,
    entries: [
      ...db.entries,
      { ...target, id: newId(), kind, role: editApprovers[0], values },
    ],
  });
  /* The Account Manager's copy has no sale money (C4): a sale without its LINE MAN amount is
   * checked with a stand-in, and the edit is saved without money for save_app_state to fill in
   * from the server's copy. */
  const moneyHidden =
    target.kind === "sale" && target.values.lineMan === undefined;
  const input = { ...target.values, ...proposed };
  if (moneyHidden && input.lineMan === undefined) input.lineMan = "0";
  const checked = record(
    as("void", { targetId: target.id }),
    target.role,
    target.kind,
    input,
    target.lotId,
    target.date,
    target.branch,
    true,
  ).entries.at(-1)!.values;
  const corrected = moneyHidden ? omit(checked, saleMoneyKeys) : checked;
  const before = stockLevels(db);
  for (const [key, level] of stockLevels(
    as("entryEdit", { targetId: target.id, ...pack("to.", corrected) }),
  ))
    assert(
      level >= -0.001 || level >= (before.get(key) ?? 0) - 0.001,
      `แก้แล้ว${key.split("#")[0]}จะติดลบ (${fmt(level)}) · แก้รายการที่ตามมาก่อน`,
    );
  return corrected;
}
/** What an edit entry stores about its target: the before and after values and whose it is. */
function editValues(db: Database, target: Entry, proposed: Values) {
  return {
    targetKind: target.kind,
    targetDate: target.date,
    targetRole: target.role,
    targetBranch: target.branch,
    ...pack("from.", target.values),
    ...pack("to.", correctedValues(db, target, proposed)),
  };
}
/** `targetId`'s entry with its current (edited) values, if `role` may edit it. */
function editTarget(
  db: Database,
  targetId: string,
  role: Role,
  branch: string,
) {
  const target = db.entries.find((e) => e.id === targetId);
  assert(target, "ไม่พบรายการที่จะแก้ไข");
  const block = editBlock(db, target, role, branch);
  assert(!block, block);
  return entries(db, target.kind).find((e) => e.id === targetId)!;
}
const ownership: Record<string, Role> = {
  purchase: "owner",
  shipmentRequest: "owner",
  shipmentRequestEdit: "owner",
  meatPayment: "owner",
  smokeOrder: "owner",
  smokingInvoice: "cm",
  smokeOrderAccept: "cm",
  invoiceReview: "owner",
  invoicePayment: "owner",
  foodivaConfirm: "foodiva",
  packingList: "foodiva",
  foodivaReturnReceive: "foodiva",
  dispatch: "foodiva",
  cmReceive: "cm",
  prepare: "cm",
  smoke: "cm",
  closeLot: "cm",
  chefEdit: "cm",
  return: "owner",
  central: "owner",
  allocate: "owner",
  chiliAllocate: "owner",
  receive: "branch",
  thaw: "branch",
  supplyPurchase: "branch",
  supplyIssue: "branch",
  ricePurchase: "branch",
  chiliPurchase: "branch",
  riceIssue: "branch",
  chiliIssue: "branch",
  rice: "branch",
  riceCarry: "branch",
  sale: "branch",
  influencerBox: "branch",
  materials: "branch",
  materialReceive: "owner",
  ownerWasteReceive: "owner",
  generalPurchase: "owner",
  materialTransfer: "owner",
  materialConfirm: "branch",
  closeDay: "branch",
  expense: "owner",
  config: "owner",
  unlock: "owner",
  void: "owner",
};
/** Per-กล่องรับเข้า weights of a Packing List. They live in one entry value, one
 *  line each, the way `smoke` stores its pack weights. */
export function packingListBoxes(value = "") {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(Number);
}
/** Chef House's weighed-in kg per กล่องรับเข้า, one line per Packing List box and in its order.
 *  Unlike packingListBoxes a blank line stays (as NaN), so a skipped box is caught, not shifted. */
export function receivedBoxWeights(value = "") {
  return value.split("\n").map((line) => (line.trim() ? Number(line) : NaN));
}
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
/** Refused because an amount is over what is on hand. Its own class so a form can show it
 *  as soon as that amount is typed, before the rest of the form is filled in. */
export class OverStockError extends Error {
  name = "OverStockError";
}
/** Refuses `amount` over `max` and says what the most is, so the user knows what to type. */
function withinStock(
  amount: number,
  max: number,
  message: string,
  unit = "กก.",
  prefix = "กรอกได้สูงสุด",
) {
  if (amount <= max + 0.001) return;
  const most = Math.max(0, max);
  throw new OverStockError(
    `${message} · ${prefix} ${unit === "กก." ? fmt(most) : String(Math.floor(most + 0.001))}${unit ? ` ${unit}` : ""}`,
  );
}
/** Thai runs together without spaces, but a label starting or ending in Latin/digits needs a
 *  space on that side ("กรอก Sliced Weight Lost เป็นตัวเลข…"). */
function spaced(label: string) {
  const latin = /[A-Za-z0-9)]/;
  return `${latin.test(label[0] ?? "") ? " " : ""}${label}${latin.test(label.at(-1) ?? "") ? " " : ""}`;
}
function positive(v: Values, k: string, label: string, allowZero = false) {
  const value = Number(v[k]);
  assert(
    v[k]?.trim() &&
      Number.isFinite(value) &&
      (allowZero ? value >= 0 : value > 0),
    `กรอก${spaced(label)}เป็นตัวเลข${allowZero ? "ตั้งแต่ศูนย์" : "มากกว่าศูนย์"}`,
  );
}
function required(v: Values, k: string, label: string) {
  assert(v[k]?.trim(), `กรอก${spaced(label).trimEnd()}`);
}
function variance(actual: number, expected: number, v: Values, always = true) {
  if (
    Math.abs(actual - expected) > 0.001 &&
    (always || expected === 0 || Math.abs(actual - expected) / expected > 0.2)
  )
    required(v, "reason", "เหตุผลส่วนต่าง");
}
/** Sum of Chef House's yellow cells: one weight per box of the shipment's latest Packing List.
 *  A total off the Packing List is not an error; it is what stock and cost run on. */
function receivedTotal(db: Database, lotId: string, value = "") {
  const listed = packingListBoxes(latestPackingList(db, lotId)?.values.boxes);
  const got = receivedBoxWeights(value);
  assert(
    got.length === listed.length,
    "จำนวนกล่องรับเข้าไม่ตรงกับ Packing List กรุณาเปิดฟอร์มใหม่",
  );
  assert(
    got.every((kg) => Number.isFinite(kg) && kg >= 0),
    "กรอกน้ำหนักจริงทุกกล่องรับเข้า (ใส่ 0 ถ้าไม่ได้รับกล่องนั้น)",
  );
  const total = got.reduce((a, b) => a + b, 0);
  assert(total > 0, "น้ำหนักรับจริงรวมต้องมากกว่าศูนย์");
  return { total, boxes: got.join("\n") };
}
/** Optional payment slips: JSON [{ name, storageKey }], the bytes already in attachment storage. */
function checkSlips(v: Values) {
  if (!v.slips) return;
  let slips: unknown;
  try {
    slips = JSON.parse(v.slips);
  } catch {}
  assert(
    Array.isArray(slips) &&
      slips.every(
        (slip: Values | null) =>
          slip?.name?.trim?.() && slip?.storageKey?.trim?.(),
      ),
    "ไฟล์สลิปไม่ถูกต้อง กรุณาแนบใหม่",
  );
}
/** Checks a Request's `lines` and writes them back normalised with `requestedKg`. When
 *  editing (`own`), that Request's current lines count as still available to their POs. */
function requestLines(db: Database, v: Values, own?: Lot) {
  let lines: Values[] = [];
  try {
    lines = JSON.parse(v.lines || "");
  } catch {}
  assert(Array.isArray(lines) && lines.length, "เลือก PO ซื้ออย่างน้อย 1 ใบ");
  const current = own ? shipmentLines(own) : [];
  const seen = new Set<string>();
  for (const line of lines) {
    const po = purchaseLots(db).find((l) => l.id === line?.lotId);
    assert(po, "ไม่พบ PO ซื้อที่เลือก");
    assert(!seen.has(po.id), "เลือก PO ซื้อซ้ำในใบเดียวกัน");
    seen.add(po.id);
    const kg = Number(String(line.kg ?? "").trim() || NaN);
    assert(
      Number.isFinite(kg) && kg > 0,
      `กรอกน้ำหนักที่จะส่งของ ${po.poId} เป็นตัวเลขมากกว่าศูนย์`,
    );
    assert(
      entries(db, "foodivaConfirm", po.id).length,
      `${po.poId} ยังไม่มี Invoice เนื้อจาก Foodiva`,
    );
    const remaining =
      poRemainingKg(db, po.id) +
      current
        .filter((mine) => mine.lotId === po.id)
        .reduce((total, mine) => total + mine.kg, 0);
    if (kg > remaining + 0.001)
      throw new OverStockError(
        `น้ำหนักที่ขอส่งเกินยอดคงเหลือของ ${po.poId} (เหลือ ${remaining.toFixed(2)} กก.)`,
      );
  }
  v.lines = JSON.stringify(
    lines.map((line) => ({ lotId: line.lotId, kg: String(Number(line.kg)) })),
  );
  v.requestedKg = String(
    lines.reduce((total, line) => total + Number(line.kg), 0),
  );
}
export function mutate(
  db: Database,
  role: Role,
  kind: string,
  input: Values,
  lotId: string,
  date: string,
  /** The acting branch account's branch. Required for role "branch"; never taken from config. */
  actorBranch = "",
): Database {
  return record(db, role, kind, input, lotId, date, actorBranch);
}
/** `mutate`, plus `correcting`: re-checks an entry being edited, whose day may be closed. */
function record(
  db: Database,
  role: Role,
  kind: string,
  input: Values,
  lotId: string,
  date: string,
  actorBranch = "",
  correcting = false,
): Database {
  assert(
    kind === "editRequest"
      ? !editApprovers.includes(role)
      : kind === "entryEdit" || kind === "editDecision"
        ? editApprovers.includes(role)
        : ownership[kind] === role,
    "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้",
  );
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date), "เลือกวันที่ทำรายการ");
  // Same clock as format.ts `today` (kept inline: this module has no imports).
  const todayDate = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok",
  });
  assert(date <= todayDate, "วันที่ทำรายการต้องไม่เกินวันนี้");
  const startDate = db.config.systemStartDate || "";
  // Only once the system has gone live; a future start date means setup is still in progress.
  if (kind !== "config" && startDate && startDate <= todayDate)
    assert(
      date >= startDate,
      `วันที่ทำรายการต้องไม่ก่อนวันเริ่มใช้ระบบ (${startDate})`,
    );
  const next: Database = structuredClone(db),
    v = { ...input };
  let lot = next.lots.find((l) => l.id === lotId);
  const branch = role === "branch" ? actorBranch : v.branch || db.config.branch;
  for (const key of [
    "arrival",
    "time",
    "closeTime",
    "pickupTime",
    "dispatchTime",
  ]) {
    if (key in v)
      assert(
        /^([01]\d|2[0-3]):[0-5]\d$/.test(v[key]),
        "กรอกเวลาเป็น HH:mm เช่น 08:00",
      );
  }
  if (role === "branch") {
    assert(branches.includes(branch), "ไม่พบสาขาของบัญชีนี้");
    // A request changes nothing until an approver decides, so a closed day still takes one.
    if (!correcting && kind !== "editRequest")
      assert(
        !isClosed(db, branch, date),
        "วันนี้ปิดยอดแล้ว ต้องให้ Owner ปลดล็อกก่อน",
      );
  }
  const expected = stageAction.indexOf(kind);
  if (expected > 0 && kind !== "allocate") {
    assert(lot?.kind === "shipment", "รายการนี้ต้องทำกับการส่ง ไม่ใช่ PO ซื้อ");
    assert(lot.stage === expected, "ขั้นตอนเปลี่ยนไปแล้ว กรุณาเปิดฟอร์มใหม่");
    // A backdated step must not land before the step it depends on.
    const latest = db.entries
      .filter((e) => e.lotId === lotId)
      .reduce((max, e) => (e.date > max ? e.date : max), "");
    assert(
      date >= latest,
      `วันที่ต้องไม่ก่อนขั้นตอนก่อนหน้าของ Lot นี้ (${latest})`,
    );
  }
  if (["foodivaConfirm", "ownerWasteReceive", "meatPayment"].includes(kind))
    assert(lot && !lot.kind, "รายการนี้ต้องทำกับ PO ซื้อ");
  // Non-stage lot-pipeline entries still can't predate the lot's PO. Branch kinds are
  // excluded: they carry the selected lot as context, not as the lot they belong to.
  const lotPipeline = [
    "foodivaConfirm",
    "packingList",
    "foodivaReturnReceive",
    "smokeOrder",
    "smokeOrderAccept",
    "smokingInvoice",
    "invoiceReview",
    "invoicePayment",
    "chefEdit",
    "meatPayment",
    "shipmentRequestEdit",
  ];
  if (lot && lotPipeline.includes(kind)) {
    const lotRef = lot.id;
    const first = db.entries
      .filter((e) => e.lotId === lotRef)
      .reduce((min, e) => (!min || e.date < min ? e.date : min), "");
    assert(
      !first || date >= first,
      `วันที่ต้องไม่ก่อนวันเปิด PO ของ Lot นี้ (${first})`,
    );
  }
  const lotRequired = ["allocate", "receive", "thaw", "sale", "influencerBox"];
  if (lotRequired.includes(kind))
    assert(lot && lot.stage >= 8, "Lot ต้องรับเข้าสต๊อกกลางก่อน");
  if (role === "branch" && lotRequired.includes(kind))
    assert(
      entries(db, "allocate", lotId, branch).length,
      "Lot นี้ไม่ได้จัดสรรมายังสาขาของคุณ",
    );
  if (kind === "purchase") {
    required(v, "supplier", "ผู้ขาย");
    required(v, "customerName", "ชื่อบริษัท / ลูกค้า");
    required(v, "customerAddress", "ที่อยู่");
    required(v, "attention", "ชื่อผู้ติดต่อ (Attention)");
    required(v, "phone", "เบอร์ติดต่อ");
    required(v, "taxId", "เลขประจำตัวผู้เสียภาษี");
    required(v, "packSize", "ขนาดบรรจุ");
    required(v, "productName", "รายการสินค้า");
    positive(v, "orderedKg", "น้ำหนักสั่งซื้อ");
    positive(v, "price", "ราคา / กก.");
    const year = date.slice(0, 4);
    const count = next.lots.filter((l) => !l.kind).length + 1;
    lotId = `F${date.slice(2).replaceAll("-", "")}-${String(count).padStart(3, "0")}`;
    lot = {
      id: lotId,
      poId: `PO-${year}-${String(count).padStart(4, "0")}`,
      stage: 1,
      values: v,
      config: { ...db.config },
    };
    next.lots.push(lot);
  } else if (kind === "shipmentRequest") {
    requestLines(db, v);
    const count = next.lots.filter((l) => l.kind === "shipment").length + 1;
    lotId = `S${date.slice(2).replaceAll("-", "")}-${String(count).padStart(3, "0")}`;
    lot = {
      id: lotId,
      poId: `SH-${date.slice(0, 4)}-${String(count).padStart(4, "0")}`,
      kind: "shipment",
      stage: 1,
      values: v,
      config: { ...db.config },
    };
    next.lots.push(lot);
  } else if (kind === "shipmentRequestEdit") {
    // Replaces the Request's lines in place (same SH number) until Foodiva makes the manifest.
    // The entry records the new lines; the lot carries the latest, which everything reads.
    assert(
      lot?.kind === "shipment" && shipments(db).some((s) => s.id === lotId),
      "Request นี้ถูกยกเลิกแล้ว",
    );
    assert(
      lot.stage === 1 && !entries(db, "dispatch", lotId).length,
      "Foodiva ทำใบขนส่งแล้ว แก้ไข Request ไม่ได้",
    );
    requestLines(db, v, lot);
    lot.values = {
      ...lot.values,
      lines: v.lines,
      requestedKg: v.requestedKg,
      note: v.note ?? lot.values.note ?? "",
    };
  } else if (kind === "smokeOrder" && lot) {
    const list = latestPackingList(db, lotId);
    assert(list, "รอ Foodiva ทำ Packing List ก่อนออก PO รมควัน");
    assert(
      !entries(db, "smokeOrder", lotId).length,
      "ออก PO รมควันของการส่งนี้แล้ว",
    );
    required(v, "requestedSmokeDate", "วันที่ขอรม");
    required(v, "smoker", "โรงรม / ผู้ให้บริการ");
    // One shipment, one Packing List, one smoke PO. The kg starts at the Packing List total
    // and the Owner may change it (A6); no upper cap.
    if (!v.rawKg?.trim()) v.rawKg = list.values.slicedNetKg;
    positive(v, "rawKg", "น้ำหนัก PO รมควัน");
    v.rawKg = String(Number(v.rawKg));
    v.serviceRate = String(smokeServiceRate(n(v, "rawKg")));
    v.orderNumber = `SO-${date.slice(0, 4)}-${String(entries(db, "smokeOrder").length + 1).padStart(4, "0")}`;
    v.estimatedCost = String(n(v, "rawKg") * n(v, "serviceRate"));
    v.status = "Sent";
  } else if (kind === "smokeOrderAccept" && lot) {
    const order = entries(db, "smokeOrder", lotId).at(-1);
    assert(order, "ยังไม่มี PO รมควันจาก Owner");
    assert(
      !entries(db, "smokeOrderAccept", lotId).length,
      "รับ PO รมควันนี้แล้ว",
    );
    required(v, "acceptedBy", "ชื่อผู้รับ PO");
    v.orderId = order.id;
    v.orderNumber = order.values.orderNumber;
    v.status = "Accepted";
  } else if (kind === "smokingInvoice" && lot) {
    assert(lot.stage >= 6, "ต้องยืนยันปิดรอบก่อนออกใบวางบิลค่ารมควัน");
    assert(
      entries(db, "smokeOrderAccept", lotId).length,
      "ต้องยืนยันรับ PO รมควันก่อนออกใบวางบิล",
    );
    const smokeOrder = entries(db, "smokeOrder", lotId).at(-1);
    assert(smokeOrder, "ไม่พบ PO รมควันที่อ้างอิง");
    required(v, "invoiceNumber", "เลข Invoice ค่ารม");
    required(v, "invoiceDate", "วันที่ Invoice");
    v.serviceProvider = smokeOrder.values.smoker || "Chef House";
    v.serviceQuantity = String(n(smokeOrder.values, "rawKg"));
    v.serviceRate = String(smokeServiceRate(n(v, "serviceQuantity")));
    v.amountBeforeVat = String(n(v, "serviceQuantity") * n(v, "serviceRate"));
    v.vat = String(n(v, "vat"));
    v.withholdingTax = String(n(v, "withholdingTax"));
    // Chef House bills the amount itself (A7): it starts at kg × rate and Chef may change it.
    if (!v.netPayable?.trim())
      v.netPayable = String(
        n(v, "amountBeforeVat") + n(v, "vat") - n(v, "withholdingTax"),
      );
    positive(v, "netPayable", "ยอดเรียกเก็บค่ารมควัน");
    v.netPayable = String(Number(v.netPayable));
    required(v, "attachment", "Invoice ที่แนบ");
    v.status = "Submitted";
  } else if (kind === "invoiceReview" && lot) {
    const invoice =
      entries(db, "smokingInvoice", lotId).find(
        (entry) => entry.id === v.invoiceId,
      ) || entries(db, "smokingInvoice", lotId).at(-1);
    assert(invoice, "ไม่พบ Invoice ค่ารมควันที่ต้องตรวจ");
    v.invoiceId = invoice.id;
    assert(
      smokingInvoiceStatus(db, invoice) !== "ชำระแล้ว",
      "Invoice นี้ชำระแล้ว",
    );
    assert(
      ["รับยอด", "ส่งกลับแก้ไข"].includes(v.decision),
      "เลือกผลการตรวจยอด",
    );
    required(v, "reviewedBy", "ชื่อผู้ตรวจ");
    v.reviewedAt = new Date().toISOString();
  } else if (kind === "invoicePayment" && lot) {
    const invoice =
      entries(db, "smokingInvoice", lotId).find(
        (entry) => entry.id === v.invoiceId,
      ) || entries(db, "smokingInvoice", lotId).at(-1);
    assert(invoice, "ไม่พบ Invoice ค่ารมควันที่ต้องชำระ");
    v.invoiceId = invoice.id;
    assert(
      smokingInvoiceStatus(db, invoice) === "รอชำระ",
      "ต้องรับยอด Invoice ก่อนชำระเงิน",
    );
    required(v, "paymentDate", "วันที่ชำระ");
    required(v, "paidBy", "ผู้ดำเนินการชำระ");
    positive(v, "paidAmount", "ยอดชำระ");
    assert(
      Math.abs(n(v, "paidAmount") - n(invoice.values, "netPayable")) < 0.01,
      "ยอดชำระต้องเท่ากับยอดสุทธิใน Invoice",
    );
    checkSlips(v);
  } else if (kind === "meatPayment" && lot) {
    const invoice = entries(db, "foodivaConfirm", lotId).at(-1);
    assert(invoice, "ยังไม่มี Invoice เนื้อจาก Foodiva");
    assert(
      !entries(db, "meatPayment", lotId).length,
      "ชำระ Invoice เนื้อใบนี้แล้ว",
    );
    required(v, "paymentDate", "วันที่ชำระ");
    required(v, "paidBy", "ผู้ดำเนินการชำระ");
    positive(v, "paidAmount", "ยอดชำระ");
    if (n(invoice.values, "invoiceAmount") > 0)
      assert(
        Math.abs(n(v, "paidAmount") - n(invoice.values, "invoiceAmount")) <
          0.01,
        "ยอดชำระต้องเท่ากับยอดรวม Invoice เนื้อ",
      );
    v.invoiceNo = invoice.values.invoiceNo;
    checkSlips(v);
  } else if (kind === "foodivaConfirm" && lot) {
    required(v, "invoiceNo", "เลข Invoice");
    required(v, "invoiceDate", "วันที่ Invoice");
    required(v, "attachment", "Invoice ที่แนบ");
    required(v, "confirmedBy", "ชื่อผู้ยืนยัน");
    positive(v, "confirmedKg", "น้ำหนักที่ยืนยันได้");
    positive(v, "readyForChiangMaiKg", "น้ำหนักพร้อมส่งเชียงใหม่", true);
    positive(
      v,
      "reservedForOwnerKg",
      "น้ำหนักเนื้อส่วนที่เหลือรอ Owner รับ",
      true,
    );
    positive(v, "invoiceAmount", "ยอดรวม Invoice", true);
    withinStock(
      n(v, "confirmedKg"),
      n(lot.values, "orderedKg"),
      "น้ำหนักยืนยันเกินยอด PO",
    );
    assert(
      Math.abs(
        n(v, "readyForChiangMaiKg") +
          n(v, "reservedForOwnerKg") -
          n(v, "confirmedKg"),
      ) < 0.001,
      "น้ำหนักพร้อมส่งเชียงใหม่และเนื้อส่วนที่เหลือรอ Owner รับต้องรวมเท่ากับน้ำหนักตาม Invoice",
    );
  } else if (kind === "packingList" && lot) {
    assert(
      lot.kind === "shipment" && entries(db, "dispatch", lotId).length,
      "ต้องทำใบขนส่งขาไปก่อนทำ Packing List",
    );
    assert(
      !entries(db, "smokeOrder", lotId).length,
      "Owner ออก PO รมควันจาก Packing List นี้แล้ว แก้ไขไม่ได้",
    );
    required(v, "invoiceNo", "เลข Invoice");
    required(v, "product", "รายการสินค้า");
    const boxes = packingListBoxes(v.boxes);
    assert(boxes.length, "กรอกน้ำหนักอย่างน้อย 1 กล่องรับเข้า");
    assert(
      boxes.every((kg) => Number.isFinite(kg) && kg > 0),
      "น้ำหนักกล่องรับเข้าต้องเป็นตัวเลขมากกว่าศูนย์",
    );
    // Blank rows are dropped at save, so the stored list is contiguous: box no = line no.
    v.boxes = boxes.map((kg) => kg.toFixed(2)).join("\n");
    v.boxCount = String(boxes.length);
    /* A2: Sliced Weight Net is the rows added up, never typed — whatever the form sends
     * is recomputed here so the two can never drift apart. */
    v.slicedNetKg = String(boxes.reduce((sum, kg) => sum + kg, 0));
    /* Sliced Weight Lost is what cutting took away — Inv. Weight less Sliced Weight Net,
     * never Chef House's yellow cells. Zero is a normal list: nothing was lost. */
    positive(v, "slicedLostKg", "Sliced Weight Lost", true);
    if (v.invWeightKg?.trim()) {
      positive(v, "invWeightKg", "Inv. Weight");
      withinStock(
        n(v, "slicedNetKg"),
        n(v, "invWeightKg"),
        "น้ำหนักรวมกล่องรับเข้าเกิน Inv. Weight",
        "กก.",
        "รวมได้สูงสุด",
      );
    }
  } else if (kind === "ownerWasteReceive" && lot) {
    required(v, "receivedDate", "วันที่ Owner รับเนื้อ");
    positive(v, "receivedKg", "น้ำหนักรับจริง");
    required(v, "receiver", "ผู้รับเนื้อ");
    assert(
      reservedForOwnerContent(db, lotId) > 0,
      "Foodiva ยังไม่ได้ระบุเนื้อส่วนที่เหลือรอ Owner รับ",
    );
    withinStock(
      n(v, "receivedKg"),
      ownerWasteOutstanding(db, lotId),
      "น้ำหนักรับเกินยอดเนื้อส่วนที่เหลือที่ Foodiva รอให้ Owner รับ",
    );
  } else if (kind === "foodivaReturnReceive" && lot) {
    assert(lot.stage === 7, "รอ Owner สร้างใบขนส่งกลับจาก Chef House ก่อน");
    assert(
      entries(db, "return", lotId).length,
      "ยังไม่มีใบขนส่ง Chef House → Foodiva",
    );
    required(v, "receivedDate", "วันที่รับ");
    required(v, "receivedTime", "เวลารับ");
    positive(v, "receivedKg", "น้ำหนักรับ");
    positive(v, "receivedBags", "จำนวนกล่องรมควัน", true);
    assert(
      Number.isInteger(n(v, "receivedBags")),
      "จำนวนกล่องรมควันต้องเป็นจำนวนเต็ม",
    );
    // Foodiva weighs against what the return truck carried, not the full smoke output.
    variance(
      n(v, "receivedKg"),
      n(entries(db, "return", lotId).at(-1)!.values, "returnKg"),
      v,
      false,
    );
  } else if (kind === "dispatch" && lot) {
    assert(
      shipments(db).some((s) => s.id === lotId),
      "Request นี้ถูกยกเลิกแล้ว",
    );
    // The truck carries what the Owner requested; Foodiva does not type a weight.
    v.dispatchKg = lot.values.requestedKg;
    required(v, "pickupDate", "วันรับ");
    required(v, "pickupTime", "เวลารถรับ");
    required(v, "origin", "ต้นทาง");
    required(v, "destination", "ปลายทาง");
    // Fees come from the settings in force when the manifest is made, not the lot's purchase-time snapshot.
    v.outboundCost =
      v.trip === "ไปกลับ"
        ? (db.config.roundFee ?? lot.config.roundFee)
        : (db.config.outboundFee ?? lot.config.outboundFee);
    assert(v.origin !== v.destination, "ต้นทางและปลายทางต้องต่างกัน");
    v.transferNumber = `TR-${date.slice(0, 4)}-${String(entries(db, "dispatch").length + 1).padStart(4, "0")}`;
  } else if (kind === "cmReceive" && lot) {
    assert(
      entries(db, "smokeOrderAccept", lotId).length,
      "ต้องยืนยันรับ PO รมควันก่อนยืนยันรับเนื้อ",
    );
    required(v, "arrival", "เวลาถึง");
    const received = receivedTotal(db, lotId, v.receivedBoxes);
    v.receivedBoxes = received.boxes;
    v.receivedKg = String(received.total);
  } else if (kind === "prepare" && lot) {
    positive(v, "preSmokeKg", "น้ำหนักก่อนสโมค");
    withinStock(
      n(v, "preSmokeKg"),
      n(lot.values, "receivedKg"),
      "น้ำหนักก่อนสโมคเกินน้ำหนักรับ",
    );
  } else if (kind === "smoke" && lot) {
    positive(v, "inputKg", "น้ำหนักเข้าเตา");
    withinStock(
      n(v, "inputKg"),
      n(lot.values, "preSmokeKg") - processed(db, lotId),
      "น้ำหนักเข้าเตาเกินน้ำหนักรอผลิต",
    );
    positive(v, "wasteKg", "น้ำหนัก Waste", true);
    required(v, "smokeDate", "วันที่สโมค");
    const weights = packWeights(v.packs);
    assert(
      weights.length > 0 && weights.every(isPackWeight),
      "กรอกน้ำหนักกล่องรมควันทุกกล่องรมควัน ต้องมากกว่า 0 กก.",
    );
    const output = weights.reduce((a, b) => a + b, 0);
    assert(
      Math.abs(output + n(v, "wasteKg") - n(v, "inputKg")) <= 0.001,
      "น้ำหนักกล่องรมควันรวมและ Waste ต้องเท่ากับน้ำหนักเข้าเตา",
    );
    v.wasteKg = String(n(v, "wasteKg"));
    v.postSmokeKg = output.toFixed(2);
    v.packCount = String(weights.length);
    v.subLot = `SB-${date.slice(0, 4)}-${String(entries(db, "smoke").length + 1).padStart(4, "0")}`;
  } else if (kind === "chefEdit" && lot) {
    // Corrects the receive/prepare/smoke values without touching those entries (see entries()).
    assert(lot.stage === 5, "แก้ไขได้เฉพาะก่อนยืนยันปิด Lot");
    const receiveEntry = entries(next, "cmReceive", lotId).at(-1);
    const prepareEntry = entries(next, "prepare", lotId).at(-1);
    const smokeEntries = entries(next, "smoke", lotId);
    let drafts: Values[] = [];
    try {
      drafts = JSON.parse(v.batches || "[]");
    } catch {}
    assert(
      receiveEntry &&
        prepareEntry &&
        Array.isArray(drafts) &&
        drafts.length === smokeEntries.length &&
        smokeEntries.every((entry, index) => drafts[index]?.id === entry.id),
      "ไม่พบข้อมูล Lot ล่าสุด",
    );
    // The yellow cells are weighed once, at cmReceive, and never edited again (A5).
    assert(
      v.receivedBoxes === undefined && v.receivedKg === undefined,
      "น้ำหนักรับจริง (ช่องเหลือง) บันทึกครั้งเดียวตอนยืนยันรับเนื้อ แก้ไขไม่ได้",
    );
    const receivedKg = n(lot.values, "receivedKg");
    const preSmokeKg = Number(v.preSmokeKg);
    assert(
      Number.isFinite(receivedKg) &&
        Number.isFinite(preSmokeKg) &&
        receivedKg > 0 &&
        preSmokeKg > 0,
      "กรอกน้ำหนักให้ถูกต้อง",
    );
    withinStock(preSmokeKg, receivedKg, "น้ำหนักก่อนสโมคมากกว่าน้ำหนักรับจริง");
    const batches = drafts.map((draft) => {
      const inputKg = Number(draft.inputKg);
      const wasteKg = Number(draft.wasteKg);
      const weights = packWeights(draft.packs);
      assert(
        draft.smokeDate &&
          Number.isFinite(inputKg) &&
          Number.isFinite(wasteKg) &&
          inputKg > 0 &&
          wasteKg >= 0,
        "กรอกวันที่ น้ำหนักเข้าเตา และ Waste ให้ครบทุกรอบ",
      );
      assert(
        weights.length && weights.every(isPackWeight),
        "กรอกน้ำหนักกล่องรมควันให้ครบและมากกว่า 0 ทุกรอบ",
      );
      const postSmokeKg = weights.reduce((total, weight) => total + weight, 0);
      assert(
        Math.abs(postSmokeKg + wasteKg - inputKg) <= 0.001,
        "น้ำหนักกล่องรมควันรวมและ Waste ต้องเท่ากับน้ำหนักเข้าเตา",
      );
      return {
        smokeDate: draft.smokeDate,
        inputKg: String(inputKg),
        wasteKg: String(wasteKg),
        packs: weights.join("\n"),
        postSmokeKg: postSmokeKg.toFixed(2),
        packCount: String(weights.length),
      };
    });
    assert(
      Math.abs(
        batches.reduce((total, batch) => total + Number(batch.inputKg), 0) -
          preSmokeKg,
      ) <= 0.001,
      "ก่อนปิด Lot น้ำหนักเข้าเตารวมจาก Log ต้องเท่ากับน้ำหนักก่อนสโมค",
    );
    // Recorded, not applied: save_app_state refuses changed history, so entries() overlays these.
    v.receiveId = receiveEntry.id;
    v.prepareId = prepareEntry.id;
    v.receivedKg = String(receivedKg);
    v.preSmokeKg = String(preSmokeKg);
    const latestBatch = batches.at(-1)!;
    lot.values = {
      ...lot.values,
      arrival: v.arrival,
      preSmokeKg: String(preSmokeKg),
      inputKg: latestBatch.inputKg,
      wasteKg: latestBatch.wasteKg,
      packs: latestBatch.packs,
      postSmokeKg: latestBatch.postSmokeKg,
      packCount: latestBatch.packCount,
    };
    v.batches = JSON.stringify(
      batches.map((batch, index) => ({ id: smokeEntries[index].id, ...batch })),
    );
  } else if (kind === "closeLot" && lot) {
    assert(
      Math.abs(n(lot.values, "preSmokeKg") - processed(db, lotId)) < 0.005,
      "ยังมีน้ำหนักรอผลิต ต้องบันทึกให้ครบก่อน",
    );
    assert(produced(db, lotId) > 0, "ยังไม่มีผลผลิต");
    required(v, "confirm", "ชื่อผู้ยืนยัน");
  } else if (kind === "return" && lot) {
    required(v, "returnDate", "วันที่รถรับ");
    required(v, "returnTime", "เวลารถรับ");
    required(v, "origin", "ต้นทาง");
    required(v, "destination", "ปลายทาง");
    required(v, "vehicleType", "ประเภทรถ");
    required(v, "plate", "ทะเบียนรถ");
    required(v, "driverName", "ชื่อคนขับ");
    required(v, "driverPhone", "เบอร์ติดต่อคนขับ");
    assert(v.origin !== v.destination, "ต้นทางและปลายทางต้องต่างกัน");
    positive(v, "returnKg", "น้ำหนักส่งกลับ");
    v.transferNumber = `TR-${date.slice(0, 4)}-R${String(entries(db, "return").length + 1).padStart(4, "0")}`;
    withinStock(
      n(v, "returnKg"),
      produced(db, lotId),
      "น้ำหนักส่งกลับเกินผลผลิต",
    );
    v.returnCost =
      lot.values.trip === "ไปกลับ"
        ? "0"
        : (db.config.returnFee ?? lot.config.returnFee);
  } else if (kind === "central" && lot) {
    assert(
      entries(db, "foodivaReturnReceive", lotId).length,
      "รอ Foodiva ยืนยันรับเนื้อรมควันก่อน",
    );
    positive(v, "centralKg", "น้ำหนักรับกลาง");
    variance(
      n(v, "centralKg"),
      n(
        entries(db, "foodivaReturnReceive", lotId).at(-1)?.values || {},
        "receivedKg",
      ),
      v,
      false,
    );
  } else if (kind === "allocate") {
    positive(v, "kg", "น้ำหนักจัดสรร");
    withinStock(n(v, "kg"), centralStock(db, lotId), "สต๊อกกลางไม่พอ");
    assert(branches.includes(v.branch), "เลือกสาขา");
  } else if (kind === "receive") {
    positive(v, "kg", "น้ำหนักรับ");
    const allocation = entries(db, "allocate", lotId, branch).find(
      (e) => e.id === v.allocation,
    );
    assert(allocation, "เลือกใบจัดสรร");
    const outstanding = allocationOutstanding(db, allocation);
    withinStock(n(v, "kg"), outstanding, "รับเกินยอดค้างรับ");
    // Closing the allocation makes any shortfall final, so it needs a reason; a
    // partial receive leaves the rest pending.
    if (v.complete === "1") variance(n(v, "kg"), outstanding, v);
  } else if (kind === "thaw") {
    positive(v, "kg", "น้ำหนักละลาย");
    withinStock(
      n(v, "kg"),
      balance(db, lotId, branch).frozen,
      "สต๊อกแช่แข็งไม่พอ",
    );
    positive(v, "bags", "จำนวนกล่องรมควันที่ละลาย");
    assert(Number.isInteger(n(v, "bags")), "จำนวนกล่องรมควันต้องเป็นจำนวนเต็ม");
    const oldest = db.lots
      .filter((l) => balance(db, l.id, branch).frozen > 0.001)
      .sort((a, b) =>
        (a.values.smokeDate || a.id).localeCompare(b.values.smokeDate || b.id),
      )[0];
    if (oldest && oldest.id !== lotId) required(v, "reason", "เหตุผลข้าม FIFO");
  } else if (kind === "ricePurchase") {
    // Every purchase says which way this round goes, at either branch (B2):
    // self-cook buys raw rice, bought-cooked buys cooked rice. The other side is zeroed.
    assert(riceSources.includes(v.riceSource), "เลือกที่มาของข้าวเหนียวรอบนี้");
    const selfCook = v.riceSource === riceSources[0];
    for (const key of selfCook
      ? ["cookedRiceKg", "cookedRiceCost"]
      : ["rawRiceKg", "rawRiceCost"])
      v[key] = "0";
    required(v, "supplier", "ผู้จำหน่ายข้าว");
    if (selfCook) {
      positive(v, "rawRiceKg", "ข้าวเหนียวดิบซื้อเข้า");
      positive(v, "rawRiceCost", "ยอดซื้อข้าวเหนียวดิบ");
      v.totalCost = v.rawRiceCost;
    } else {
      // cookedRicePar is only a hint in the form now, never a block (FB-12).
      positive(v, "cookedRiceKg", "ข้าวเหนียวสุกซื้อเข้า");
      positive(v, "cookedRiceCost", "ยอดซื้อข้าวเหนียวสุก");
      v.totalCost = v.cookedRiceCost;
    }
  } else if (kind === "chiliAllocate") {
    assert(branches.includes(v.branch), "เลือกสาขาปลายทาง");
    positive(v, "chiliTubes", "จำนวนน้ำพริกที่จัดสรร");
    assert(
      Number.isInteger(n(v, "chiliTubes")),
      "น้ำพริกต้องเป็นจำนวนหลอดเต็ม",
    );
    withinStock(
      n(v, "chiliTubes"),
      ownerChiliStock(db),
      "น้ำพริกในคลัง Owner ไม่พอ กรุณาบันทึกซื้อเข้าบัญชีก่อน",
      "หลอด",
    );
  } else if (kind === "chiliPurchase") {
    positive(v, "chiliTubes", "น้ำพริกซื้อเข้า");
    assert(
      Number.isInteger(n(v, "chiliTubes")),
      "น้ำพริกต้องเป็นจำนวนหลอดเต็ม",
    );
    positive(v, "chiliCost", "ยอดซื้อน้ำพริก");
    required(v, "supplier", "ผู้จำหน่ายน้ำพริก");
    v.totalCost = v.chiliCost;
  } else if (kind === "riceIssue") {
    positive(v, "rawRiceIssuedKg", "ข้าวเหนียวดิบที่เบิก");
    withinStock(
      n(v, "rawRiceIssuedKg"),
      rawRiceStock(db, branch),
      "ข้าวเหนียวดิบในสต๊อกไม่พอ",
    );
    required(v, "receiver", "ผู้รับของ");
  } else if (kind === "chiliIssue") {
    positive(v, "chiliIssuedTubes", "น้ำพริกที่เบิก");
    assert(
      Number.isInteger(n(v, "chiliIssuedTubes")),
      "น้ำพริกต้องเป็นจำนวนหลอดเต็ม",
    );
    withinStock(
      n(v, "chiliIssuedTubes"),
      chiliStock(db, branch),
      "น้ำพริกในสต๊อกไม่พอ",
      "หลอด",
    );
    required(v, "receiver", "ผู้รับของ");
  } else if (kind === "supplyPurchase") {
    for (const key of [
      "rawRiceKg",
      "rawRiceCost",
      "cookedRiceKg",
      "cookedRiceCost",
      "chiliTubes",
      "chiliCost",
    ])
      v[key] ??= "0";
    positive(v, "rawRiceKg", "ข้าวเหนียวดิบซื้อเข้า", true);
    positive(v, "rawRiceCost", "ยอดซื้อข้าวเหนียวดิบ", true);
    positive(v, "cookedRiceKg", "ข้าวเหนียวสุกซื้อเข้า", true);
    positive(v, "cookedRiceCost", "ยอดซื้อข้าวเหนียวสุก", true);
    positive(v, "chiliTubes", "น้ำพริกซื้อเข้า", true);
    positive(v, "chiliCost", "ยอดซื้อน้ำพริก", true);
    assert(
      n(v, "rawRiceKg") > 0 ||
        n(v, "cookedRiceKg") > 0 ||
        n(v, "chiliTubes") > 0,
      "กรอกจำนวนข้าวเหนียวหรือน้ำพริกที่ซื้อเข้า",
    );
    assert(
      Number.isInteger(n(v, "chiliTubes")),
      "น้ำพริกต้องเป็นจำนวนหลอดเต็ม",
    );
    if (n(v, "rawRiceKg") > 0)
      positive(v, "rawRiceCost", "ยอดซื้อข้าวเหนียวดิบ");
    if (n(v, "cookedRiceKg") > 0)
      positive(v, "cookedRiceCost", "ยอดซื้อข้าวเหนียวสุก");
    if (n(v, "chiliTubes") > 0) positive(v, "chiliCost", "ยอดซื้อน้ำพริก");
    required(v, "supplier", "ผู้จำหน่าย");
    v.totalCost = String(
      n(v, "rawRiceCost") + n(v, "cookedRiceCost") + n(v, "chiliCost"),
    );
  } else if (kind === "supplyIssue") {
    positive(v, "rawRiceIssuedKg", "ข้าวเหนียวดิบที่เบิก", true);
    positive(v, "chiliIssuedTubes", "น้ำพริกที่เบิก", true);
    assert(
      n(v, "rawRiceIssuedKg") > 0 || n(v, "chiliIssuedTubes") > 0,
      "กรอกจำนวนข้าวเหนียวดิบหรือน้ำพริกที่เบิก",
    );
    assert(
      Number.isInteger(n(v, "chiliIssuedTubes")),
      "น้ำพริกที่เบิกต้องเป็นจำนวนหลอดเต็ม",
    );
    withinStock(
      n(v, "rawRiceIssuedKg"),
      rawRiceStock(db, branch),
      "ข้าวเหนียวดิบในสต๊อกไม่พอ",
    );
    withinStock(
      n(v, "chiliIssuedTubes"),
      chiliStock(db, branch),
      "น้ำพริกในสต๊อกไม่พอ",
      "หลอด",
    );
    required(v, "receiver", "ผู้รับของ");
  } else if (kind === "rice") {
    // Cooked rice may weigh more than the raw rice it came from (FB-10): no ratio check.
    positive(v, "rawUsedKg", "ข้าวเหนียวดิบที่นำมาหุง");
    positive(v, "riceKg", "ข้าวเหนียวสุกที่ได้");
    withinStock(
      n(v, "rawUsedKg"),
      issuedRawRiceStock(db, branch),
      "ข้าวเหนียวดิบที่เบิกไว้ไม่พอ กรุณาบันทึกเบิกก่อนหุง",
    );
  } else if (kind === "riceCarry") {
    positive(v, "leftoverKg", "ข้าวเหนียวสุกเหลือปลายวัน", true);
    variance(n(v, "leftoverKg"), cookedRiceStock(db, branch), v);
    required(v, "reheat", "การจัดการวันถัดไป");
  } else if (kind === "materials") {
    for (let i = 0; i < 7; i++) {
      positive(v, "material" + i, materials[i], true);
      assert(Number.isInteger(n(v, "material" + i)), "วัสดุต้องเป็นจำนวนเต็ม");
      if (v["opening" + i] !== undefined || v["used" + i] !== undefined) {
        const expectedOpening = branchMaterialStock(db, branch, i, date);
        positive(v, "opening" + i, `ยอดตั้งต้น ${materials[i]}`, true);
        positive(v, "used" + i, `จำนวนใช้ ${materials[i]}`, true);
        assert(
          Number.isInteger(n(v, "opening" + i)) &&
            Number.isInteger(n(v, "used" + i)),
          "ยอดวัสดุต้องเป็นจำนวนเต็ม",
        );
        assert(
          n(v, "opening" + i) === expectedOpening,
          `ยอดตั้งต้น ${materials[i]} มีการเปลี่ยนแปลง กรุณาโหลดหน้าใหม่`,
        );
        withinStock(
          n(v, "used" + i),
          expectedOpening,
          `จำนวนใช้ ${materials[i]} เกินยอดตั้งต้น`,
          "",
        );
        const expectedRemaining = expectedOpening - n(v, "used" + i);
        assert(
          n(v, "material" + i) >= 0,
          `ยอดตรวจนับ ${materials[i]} ติดลบไม่ได้`,
        );
        if (Math.abs(n(v, "material" + i) - expectedRemaining) > 0.001)
          required(v, "materialReason" + i, `เหตุผลส่วนต่าง ${materials[i]}`);
      }
    }
    /* Saving again is how a mistyped count gets fixed. Stamp the round and the
     * reason instead of locking the form, so the owner can tell an honest fix from
     * a quiet rewrite: every round stays in the log. */
    const recorded = entries(db, "materials", undefined, branch, date);
    if (recorded.length) {
      v.revision = String(recorded.length + 1);
      required(v, "correctionReason", "เหตุผลที่แก้ไขยอดวัสดุ");
    }
  } else if (kind === "materialReceive") {
    required(v, "purchaseDate", "วันที่ซื้อวัสดุ");
    assert(materials.includes(v.material), "เลือกวัสดุ");
    positive(v, "quantity", "จำนวนรับเข้าคลัง");
    assert(Number.isInteger(n(v, "quantity")), "จำนวนวัสดุต้องเป็นจำนวนเต็ม");
    positive(v, "unitPrice", "ราคาต่อหน่วย", true);
    required(v, "supplier", "ผู้จำหน่าย");
    v.totalCost = String(n(v, "quantity") * n(v, "unitPrice"));
  } else if (kind === "generalPurchase") {
    required(v, "purchaseDate", "วันที่ซื้อ");
    required(v, "item", "รายการที่ซื้อ");
    required(v, "purchaseCategory", "หมวดบัญชี");
    positive(v, "quantity", "จำนวนที่ซื้อ");
    positive(v, "unitPrice", "ราคาซื้อต่อหน่วย", true);
    required(v, "supplier", "ผู้จำหน่าย");
    v.totalCost = String(n(v, "quantity") * n(v, "unitPrice"));
  } else if (kind === "materialTransfer") {
    assert(materials.includes(v.material), "เลือกวัสดุ");
    assert(branches.includes(v.branch), "เลือกสาขาปลายทาง");
    const materialIndex = materials.indexOf(v.material);
    assert(
      materialPar(db, v.branch, materialIndex) > 0 &&
        materialUnitPrice(db, v.branch, materialIndex) > 0,
      `ตั้งจำนวนฐานและราคาต่อหน่วยของ ${v.material} สำหรับสาขา${v.branch} ก่อนส่ง`,
    );
    positive(v, "quantity", "จำนวนที่ส่ง");
    assert(Number.isInteger(n(v, "quantity")), "จำนวนวัสดุต้องเป็นจำนวนเต็ม");
    withinStock(
      n(v, "quantity"),
      ownerMaterialStock(db, v.material),
      `${v.material} ในคลัง Owner ไม่พอ`,
      "",
    );
    required(v, "receiver", "ผู้รับของ");
    v.requiresConfirm = "1";
  } else if (kind === "materialConfirm") {
    const transfer = entries(db, "materialTransfer", undefined, branch).find(
      (entry) => entry.id === v.transferId,
    );
    assert(transfer, "ไม่พบรายการส่งวัสดุ");
    assert(
      !entries(db, "materialConfirm", undefined, branch).some(
        (entry) => entry.values.transferId === v.transferId,
      ),
      "ยืนยันรับรายการนี้แล้ว",
    );
    positive(v, "receivedQuantity", "จำนวนที่รับจริง");
    assert(
      Number.isInteger(n(v, "receivedQuantity")),
      "จำนวนรับจริงต้องเป็นจำนวนเต็ม",
    );
    withinStock(
      n(v, "receivedQuantity"),
      n(transfer.values, "quantity"),
      "จำนวนรับจริงเกินจำนวนที่ส่ง",
      "",
    );
    variance(n(v, "receivedQuantity"), n(transfer.values, "quantity"), v);
    required(v, "receiver", "ชื่อผู้รับจริง");
  } else if (kind === "sale") {
    for (const k of [
      "boxes",
      "addons",
      "chiliAddons",
      "soldKg",
      "wasteKg",
      "expense",
      "lineMan",
      "riceWasteKg",
    ])
      positive(v, k, k, true);
    for (const k of ["boxes", "addons", "chiliAddons"])
      assert(Number.isInteger(n(v, k)), "จำนวนขายต้องเป็นจำนวนเต็ม");
    v.riceServings = v.boxes;
    v.chiliComplimentary = "0";
    v.chiliSold = String(n(v, "chiliAddons"));
    // 100–103 g per pack is only a warning (packWeightWarning): the form shows it.
    withinStock(
      n(v, "soldKg") + n(v, "wasteKg"),
      balance(db, lotId, branch).ready,
      "น้ำหนักที่ใช้และเวสต์เกินเนื้อที่ละลายแล้ว (รวมชิลยกมา)",
      "กก.",
      "ใช้จริงรวมเวสต์ได้สูงสุด",
    );
    withinStock(
      n(v, "riceServings") * 0.2 + n(v, "riceWasteKg"),
      cookedRiceStock(db, branch),
      "ข้าวเหนียวไม่พอ",
      "กก.",
      "มีข้าวเหนียวสุก",
    );
    withinStock(
      n(v, "chiliSold"),
      chiliStock(db, branch),
      "น้ำพริกที่ Owner จัดสรรให้สาขาไม่พอ",
      "หลอด",
    );
    const hasChiliCount = v.chiliCount !== undefined && v.chiliCount !== "";
    const expectedChili = chiliStock(db, branch) - n(v, "chiliSold");
    v.chiliExpected = String(expectedChili);
    if (hasChiliCount) {
      positive(v, "chiliCount", "ยอดตรวจนับน้ำพริก", true);
      assert(
        Number.isInteger(n(v, "chiliCount")),
        "ยอดตรวจนับน้ำพริกต้องเป็นจำนวนหลอดเต็ม",
      );
      if (n(v, "chiliCount") !== expectedChili)
        required(v, "chiliRemark", "หมายเหตุเมื่อน้ำพริกไม่ตรง");
    }
    if (n(v, "wasteKg") > 0 || n(v, "riceWasteKg") > 0)
      required(v, "reason", "เหตุผล Waste");
    if (n(v, "expense") > 0) required(v, "payer", "ผู้จ่ายเงิน");
    v.revenue = v.lineMan;
    v.menuTotal = String(
      n(v, "boxes") * n(db.config, "boxPrice") +
        n(v, "addons") * n(db.config, "addonPrice") +
        n(v, "chiliAddons") * n(db.config, "chiliPrice"),
    );
    v.meatCost = String(n(v, "soldKg") * (lotCost(db, lot!).perKg || 0));
    v.wasteCost = String(n(v, "wasteKg") * (lotCost(db, lot!).perKg || 0));
  } else if (kind === "influencerBox") {
    /* A giveaway is a sale with no money in: the same goods leave the shelf, so it
     * carries the same value keys and every stock helper counts it for free.
     * The name is free text until the influencer table exists to link it to. */
    required(v, "influencer", "ชื่ออินฟลูเอนเซอร์");
    for (const [key, label] of [
      ["boxes", "จำนวนกล่องสินค้า"],
      ["addons", "จำนวนเนื้อซีลเพิ่ม"],
      ["chiliAddons", "จำนวนน้ำพริก"],
      ["soldKg", "น้ำหนักเนื้อที่ส่ง"],
      ["shippingFee", "ค่าส่ง"],
    ])
      positive(v, key, label, true);
    for (const k of ["boxes", "addons", "chiliAddons"])
      assert(Number.isInteger(n(v, k)), "จำนวนที่ส่งต้องเป็นจำนวนเต็ม");
    const sentPacks = n(v, "boxes") + n(v, "addons");
    assert(
      sentPacks + n(v, "chiliAddons") > 0,
      "กรอกของที่ส่งให้อินฟลูเอนเซอร์อย่างน้อย 1 รายการ",
    );
    withinStock(
      n(v, "soldKg"),
      balance(db, lotId, branch).ready,
      "น้ำหนักที่ส่งเกินเนื้อที่ละลายแล้ว (รวมชิลยกมา)",
    );
    v.riceServings = v.boxes;
    v.chiliSold = String(n(v, "chiliAddons"));
    withinStock(
      n(v, "riceServings") * 0.2,
      cookedRiceStock(db, branch),
      "ข้าวเหนียวไม่พอ",
      "กก.",
      "มีข้าวเหนียวสุก",
    );
    withinStock(
      n(v, "chiliSold"),
      chiliStock(db, branch),
      "น้ำพริกที่ Owner จัดสรรให้สาขาไม่พอ",
      "หลอด",
    );
    v.meatCost = String(n(v, "soldKg") * (lotCost(db, lot!).perKg || 0));
  } else if (kind === "closeDay") {
    // Any time of day (FB-14): what blocks a close is missing data, not the clock.
    const missing = closeDayChecklist(db, branch, date).find(
      (item) => item.required && !item.done,
    );
    assert(!missing, missing?.message ?? "");
    // Thawed meat left over is not an error: it carries into tomorrow as chill.
    required(v, "confirm", "ชื่อผู้ยืนยัน");
  } else if (kind === "expense") {
    positive(v, "amount", "ยอดเงิน");
    required(v, "category", "หมวดหมู่");
    required(v, "detail", "รายละเอียด");
  } else if (kind === "unlock") {
    assert(isClosed(db, branch, date), "วันนี้ยังไม่ได้ปิด");
    required(v, "reason", "เหตุผลปลดล็อก");
  } else if (kind === "void") {
    const target = db.entries.find((entry) => entry.id === v.targetId);
    const reversible = [
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
      "shipmentRequest",
    ];
    assert(target && reversible.includes(target.kind), "รายการนี้ยกเลิกไม่ได้");
    if (target.kind === "shipmentRequest")
      assert(
        db.lots.find((l) => l.id === target.lotId)?.stage === 1,
        "Foodiva ทำใบขนส่งแล้ว ยกเลิก Request ไม่ได้",
      );
    assert(
      !db.entries.some(
        (entry) =>
          entry.kind === "void" && entry.values.targetId === v.targetId,
      ),
      "รายการนี้ถูกยกเลิกแล้ว",
    );
    required(v, "reason", "เหตุผลยกเลิกรายการ");
    v.targetKind = target.kind;
    v.targetDate = target.date;
    v.targetBranch = target.branch;
  } else if (kind === "entryEdit" || kind === "editRequest") {
    // Recorded, not applied: entries() overlays the `to.` values on the target (like chefEdit).
    const target = editTarget(db, v.targetId, role, branch);
    if (kind === "editRequest")
      assert(
        !openEditRequest(db, target.id),
        "รายการนี้มีคำขอแก้ไขรอพิจารณาอยู่แล้ว",
      );
    required(v, "reason", "เหตุผลที่แก้ไข");
    let proposed: Values = {};
    try {
      proposed = JSON.parse(v.values || "{}");
    } catch {}
    delete v.values;
    Object.assign(v, editValues(db, target, proposed));
    lotId = target.lotId;
  } else if (kind === "editDecision") {
    const request = entries(db, "editRequest").find(
      (e) => e.id === v.requestId,
    );
    assert(request, "ไม่พบคำขอแก้ไข");
    assert(!editDecisionOf(db, request.id), "คำขอนี้พิจารณาแล้ว");
    assert(
      Object.values(editDecisions).includes(v.decision),
      "เลือกอนุมัติหรือไม่อนุมัติ",
    );
    v.targetId = request.values.targetId;
    v.requesterRole = request.role;
    v.requesterBranch = request.branch;
    if (v.decision === editDecisions.approve) {
      // Checked again now: the log may have moved on since the request was filed.
      const target = editTarget(db, v.targetId, role, branch);
      Object.assign(v, editValues(db, target, unpack("to.", request.values)));
    } else {
      required(v, "note", "เหตุผลที่ไม่อนุมัติ");
      for (const key of [
        "targetKind",
        "targetDate",
        "targetRole",
        "targetBranch",
      ])
        v[key] = request.values[key];
    }
    lotId = request.lotId;
  } else if (kind === "config") {
    v.ricePrice = "0";
    // Labels match the Thai setting names in ConfigView.
    for (const [key, label] of Object.entries({
      boxPrice: "ราคากล่องมาตรฐาน",
      addonPrice: "ราคาเนื้อซีลเพิ่ม",
      packKg: "น้ำหนักเฉลี่ยต่อซีล",
      ricePrice: "ราคาข้าว",
      chiliPrice: "ราคาขายน้ำพริกหลอด",
      rawRicePar: "จำนวนฐานข้าวเหนียวดิบ",
      rawRiceUnitPrice: "ราคาต่อหน่วยข้าวเหนียวดิบ",
      chiliPar: "จำนวนฐานน้ำพริก",
      chiliUnitPrice: "ราคาต่อหน่วยน้ำพริก",
      cookedRicePar: "จำนวนฐานข้าวเหนียวสุก",
      cookedRiceUnitPrice: "ราคาต่อหน่วยข้าวเหนียวสุก",
      outboundFee: "ค่าขนส่งขาไป",
      returnFee: "ค่าขนส่งขากลับ",
      roundFee: "ค่าขนส่งไป-กลับ",
      tolerance: "ค่าคลาดเคลื่อนยอดขาย",
    }))
      positive(v, key, label, key !== "packKg");
    assert(n(v, "tolerance") <= 100, "ค่าคลาดเคลื่อนต้องไม่เกิน 100%");
    assert(branches.includes(v.branch), "เลือกสาขาสำหรับบัญชีทดลอง");
    required(v, "companyName", "ชื่อบริษัท");
    for (let i = 0; i < materials.length; i++) {
      positive(v, "material" + i, `จำนวนฐาน ${materials[i]}`, true);
      positive(v, "materialPrice" + i, `ราคาต่อหน่วย ${materials[i]}`, true);
      for (const suffix of ["saladaeng", "minburi"]) {
        if (v[`material${i}_${suffix}`] !== undefined)
          positive(
            v,
            `material${i}_${suffix}`,
            `จำนวนฐาน ${materials[i]}`,
            true,
          );
        if (v[`materialPrice${i}_${suffix}`] !== undefined)
          positive(
            v,
            `materialPrice${i}_${suffix}`,
            `ราคาต่อหน่วย ${materials[i]}`,
            true,
          );
      }
    }
    next.config = { ...db.config, ...v };
  }
  if (lot && expected > 0 && kind !== "allocate") {
    lot.values = { ...lot.values, ...v };
    if (kind !== "smoke") lot.stage++;
    else if (
      Math.abs(
        n(lot.values, "preSmokeKg") - processed(db, lotId) - n(v, "inputKg"),
      ) < 0.005
    )
      lot.stage = 5;
  }
  const entryDate = ["materialReceive", "generalPurchase"].includes(kind)
    ? v.purchaseDate || date
    : kind === "ownerWasteReceive"
      ? v.receivedDate || date
      : date;
  next.entries.push({
    id: newId(),
    kind,
    role,
    lotId: lot?.id || lotId,
    branch,
    date: entryDate,
    at: new Date().toISOString(),
    values: v,
  });
  return next;
}

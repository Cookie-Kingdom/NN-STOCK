import {
  materials,
  mutate,
  packingListBoxes,
  seed,
  type Database,
  type Role,
  type Values,
} from "@/lib/store";

export const day = "2026-09-09";
export const packs = (count: number) =>
  Array.from({ length: count }, () => "0.100").join("\n");
export const purchaseInfo = {
  supplier: "Test Foodiva",
  customerName: "บริษัททดสอบ",
  customerAddress: "กรุงเทพฯ",
  attention: "ฝ่ายจัดซื้อ",
  phone: "0800000000",
  taxId: "0100000000000",
  packSize: "6 ชิ้นต่อถุง",
  productName: "เนื้อวัว",
};
export const send = {
  pickupDate: day,
  pickupTime: "06:30",
  origin: "กรุงเทพ",
  destination: "เชียงใหม่",
  trip: "ไปกลับ",
};

export type Setup = {
  run: (role: Role, kind: string, values?: Values, lotId?: string) => Database;
  readonly db: Database;
};

/** A seed database with material pars set, plus `run` that applies `mutate` on `day` as a
 * `branch` account. `run` works on the newest lot unless given one. */
export function setup(branch = seed.config.branch): Setup {
  let db = structuredClone(seed);
  for (let index = 0; index < materials.length; index++) {
    db.config[`material${index}_saladaeng`] = "100";
    db.config[`materialPrice${index}_saladaeng`] = "1";
    db.config[`material${index}_minburi`] = "100";
    db.config[`materialPrice${index}_minburi`] = "1";
  }
  return {
    run: (role, kind, values = {}, lotId = db.lots.at(-1)?.id || "") =>
      (db = mutate(db, role, kind, values, lotId, day, branch)),
    get db() {
      return db;
    },
  };
}

export const last = (s: Setup) => s.db.entries.at(-1)!;

export function purchase(s: Setup, kg: string, price = "250") {
  s.run("owner", "purchase", { ...purchaseInfo, orderedKg: kg, price });
}

export function confirm(s: Setup, kg: string, readyKg = kg) {
  s.run("foodiva", "foodivaConfirm", {
    invoiceNo: "INV-1",
    invoiceDate: day,
    attachment: "inv.pdf",
    confirmedBy: "Foodiva",
    confirmedKg: kg,
    readyForChiangMaiKg: readyKg,
    reservedForOwnerKg: String(Number(kg) - Number(readyKg)),
    invoiceAmount: "1",
  });
}

/** Owner's Request: one shipment lot drawing `[purchaseLotId, kg]` from each purchase PO. */
export function request(s: Setup, lines: [string, string][]) {
  s.run("owner", "shipmentRequest", {
    lines: JSON.stringify(lines.map(([lotId, kg]) => ({ lotId, kg }))),
  });
}

/** Foodiva's outbound transport document for the newest shipment (stage 1 → 2). */
export function dispatch(s: Setup) {
  s.run("foodiva", "dispatch", send);
}

/** Foodiva's Packing List, one กล่องรับเข้า weight per line. */
export function packingList(s: Setup, boxes: string) {
  s.run("foodiva", "packingList", {
    invoiceNo: "INV-1",
    product: "เนื้อวัว",
    // Foodiva types Lost; in practice it matches the box total.
    slicedLostKg: String(packingListBoxes(boxes).reduce((a, kg) => a + kg, 0)),
    boxes,
  });
}

/** Owner's smoke PO; its quantity comes from the Packing List. */
export function smokeOrder(s: Setup) {
  s.run("owner", "smokeOrder", {
    requestedSmokeDate: day,
    smoker: "Chef House",
  });
}

/** Chef House's smoking invoice for a closed run. */
export function invoice(s: Setup) {
  s.run("cm", "smokingInvoice", {
    invoiceNumber: "CH-1",
    invoiceDate: day,
    attachment: "ch.pdf",
  });
  return last(s);
}

/** Purchase PO with Foodiva's invoice and a Request for all of it: a shipment waiting for Foodiva's truck. */
export function readyToDispatch(s: Setup, kg: string) {
  purchase(s, kg);
  confirm(s, kg);
  request(s, [[s.db.lots.at(-1)!.id, kg]]);
}

/** Shipment at stage 3: `kg` requested and trucked as the Packing List `boxes`, smoke PO
 * accepted, weighed in at Chef House as `receivedBoxes` (the yellow cells). */
export function received(
  s: Setup,
  kg: string,
  boxes = kg,
  receivedBoxes = boxes,
) {
  readyToDispatch(s, kg);
  dispatch(s);
  packingList(s, boxes);
  smokeOrder(s);
  s.run("cm", "smokeOrderAccept", { acceptedBy: "Chef House" });
  s.run("cm", "cmReceive", { receivedBoxes, arrival: "08:00" });
}

/** Shipment at stage 5: 50 kg sent in two 25 kg boxes, 49 kg weighed in, fully smoked
 * (36 kg in 360 bags), waiting for Chef House to close it. */
export function smoked() {
  const s = setup();
  received(s, "50", "25\n25", "24.5\n24.5");
  s.run("cm", "prepare", { preSmokeKg: "48" });
  s.run("cm", "smoke", {
    smokeDate: day,
    inputKg: "20",
    wasteKg: "5",
    packs: packs(150),
  });
  s.run("cm", "smoke", {
    smokeDate: day,
    inputKg: "28",
    wasteKg: "7",
    packs: packs(210),
  });
  return s;
}

/** Shipment at stage 6: run closed at Chef House, waiting for the return truck. */
export function closed() {
  const s = smoked();
  s.run("cm", "closeLot", { confirm: "สมชาย" });
  return s;
}

/** Lot at stage 7: closed, trucked back and received by Foodiva. */
export function returned() {
  const s = closed();
  s.run("owner", "return", {
    returnDate: day,
    returnTime: "09:00",
    origin: "Chef House",
    destination: "Foodiva",
    vehicleType: "รถห้องเย็น",
    plate: "กข123",
    driverName: "คนขับ",
    driverPhone: "0800000000",
    returnKg: "36",
  });
  s.run("foodiva", "foodivaReturnReceive", {
    receivedDate: day,
    receivedTime: "10:00",
    receivedKg: "36",
    receivedBags: "360",
  });
  return s;
}

/** Lot at stage 8 with 35 kg in central stock. */
export function ready() {
  const s = returned();
  s.run("owner", "central", { centralKg: "35" });
  return s;
}

/** ศาลาแดง on `day`: 70 kg of one lot thawed, 65.5 kg used in 655 packs, no waste,
 * so 4.5 kg is left in the chiller for tomorrow. The day is not closed yet. */
export function chillDay() {
  const s = setup();
  received(s, "100", "50\n50", "49\n49");
  s.run("cm", "prepare", { preSmokeKg: "96" });
  s.run("cm", "smoke", {
    smokeDate: day,
    inputKg: "96",
    wasteKg: "24",
    packs: packs(720),
  });
  s.run("cm", "closeLot", { confirm: "สมชาย" });
  s.run("owner", "return", {
    returnDate: day,
    returnTime: "09:00",
    origin: "Chef House",
    destination: "Foodiva",
    vehicleType: "รถห้องเย็น",
    plate: "กข123",
    driverName: "คนขับ",
    driverPhone: "0800000000",
    returnKg: "72",
  });
  s.run("foodiva", "foodivaReturnReceive", {
    receivedDate: day,
    receivedTime: "10:00",
    receivedKg: "72",
    receivedBags: "720",
  });
  s.run("owner", "central", { centralKg: "72" });
  s.run("owner", "allocate", {
    branch: "ศาลาแดง",
    kg: "70",
    deliveryDate: day,
  });
  s.run("branch", "receive", { kg: "70", allocation: last(s).id });
  s.run("branch", "thaw", { kg: "70", bags: "7" });
  s.run("branch", "sale", {
    boxes: "0",
    addons: "655",
    chiliAddons: "0",
    soldKg: "65.5",
    wasteKg: "0",
    riceWasteKg: "0",
    expense: "0",
    lineMan: "209600",
  });
  return s;
}

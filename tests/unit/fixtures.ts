import {
  materials,
  mutate,
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
  origin: "กรุงเทพ",
  destination: "เชียงใหม่",
  trip: "ไปกลับ",
};

export type Setup = {
  run: (role: Role, kind: string, values?: Values, lotId?: string) => Database;
  readonly db: Database;
};

/** A seed database with material pars set, plus `run` that applies `mutate` on `day` as a `branch` account. */
export function setup(branch = seed.config.branch): Setup {
  let db = structuredClone(seed);
  for (let index = 0; index < materials.length; index++) {
    db.config[`material${index}_saladaeng`] = "100";
    db.config[`materialPrice${index}_saladaeng`] = "1";
    db.config[`material${index}_minburi`] = "100";
    db.config[`materialPrice${index}_minburi`] = "1";
  }
  return {
    run: (role, kind, values = {}, lotId = db.lots[0]?.id || "") =>
      (db = mutate(db, role, kind, values, lotId, day, branch)),
    get db() {
      return db;
    },
  };
}

export const last = (s: Setup) => s.db.entries.at(-1)!;

export function purchase(s: Setup, kg: string) {
  s.run("owner", "purchase", { ...purchaseInfo, orderedKg: kg, price: "250" });
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

/** Smoke PO, Chef_house acceptance and the submitted smoking invoice. */
export function invoice(s: Setup, kg: string) {
  s.run("owner", "smokeOrder", {
    requestedSmokeDate: day,
    smoker: "Chef_house",
    rawKg: kg,
  });
  s.run("cm", "smokeOrderAccept", { acceptedBy: "Chef_house" });
  s.run("cm", "smokingInvoice", {
    invoiceNumber: "CH-1",
    invoiceDate: day,
    attachment: "ch.pdf",
  });
  return last(s);
}

/** Purchase through a paid smoking invoice: everything dispatch waits for. */
export function readyToDispatch(s: Setup, kg: string) {
  purchase(s, kg);
  confirm(s, kg);
  const smokingInvoice = invoice(s, kg);
  s.run("owner", "invoiceReview", {
    invoiceId: smokingInvoice.id,
    decision: "รับยอด",
    reviewedBy: "Owner",
  });
  s.run("owner", "invoicePayment", {
    invoiceId: smokingInvoice.id,
    paymentDate: day,
    paidBy: "Owner",
    paidAmount: smokingInvoice.values.netPayable,
  });
}

/** Lot at stage 5: fully smoked (36 kg in 360 bags), waiting for Chef_house to close it. */
export function smoked() {
  const s = setup();
  readyToDispatch(s, "50");
  s.run("owner", "dispatch", { ...send, dispatchKg: "50" });
  s.run("cm", "cmReceive", { receivedKg: "49", arrival: "08:00" });
  s.run("cm", "prepare", { preKg: "48" });
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

/** Lot at stage 7: closed, trucked back and received by Foodiva. */
export function returned() {
  const s = smoked();
  s.run("cm", "closeLot", { confirm: "สมชาย" });
  s.run("owner", "return", {
    returnDate: day,
    returnTime: "09:00",
    origin: "Chef_house",
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

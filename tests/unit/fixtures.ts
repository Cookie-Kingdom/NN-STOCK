import {
  check,
  materials,
  mutate,
  seed,
  type Database,
  type ActingRole,
  type Values,
  type EntryKind,
} from "@/lib/store";
import { retiredKinds } from "@/lib/store/model";

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
  packSize: "6 ชิ้นต่อกล่อง",
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
  run: (
    role: ActingRole,
    kind: EntryKind,
    values?: Values,
    lotId?: string,
  ) => Database;
  /** `run` as a dry run: what it would warn about and refuse with; the database is kept. */
  check: (
    role: ActingRole,
    kind: EntryKind,
    values?: Values,
    lotId?: string,
  ) => { warnings: string[]; error: string };
  /** `check(fn)` for steps that save through `run`: the database is put back afterwards. */
  dry: (fn: () => unknown) => { warnings: string[]; error: string };
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
    check: (role, kind, values = {}, lotId = db.lots.at(-1)?.id || "") =>
      check(() => mutate(db, role, kind, values, lotId, day, branch)),
    dry: (fn) => {
      const saved = db;
      try {
        return check(fn);
      } finally {
        db = saved;
      }
    },
    get db() {
      return db;
    },
  };
}

export const last = (s: Setup) => s.db.entries.at(-1)!;

/** Old data from before allocation was retired (BR-01, RET-04): an Owner allocation of `kg`
 *  to `branch` on the newest batch (or `lotId`). mutate refuses new ones, so the kind is
 *  un-retired for this one save only. */
export function legacyAllocate(
  s: Setup,
  values: { branch: string; kg: string; deliveryDate?: string },
  lotId?: string,
) {
  const at = retiredKinds.indexOf("allocate");
  retiredKinds.splice(at, 1);
  try {
    s.run("owner", "allocate", values, lotId);
  } finally {
    retiredKinds.splice(at, 0, "allocate");
  }
  return last(s);
}

/** Old data: a branch receive of `kg` made against `allocation` (new receives never carry
 *  one). Recorded as a direct receive on the allocation's batch, then tied to it. */
export function legacyReceive(
  s: Setup,
  kg: string,
  allocation: string,
  extra: Values = {},
) {
  const lotId = s.db.entries.find((e) => e.id === allocation)!.lotId;
  s.run("branch", "receive", { kg, ...extra }, lotId);
  last(s).values.allocation = allocation;
  if (extra.complete) last(s).values.complete = extra.complete;
  return last(s);
}

/** A save that goes through with a warning: no refusal, and a warning matching `match`.
 *  Plain throws, not vitest's `expect`: .storybook/fixtures.ts imports this file, and vitest
 *  loaded in the browser breaks every story that uses the fixtures. */
export function expectWarning(
  result: { warnings: string[]; error: string },
  match: string | RegExp,
) {
  if (result.error) throw new Error(`refused: ${result.error}`);
  const warnings = result.warnings.join("\n");
  const found =
    typeof match === "string" ? warnings.includes(match) : match.test(warnings);
  if (!found) throw new Error(`no warning matching ${match} in: ${warnings}`);
}

export function purchase(s: Setup, kg: string, price = "250") {
  s.run("owner", "purchase", { ...purchaseInfo, orderedKg: kg, price });
}

export function confirm(s: Setup, kg: string, readyKg = kg) {
  s.run("owner", "foodivaConfirm", {
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

/** Foodiva's outbound transport document for the newest batch (`""` opens a new one). */
export function dispatch(s: Setup, lotId?: string) {
  s.run("owner", "dispatch", send, lotId);
}

/** The kg of one weight per line, added up (the fixtures still name boxes this way). */
export const lineTotal = (lines: string) =>
  String(
    lines
      .split("\n")
      .filter((line) => line.trim())
      .reduce((a, kg) => a + Number(kg), 0),
  );

/** Foodiva's Packing List: totals only, `boxes` one กล่องรับเข้า weight per line. */
export function packingList(s: Setup, boxes: string) {
  const total = lineTotal(boxes);
  s.run("owner", "packingList", {
    invoiceNo: "INV-1",
    product: "เนื้อวัว",
    attachment: "packing.pdf",
    slicedNetKg: total,
    boxCount: String(boxes.split("\n").filter((line) => line.trim()).length),
    // Foodiva types Lost; in practice it matches the box total.
    slicedLostKg: total,
  });
}

/** Owner's smoke PO on the newest batch (`lotId === ""` opens a new one), drawing
 * `[purchaseLotId, kg]` from each purchase PO in `lines`. `rawKg` comes from the Packing List
 * when left out (so the batch must have one then). */
export function smokeOrder(
  s: Setup,
  lines: [string, string][] = [],
  rawKg?: string,
  lotId?: string,
) {
  s.run(
    "owner",
    "smokeOrder",
    {
      requestedSmokeDate: day,
      smoker: "Chef House",
      lines: JSON.stringify(lines.map(([lotId, kg]) => ({ lotId, kg }))),
      ...(rawKg ? { rawKg } : {}),
    },
    lotId,
  );
}

/** Chef House's smoking invoice for a closed run. */
export function invoice(s: Setup) {
  s.run("owner", "smokingInvoice", {
    invoiceNumber: "CH-1",
    invoiceDate: day,
    attachment: "ch.pdf",
  });
  return last(s);
}

/** Purchase PO with Foodiva's invoice, and the Owner's smoke PO for all of it opening a new
 * batch (SMK-01): a batch waiting for Foodiva's truck. */
export function readyToDispatch(s: Setup, kg: string) {
  purchase(s, kg);
  confirm(s, kg);
  smokeOrder(s, [[s.db.lots.at(-1)!.id, kg]], kg, "");
}

/** Batch weighed in at Chef House: `kg` on the smoke PO and trucked with a Packing List
 * totalling `boxes`, smoke PO accepted, received as the total of `receivedBoxes`. */
export function received(
  s: Setup,
  kg: string,
  boxes = kg,
  receivedBoxes = boxes,
) {
  readyToDispatch(s, kg);
  dispatch(s);
  packingList(s, boxes);
  s.run("owner", "smokeOrderAccept", { acceptedBy: "Chef House" });
  s.run("owner", "cmReceive", {
    receivedKg: lineTotal(receivedBoxes),
    arrival: "08:00",
  });
}

/** Batch fully smoked, not closed: 50 kg sent in two 25 kg boxes, 49 kg weighed in, 36 kg
 * in 360 bags, waiting for Chef House to close it. */
export function smoked() {
  const s = setup();
  received(s, "50", "25\n25", "24.5\n24.5");
  s.run("owner", "prepare", { preSmokeKg: "48" });
  s.run("owner", "smoke", {
    smokeDate: day,
    inputKg: "20",
    wasteKg: "5",
    packs: packs(150),
  });
  s.run("owner", "smoke", {
    smokeDate: day,
    inputKg: "28",
    wasteKg: "7",
    packs: packs(210),
  });
  return s;
}

/** Batch closed at Chef House, waiting for the return truck. */
export function closed() {
  const s = smoked();
  s.run("owner", "closeLot", { confirm: "สมชาย" });
  return s;
}

/** Batch closed, trucked back and received by Foodiva. */
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
  s.run("owner", "foodivaReturnReceive", {
    receivedDate: day,
    receivedTime: "10:00",
    receivedKg: "36",
    receivedBags: "360",
  });
  return s;
}

/** Batch with 35 kg in central stock. */
export function ready() {
  const s = returned();
  s.run("owner", "central", { centralKg: "35" });
  return s;
}

/** ศาลาแดง on `day`: 70 kg of one lot received and thawed, 65.5 kg used, no waste,
 * so 4.5 kg is left in the chiller for tomorrow. The day is not closed yet. */
export function chillDay() {
  const s = setup();
  received(s, "100", "50\n50", "49\n49");
  s.run("owner", "prepare", { preSmokeKg: "96" });
  s.run("owner", "smoke", {
    smokeDate: day,
    inputKg: "96",
    wasteKg: "24",
    packs: packs(720),
  });
  s.run("owner", "closeLot", { confirm: "สมชาย" });
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
  s.run("owner", "foodivaReturnReceive", {
    receivedDate: day,
    receivedTime: "10:00",
    receivedKg: "72",
    receivedBags: "720",
  });
  s.run("owner", "central", { centralKg: "72" });
  // BR-01: the branch records what it received straight on the batch.
  s.run("branch", "receive", { kg: "70" });
  s.run("branch", "thaw", { kg: "70" });
  s.run("branch", "sale", {
    boxes: "0",
    chiliAddons: "0",
    soldKg: "65.5",
    wasteKg: "0",
    riceWasteKg: "0",
    expense: "0",
    lineMan: "209600",
  });
  return s;
}

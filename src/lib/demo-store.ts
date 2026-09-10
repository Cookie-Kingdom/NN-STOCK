/** Local demo domain. Every mutation is validated here; the UI never advances stages itself. */
export type Role = "owner" | "cm" | "branch";
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
};
export type Lot = {
  id: string;
  poId: string;
  stage: number;
  values: Values;
  config: Values;
};
export type Database = {
  version: 6;
  lots: Lot[];
  entries: Entry[];
  config: Values;
};
export const roleName = {
  owner: "Owner",
  cm: "Chef_house",
  branch: "ผู้ดูแลสาขา",
};
export const materials = [
  "กล่องพิมพ์ลาย",
  "กระดาษรอง",
  "ถุงซิปเนื้อ",
  "ถุงซิปข้าว",
  "ถุงหิ้วกระดาษ",
  "สติกเกอร์โลโก้",
  "การ์ด / สติกเกอร์วิธีอุ่น",
];
export const branches = ["ศาลาแดง", "มีนบุรี"];
export const stages = [
  "ใบสั่งซื้อ",
  "ขนส่งขาไป",
  "รับที่ Chef_house",
  "ก่อนสโมค",
  "บันทึกสโมค",
  "ปิด Lot",
  "นัดรับขากลับ",
  "รับสต๊อกกลาง",
  "จัดสรร / ขาย",
];
export const stageRole: Role[] = [
  "owner",
  "owner",
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
export const titles: Record<string, string> = {
  purchase: "สร้างใบสั่งซื้อ",
  brinePurchase: "สร้างใบ PO น้ำหมัก",
  dispatch: "ส่งเนื้อไป Chef_house",
  cmReceive: "ยืนยันรับที่ Chef_house",
  prepare: "น้ำหนักก่อนสโมค",
  smoke: "บันทึกการสโมค",
  closeLot: "ปิดและล็อก Lot",
  return: "นัดรับขากลับ",
  central: "รับเข้าสต๊อกกลาง",
  allocate: "จัดสรรไปสาขา",
  receive: "รับของเข้าสาขา",
  thaw: "แบ่งละลายเนื้อ",
  supplyPurchase: "ซื้อข้าวเหนียวและน้ำพริกเข้าสต๊อก",
  supplyIssue: "บันทึกเบิกข้าวเหนียวและน้ำพริก",
  ricePurchase: "ซื้อข้าวเหนียวเข้าสต๊อก",
  chiliPurchase: "ซื้อน้ำพริกเข้าสต๊อก",
  riceIssue: "เบิกข้าวเหนียวดิบวันนี้",
  chiliIssue: "เบิกน้ำพริกวันนี้",
  rice: "ข้าวเหนียวช่วงเช้า",
  riceCarry: "ยืนยันข้าวเหนียวสุกคงเหลือ",
  sale: "บันทึกยอดขาย / Waste",
  materials: "เช็ควัสดุ 7 รายการ",
  materialReceive: "รับวัสดุเข้าคลัง Owner",
  materialTransfer: "ส่งวัสดุไปสาขา",
  materialConfirm: "ยืนยันรับวัสดุที่สาขา",
  closeDay: "ยืนยันปิดวัน",
  expense: "ค่าใช้จ่าย Owner",
  config: "บันทึกการตั้งค่า",
  unlock: "ปลดล็อกวัน",
  void: "ยกเลิกรายการ",
};
export const seed: Database = {
  version: 6,
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
    brinePrice: "40",
    brineOpeningMl: "0",
    smokeRate: "60",
    outboundFee: "1200",
    returnFee: "1200",
    roundFee: "2000",
    tolerance: "20",
    closeTime: "21:00",
    branch: "ศาลาแดง",
    ...Object.fromEntries(
      materials.flatMap((_, i) => [
        ["material" + i, "0"],
        ["materialPrice" + i, "0"],
      ]),
    ),
  },
};

/** Creates a deterministic seven-day fixture for exercising the complete demo loop. */
export function sevenDayRoleplay(endDate: string): Database {
  let db = structuredClone(seed);
  const end = new Date(`${endDate}T00:00:00Z`);
  const dates = Array.from({ length: 7 }, (_, index) => {
    const value = new Date(end);
    value.setUTCDate(value.getUTCDate() - (6 - index));
    return value.toISOString().slice(0, 10);
  });
  for (let index = 0; index < materials.length; index++) {
    db.config[`material${index}_saladaeng`] = "100";
    db.config[`materialPrice${index}_saladaeng`] = "1";
    db.config[`material${index}_minburi`] = "100";
    db.config[`materialPrice${index}_minburi`] = "1";
  }
  let currentDate = dates[0];
  const run = (role: Role, kind: string, values: Values, lotId = "") => {
    db = mutate(db, role, kind, values, lotId, currentDate);
  };
  const packs = Array.from({ length: 500 }, () => "0.100").join("\n");
  run("owner", "brinePurchase", {
    supplier: "ผู้ขายน้ำหมักทดสอบ",
    quantityMl: "10000",
    totalCost: "1000",
  });
  run("owner", "purchase", {
    supplier: "Chef_house ทดสอบ",
    orderedKg: "50",
    price: "250",
  });
  const lotId = db.lots[0].id;
  run("owner", "dispatch", {
    dispatchKg: "50",
    pickupDate: dates[0],
    origin: "กรุงเทพ",
    destination: "Chef_house",
    trip: "ไปกลับ",
  }, lotId);
  run("cm", "cmReceive", { receivedKg: "50", arrival: "08:00" }, lotId);
  run("cm", "prepare", { preKg: "50" }, lotId);
  run("cm", "smoke", {
    smokeDate: dates[0],
    inputKg: "50",
    brineMl: "5000",
    packs,
  }, lotId);
  run("cm", "closeLot", { confirm: "Chef_house" }, lotId);
  run("owner", "return", { returnDate: dates[0], returnVehicle: "ทดสอบ-001" }, lotId);
  run("owner", "central", { centralKg: "50" }, lotId);
  const firstBags = availableBags(db, lotId);
  run("owner", "allocate", {
    branch: "ศาลาแดง",
    deliveryDate: dates[0],
    bagIds: firstBags.slice(0, 250).map((bag) => bag.id).join(","),
  }, lotId);
  const salaAllocation = db.entries.at(-1)?.id || "";
  const secondBags = availableBags(db, lotId);
  run("owner", "allocate", {
    branch: "มีนบุรี",
    deliveryDate: dates[0],
    bagIds: secondBags.slice(0, 250).map((bag) => bag.id).join(","),
  }, lotId);
  const minburiAllocation = db.entries.at(-1)?.id || "";
  for (const material of materials) {
    run("owner", "materialReceive", {
      material,
      quantity: "200",
      unitPrice: "1",
      supplier: "ผู้ขายวัสดุทดสอบ",
    });
    for (const branch of branches) {
      db.config.branch = branch;
      run("owner", "materialTransfer", {
        material,
        branch,
        quantity: "100",
        receiver: "ผู้ดูแลทดสอบ",
      });
      const transferId = db.entries.at(-1)?.id || "";
      run("branch", "materialConfirm", {
        transferId,
        receivedQuantity: "100",
        receiver: "ผู้ดูแลทดสอบ",
      });
    }
  }
  for (const [dayIndex, workDate] of dates.entries()) {
    currentDate = workDate;
    for (const branch of branches) {
      db.config.branch = branch;
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
        run("branch", "receive", {
          kg: "25",
          bags: "250",
          allocation: branch === "ศาลาแดง" ? salaAllocation : minburiAllocation,
        }, lotId);
      }
      if (branch === "ศาลาแดง") {
        run("branch", "ricePurchase", {
          supplier: "ร้านข้าวทดสอบ",
          rawRiceKg: "5",
          rawRiceCost: "275",
        });
      } else {
        run("branch", "ricePurchase", {
          supplier: "ร้านข้าวทดสอบ",
          cookedRiceKg: "32",
          cookedRiceCost: "1440",
        });
      }
      run("branch", "chiliPurchase", {
        supplier: "ร้านน้ำพริกทดสอบ",
        chiliTubes: "20",
        chiliCost: "600",
      });
      run("branch", "thaw", { kg: "1.521" }, lotId);
      run("branch", "materials", materialValues);
      if (branch === "ศาลาแดง") {
        run("branch", "riceIssue", { rawRiceIssuedKg: "3", receiver: "ผู้ดูแลทดสอบ" });
        run("branch", "chiliIssue", { chiliIssuedTubes: "5", receiver: "ผู้ดูแลทดสอบ" });
        run("branch", "rice", { rawUsedKg: "3", riceKg: "3" });
      } else {
        run("branch", "chiliIssue", { chiliIssuedTubes: "5", receiver: "ผู้ดูแลทดสอบ" });
      }
      run("branch", "sale", {
        boxes: "14",
        addons: "0",
        chiliAddons: "0",
        soldKg: "1.421",
        wasteKg: "0.100",
        riceWasteKg: "0",
        expense: "0",
        lineMan: "4900",
        reason: "ทดสอบปิดยอด",
      }, lotId);
      if (branch === "มีนบุรี") {
        run("branch", "riceCarry", {
          leftoverKg: cookedRiceStock(db, branch).toFixed(3),
          reheat: "เก็บไว้อุ่นวันถัดไป",
        });
      }
      run("branch", "closeDay", { time: "21:00", confirm: "ผู้ดูแลทดสอบ" });
    }
  }
  db.config.branch = "ศาลาแดง";
  return db;
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
      .filter((entry) => entry.kind === "void")
      .map((entry) => entry.values.targetId),
  );
  return db.entries.filter(
    (e) =>
      e.kind === kind &&
      !voided.has(e.id) &&
      (!lotId || e.lotId === lotId) &&
      (!branch || e.branch === branch) &&
      (!date || e.date === date),
  );
}
export function produced(db: Database, lotId: string) {
  return sum(entries(db, "smoke", lotId), "outputKg");
}
export function producedBags(db: Database, lotId: string) {
  return sum(entries(db, "smoke", lotId), "packCount");
}
export type StockBag = { id: string; weight: number };
export function availableBags(db: Database, lotId: string): StockBag[] {
  let bags = entries(db, "smoke", lotId).flatMap((entry) =>
    (entry.values.packs || "").split(/[,\s]+/).filter(Boolean).map((weight, index) => ({
      id: `${entry.id}:${index + 1}`,
      weight: Number(weight),
    })),
  ).filter((bag) => Number.isFinite(bag.weight) && bag.weight > 0);
  for (const allocation of entries(db, "allocate", lotId)) {
    const ids = (allocation.values.bagIds || "").split(",").filter(Boolean);
    bags = ids.length
      ? bags.filter((bag) => !ids.includes(bag.id))
      : bags.slice(Math.max(0, n(allocation.values, "bags")));
  }
  return bags;
}
export function brineStockMl(db: Database) {
  return n(db.config, "brineOpeningMl") + sum(entries(db, "brinePurchase"), "quantityMl") - sum(entries(db, "smoke"), "brineMl");
}
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
export function centralBagStock(db: Database, lotId: string) {
  return availableBags(db, lotId).length;
}
export function balance(db: Database, lotId: string, branch: string) {
  const received = sum(entries(db, "receive", lotId, branch), "kg"),
    thawed = sum(entries(db, "thaw", lotId, branch), "kg");
  const used = entries(db, "sale", lotId, branch).reduce(
    (s, e) => s + num(e.values, "soldKg") + num(e.values, "wasteKg"),
    0,
  );
  return { received, frozen: received - thawed, ready: thawed - used };
}
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
    entries(db, "sale", undefined, branch).reduce(
      (total, entry) =>
        total +
        num(entry.values, "riceServings") * 0.2 +
        num(entry.values, "riceWasteKg"),
      0,
    )
  );
}
export function chiliStock(db: Database, branch: string) {
  return (
    sum(entries(db, "supplyPurchase", undefined, branch), "chiliTubes") +
    sum(entries(db, "chiliPurchase", undefined, branch), "chiliTubes") -
    sum(entries(db, "supplyIssue", undefined, branch), "chiliIssuedTubes") -
    sum(entries(db, "chiliIssue", undefined, branch), "chiliIssuedTubes")
  );
}
export function issuedChiliStock(db: Database, branch: string) {
  return (
    sum(entries(db, "supplyIssue", undefined, branch), "chiliIssuedTubes") +
    sum(entries(db, "chiliIssue", undefined, branch), "chiliIssuedTubes") -
    sum(entries(db, "sale", undefined, branch), "chiliSold")
  );
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
      if (!entry.values.requiresConfirm) return total + n(entry.values, "quantity");
      const confirmation = entries(db, "materialConfirm", undefined, branch)
        .find((item) => item.values.transferId === entry.id);
      return total + (confirmation ? n(confirmation.values, "receivedQuantity") : 0);
    }, 0);
  const used = entries(db, "materials", undefined, branch)
    .filter((entry) => !throughDate || entry.date < throughDate)
    .reduce((total, entry) => total + n(entry.values, "used" + materialIndex), 0);
  const adjustments = entries(db, "materials", undefined, branch)
    .filter((entry) => !throughDate || entry.date < throughDate)
    .reduce(
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
  return n(
    db.config,
    `material${index}_${branch === "ศาลาแดง" ? "saladaeng" : "minburi"}`,
  ) || n(db.config, `material${index}`);
}
export function materialUnitPrice(db: Database, branch: string, index: number) {
  return n(
    db.config,
    `materialPrice${index}_${branch === "ศาลาแดง" ? "saladaeng" : "minburi"}`,
  ) || n(db.config, `materialPrice${index}`);
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
  const c = lot.config,
    v = lot.values;
  const meat = num(v, "dispatchKg") * num(v, "price"),
    brine = num(v, "dispatchKg") * 0.1 * num(c, "brinePrice");
  const smoke = num(v, "dispatchKg") * num(c, "smokeRate");
  const freight = num(v, "outboundCost") + num(v, "returnCost");
  return {
    meat,
    brine,
    smoke,
    freight,
    total: meat + brine + smoke + freight,
    perKg:
      num(v, "centralKg") > 0
        ? (meat + brine + smoke + freight) / num(v, "centralKg")
        : null,
  };
}
export function revenue(db: Database) {
  return sum(entries(db, "sale"), "revenue");
}
export function visibleEntries(db: Database, role: Role) {
  return db.entries
    .filter(
      (e) =>
        role === "owner" ||
        (e.role === role &&
          (role !== "branch" || e.branch === db.config.branch)),
    )
    .map((e) =>
      role === "owner"
        ? e
        : {
            ...e,
            values: Object.fromEntries(
              Object.entries(e.values).filter(
                ([k]) => !["meatCost", "wasteCost"].includes(k),
              ),
            ),
          },
    );
}
const ownership: Record<string, Role> = {
  purchase: "owner",
  brinePurchase: "owner",
  dispatch: "owner",
  cmReceive: "cm",
  prepare: "cm",
  smoke: "cm",
  closeLot: "cm",
  return: "owner",
  central: "owner",
  allocate: "owner",
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
  materials: "branch",
  materialReceive: "owner",
  materialTransfer: "owner",
  materialConfirm: "branch",
  closeDay: "branch",
  expense: "owner",
  config: "owner",
  unlock: "owner",
  void: "owner",
};
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function positive(v: Values, k: string, label: string, allowZero = false) {
  const value = Number(v[k]);
  assert(
    v[k]?.trim() &&
      Number.isFinite(value) &&
      (allowZero ? value >= 0 : value > 0),
    `กรอก${label}เป็นตัวเลข${allowZero ? "ตั้งแต่ศูนย์" : "มากกว่าศูนย์"}`,
  );
}
function required(v: Values, k: string, label: string) {
  assert(v[k]?.trim(), `กรอก${label}`);
}
function variance(actual: number, expected: number, v: Values, always = true) {
  if (
    Math.abs(actual - expected) > 0.001 &&
    (always || expected === 0 || Math.abs(actual - expected) / expected > 0.2)
  )
    required(v, "reason", "เหตุผลส่วนต่าง");
}
export function mutate(
  db: Database,
  role: Role,
  kind: string,
  input: Values,
  lotId: string,
  date: string,
): Database {
  assert(ownership[kind] === role, "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date), "เลือกวันที่ทำรายการ");
  const next: Database = structuredClone(db),
    v = { ...input };
  let lot = next.lots.find((l) => l.id === lotId);
  const branch =
    role === "branch" ? db.config.branch : v.branch || db.config.branch;
  for (const key of ["arrival", "time", "closeTime"]) {
    if (key in v)
      assert(
        /^([01]\d|2[0-3]):[0-5]\d$/.test(v[key]),
        "กรอกเวลาเป็น HH:mm เช่น 08:00",
      );
  }
  if (role === "branch")
    assert(
      !isClosed(db, branch, date),
      "วันนี้ปิดยอดแล้ว ต้องให้ Owner ปลดล็อกก่อน",
    );
  const expected = stageAction.indexOf(kind);
  if (expected > 0 && kind !== "allocate")
    assert(
      lot && lot.stage === expected,
      "ขั้นตอนเปลี่ยนไปแล้ว กรุณาเปิดฟอร์มใหม่",
    );
  const lotRequired = ["allocate", "receive", "thaw", "sale"];
  if (lotRequired.includes(kind))
    assert(lot && lot.stage >= 8, "Lot ต้องรับเข้าสต๊อกกลางก่อน");
  if (role === "branch" && lotRequired.includes(kind))
    assert(
      entries(db, "allocate", lotId, branch).length,
      "Lot นี้ไม่ได้จัดสรรมายังสาขาของคุณ",
    );
  if (kind === "purchase") {
    required(v, "supplier", "ผู้ขาย");
    positive(v, "orderedKg", "น้ำหนักสั่งซื้อ");
    positive(v, "price", "ราคา / กก.");
    lotId = `NN-${date.replaceAll("-", "")}-${String(next.lots.length + 1).padStart(3, "0")}`;
    lot = {
      id: lotId,
      poId: `PO-${date.replaceAll("-", "")}-${next.lots.length + 1}`,
      stage: 1,
      values: v,
      config: { ...db.config },
    };
    next.lots.push(lot);
  } else if (kind === "brinePurchase") {
    required(v, "supplier", "ผู้จำหน่ายน้ำหมัก");
    positive(v, "quantityMl", "ปริมาณน้ำหมัก");
    positive(v, "totalCost", "ราคารวม", true);
    v.poNumber = `PO-BRINE-${date.replaceAll("-", "")}-${entries(db, "brinePurchase").length + 1}`;
  } else if (kind === "dispatch" && lot) {
    positive(v, "dispatchKg", "น้ำหนักส่ง");
    required(v, "pickupDate", "วันรับ");
    required(v, "origin", "ต้นทาง");
    required(v, "destination", "ปลายทาง");
    const sent = db.lots
      .filter((l) => l.poId === lot!.poId)
      .reduce((s, l) => s + n(l.values, "dispatchKg"), 0);
    assert(
      num(v, "dispatchKg") <= n(lot.values, "orderedKg") - sent + 0.001,
      "ส่งเกินน้ำหนักค้างส่งของ PO",
    );
    v.outboundCost =
      v.trip === "ไปกลับ" ? lot.config.roundFee : lot.config.outboundFee;
    const remainder = n(lot.values, "orderedKg") - sent - num(v, "dispatchKg");
    if (remainder > 0.001)
      next.lots.push({
        id: `${lot.id}-R${next.lots.length + 1}`,
        poId: lot.poId,
        stage: 1,
        values: {
          supplier: lot.values.supplier,
          orderedKg: lot.values.orderedKg,
          price: lot.values.price,
        },
        config: { ...lot.config },
      });
  } else if (kind === "cmReceive" && lot) {
    positive(v, "receivedKg", "น้ำหนักรับ");
    required(v, "arrival", "เวลาถึง");
    variance(n(v, "receivedKg"), n(lot.values, "dispatchKg"), v);
  } else if (kind === "prepare" && lot) {
    positive(v, "preKg", "น้ำหนักก่อนสโมค");
    assert(
      n(v, "preKg") <= n(lot.values, "receivedKg"),
      "น้ำหนักก่อนสโมคเกินน้ำหนักรับ",
    );
  } else if (kind === "smoke" && lot) {
    positive(v, "inputKg", "น้ำหนักเข้าเตา");
    const brineMl = n(v, "brineMl") || n(v, "brineKg") * 1000;
    assert(brineMl >= 0, "น้ำหมักต้องไม่ติดลบ");
    v.brineMl = String(brineMl);
    assert(brineMl <= brineStockMl(db), "สต๊อกน้ำหมักไม่พอ กรุณาสร้าง PO น้ำหมักก่อน");
    required(v, "smokeDate", "วันที่สโมค");
    const weights = (v.packs || "")
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    assert(
      weights.length > 0 &&
        weights.every((w) => Number.isFinite(w) && w > 0),
      "น้ำหนักถุงใหญ่จาก Chef_house ต้องมากกว่า 0 กก.",
    );
    const output = weights.reduce((a, b) => a + b, 0);
    assert(
      n(v, "inputKg") <= n(lot.values, "preKg") - processed(db, lotId) + 0.001,
      "น้ำหนักเข้าเตาเกินน้ำหนักรอผลิต",
    );
    assert(
      output <= n(v, "inputKg") + brineMl / 1000,
      "น้ำหนักถุงรวมเกินน้ำหนักเข้าเตารวมกับน้ำหมัก",
    );
    v.outputKg = output.toFixed(2);
    v.packCount = String(weights.length);
  } else if (kind === "closeLot" && lot) {
    assert(
      Math.abs(n(lot.values, "preKg") - processed(db, lotId)) < 0.005,
      "ยังมีน้ำหนักรอผลิต ต้องบันทึกให้ครบก่อน",
    );
    assert(produced(db, lotId) > 0, "ยังไม่มีผลผลิต");
    required(v, "confirm", "ชื่อผู้ยืนยัน");
  } else if (kind === "return" && lot) {
    required(v, "returnDate", "วันรับขากลับ");
    required(v, "returnVehicle", "รถรับกลับ");
    v.returnCost = lot.values.trip === "ไปกลับ" ? "0" : lot.config.returnFee;
  } else if (kind === "central" && lot) {
    positive(v, "centralKg", "น้ำหนักรับกลาง");
    variance(n(v, "centralKg"), produced(db, lotId), v, false);
  } else if (kind === "allocate") {
    const selectedBagIds = (v.bagIds || "").split(",").filter(Boolean);
    if (selectedBagIds.length) {
      const available = availableBags(db, lotId);
      const selected = available.filter((bag) => selectedBagIds.includes(bag.id));
      assert(selected.length === selectedBagIds.length, "มีถุงที่ถูกจัดสรรไปแล้ว กรุณาเปิดฟอร์มใหม่");
      v.kg = String(selected.reduce((sum, bag) => sum + bag.weight, 0));
      v.bags = String(selected.length);
    }
    positive(v, "kg", "น้ำหนักจัดสรร");
    positive(v, "bags", "จำนวนถุง");
    assert(Number.isInteger(n(v, "bags")), "จำนวนถุงต้องเป็นจำนวนเต็ม");
    assert(branches.includes(v.branch), "เลือกสาขา");
    assert(n(v, "kg") <= centralStock(db, lotId) + 0.001, "สต๊อกกลางไม่พอ");
    assert(n(v, "bags") <= centralBagStock(db, lotId), "จำนวนถุงในสต๊อกกลางไม่พอ");
  } else if (kind === "receive") {
    positive(v, "kg", "น้ำหนักรับ");
    positive(v, "bags", "จำนวนถุง");
    assert(Number.isInteger(n(v, "bags")), "จำนวนถุงต้องเป็นจำนวนเต็ม");
    const allocation = entries(db, "allocate", lotId, branch).find(
      (e) => e.id === v.allocation,
    );
    assert(allocation, "เลือกใบจัดสรร");
    const taken = entries(db, "receive", lotId, branch)
      .filter((e) => e.values.allocation === v.allocation)
      .reduce((s, e) => s + n(e.values, "kg"), 0);
    const outstanding = n(allocation.values, "kg") - taken;
    assert(n(v, "kg") <= outstanding + 0.001, "รับเกินยอดค้างรับ");
    variance(n(v, "kg"), outstanding, v);
  } else if (kind === "thaw") {
    positive(v, "kg", "น้ำหนักละลาย");
    assert(
      n(v, "kg") <= balance(db, lotId, branch).frozen + 0.001,
      "สต๊อกแช่แข็งไม่พอ",
    );
    const oldest = db.lots
      .filter((l) => balance(db, l.id, branch).frozen > 0.001)
      .sort((a, b) =>
        (a.values.smokeDate || a.id).localeCompare(b.values.smokeDate || b.id),
      )[0];
    if (oldest && oldest.id !== lotId) required(v, "reason", "เหตุผลข้าม FIFO");
  } else if (kind === "ricePurchase") {
    for (const key of ["rawRiceKg", "rawRiceCost", "cookedRiceKg", "cookedRiceCost"])
      v[key] ??= "0";
    required(v, "supplier", "ผู้จำหน่ายข้าว");
    if (branch === "มีนบุรี") {
      positive(v, "cookedRiceKg", "ข้าวเหนียวสุกซื้อเข้า");
      positive(v, "cookedRiceCost", "ยอดซื้อข้าวเหนียวสุก");
      assert(
        cookedRiceStock(db, branch) + n(v, "cookedRiceKg") >=
          n(db.config, "cookedRicePar"),
        `ยอดข้าวเหนียวสุกหลังซื้อควรมีอย่างน้อย ${db.config.cookedRicePar} กก.`,
      );
      v.totalCost = v.cookedRiceCost;
    } else {
      positive(v, "rawRiceKg", "ข้าวเหนียวดิบซื้อเข้า");
      positive(v, "rawRiceCost", "ยอดซื้อข้าวเหนียวดิบ");
      v.totalCost = v.rawRiceCost;
    }
  } else if (kind === "chiliPurchase") {
    positive(v, "chiliTubes", "น้ำพริกซื้อเข้า");
    assert(Number.isInteger(n(v, "chiliTubes")), "น้ำพริกต้องเป็นจำนวนหลอดเต็ม");
    positive(v, "chiliCost", "ยอดซื้อน้ำพริก");
    required(v, "supplier", "ผู้จำหน่ายน้ำพริก");
    v.totalCost = v.chiliCost;
  } else if (kind === "riceIssue") {
    assert(branch === "ศาลาแดง", "สาขามีนบุรีซื้อข้าวเหนียวสุก ไม่ต้องเบิกข้าวดิบ");
    positive(v, "rawRiceIssuedKg", "ข้าวเหนียวดิบที่เบิก");
    assert(
      n(v, "rawRiceIssuedKg") <= rawRiceStock(db, branch) + 0.001,
      "ข้าวเหนียวดิบในสต๊อกไม่พอ",
    );
    required(v, "receiver", "ผู้รับของ");
  } else if (kind === "chiliIssue") {
    positive(v, "chiliIssuedTubes", "น้ำพริกที่เบิก");
    assert(Number.isInteger(n(v, "chiliIssuedTubes")), "น้ำพริกต้องเป็นจำนวนหลอดเต็ม");
    assert(
      n(v, "chiliIssuedTubes") <= chiliStock(db, branch),
      "น้ำพริกในสต๊อกไม่พอ",
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
    if (branch === "มีนบุรี") {
      assert(n(v, "rawRiceKg") === 0, "สาขามีนบุรีซื้อข้าวเหนียวสุก");
      assert(
        cookedRiceStock(db, branch) + n(v, "cookedRiceKg") >=
          n(db.config, "cookedRicePar"),
        `ยอดข้าวเหนียวสุกหลังซื้อควรมีอย่างน้อย ${db.config.cookedRicePar} กก.`,
      );
    } else {
      assert(n(v, "cookedRiceKg") === 0, "สาขาศาลาแดงซื้อข้าวเหนียวดิบ");
    }
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
    assert(
      n(v, "rawRiceIssuedKg") <= rawRiceStock(db, branch) + 0.001,
      "ข้าวเหนียวดิบในสต๊อกไม่พอ",
    );
    assert(
      n(v, "chiliIssuedTubes") <= chiliStock(db, branch),
      "น้ำพริกในสต๊อกไม่พอ",
    );
    required(v, "receiver", "ผู้รับของ");
  } else if (kind === "rice") {
    assert(branch === "ศาลาแดง", "ขั้นตอนหุงข้าวใช้สำหรับสาขาศาลาแดง");
    positive(v, "rawUsedKg", "ข้าวเหนียวดิบที่นำมาหุง");
    positive(v, "riceKg", "ข้าวเหนียวสุกที่ได้");
    assert(
      n(v, "rawUsedKg") <= issuedRawRiceStock(db, branch) + 0.001,
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
        assert(
          n(v, "used" + i) <= expectedOpening,
          `จำนวนใช้ ${materials[i]} เกินยอดตั้งต้น`,
        );
        const expectedRemaining = expectedOpening - n(v, "used" + i);
        assert(n(v, "material" + i) >= 0, `ยอดตรวจนับ ${materials[i]} ติดลบไม่ได้`);
        if (Math.abs(n(v, "material" + i) - expectedRemaining) > 0.001)
          required(v, "materialReason" + i, `เหตุผลส่วนต่าง ${materials[i]}`);
      }
    }
    assert(
      !entries(db, "materials", undefined, branch, date).length,
      "บันทึกการใช้วัสดุของวันนี้แล้ว",
    );
  } else if (kind === "materialReceive") {
    assert(materials.includes(v.material), "เลือกวัสดุ");
    positive(v, "quantity", "จำนวนรับเข้าคลัง");
    assert(Number.isInteger(n(v, "quantity")), "จำนวนวัสดุต้องเป็นจำนวนเต็ม");
    positive(v, "unitPrice", "ราคาต่อหน่วย", true);
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
    assert(
      n(v, "quantity") <= ownerMaterialStock(db, v.material),
      "วัสดุในคลัง Owner ไม่พอ",
    );
    required(v, "receiver", "ผู้รับของ");
    v.requiresConfirm = "1";
  } else if (kind === "materialConfirm") {
    const transfer = entries(db, "materialTransfer", undefined, branch)
      .find((entry) => entry.id === v.transferId);
    assert(transfer, "ไม่พบรายการส่งวัสดุ");
    assert(
      !entries(db, "materialConfirm", undefined, branch)
        .some((entry) => entry.values.transferId === v.transferId),
      "ยืนยันรับรายการนี้แล้ว",
    );
    positive(v, "receivedQuantity", "จำนวนที่รับจริง");
    assert(Number.isInteger(n(v, "receivedQuantity")), "จำนวนรับจริงต้องเป็นจำนวนเต็ม");
    assert(n(v, "receivedQuantity") <= n(transfer.values, "quantity"), "จำนวนรับจริงเกินจำนวนที่ส่ง");
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
    const soldPacks = n(v, "boxes") + n(v, "addons");
    assert(
      soldPacks === 0
        ? n(v, "soldKg") === 0
        : n(v, "soldKg") >= soldPacks * 0.1 - 0.001 &&
          n(v, "soldKg") <= soldPacks * 0.103 + 0.001,
      "น้ำหนักเนื้อขายต้องอยู่ระหว่าง 100–103 กรัมต่อซีล",
    );
    assert(
      n(v, "soldKg") + n(v, "wasteKg") <=
        balance(db, lotId, branch).ready + 0.001,
      "น้ำหนักขายและ Waste เกินเนื้อพร้อมขาย",
    );
    assert(
      n(v, "riceServings") * 0.2 + n(v, "riceWasteKg") <=
        cookedRiceStock(db, branch) + 0.001,
      "ข้าวเหนียวไม่พอ",
    );
    assert(
      n(v, "chiliSold") <= issuedChiliStock(db, branch),
      "น้ำพริกที่เบิกไว้ไม่พอ กรุณาบันทึกเบิกก่อนขาย",
    );
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
  } else if (kind === "closeDay") {
    required(v, "time", "เวลาปิด");
    assert(
      v.time >= db.config.closeTime,
      `ปิดวันได้ตั้งแต่ ${db.config.closeTime} (นาฬิกาจำลอง)`,
    );
    assert(
      entries(db, "sale", undefined, branch, date).length,
      "ยังไม่มีรายการขายวันนี้",
    );
    assert(
      entries(db, "materials", undefined, branch, date).length,
      "ยังไม่เช็ควัสดุวันนี้",
    );
    assert(
      entries(
        db,
        branch === "มีนบุรี" ? "riceCarry" : "rice",
        undefined,
        branch,
        date,
      ).length,
      branch === "มีนบุรี"
        ? "ยังไม่ยืนยันข้าวเหนียวสุกคงเหลือ"
        : "ยังไม่บันทึกข้าวช่วงเช้า",
    );
    assert(
      db.lots.every((l) => Math.abs(balance(db, l.id, branch).ready) < 0.005),
      "ยังมีเนื้อพร้อมขาย ต้องบันทึกขายหรือ Waste ให้เป็นศูนย์",
    );
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
      "allocate", "receive", "thaw", "ricePurchase", "chiliPurchase",
      "riceIssue", "chiliIssue", "rice", "riceCarry", "sale", "materials",
      "materialReceive", "materialTransfer", "materialConfirm", "closeDay",
      "expense", "unlock",
    ];
    assert(target && reversible.includes(target.kind), "รายการนี้ยกเลิกไม่ได้");
    assert(
      !db.entries.some(
        (entry) => entry.kind === "void" && entry.values.targetId === v.targetId,
      ),
      "รายการนี้ถูกยกเลิกแล้ว",
    );
    required(v, "reason", "เหตุผลยกเลิกรายการ");
    v.targetKind = target.kind;
    v.targetDate = target.date;
    v.targetBranch = target.branch;
  } else if (kind === "config") {
    v.ricePrice = "0";
    for (const key of [
      "boxPrice",
      "addonPrice",
      "packKg",
      "ricePrice",
      "chiliPrice",
      "rawRicePar",
      "rawRiceUnitPrice",
      "chiliPar",
      "chiliUnitPrice",
      "cookedRicePar",
      "cookedRiceUnitPrice",
      "brinePrice",
      "smokeRate",
      "outboundFee",
      "returnFee",
      "roundFee",
      "tolerance",
    ])
      positive(v, key, key, key !== "packKg");
    assert(n(v, "tolerance") <= 100, "ค่าคลาดเคลื่อนต้องไม่เกิน 100%");
    assert(branches.includes(v.branch), "เลือกสาขาสำหรับบัญชีทดลอง");
    required(v, "closeTime", "เวลาเริ่มปิดวัน");
    for (let i = 0; i < materials.length; i++) {
      positive(v, "material" + i, `จำนวนฐาน ${materials[i]}`, true);
      positive(v, "materialPrice" + i, `ราคาต่อหน่วย ${materials[i]}`, true);
      for (const suffix of ["saladaeng", "minburi"]) {
        if (v[`material${i}_${suffix}`] !== undefined)
          positive(v, `material${i}_${suffix}`, `จำนวนฐาน ${materials[i]}`, true);
        if (v[`materialPrice${i}_${suffix}`] !== undefined)
          positive(v, `materialPrice${i}_${suffix}`, `ราคาต่อหน่วย ${materials[i]}`, true);
      }
    }
    next.config = { ...db.config, ...v };
  }
  if (lot && expected > 0 && kind !== "allocate") {
    lot.values = { ...lot.values, ...v };
    if (kind !== "smoke") lot.stage++;
    else if (
      Math.abs(
        n(lot.values, "preKg") - processed(db, lotId) - n(v, "inputKg"),
      ) < 0.005
    )
      lot.stage = 5;
  }
  next.entries.push({
    id: crypto.randomUUID(),
    kind,
    role,
    lotId: lot?.id || lotId,
    branch,
    date,
    at: new Date().toISOString(),
    values: v,
  });
  return next;
}


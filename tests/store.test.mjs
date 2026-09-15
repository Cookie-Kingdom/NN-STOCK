import { test } from "node:test";
import assert from "node:assert/strict";
import {
  seed,
  mutate,
  balance,
  centralStock,
  produced,
  lotCost,
  isClosed,
  visibleEntries,
  rawRiceStock,
  cookedRiceStock,
  chiliStock,
  issuedRawRiceStock,
  materials,
  packWeights,
  validPackWeights,
} from "../src/lib/store.ts";
const day = "2026-09-09";
const packs = (count) => Array.from({ length: count }, () => "0.100").join("\n");
const purchaseInfo = {
  supplier: "Test Foodiva",
  customerName: "บริษัททดสอบ",
  customerAddress: "กรุงเทพฯ",
  attention: "ฝ่ายจัดซื้อ",
  phone: "0800000000",
  taxId: "0100000000000",
  packSize: "6 ชิ้นต่อถุง",
  productName: "เนื้อวัว",
};
const send = {
  pickupDate: day,
  origin: "กรุงเทพ",
  destination: "เชียงใหม่",
  trip: "ไปกลับ",
};
function setup(branch = seed.config.branch) {
  let db = structuredClone(seed);
  db.config.branch = branch;
  for (let index = 0; index < materials.length; index++) {
    db.config[`material${index}_saladaeng`] = "100";
    db.config[`materialPrice${index}_saladaeng`] = "1";
    db.config[`material${index}_minburi`] = "100";
    db.config[`materialPrice${index}_minburi`] = "1";
  }
  const run = (r, k, v = {}, id = db.lots[0]?.id || "") =>
    (db = mutate(db, r, k, v, id, day));
  return {
    run,
    get db() {
      return db;
    },
  };
}
/** Purchase through a paid smoking invoice: everything dispatch waits for. */
function readyToDispatch(s, kg) {
  s.run("owner", "purchase", { ...purchaseInfo, orderedKg: kg, price: "250" });
  s.run("fooddiva", "foodDivaConfirm", {
    invoiceNo: "INV-1",
    invoiceDate: day,
    attachment: "inv.pdf",
    confirmedBy: "Foodiva",
    confirmedKg: kg,
    readyForChiangMaiKg: kg,
    reservedForOwnerKg: "0",
    invoiceAmount: "1",
  });
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
  const invoice = s.db.entries.at(-1);
  s.run("owner", "invoiceReview", {
    invoiceId: invoice.id,
    decision: "รับยอด",
    reviewedBy: "Owner",
  });
  s.run("owner", "invoicePayment", {
    invoiceId: invoice.id,
    paymentDate: day,
    paidBy: "Owner",
    paidAmount: invoice.values.netPayable,
  });
}
/** Lot at stage 5: fully smoked, waiting for Chef_house to close it. */
function smoked() {
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
function ready() {
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
  s.run("fooddiva", "foodDivaReturnReceive", {
    receivedDate: day,
    receivedTime: "10:00",
    receivedKg: "36",
    receivedBags: "360",
  });
  s.run("owner", "central", { centralKg: "35" });
  return s;
}
test("Min Buri buys cooked rice to a 30 kg floor and records carry-over", () => {
  const s = setup("มีนบุรี");
  assert.throws(
    () =>
      s.run("branch", "ricePurchase", {
        supplier: "ครัวข้าวเหนียว",
        cookedRiceKg: "29",
        cookedRiceCost: "1305",
      }),
    /30 กก/,
  );
  s.run("branch", "ricePurchase", {
    supplier: "ครัวข้าวเหนียว",
    cookedRiceKg: "32",
    cookedRiceCost: "1440",
  });
  assert.equal(cookedRiceStock(s.db, "มีนบุรี"), 32);
  s.run("branch", "riceCarry", {
    leftoverKg: "32",
    reheat: "เก็บไว้อุ่นวันถัดไป",
  });
  assert.equal(s.db.entries.at(-1).values.reheat, "เก็บไว้อุ่นวันถัดไป");
});
test("full loop: partial smoke, central, two branches, partial receipt, sale and lock", () => {
  const s = ready(),
    id = s.db.lots[0].id;
  assert.equal(produced(s.db, id), 36);
  assert.equal(s.db.lots[0].stage, 8);
  assert.equal(lotCost(s.db, s.db.lots[0]).freight, 2000);
  s.run("owner", "allocate", {
    branch: "ศาลาแดง",
    kg: "10",
    bags: "5",
    deliveryDate: day,
  });
  const allocation = s.db.entries.at(-1).id;
  s.run("owner", "allocate", {
    branch: "มีนบุรี",
    kg: "5",
    bags: "2",
    deliveryDate: day,
  });
  assert.equal(centralStock(s.db, id), 20);
  s.run("branch", "receive", {
    kg: "4",
    bags: "2",
    allocation,
    reason: "ทยอยรับ",
  });
  s.run("branch", "receive", { kg: "6", bags: "3", allocation });
  s.run("branch", "thaw", { kg: "4.2", bags: "2" });
  s.run("branch", "ricePurchase", {
    supplier: "ตลาดศาลาแดง",
    rawRiceKg: "10",
    rawRiceCost: "500",
  });
  s.run("owner", "generalPurchase", {
    purchaseDate: day,
    item: "น้ำพริกหลอด",
    purchaseCategory: "วัตถุดิบ",
    quantity: "50",
    unitPrice: "6",
    supplier: "ผู้ผลิตน้ำพริก",
  });
  s.run("owner", "chiliAllocate", { branch: "ศาลาแดง", chiliTubes: "50" });
  s.run("branch", "riceIssue", {
    rawRiceIssuedKg: "4",
    receiver: "ผู้ดูแล",
  });
  s.run("branch", "rice", {
    rawUsedKg: "4",
    riceKg: "10",
  });
  assert.equal(rawRiceStock(s.db, "ศาลาแดง"), 6);
  assert.equal(issuedRawRiceStock(s.db, "ศาลาแดง"), 0);
  assert.equal(cookedRiceStock(s.db, "ศาลาแดง"), 10);
  assert.equal(chiliStock(s.db, "ศาลาแดง"), 50);
  s.run("branch", "sale", {
    boxes: "40",
    addons: "0",
    chiliAddons: "2",
    soldKg: "4",
    wasteKg: ".2",
    riceWasteKg: "0",
    expense: "10",
    payer: "ผู้ดูแล",
    lineMan: "14060",
    reason: "เนื้อเหลือปิดวัน",
  });
  assert.equal(chiliStock(s.db, "ศาลาแดง"), 48);
  assert.ok(Math.abs(balance(s.db, id, "ศาลาแดง").ready) < 0.001);
  assert.equal(balance(s.db, id, "ศาลาแดง").frozen, 5.8);
  assert.equal(balance(s.db, id, "มีนบุรี").received, 0);
  for (let i = 0; i < 7; i++) {
    s.db.config["material" + i] = "500";
    s.run("owner", "materialReceive", {
      purchaseDate: day,
      material: materials[i],
      quantity: "1000",
      unitPrice: "1",
      supplier: "ผู้ขายวัสดุ",
    });
    s.run("owner", "materialTransfer", {
      material: materials[i],
      branch: "ศาลาแดง",
      quantity: "500",
      receiver: "ผู้ดูแล",
    });
    s.run("branch", "materialConfirm", {
      transferId: s.db.entries.at(-1).id,
      receivedQuantity: "500",
      receiver: "ผู้ดูแล",
    });
  }
  s.run(
    "branch",
    "materials",
    Object.fromEntries(
      Array.from({ length: 7 }, (_, i) => [
        ["opening" + i, "500"],
        ["used" + i, "50"],
        ["material" + i, "450"],
      ]).flat(),
    ),
  );
  assert.equal(s.db.entries.at(-1).values.material0, "450");
  s.run("branch", "closeDay", { time: "22:00", confirm: "ผู้ดูแล" });
  assert.ok(isClosed(s.db, "ศาลาแดง", day));
  assert.throws(() => s.run("branch", "thaw", { kg: "1", bags: "1" }), /ปิดยอด/);
  assert.ok(
    visibleEntries(s.db, "branch").every((e) => !("meatCost" in e.values)),
  );
  assert.ok(!visibleEntries(s.db, "cm").some((e) => e.kind === "sale"));
  assert.deepEqual(JSON.parse(JSON.stringify(s.db)), s.db);
});
test("invalid role and out-of-order writes rejected without mutation", () => {
  const s = setup();
  assert.throws(
    () =>
      s.run("cm", "purchase", { supplier: "x", orderedKg: "10", price: "1" }),
    /ไม่มีสิทธิ์/,
  );
  assert.equal(s.db.lots.length, 0);
  assert.throws(
    () => s.run("owner", "allocate", { branch: "มีนบุรี", kg: "1", bags: "1" }),
    /สต๊อกกลาง/,
  );
});
test("dispatch waits for a paid smoking invoice and cannot exceed Foodiva's ready weight", () => {
  const s = setup();
  s.run("owner", "purchase", { ...purchaseInfo, orderedKg: "40", price: "10" });
  assert.throws(
    () => s.run("owner", "dispatch", { ...send, dispatchKg: "40" }),
    /Foodiva/,
  );
  const t = setup();
  readyToDispatch(t, "40");
  assert.throws(
    () => t.run("owner", "dispatch", { ...send, dispatchKg: "41" }),
    /เกิน/,
  );
  t.run("owner", "dispatch", { ...send, dispatchKg: "40" });
  assert.equal(t.db.lots[0].stage, 2);
});
test("over-allocation, over-thaw and cross-branch receive rejected", () => {
  const s = ready();
  assert.throws(
    () =>
      s.run("owner", "allocate", { branch: "มีนบุรี", kg: "36", bags: "2" }),
    /ไม่พอ/,
  );
  s.run("owner", "allocate", { branch: "มีนบุรี", kg: "5", bags: "2" });
  assert.throws(
    () =>
      s.run("branch", "receive", {
        kg: "5",
        bags: "2",
        allocation: s.db.entries.at(-1).id,
      }),
    /ไม่ได้จัดสรร/,
  );
  s.run("owner", "allocate", { branch: "ศาลาแดง", kg: "5", bags: "2" });
  s.run("branch", "receive", {
    kg: "5",
    bags: "2",
    allocation: s.db.entries.at(-1).id,
  });
  assert.throws(() => s.run("branch", "thaw", { kg: "6", bags: "2" }), /ไม่พอ/);
});
test("excess pre-smoke, over-smoke and incomplete close blocked", () => {
  const s = setup();
  readyToDispatch(s, "10");
  s.run("owner", "dispatch", { ...send, dispatchKg: "10" });
  s.run("cm", "cmReceive", { receivedKg: "10", arrival: "08:00" });
  assert.throws(() => s.run("cm", "prepare", { preKg: "11" }), /เกิน/);
  s.run("cm", "prepare", { preKg: "10" });
  assert.throws(() => s.run("cm", "closeLot", { confirm: "x" }), /ขั้นตอน/);
  assert.throws(
    () =>
      s.run("cm", "smoke", {
        inputKg: "11",
        wasteKg: "6",
        smokeDate: day,
        packs: packs(50),
      }),
    /เกิน/,
  );
});
test("day close time gate and sales deviation validation", () => {
  const s = ready();
  s.run("owner", "allocate", { branch: "ศาลาแดง", kg: "5", bags: "2" });
  s.run("branch", "receive", {
    kg: "5",
    bags: "2",
    allocation: s.db.entries.at(-1).id,
  });
  s.run("branch", "thaw", { kg: "5", bags: "2" });
  assert.throws(
    () => s.run("branch", "closeDay", { time: "21:59", confirm: "x" }),
    /22:00/,
  );
  assert.throws(
    () => s.run("branch", "closeDay", { time: "22:00", confirm: "x" }),
    /รายการขาย/,
  );
  assert.throws(
    () =>
      s.run("branch", "sale", {
        boxes: "10",
        addons: "0",
        chiliAddons: "0",
        soldKg: "2",
        wasteKg: "0",
        riceWasteKg: "0",
        expense: "0",
        lineMan: "3500",
      }),
    /100–103 กรัม/,
  );
});
test("chef edit before close validates in mutate, never touches the old database and is logged", () => {
  const s = smoked(),
    id = s.db.lots[0].id;
  const smokes = s.db.entries.filter((entry) => entry.kind === "smoke");
  const draft = (entry, change = {}) => ({
    id: entry.id,
    smokeDate: day,
    inputKg: entry.values.inputKg,
    wasteKg: entry.values.wasteKg,
    packs: entry.values.packs,
    ...change,
  });
  const edit = (values, drafts) =>
    s.run(
      "cm",
      "chefEdit",
      {
        receivedKg: "49",
        arrival: "08:00",
        preKg: "48",
        ...values,
        batches: JSON.stringify(drafts),
      },
      id,
    );
  assert.throws(() => s.run("owner", "chefEdit", {}, id), /ไม่มีสิทธิ์/);
  assert.throws(
    () => edit({}, [draft(smokes[0], { wasteKg: "4" }), draft(smokes[1])]),
    /เท่ากับน้ำหนักเข้าเตา/,
  );
  assert.throws(
    () => edit({ preKg: "47" }, smokes.map((entry) => draft(entry))),
    /น้ำหนักก่อนสโมค/,
  );
  assert.throws(() => edit({}, [draft(smokes[0])]), /ไม่พบข้อมูล Lot/);
  const before = s.db;
  edit({}, [
    draft(smokes[0], { wasteKg: "4", packs: packs(160) }),
    draft(smokes[1]),
  ]);
  assert.equal(
    before.entries.find((entry) => entry.id === smokes[0].id).values.wasteKg,
    "5",
  );
  assert.equal(produced(s.db, id), 37);
  assert.equal(s.db.entries.at(-1).kind, "chefEdit");
  assert.equal(s.db.lots[0].stage, 5);
  s.run("cm", "closeLot", { confirm: "x" }, id);
  assert.throws(
    () => edit({}, smokes.map((entry) => draft(entry))),
    /ก่อนยืนยันปิด Lot/,
  );
});
test("pack weights parse newline or comma input and only valid weights count as bags", () => {
  assert.deepEqual(packWeights("1.5\n2, 3"), [1.5, 2, 3]);
  assert.deepEqual(validPackWeights("1\nabc\n0\n2"), [1, 2]);
  assert.deepEqual(validPackWeights(), []);
});

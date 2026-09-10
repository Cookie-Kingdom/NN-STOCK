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
  issuedChiliStock,
  materials,
} from "../src/lib/demo-store.ts";
const day = "2026-09-09";
const packs = (count) => Array.from({ length: count }, () => "0.100").join("\n");
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
function ready() {
  const s = setup();
  s.run("owner", "brinePurchase", { supplier: "ผู้ขายน้ำหมัก", quantityMl: "10000", totalCost: "1000" });
  s.run("owner", "purchase", {
    supplier: "Test Foodiva",
    orderedKg: "50",
    price: "250",
  });
  s.run("owner", "dispatch", {
    dispatchKg: "50",
    pickupDate: day,
    origin: "กรุงเทพ",
    destination: "เชียงใหม่",
    trip: "ไปกลับ",
  });
  s.run("cm", "cmReceive", {
    receivedKg: "49",
    arrival: "08:00",
    reason: "สูญเสียระหว่างขนส่ง",
  });
  s.run("cm", "prepare", { preKg: "48" });
  s.run("cm", "smoke", {
    smokeDate: day,
    inputKg: "20",
    brineKg: "2",
    packs: packs(150),
  });
  s.run("cm", "smoke", {
    smokeDate: day,
    inputKg: "28",
    brineKg: "2.8",
    packs: packs(210),
  });
  s.run("cm", "closeLot", { confirm: "สมชาย" });
  s.run("owner", "return", { returnDate: day, returnVehicle: "กข123" });
  s.run("owner", "central", { centralKg: "35" });
  return s;
}
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
  s.run("branch", "thaw", { kg: "4.2" });
  s.run("branch", "ricePurchase", {
    supplier: "ตลาดศาลาแดง",
    rawRiceKg: "10",
    rawRiceCost: "500",
  });
  s.run("branch", "chiliPurchase", {
    supplier: "ตลาดศาลาแดง",
    chiliTubes: "50",
    chiliCost: "300",
  });
  s.run("branch", "riceIssue", {
    rawRiceIssuedKg: "4",
    receiver: "ผู้ดูแล",
  });
  s.run("branch", "chiliIssue", {
    chiliIssuedTubes: "42",
    receiver: "ผู้ดูแล",
  });
  s.run("branch", "rice", {
    rawUsedKg: "4",
    riceKg: "10",
  });
  assert.equal(rawRiceStock(s.db, "ศาลาแดง"), 6);
  assert.equal(issuedRawRiceStock(s.db, "ศาลาแดง"), 0);
  assert.equal(cookedRiceStock(s.db, "ศาลาแดง"), 10);
  assert.equal(chiliStock(s.db, "ศาลาแดง"), 8);
  assert.equal(issuedChiliStock(s.db, "ศาลาแดง"), 42);
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
  assert.equal(issuedChiliStock(s.db, "ศาลาแดง"), 40);
  assert.ok(Math.abs(balance(s.db, id, "ศาลาแดง").ready) < 0.001);
  assert.equal(balance(s.db, id, "ศาลาแดง").frozen, 5.8);
  assert.equal(balance(s.db, id, "มีนบุรี").received, 0);
  for (let i = 0; i < 7; i++) {
    s.db.config["material" + i] = "500";
    s.run("owner", "materialReceive", {
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
  s.run("branch", "closeDay", { time: "21:00", confirm: "ผู้ดูแล" });
  assert.ok(isClosed(s.db, "ศาลาแดง", day));
  assert.throws(() => s.run("branch", "thaw", { kg: "1" }), /ปิดยอด/);
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
test("partial dispatch creates sibling lots without duplicating ordered balance", () => {
  const s = setup();
  s.run("owner", "purchase", { supplier: "F", orderedKg: "100", price: "10" });
  const send = {
    pickupDate: day,
    origin: "BKK",
    destination: "CM",
    trip: "เที่ยวเดียว",
  };
  s.run("owner", "dispatch", { ...send, dispatchKg: "40" });
  const second = s.db.lots[1].id;
  s.run("owner", "dispatch", { ...send, dispatchKg: "30" }, second);
  assert.equal(s.db.lots.length, 3);
  assert.equal(s.db.lots.filter((l) => l.stage === 1).length, 1);
  assert.throws(
    () =>
      s.run(
        "owner",
        "dispatch",
        { ...send, dispatchKg: "31" },
        s.db.lots[2].id,
      ),
    /เกิน/,
  );
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
  assert.throws(() => s.run("branch", "thaw", { kg: "6" }), /ไม่พอ/);
});
test("receive mismatch, excess pre-smoke and incomplete close blocked", () => {
  const s = setup();
  s.run("owner", "purchase", { supplier: "F", orderedKg: "10", price: "10" });
  s.run("owner", "dispatch", {
    dispatchKg: "10",
    pickupDate: day,
    origin: "B",
    destination: "C",
    trip: "เที่ยวเดียว",
  });
  assert.throws(
    () => s.run("cm", "cmReceive", { receivedKg: "9", arrival: "08:00" }),
    /เหตุผล/,
  );
  s.run("cm", "cmReceive", { receivedKg: "10", arrival: "08:00" });
  assert.throws(() => s.run("cm", "prepare", { preKg: "11" }), /เกิน/);
  s.run("cm", "prepare", { preKg: "10" });
  assert.throws(() => s.run("cm", "closeLot", { confirm: "x" }), /ขั้นตอน/);
  assert.throws(
    () =>
      s.run("cm", "smoke", {
        inputKg: "11",
        brineKg: "0",
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
  s.run("branch", "thaw", { kg: "5" });
  assert.throws(
    () => s.run("branch", "closeDay", { time: "20:59", confirm: "x" }),
    /21:00/,
  );
  assert.throws(
    () => s.run("branch", "closeDay", { time: "21:00", confirm: "x" }),
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

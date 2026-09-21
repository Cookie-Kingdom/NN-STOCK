import { describe, expect, test } from "vitest";
import {
  lotCost,
  poRemainingKg,
  shipmentShares,
  shipments,
  visibleDatabase,
} from "@/lib/store";
import {
  confirm,
  day,
  dispatch,
  last,
  packingList,
  purchase,
  request,
  setup,
  smoked,
  smokeOrder,
  type Setup,
} from "./fixtures";

/** Purchase POs of the given kg (and price), each with Foodiva's invoice; returns their lot ids. */
function purchases(s: Setup, ...pos: [string, string?][]) {
  return pos.map(([kg, price]) => {
    purchase(s, kg, price);
    confirm(s, kg);
    return s.db.lots.at(-1)!.id;
  });
}

describe("shipment request", () => {
  test("three purchase POs of 300, 700 and 500 kg go out in one 1,500 kg shipment", () => {
    const s = setup();
    const ids = purchases(s, ["300"], ["700"], ["500"]);
    request(s, [[ids[0], "300"], [ids[1], "700"], [ids[2], "500"]]);
    const shipment = s.db.lots.at(-1)!;
    expect(shipment).toMatchObject({
      id: "S260909-001",
      poId: "SH-2026-0001",
      kind: "shipment",
      stage: 1,
    });
    expect(shipment.values.requestedKg).toBe("1500");
    for (const id of ids) expect(poRemainingKg(s.db, id)).toBe(0);
    dispatch(s);
    expect(s.db.lots.at(-1)!.values.dispatchKg).toBe("1500");
    // Purchase numbering skips shipments.
    purchase(s, "10");
    expect(s.db.lots.at(-1)!.poId).toBe("PO-2026-0004");
  });

  test("a 1,000 kg PO that shipped 400 shows 600 remaining and can ship again; more is refused naming the PO", () => {
    const s = setup();
    const [id] = purchases(s, ["1000"]);
    request(s, [[id, "400"]]);
    expect(poRemainingKg(s.db, id)).toBe(600);
    expect(() => request(s, [[id, "600.5"]])).toThrow(
      "น้ำหนักที่ขอส่งเกินยอดคงเหลือของ PO-2026-0001 (เหลือ 600.00 กก.)",
    );
    request(s, [[id, "600"]]);
    expect(poRemainingKg(s.db, id)).toBe(0);
    expect(shipments(s.db).map((lot) => lot.poId)).toEqual(["SH-2026-0001", "SH-2026-0002"]);
  });

  test("a Request needs a known, invoiced PO once each with a positive weight", () => {
    const s = setup();
    const [id] = purchases(s, ["100"]);
    purchase(s, "50");
    const uninvoiced = s.db.lots.at(-1)!.id;
    expect(() => s.run("owner", "shipmentRequest", { lines: "[]" })).toThrow("เลือก PO ซื้ออย่างน้อย 1 ใบ");
    expect(() => s.run("owner", "shipmentRequest", { lines: "oops" })).toThrow("เลือก PO ซื้ออย่างน้อย 1 ใบ");
    expect(() => request(s, [["F000000-999", "1"]])).toThrow("ไม่พบ PO ซื้อที่เลือก");
    expect(() => request(s, [[id, "1"], [id, "2"]])).toThrow("เลือก PO ซื้อซ้ำในใบเดียวกัน");
    expect(() => request(s, [[id, "0"]])).toThrow("กรอกน้ำหนักที่จะส่งของ PO-2026-0001 เป็นตัวเลขมากกว่าศูนย์");
    expect(() => request(s, [[id, ""]])).toThrow("เป็นตัวเลขมากกว่าศูนย์");
    expect(() => request(s, [[uninvoiced, "1"]])).toThrow("PO-2026-0002 ยังไม่มี Invoice เนื้อจาก Foodiva");
    expect(() => s.run("foodiva", "shipmentRequest", { lines: "[]" })).toThrow("ไม่มีสิทธิ์");
  });

  test("voiding a Request gives the kg back until Foodiva trucks it", () => {
    const s = setup();
    const [id] = purchases(s, ["100"]);
    request(s, [[id, "100"]]);
    const first = last(s);
    s.run("owner", "void", { targetId: first.id, reason: "ขอผิด" });
    expect(poRemainingKg(s.db, id)).toBe(100);
    expect(shipments(s.db)).toEqual([]);
    expect(() => s.run("foodiva", "dispatch", {}, first.lotId)).toThrow("Request นี้ถูกยกเลิกแล้ว");
    request(s, [[id, "100"]]);
    dispatch(s);
    expect(() => s.run("owner", "void", { targetId: last(s).id, reason: "x" })).toThrow("ยกเลิกไม่ได้");
    const second = s.db.entries.findLast((e) => e.kind === "shipmentRequest")!;
    expect(() => s.run("owner", "void", { targetId: second.id, reason: "x" })).toThrow(
      "Foodiva ทำใบขนส่งแล้ว ยกเลิก Request ไม่ได้",
    );
  });
});

describe("shipment at Chef House", () => {
  test("yellow cells off the Packing List save, and meat cost splits back to each PO pro rata", () => {
    const s = setup();
    const [a, b] = purchases(s, ["300", "250"], ["700", "200"]);
    request(s, [[a, "300"], [b, "700"]]);
    dispatch(s);
    packingList(s, "500\n500");
    smokeOrder(s);
    s.run("cm", "smokeOrderAccept", { acceptedBy: "Chef House" });
    const receive = (receivedBoxes: string) =>
      s.run("cm", "cmReceive", { receivedBoxes, arrival: "08:00" });
    expect(() => receive("450")).toThrow("จำนวนกล่องรับเข้าไม่ตรงกับ Packing List");
    expect(() => receive("450\n")).toThrow("กรอกน้ำหนักจริงทุกกล่องรับเข้า");
    expect(() => receive("0\n0")).toThrow("น้ำหนักรับจริงรวมต้องมากกว่าศูนย์");
    receive("450\n500");
    const shipment = s.db.lots.at(-1)!;
    expect(shipment.values.receivedKg).toBe("950");
    expect(shipmentShares(s.db, shipment)).toEqual([
      { lotId: a, poId: "PO-2026-0001", requestedKg: 300, kg: 285, price: 250, meat: 71250 },
      { lotId: b, poId: "PO-2026-0002", requestedKg: 700, kg: 665, price: 200, meat: 133000 },
    ]);
    expect(lotCost(s.db, shipment).meat).toBe(204250);
  });

  test("Chef House's database holds no purchase PO number, price or Request lines", () => {
    const s = smoked();
    // A second shipment still waiting for its smoke PO stays out of Chef House's view.
    const [id] = purchases(s, ["20"]);
    request(s, [[id, "20"]]);
    const chef = visibleDatabase(s.db, "cm");
    const json = JSON.stringify(chef);
    expect(json).not.toContain("PO-");
    expect(json).not.toContain('"price"');
    expect(json).not.toContain('"lines"');
    expect(chef.lots.map((lot) => lot.poId)).toEqual(["SH-2026-0001"]);
    expect(chef.entries.map((e) => e.kind)).toEqual(
      expect.arrayContaining(["packingList", "smokeOrder", "cmReceive"]),
    );
    expect(chef.entries.map((e) => e.kind)).not.toContain("dispatch");
    expect(visibleDatabase(s.db, "owner")).toBe(s.db);
  });
});

describe("meat invoice payment", () => {
  test("pays Foodiva's meat invoice once, for its exact amount, on the purchase PO only", () => {
    const s = setup();
    purchase(s, "40");
    const po = s.db.lots.at(-1)!.id;
    const pay = (paidAmount: string, lotId = po, slips?: string) =>
      s.run("owner", "meatPayment", { paymentDate: day, paidBy: "Owner", paidAmount, ...(slips && { slips }) }, lotId);
    expect(() => pay("10000")).toThrow("ยังไม่มี Invoice เนื้อจาก Foodiva");
    s.run("foodiva", "foodivaConfirm", {
      invoiceNo: "INV-9",
      invoiceDate: day,
      attachment: "inv.pdf",
      confirmedBy: "Foodiva",
      confirmedKg: "40",
      readyForChiangMaiKg: "40",
      reservedForOwnerKg: "0",
      invoiceAmount: "10000",
    });
    expect(() => pay("9999")).toThrow("ยอดชำระต้องเท่ากับยอดรวม Invoice เนื้อ");
    expect(() => pay("10000", po, "not json")).toThrow("ไฟล์สลิปไม่ถูกต้อง กรุณาแนบใหม่");
    expect(() => pay("10000", po, '[{"name":"a.jpg"}]')).toThrow("ไฟล์สลิปไม่ถูกต้อง");
    pay("10000", po, '[{"name":"a.jpg","storageKey":"k1"},{"name":"b.pdf","storageKey":"k2"}]');
    expect(last(s).values.invoiceNo).toBe("INV-9");
    expect(() => pay("10000")).toThrow("ชำระ Invoice เนื้อใบนี้แล้ว");
    request(s, [[po, "40"]]);
    expect(() => pay("10000", s.db.lots.at(-1)!.id)).toThrow("รายการนี้ต้องทำกับ PO ซื้อ");
  });
});

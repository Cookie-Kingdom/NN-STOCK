import { describe, expect, test } from "vitest";
import {
  entries,
  lotCost,
  poRemainingKg,
  shipmentShares,
  shipments,
} from "@/lib/store";
import {
  confirm,
  day,
  dispatch,
  expectWarning,
  last,
  packingList,
  purchase,
  setup,
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

describe("smoke PO lines", () => {
  test("SMK-02 three purchase POs of 300, 700 and 500 kg go out in one 1,500 kg batch", () => {
    const s = setup();
    const ids = purchases(s, ["300"], ["700"], ["500"]);
    smokeOrder(
      s,
      [
        [ids[0], "300"],
        [ids[1], "700"],
        [ids[2], "500"],
      ],
      "1500",
      "",
    );
    const batch = s.db.lots.at(-1)!;
    expect(batch).toMatchObject({
      id: expect.stringMatching(/^S260909-001-[0-9a-f]{4}$/),
      poId: "SH-2026-0001",
      kind: "shipment",
    });
    expect(batch.values.requestedKg).toBe("1500");
    for (const id of ids) expect(poRemainingKg(s.db, id)).toBe(0);
    dispatch(s);
    expect(s.db.lots.at(-1)!.values.dispatchKg).toBe("1500");
    // Purchase numbering skips batches.
    purchase(s, "10");
    expect(s.db.lots.at(-1)!.poId).toBe("PO-2026-0004");
  });

  test("SMK-02 a 1,000 kg PO that sent 400 shows 600 remaining and can send again; more warns naming the PO", () => {
    const s = setup();
    const [id] = purchases(s, ["1000"]);
    smokeOrder(s, [[id, "400"]], "400", "");
    expect(poRemainingKg(s.db, id)).toBe(600);
    expectWarning(
      s.dry(() => smokeOrder(s, [[id, "600.5"]], "600.5", "")),
      "น้ำหนักที่ขอส่งเกินยอดคงเหลือของ PO-2026-0001 (เหลือ 600.00 กก.)",
    );
    smokeOrder(s, [[id, "600"]], "600", "");
    expect(poRemainingKg(s.db, id)).toBe(0);
    expect(shipments(s.db).map((lot) => lot.poId)).toEqual([
      "SH-2026-0001",
      "SH-2026-0002",
    ]);
  });

  test("SMK-05 the Owner edits a smoke PO's lines later through entryEdit", () => {
    const s = setup();
    const [a, b, c] = purchases(s, ["300"], ["700"], ["500"]);
    smokeOrder(
      s,
      [
        [a, "200"],
        [b, "300"],
      ],
      "500",
      "",
    );
    const batch = s.db.lots.at(-1)!;
    const order = last(s);
    const edit = (lines: [string, string][]) =>
      s.run("owner", "entryEdit", {
        targetId: order.id,
        reason: "แก้ PO ซื้อ",
        values: JSON.stringify({
          lines: JSON.stringify(lines.map(([lotId, kg]) => ({ lotId, kg }))),
        }),
      });
    // Its own 300 kg on PO b count as available again: 700 is the whole PO, 701 warns.
    expectWarning(
      s.dry(() => edit([[b, "701"]])),
      /เกินยอดคงเหลือ.*เหลือ 700\.00/,
    );
    edit([
      [b, "700"],
      [c, "100"],
    ]);
    const edited = entries(s.db, "smokeOrder", batch.id)[0];
    expect(edited.values.orderNumber).toBe(order.values.orderNumber);
    expect(edited.values.requestedKg).toBe("800");
    expect(s.db.lots.at(-1)!.values.requestedKg).toBe("800");
    expect(shipments(s.db)).toHaveLength(1);
    expect(poRemainingKg(s.db, a)).toBe(300);
    expect(poRemainingKg(s.db, b)).toBe(0);
    expect(poRemainingKg(s.db, c)).toBe(400);
  });
});

describe("batch at Chef House", () => {
  test("CHF-02 a received total off the Packing List saves, and meat cost splits back to each PO pro rata", () => {
    const s = setup();
    const [a, b] = purchases(s, ["300", "250"], ["700", "200"]);
    smokeOrder(
      s,
      [
        [a, "300"],
        [b, "700"],
      ],
      "1000",
      "",
    );
    dispatch(s);
    packingList(s, "500\n500");
    s.run("owner", "smokeOrderAccept", { acceptedBy: "Chef House" });
    const receive = (receivedKg: string) =>
      s.run("owner", "cmReceive", { receivedKg, arrival: "08:00" });
    // A total off the Packing List is said, not refused.
    expectWarning(
      s.dry(() => receive("450")),
      "น้ำหนักรับรวมไม่ตรงกับ Packing List",
    );
    expect(() => receive("-1")).toThrow("น้ำหนักรับรวม");
    receive("950");

    const batch = s.db.lots.at(-1)!;
    expect(batch.values.receivedKg).toBe("950");
    expect(shipmentShares(s.db, batch)).toEqual([
      {
        lotId: a,
        poId: "PO-2026-0001",
        requestedKg: 300,
        kg: 285,
        price: 250,
        meat: 71250,
      },
      {
        lotId: b,
        poId: "PO-2026-0002",
        requestedKg: 700,
        kg: 665,
        price: 200,
        meat: 133000,
      },
    ]);
    expect(lotCost(s.db, batch).meat).toBe(204250);
  });
});

describe("meat invoice payment", () => {
  test("PO-03 pays Foodiva's meat invoice once, on the purchase PO only; without an invoice it only warns", () => {
    const s = setup();
    purchase(s, "40");
    const po = s.db.lots.at(-1)!.id;
    const pay = (paidAmount: string, lotId = po, slips?: string) =>
      s.run(
        "owner",
        "meatPayment",
        {
          paymentDate: day,
          paidBy: "Owner",
          paidAmount,
          ...(slips && { slips }),
        },
        lotId,
      );
    expectWarning(
      s.dry(() => pay("10000")),
      "ยังไม่มี Invoice เนื้อจาก Foodiva",
    );
    s.run("owner", "foodivaConfirm", {
      invoiceNo: "INV-9",
      invoiceDate: day,
      attachment: "inv.pdf",
      confirmedBy: "Foodiva",
      confirmedKg: "40",
      readyForChiangMaiKg: "40",
      reservedForOwnerKg: "0",
      invoiceAmount: "10000",
    });
    expectWarning(
      s.dry(() => pay("9999")),
      "ยอดชำระต้องเท่ากับยอดรวม Invoice เนื้อ",
    );
    expect(() => pay("10000", po, "not json")).toThrow(
      "ไฟล์สลิปไม่ถูกต้อง กรุณาแนบใหม่",
    );
    expect(() => pay("10000", po, '[{"name":"a.jpg"}]')).toThrow(
      "ไฟล์สลิปไม่ถูกต้อง",
    );
    pay(
      "10000",
      po,
      '[{"name":"a.jpg","storageKey":"k1"},{"name":"b.pdf","storageKey":"k2"}]',
    );
    expect(last(s).values.invoiceNo).toBe("INV-9");
    expect(() => pay("10000")).toThrow("ชำระ Invoice เนื้อใบนี้แล้ว");
    // PO-02: Foodiva may still re-issue its invoice; it is only told the PO is paid.
    expectWarning(
      s.check("owner", "foodivaConfirm", {
        invoiceNo: "INV-9b",
        invoiceDate: day,
        attachment: "inv.pdf",
        confirmedBy: "Foodiva",
        confirmedKg: "40",
        readyForChiangMaiKg: "40",
        reservedForOwnerKg: "0",
        invoiceAmount: "10000",
      }),
      "Owner ชำระ Invoice เนื้อของ PO นี้แล้ว",
    );
    smokeOrder(s, [[po, "40"]], "40", "");
    expect(() => pay("10000", s.db.lots.at(-1)!.id)).toThrow(
      "รายการนี้ต้องทำกับ PO ซื้อ",
    );
  });
});

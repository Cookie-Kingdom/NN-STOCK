import { expect, test } from "vitest";
import {
  foodivaInvoiceRows,
  smokeOrderPrintRows,
  smokeOrderTraceRows,
  smokingInvoiceRows,
  transportDocumentRows,
} from "@/components/organisms/owner/documentRows";
import {
  dateLabel,
  lotIssueDate,
  matchesDocumentFilter,
  purchaseOrderRows,
  type DocumentReferenceType,
} from "@/components/organisms/shared/documentRows";
import { entries, visibleDatabase, type Entry, type Lot } from "@/lib/store";
import {
  closed,
  confirm,
  day,
  dispatch,
  invoice,
  packingList,
  purchase,
  request,
  setup,
  smokeOrder,
} from "./fixtures";

const asObject = (rows: [string, string][]) => Object.fromEntries(rows);

test("transport rows read the direction's own date and weight keys", () => {
  const lot: Lot = {
    id: "F260909-001",
    poId: "PO-2026-0001",
    stage: 2,
    values: {},
    config: {},
  };
  const trip: Entry = {
    id: "t1",
    kind: "dispatch",
    role: "owner",
    lotId: lot.id,
    branch: "",
    date: day,
    at: "",
    values: {
      origin: "กรุงเทพฯ",
      destination: "เชียงใหม่",
      dispatchKg: "12.5",
      returnKg: "3",
      returnDate: "2026-09-12",
      plate: "กข123",
    },
  };
  expect(asObject(transportDocumentRows(lot, trip, "outbound"))).toMatchObject({
    วันที่รถรับ: day,
    PO: "PO-2026-0001",
    น้ำหนักส่ง: "12.50 กก.",
    ทะเบียนรถ: "กข123",
    คนขับ: "—",
  });
  expect(asObject(transportDocumentRows(lot, trip, "return"))).toMatchObject({
    วันที่รถรับ: "2026-09-12",
    น้ำหนักส่ง: "3.00 กก.",
  });
});

test("invoice and smoke PO rows follow the lot's documents", () => {
  const s = closed();
  const sent = invoice(s);
  s.run("owner", "invoiceReview", {
    invoiceId: sent.id,
    decision: "รับยอด",
    reviewedBy: "Owner",
  });
  s.run("owner", "invoicePayment", {
    invoiceId: sent.id,
    paymentDate: day,
    paidBy: "Owner",
    paidAmount: sent.values.netPayable,
  });
  const po = s.db.lots[0];
  const lot = s.db.lots.at(-1)!;
  const latest = (kind: string, from = lot) =>
    entries(s.db, kind, from.id).at(-1)!;
  expect(
    asObject(foodivaInvoiceRows(s.db, po, latest("foodivaConfirm", po))),
  ).toMatchObject({
    น้ำหนักยืนยัน: "50.00 กก.",
    พร้อมส่งเชียงใหม่: "50.00 กก.",
    "ยอด Invoice": "฿1.00",
    ผู้ยืนยัน: "Foodiva",
  });
  expect(
    asObject(
      smokingInvoiceRows(
        s.db,
        lot,
        latest("smokingInvoice"),
        latest("smokeOrder"),
      ),
    ),
  ).toMatchObject({
    "PO โรงรมควัน": "SO-2026-0001",
    ยอดสุทธิ: "฿11,000.00",
    สถานะ: "ชำระแล้ว",
  });
  expect(
    asObject(
      smokingInvoiceRows(s.db, lot, latest("smokingInvoice"), undefined),
    )["PO โรงรมควัน"],
  ).toBe("—");
  expect(
    asObject(smokeOrderPrintRows(s.db, lot, latest("smokeOrder"))),
  ).toMatchObject({
    ลูกค้า: "บริษัท เนิร์ดเนื้อ จำกัด",
    ที่อยู่: "—",
    เลขที่การส่ง: "SH-2026-0001",
    "Packing List": "2 กล่องรับเข้า · 50.00 กก.",
    ขนาดบรรจุ: "2 กล่องรับเข้า",
    จำนวน: "50.00 กก.",
    "ราคา / กก.": "฿220.00",
    "ยอดรวมก่อน VAT": "฿11,000.00",
  });
  expect(
    asObject(smokeOrderTraceRows(s.db, lot, latest("smokeOrder"))),
  ).toMatchObject({
    เลขที่การส่ง: "SH-2026-0001",
    "Packing List": "2 กล่องรับเข้า · 50.00 กก.",
    ผู้รับออเดอร์: "—",
  });
});

test("the smoke PO of a 3-PO shipment, as Chef House opens it, names no purchase PO, meat price or Foodiva invoice", () => {
  const s = setup();
  for (const [kg, price] of [
    ["300", "250"],
    ["700", "200"],
    ["500", "230"],
  ]) {
    purchase(s, kg, price);
    confirm(s, kg);
  }
  request(
    s,
    s.db.lots.map((lot) => [lot.id, lot.values.orderedKg]),
  );
  dispatch(s);
  packingList(s, "750\n740");
  smokeOrder(s);
  const chef = visibleDatabase(s.db, "cm");
  const lot = chef.lots[0];
  const rows = smokeOrderPrintRows(
    chef,
    lot,
    entries(chef, "smokeOrder", lot.id)[0],
  );
  expect(asObject(rows)).toMatchObject({
    เลขที่การส่ง: "SH-2026-0001",
    จำนวน: "1,490.00 กก.",
    "ราคา / กก.": "฿200.00",
  });
  const text = JSON.stringify(rows);
  expect(text).not.toMatch(/PO-2026|INV-1|฿250|฿230/);
});

test("purchase order rows prefer the lot, then its config snapshot, then current config", () => {
  const s = setup();
  purchase(s, "40");
  const lot = s.db.lots[0];
  expect(asObject(purchaseOrderRows(lot, s.db))).toMatchObject({
    "วันที่ PO": day,
    Supplier: "Test Foodiva",
    ผู้รับออเดอร์: "ยังไม่ได้ตั้งค่า",
    ลูกค้า: "บริษัททดสอบ",
    จำนวน: "40.00 กก.",
    "ยอดรวมก่อน VAT": "฿10,000.00",
    หมายเหตุ: "—",
  });
  s.db.config.foodivaContact = "คุณสมศรี";
  expect(asObject(purchaseOrderRows(lot, s.db))["ผู้รับออเดอร์"]).toBe(
    "คุณสมศรี",
  );
});

test("document filter matches the reference text and the issue date range", () => {
  const s = setup();
  purchase(s, "40");
  const lot = s.db.lots[0];
  expect(lotIssueDate(s.db, lot)).toBe(day);
  expect(lotIssueDate(s.db, { ...lot, id: "LOT-20260101" })).toBe("2026-01-01");
  expect(lotIssueDate(s.db, { ...lot, id: "X" })).toBe("—");
  const match = (
    type: DocumentReferenceType,
    query: string,
    from = "",
    to = "",
  ) => matchesDocumentFilter(s.db, lot, type, query, from, to);
  expect(match("po", " po-2026 ")).toBe(true);
  expect(match("lot", "po-2026")).toBe(false);
  expect(match("lot", "f260909")).toBe(true);
  expect(match("po", "", day, day)).toBe(true);
  expect(match("po", "", "2026-09-10")).toBe(false);
  expect(match("po", "", "", "2026-09-08")).toBe(false);
  expect(matchesDocumentFilter(s.db, undefined, "po", "", "", "")).toBe(false);
});

test("dateLabel formats ISO dates in Thai and passes anything else through", () => {
  expect(dateLabel("2026-09-15")).toBe("15 ก.ย. 2569");
  expect(dateLabel("")).toBe("—");
  expect(dateLabel("รอระบุ")).toBe("รอระบุ");
});

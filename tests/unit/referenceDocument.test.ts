import { expect, test } from "vitest";
import { referenceDocument } from "@/components/organisms/shared/referenceDocument";
import {
  closed,
  confirm,
  day,
  dispatch,
  invoice,
  packingList,
  purchase,
  ready,
  readyToDispatch,
  request,
  setup,
  type Setup,
} from "./fixtures";

/** Reference of `kind` on the newest lot (the shipment once there is one), or on `lot`. */
const doc = (s: Setup, kind: string, lot = s.db.lots.at(-1)!) =>
  referenceDocument(s.db, kind, lot);

test("each lot form references the document it builds on, once that document exists", () => {
  const s = setup();
  purchase(s, "40");
  expect(doc(s, "foodivaConfirm")).toMatchObject({
    title: "Purchase Order",
    number: "PO-2026-0001",
  });
  expect(doc(s, "smokeOrder")).toBeUndefined();
  confirm(s, "40");
  request(s, [[s.db.lots[0].id, "40"]]);
  dispatch(s);
  expect(doc(s, "smokeOrder")).toBeUndefined();
  packingList(s, "20\n20");
  expect(doc(s, "smokeOrder")).toMatchObject({
    title: "Packing List",
    number: "SH-2026-0001",
  });
  expect(Object.fromEntries(doc(s, "smokeOrder")!.rows)).toMatchObject({
    กล่องรับเข้า: "2 กล่องรับเข้า",
    ยอดรวม: "40.00 กก.",
  });
  expect(doc(s, "smokeOrderAccept")).toBeUndefined();
  expect(doc(s, "cmReceive")).toBeUndefined();
  expect(doc(s, "sale")).toBeUndefined();
  const c = closed();
  invoice(c);
  expect(doc(c, "smokingInvoice")).toMatchObject({
    title: "Smoke Service Purchase Order",
    number: "SO-2026-0001",
  });
  expect(doc(c, "invoiceReview")).toMatchObject({
    title: "Invoice Chef House",
    number: "CH-1",
  });
});

test("Foodiva's return receipt references the return transport document; Chef House's receipt has its own form", () => {
  const s = ready();
  expect(doc(s, "cmReceive")).toBeUndefined();
  expect(doc(s, "foodivaReturnReceive")).toMatchObject({
    title: "ใบขนส่งเนื้อขากลับ",
    number: "TR-2026-R0001",
  });
});

test("every summary label exists in the printed rows", () => {
  const s = ready();
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
  const po = doc(s, "foodivaConfirm", s.db.lots[0])!;
  expect(po.rows.map(([label]) => label)).toEqual(
    expect.arrayContaining(po.summary),
  );
  const kinds = [
    "smokeOrder",
    "smokeOrderAccept",
    "smokingInvoice",
    "invoiceReview",
    "invoicePayment",
    "dispatch",
    "foodivaReturnReceive",
  ];
  for (const kind of kinds) {
    const reference = doc(s, kind)!;
    expect(
      reference.rows.map(([label]) => label),
      kind,
    ).toEqual(expect.arrayContaining(reference.summary));
  }
});

test("the Packing List reference carries Foodiva's uploaded file, not the generated sheet", () => {
  const s = setup();
  readyToDispatch(s, "40");
  dispatch(s);
  const list = {
    invoiceNo: "INV-1",
    product: "เนื้อวัว",
    boxes: "40",
    attachment: "pl.xlsx",
  };
  s.run("foodiva", "packingList", { ...list, attachmentStorageKey: "key-1" });
  expect(doc(s, "smokeOrder")!.attachment).toEqual({
    name: "pl.xlsx",
    data: undefined,
    storageKey: "key-1",
  });
  // Re-saving the list without picking the file again: the newest entry has
  // the name only, so the earlier version that still holds the file is used.
  s.run("foodiva", "packingList", list);
  expect(doc(s, "smokeOrder")!.attachment).toEqual({
    name: "pl.xlsx",
    data: undefined,
    storageKey: "key-1",
  });
});

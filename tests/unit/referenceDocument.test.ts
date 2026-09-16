import { expect, test } from "vitest";
import { referenceDocument } from "@/components/organisms/shared/referenceDocument";
import {
  confirm,
  invoice,
  purchase,
  ready,
  setup,
  type Setup,
} from "./fixtures";

const doc = (s: Setup, kind: string) =>
  referenceDocument(s.db, kind, s.db.lots[0]);

test("each lot form references the document it builds on, once that document exists", () => {
  const s = setup();
  purchase(s, "40");
  expect(doc(s, "foodivaConfirm")).toMatchObject({
    title: "Purchase Order",
    number: "PO-2026-0001",
  });
  expect(doc(s, "smokeOrder")).toBeUndefined();
  confirm(s, "40");
  expect(doc(s, "smokeOrder")).toMatchObject({
    title: "Invoice Foodiva",
    number: "INV-1",
  });
  expect(doc(s, "smokeOrderAccept")).toBeUndefined();
  invoice(s, "40");
  expect(doc(s, "smokingInvoice")).toMatchObject({
    title: "Smoke Service Purchase Order",
    number: "SO-2026-0001",
  });
  expect(doc(s, "invoiceReview")).toMatchObject({
    title: "Invoice Chef_house",
    number: "CH-1",
  });
  expect(doc(s, "cmReceive")).toBeUndefined();
  expect(doc(s, "sale")).toBeUndefined();
});

test("receiving forms reference the transport document", () => {
  const s = ready();
  expect(doc(s, "cmReceive")).toMatchObject({
    title: "ใบขนส่งเนื้อขาไป",
    number: "TR-2026-0001",
  });
  expect(doc(s, "foodivaReturnReceive")).toMatchObject({
    title: "ใบขนส่งเนื้อขากลับ",
    number: "TR-2026-R0001",
  });
});

test("every summary label exists in the printed rows", () => {
  const s = ready();
  const kinds = [
    "foodivaConfirm",
    "smokeOrder",
    "smokeOrderAccept",
    "smokingInvoice",
    "invoiceReview",
    "invoicePayment",
    "dispatch",
    "cmReceive",
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

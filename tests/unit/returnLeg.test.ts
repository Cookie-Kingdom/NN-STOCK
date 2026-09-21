import { expect, test } from "vitest";
import { transportDocumentRows } from "@/components/organisms/owner/documentRows";
import { entries, shipmentChain, type Values } from "@/lib/store";
import {
  closed,
  dispatch,
  packingList,
  readyToDispatch,
  received,
  setup,
} from "./fixtures";

const back = (returnKg: string): Values => ({
  returnDate: "2026-09-09",
  returnTime: "09:00",
  origin: "Chef House",
  destination: "Foodiva",
  vehicleType: "รถห้องเย็น",
  plate: "กข123",
  driverName: "คนขับ",
  driverPhone: "0800000000",
  returnKg,
});
const receive = (receivedKg: string, reason?: string): Values => ({
  receivedDate: "2026-09-09",
  receivedTime: "10:00",
  receivedKg,
  receivedBags: "360",
  ...(reason && { reason }),
});

test("the chain follows one shipment from purchase PO to Foodiva's freezer", () => {
  const s = closed();
  const lot = () => s.db.lots.at(-1)!;
  const po = s.db.lots.find((l) => !l.kind)!;
  expect(shipmentChain(s.db, lot())).toMatchObject({
    requestedKg: 50,
    sentKg: 50,
    chefReceivedKg: 49,
    smokedBoxes: 360,
    smokedKg: 36,
    returnKg: undefined,
    foodivaKg: undefined,
  });
  expect(shipmentChain(s.db, lot()).lines).toMatchObject([
    { poId: po.poId, requestedKg: 50 },
  ]);
  s.run("owner", "return", back("36"));
  s.run("foodiva", "foodivaReturnReceive", receive("35.5"));
  expect(shipmentChain(s.db, lot())).toMatchObject({
    returnKg: 36,
    foodivaKg: 35.5,
    foodivaBoxes: 360,
  });
});

test("a shipment still on the outbound truck has no later steps", () => {
  const s = setup();
  readyToDispatch(s, "50");
  dispatch(s);
  packingList(s, "25\n25");
  expect(shipmentChain(s.db, s.db.lots.at(-1)!)).toMatchObject({
    sentKg: 50,
    chefReceivedKg: undefined,
    smokedKg: undefined,
    returnKg: undefined,
  });
});

test("sent to Chef House is the Packing List total, not the Request kg", () => {
  const s = setup();
  readyToDispatch(s, "1500");
  dispatch(s);
  // Trucked but no Packing List yet: only the Request kg is known.
  expect(shipmentChain(s.db, s.db.lots.at(-1)!)).toMatchObject({
    requestedKg: 1500,
    sentKg: undefined,
  });
  const t = setup();
  received(t, "1500", "40\n30", "39\n30");
  expect(shipmentChain(t.db, t.db.lots.at(-1)!)).toMatchObject({
    requestedKg: 1500,
    sentKg: 70,
    chefReceivedKg: 69,
  });
});

test("Foodiva weighs in against the return truck's kg, not the whole smoke output", () => {
  const s = closed();
  s.run("owner", "return", back("20"));
  // 20 of 36 kg came back: receiving all 20 needs no reason.
  s.run("foodiva", "foodivaReturnReceive", receive("20"));
  const t = closed();
  t.run("owner", "return", back("20"));
  expect(() => t.run("foodiva", "foodivaReturnReceive", receive("15"))).toThrow(
    /เหตุผลส่วนต่าง/,
  );
  t.run("foodiva", "foodivaReturnReceive", receive("15", "น้ำแข็งละลาย"));
});

test("transport documents name the shipment and its purchase POs", () => {
  const s = closed();
  s.run("owner", "return", back("36"));
  const lot = s.db.lots.at(-1)!;
  const po = s.db.lots.find((l) => !l.kind)!;
  const rows = Object.fromEntries(
    transportDocumentRows(
      s.db,
      lot,
      entries(s.db, "return", lot.id)[0],
      "return",
    ),
  );
  expect(rows).toMatchObject({
    เลขที่การส่ง: lot.poId,
    "PO ซื้อ": `${po.poId} × 50.00 กก.`,
    น้ำหนักส่ง: "36.00 กก.",
  });
  expect(rows).not.toHaveProperty("Lot เนื้อ");
});

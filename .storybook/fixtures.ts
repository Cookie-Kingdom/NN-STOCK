// Databases for organism stories, built by the real `mutate` so every derived number
// (stock, cost, yield) is what the app would show.
import { fn } from "storybook/test";
import {
  materials,
  mutate,
  sevenDayRoleplay,
  type Database,
} from "@/lib/store";
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
  received,
  request,
  returned,
  setup,
  smoked,
  smokeOrder,
} from "../tests/unit/fixtures";

export { day };

/** One shipment through every stage, split to both branches, 7 days of sales. */
export const demoDb: Database = sevenDayRoleplay(day);

/** Shipment at stage 1: the Owner's 50 kg Request, waiting for Foodiva's transport document. */
export const dispatchDb: Database = (() => {
  const s = setup();
  readyToDispatch(s, "50");
  return s.db;
})();

/** Shipment trucked with its Packing List (25 + 25 kg), waiting for the Owner's smoke PO. */
export const packedDb: Database = (() => {
  const s = setup();
  readyToDispatch(s, "50");
  dispatch(s);
  packingList(s, "25\n25");
  return s.db;
})();

/** Purchase POs of 300, 700 and 500 kg with nothing sent yet, plus a 1,000 kg PO that
 * already sent 400 kg (600 kg remaining): the Owner's choice for the next Request. */
export const multiPoDb: Database = (() => {
  const s = setup();
  purchase(s, "1000", "240");
  confirm(s, "1000");
  request(s, [[s.db.lots.at(-1)!.id, "400"]]);
  dispatch(s);
  for (const [kg, price] of [
    ["300", "250"],
    ["700", "200"],
    ["500", "230"],
  ]) {
    purchase(s, kg, price);
    confirm(s, kg);
  }
  return s.db;
})();

/** `multiPoDb` after a 1,400 kg Request drawing 300 / 600 / 500 kg from the three new POs,
 * trucked with a 1,390 kg Packing List: one smoke PO to issue from three purchase POs,
 * next to the 400 kg shipment still without a Packing List (button disabled). */
export const multiPoPackedDb: Database = (() => {
  const s = setup();
  purchase(s, "1000", "240");
  confirm(s, "1000");
  request(s, [[s.db.lots.at(-1)!.id, "400"]]);
  dispatch(s);
  for (const [kg, price] of [
    ["300", "250"],
    ["700", "200"],
    ["500", "230"],
  ]) {
    purchase(s, kg, price);
    confirm(s, kg);
  }
  const [a, b, c] = s.db.lots.slice(-3).map((lot) => lot.id);
  request(s, [
    [a, "300"],
    [b, "600"],
    [c, "500"],
  ]);
  dispatch(s);
  packingList(s, "700\n690");
  return s.db;
})();

/** Shipment at stage 5: smoked, waiting for Chef House to close it. */
export const smokedDb: Database = smoked().db;

/** Shipment at stage 8: 35 kg in central stock, bags ready to allocate. */
export const centralDb: Database = ready().db;

/** Purchase PO with Foodiva's 30 kg Invoice in, nothing requested yet. */
export const confirmedDb: Database = (() => {
  const s = setup();
  purchase(s, "30");
  confirm(s, "30");
  return s.db;
})();

/** Smoke PO (50 kg, from the Packing List) sent to Chef House, waiting for Chef House to accept it. */
export const smokeOrderDb: Database = (() => {
  const s = setup();
  readyToDispatch(s, "50");
  dispatch(s);
  packingList(s, "25\n25");
  smokeOrder(s);
  return s.db;
})();

/** Chef House's smoking invoice for a closed run, waiting for the Owner to check the amount. */
export const submittedInvoiceDb: Database = (() => {
  const s = closed();
  invoice(s);
  return s.db;
})();

/** Smoking invoice checked and accepted, waiting for the Owner to pay it. */
export const acceptedInvoiceDb: Database = (() => {
  const s = closed();
  const sent = invoice(s);
  s.run("owner", "invoiceReview", {
    invoiceId: sent.id,
    decision: "รับยอด",
    reviewedBy: "Owner",
  });
  return s.db;
})();

/** Both invoices of `acceptedInvoiceDb` paid: the smoking bill with two slips, the
 * Foodiva meat invoice with one. Slips point at storage keys only (no bytes). */
export const paidDb: Database = (() => {
  const s = closed();
  const sent = invoice(s);
  s.run("owner", "invoiceReview", {
    invoiceId: sent.id,
    decision: "รับยอด",
    reviewedBy: "Owner",
  });
  const payment = {
    paymentDate: day,
    paidBy: "Owner",
    paymentReference: "TRF-0920",
  };
  s.run("owner", "invoicePayment", {
    ...payment,
    invoiceId: sent.id,
    paidAmount: sent.values.netPayable,
    slips: JSON.stringify([
      { name: "slip-chef-house-1.jpg", storageKey: "story-slip-1" },
      { name: "slip-chef-house-2.pdf", storageKey: "story-slip-2" },
    ]),
  });
  s.run(
    "owner",
    "meatPayment",
    {
      ...payment,
      paidAmount: "1",
      slips: JSON.stringify([
        { name: "slip-foodiva.jpg", storageKey: "story-slip-3" },
      ]),
    },
    s.db.lots[0].id,
  );
  return s.db;
})();

/** A 50 kg shipment trucked to Chef House with its smoke PO accepted, then advanced `steps` Chef House stages further. */
function chefHouseLot(steps: 0 | 1 | 2): Database {
  const s = setup();
  readyToDispatch(s, "50");
  dispatch(s);
  // With Inv. Weight, so Chef House's weigh-in recomputes Sliced Weight Lost.
  s.run("foodiva", "packingList", {
    invoiceNo: "INV-1",
    product: "เนื้อวัว",
    invWeightKg: "50",
    boxes: "25\n25",
  });
  smokeOrder(s);
  s.run("cm", "smokeOrderAccept", { acceptedBy: "Chef House" });
  if (steps > 0)
    s.run("cm", "cmReceive", { receivedBoxes: "24.5\n24.5", arrival: "08:00" });
  if (steps > 1) s.run("cm", "prepare", { preSmokeKg: "48" });
  return s.db;
}

/** Request 1,500 kg but Foodiva packed only 70 kg (40 + 30); Chef House weighed in 69 kg.
 *  "ส่งไป" is the Packing List's 70 kg, so the gap is −1 kg, not −1,431. */
export const packingShortDb: Database = (() => {
  const s = setup();
  received(s, "1500", "40\n30", "39\n30");
  return s.db;
})();

/** Shipment at stage 2: on the truck to Chiang Mai, waiting for Chef House to weigh it in. */
export const dispatchedDb: Database = chefHouseLot(0);

/** Shipment at stage 3: received at Chef House, waiting for the pre-smoke weight. */
export const cmReceivedDb: Database = chefHouseLot(1);

/** Shipment at stage 4: weighed before smoking, waiting for the daily smoke rounds. */
export const preparedDb: Database = chefHouseLot(2);

/** Shipment at stage 7: closed and trucked back, waiting for Foodiva to receive it. */
export const returnTruckDb: Database = (() => {
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
  return s.db;
})();

/** Shipment at stage 8: back in Foodiva's freezer, waiting for the Owner's central count. */
export const returnedDb: Database = returned().db;

/** Return leg weighed short: Chef House sent 36 kg (360 กล่องรมควัน), Foodiva counted 35.5 kg in. */
export const returnGapDb: Database = mutate(
  returnTruckDb,
  "foodiva",
  "foodivaReturnReceive",
  {
    receivedDate: day,
    receivedTime: "10:00",
    receivedKg: "35.5",
    receivedBags: "360",
  },
  returnTruckDb.lots.at(-1)!.id,
  day,
);

/** Shipment at stage 8: 17.5 kg / 180 bags allocated to ศาลาแดง, waiting for the branch to receive. */
export const allocatedDb: Database = (() => {
  const s = ready();
  s.run("owner", "allocate", {
    branch: "ศาลาแดง",
    kg: "17.5",
    bags: "180",
    deliveryDate: day,
  });
  return s.db;
})();

/** A closed run whose smoking invoice the Owner sent back. */
export const rejectedInvoiceDb: Database = (() => {
  const s = closed();
  const sent = invoice(s);
  s.run("owner", "invoiceReview", {
    invoiceId: sent.id,
    decision: "ส่งกลับแก้ไข",
    reviewedBy: "Owner",
    comment: "ยอดคลาดเคลื่อน โปรดออกใหม่",
  });
  return s.db;
})();

/** A material shipment to ศาลาแดง still waiting for the branch to confirm what arrived. */
export const materialTransferDb: Database = (() => {
  const s = setup();
  s.run("owner", "materialReceive", {
    purchaseDate: day,
    material: materials[0],
    quantity: "200",
    unitPrice: "3",
    supplier: "ร้านวัสดุ",
  });
  s.run("owner", "materialTransfer", {
    material: materials[0],
    branch: "ศาลาแดง",
    quantity: "60",
    receiver: "ผู้ดูแลสาขา",
  });
  return s.db;
})();

// Named so the Actions panel logs each open("kind", lotId) call.
export const open = fn().mockName("open");

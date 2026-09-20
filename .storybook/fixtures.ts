// Databases for organism stories, built by the real `mutate` so every derived number
// (stock, cost, yield) is what the app would show.
import { fn } from "storybook/test";
import { materials, sevenDayRoleplay, type Database } from "@/lib/store";
import {
  confirm,
  day,
  invoice,
  purchase,
  ready,
  readyToDispatch,
  returned,
  send,
  setup,
  smoked,
} from "../tests/unit/fixtures";

export { day };

/** One lot through every stage, split to both branches, 7 days of sales. */
export const demoDb: Database = sevenDayRoleplay(day);

/** Lot at stage 1: paid and waiting for dispatch to Chef_house. */
export const dispatchDb: Database = (() => {
  const s = setup();
  readyToDispatch(s, "50");
  return s.db;
})();

/** Lot at stage 5: smoked, waiting for Chef_house to close it. */
export const smokedDb: Database = smoked().db;

/** Lot at stage 8: 35 kg in central stock, bags ready to allocate. */
export const centralDb: Database = ready().db;

/** Lot at stage 1: Foodiva's 30 kg Invoice is in, waiting for the Owner's smoke PO. */
export const confirmedDb: Database = (() => {
  const s = setup();
  purchase(s, "30");
  confirm(s, "30");
  return s.db;
})();

/** Smoke PO sent to Chef_house, waiting for Chef_house to accept it. */
export const smokeOrderDb: Database = (() => {
  const s = setup();
  purchase(s, "30");
  confirm(s, "30");
  s.run("owner", "smokeOrder", {
    requestedSmokeDate: day,
    smoker: "Chef_house",
    rawKg: "30",
  });
  return s.db;
})();

/** Chef_house's smoking invoice submitted, waiting for the Owner to check the amount. */
export const submittedInvoiceDb: Database = (() => {
  const s = setup();
  purchase(s, "30");
  confirm(s, "30");
  invoice(s, "30");
  return s.db;
})();

/** Smoking invoice checked and accepted, waiting for the Owner to pay it. */
export const acceptedInvoiceDb: Database = (() => {
  const s = setup();
  purchase(s, "30");
  confirm(s, "30");
  const sent = invoice(s, "30");
  s.run("owner", "invoiceReview", {
    invoiceId: sent.id,
    decision: "รับยอด",
    reviewedBy: "Owner",
  });
  return s.db;
})();

/** A 50 kg lot trucked to Chef_house, then advanced `steps` Chef_house stages further. */
function chefHouseLot(steps: 0 | 1 | 2): Database {
  const s = setup();
  readyToDispatch(s, "50");
  s.run("owner", "dispatch", { ...send, dispatchKg: "50" });
  if (steps > 0)
    s.run("cm", "cmReceive", { receivedKg: "49", arrival: "08:00" });
  if (steps > 1) s.run("cm", "prepare", { preSmokeKg: "48" });
  return s.db;
}

/** Lot at stage 2: on the truck to Chiang Mai, waiting for Chef_house to weigh it in. */
export const dispatchedDb: Database = chefHouseLot(0);

/** Lot at stage 3: received at Chef_house, waiting for the pre-smoke weight. */
export const cmReceivedDb: Database = chefHouseLot(1);

/** Lot at stage 4: weighed before smoking, waiting for the daily smoke rounds. */
export const preparedDb: Database = chefHouseLot(2);

/** Lot at stage 6: closed and on the truck back, waiting for Foodiva to receive it. */
export const returnTruckDb: Database = (() => {
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
  return s.db;
})();

/** Lot at stage 7: back in Foodiva's freezer, waiting for the Owner's central count. */
export const returnedDb: Database = returned().db;

/** Lot at stage 8: 17.5 kg / 180 bags allocated to ศาลาแดง, waiting for the branch to receive. */
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

/** Lot with Foodiva's 30 kg invoice split 28 / 2 and a smoking invoice the Owner sent back. */
export const rejectedInvoiceDb: Database = (() => {
  const s = setup();
  purchase(s, "30");
  confirm(s, "30", "28");
  const sent = invoice(s, "28");
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

export const open = fn();

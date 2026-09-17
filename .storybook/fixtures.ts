// Databases for organism stories, built by the real `mutate` so every derived number
// (stock, cost, yield) is what the app would show.
import { fn } from "storybook/test";
import { sevenDayRoleplay, type Database } from "@/lib/store";
import {
  confirm,
  day,
  invoice,
  purchase,
  ready,
  readyToDispatch,
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

export const open = fn();

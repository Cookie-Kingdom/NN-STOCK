import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  confirmedDb,
  demoDb,
  dispatchDb,
  multiPoDb,
  open,
  ownerReservedDb,
  paidDb,
  returnGapDb,
  returnTruckDb,
} from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import type { Database } from "@/lib/store";
import { FoodivaView } from "./FoodivaView";

const meta: Meta = { title: "Organisms/Foodiva" };

export default meta;
type Story = StoryObj<{ db: Database }>;

const foodivaState = pick("สถานะ", {
  รอส่งของ: dispatchDb,
  "PO คงเหลือ": multiPoDb,
  "เก็บไว้ให้ Owner": ownerReservedDb,
  "Invoice รอชำระ": confirmedDb,
  "Invoice จ่ายแล้ว": paidDb,
  รถขากลับกำลังมา: returnTruckDb,
  รับขากลับแล้ว: returnGapDb,
  เสร็จสิ้น: demoDb,
});

/** Foodiva's screen. เลือกสถานะใน Controls:
 *  - รอส่งของ: the Owner's Request waiting for Foodiva's dispatch.
 *  - PO คงเหลือ: "Request เข้า" is empty (the only Request is trucked); every PO shows its
 *    kg left to send.
 *  - เก็บไว้ให้ Owner: 10 kg kept for the Owner, 4 kg already picked up; "เก็บไว้ให้ Owner
 *    คงเหลือ" shows 6 kg.
 *  - Invoice รอชำระ: invoice in, the Owner has not paid it yet; "การชำระเงิน" says รอ
 *    Owner ชำระ.
 *  - Invoice จ่ายแล้ว: the Owner paid the meat invoice; "จ่ายแล้ว" with date and amount,
 *    and the slip opens from the row (storage folder `meatPayment/`, readable by Foodiva
 *    since migration 0027).
 *  - รถขากลับกำลังมา: return truck on its way; "ยืนยันรับเข้าตู้" next to what Chef House
 *    sent (กล่องรมควัน / kg).
 *  - รับขากลับแล้ว: weighed in 0.5 kg short of what Chef House sent; the gap is flagged
 *    until the Owner's central count.
 *  - เสร็จสิ้น: the seven-day demo run, completed. */
export const WaitingForDispatch: Story = {
  argTypes: { db: foodivaState.argType },
  args: { db: foodivaState.initial },
  render: ({ db }) => <FoodivaView db={db} open={open} />,
};

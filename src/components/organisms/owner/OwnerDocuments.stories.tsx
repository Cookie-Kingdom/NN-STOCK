import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  acceptedInvoiceDb,
  closedDb,
  demoDb,
  dispatchDb,
  freeOrderDb,
  multiPoDb,
  multiPoPackedDb,
  open,
  ownerReservedDb,
  packedDb,
  packingShortDb,
  paidDb,
  paidWithoutInvoiceDb,
  returnGapDb,
  returnTruckDb,
} from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import type { Database } from "@/lib/store";
import { InvoiceView } from "./InvoiceView";
import { LotWorkflowAction } from "./LotWorkflowAction";
import { PurchaseOrderView } from "./PurchaseOrderView";
import { ReturnShipmentView } from "./ReturnShipmentView";
import { SmokingPurchaseOrderView } from "./SmokingPurchaseOrderView";
import { TransportManifestView } from "./TransportManifestView";

const db = demoDb;

const meta: Meta = {
  title: "Organisms/Owner Documents",
  parameters: { db },
};

export default meta;
type Story = StoryObj<{ db: Database }>;

const purchaseState = pick("สถานะ", {
  ตัวอย่าง: db,
  "หลาย PO": multiPoDb,
  "เก็บไว้ให้ Owner": ownerReservedDb,
});
const smokeState = pick("สถานะ", {
  ตัวอย่าง: db,
  "ชุดที่ Foodiva เปิด": packedDb,
  "PO ไม่มี Packing List": freeOrderDb,
  "หลาย PO": multiPoPackedDb,
});
const manifestState = pick("สถานะ", {
  ตัวอย่าง: db,
  "PO ยังไม่มีใบขนส่ง": freeOrderDb,
  "รอ Foodiva": dispatchDb,
  "Packing List ต่ำกว่า PO": packingShortDb,
  ขากลับ: returnGapDb,
});
const returnState = pick("สถานะ", {
  "ปิด Lot แล้ว": closedDb,
  "ยังไม่ปิด Lot": freeOrderDb,
  รถออกแล้ว: returnTruckDb,
});
const invoiceState = pick("สถานะ", {
  ตัวอย่าง: db,
  "ยังไม่มี Invoice": freeOrderDb,
  "ชำระก่อนมี Invoice": paidWithoutInvoiceDb,
  ค่ารมรอชำระ: acceptedInvoiceDb,
  ชำระแล้ว: paidDb,
});

/** เลือกสถานะใน Controls:
 *  - ตัวอย่าง: the seven-day demo run.
 *  - หลาย PO: "คงเหลือส่ง Chef House", PO 1,000 kg with 400 sent shows 600; the others
 *    show all of theirs.
 *  - เก็บไว้ให้ Owner: "เก็บไว้ให้ Owner คงเหลือ", Foodiva kept 10 kg for the Owner, who
 *    took 4 → 6 kg left; "คงเหลือส่ง Chef House" still counts from the 90 kg ready for
 *    Chiang Mai. */
export const PurchaseOrders: Story = {
  argTypes: { db: purchaseState.argType },
  args: { db: purchaseState.initial },
  render: ({ db }) => <PurchaseOrderView db={db} open={open} />,
};

/** "+ ออก PO รมควันเนื้อ" above the table is always live and opens the form on a new
 *  batch; a row with no smoke PO opens it on that batch. เลือกสถานะใน Controls:
 *  - ตัวอย่าง: the seven-day demo run.
 *  - ชุดที่ Foodiva เปิด: Foodiva trucked a batch with its Packing List before any smoke
 *    PO; the row's button issues the PO on that batch.
 *  - PO ไม่มี Packing List: a smoke PO citing two uninvoiced purchase POs (300 + 200 kg),
 *    "ยังไม่มี Packing List" and its "ยังไม่ได้จด" chips.
 *  - หลาย PO: one batch drawing on three purchase POs (kg each and what each has left),
 *    next to a trucked batch with no Packing List yet. */
export const SmokingPurchaseOrders: Story = {
  argTypes: { db: smokeState.argType },
  args: { db: smokeState.initial },
  render: ({ db }) => <SmokingPurchaseOrderView db={db} open={open} />,
};

/** The last column is the batch's "ยังไม่ได้จด" chips plus the Owner's own buttons, never
 *  disabled and all in one style, recorded or not: "ออก PO รมควันเนื้อ", "เรียกรถขากลับ".
 *  เลือกสถานะใน Controls:
 *  - ตัวอย่าง: the seven-day demo run.
 *  - PO ยังไม่มีใบขนส่ง: a smoke PO with no transport document, Packing List or Chef House
 *    weigh-in; the truck home can still be booked.
 *  - รอ Foodiva: a 50 kg smoke PO waiting for Foodiva's transport document.
 *  - Packing List ต่ำกว่า PO: PO 1,500 kg, Packing List 70 kg, Chef House 69 kg; the
 *    comparison runs on the Packing List (gap −1 kg) and the PO kg shows on its own line.
 *  - ขากลับ: return leg, Chef House sent 36 kg, Foodiva received 35.5 kg, with the gap
 *    badge. */
export const TransportManifest: Story = {
  argTypes: { db: manifestState.argType },
  args: { db: manifestState.initial },
  render: ({ db }) => <TransportManifestView db={db} open={open} />,
};

/** The return-trip tab: every batch with no truck home yet (RET-06). เลือกสถานะใน Controls:
 *  - ปิด Lot แล้ว: Chef House closed the lot; the button opens the same `return` dialog
 *    the manifest opens.
 *  - ยังไม่ปิด Lot: a batch not smoked yet still has its button, the "ยังไม่ได้จด" column
 *    lists สโมค and ปิด Lot.
 *  - รถออกแล้ว: nothing to book, the truck home is already on the road. */
export const ReturnShipment: Story = {
  argTypes: { db: returnState.argType },
  args: { db: returnState.initial },
  render: ({ db }) => <ReturnShipmentView db={db} open={open} />,
};

/** Paying never waits for the invoice (PO-07, SVC-05). เลือกสถานะใน Controls:
 *  - ตัวอย่าง: the seven-day demo run.
 *  - ยังไม่มี Invoice: two purchase POs and one batch with no invoice, each a row with a
 *    "ยังไม่มี Invoice" badge and a live "ชำระเงิน".
 *  - ชำระก่อนมี Invoice: the 300 kg PO paid before Foodiva invoiced it (ชำระแล้ว).
 *  - ค่ารมรอชำระ: an accepted smoking invoice waiting to be paid.
 *  - ชำระแล้ว: both paid, the สลิป column lists each slip with view and download. */
export const Invoices: Story = {
  argTypes: { db: invoiceState.argType },
  args: { db: invoiceState.initial },
  render: ({ db }) => <InvoiceView db={db} open={open} />,
};

const workflowState = pick("ชุด", {
  "PO รมควันรอ Foodiva": dispatchDb,
  "Foodiva เปิดชุด ยังไม่มี PO": packedDb,
  "ปิด Lot แล้ว": closedDb,
});

/** The latest batch's "ยังไม่ได้จด" chips and the Owner's buttons, which stay live and
 *  look the same whatever is recorded. เลือกชุดใน Controls:
 *  - PO รมควันรอ Foodiva: a smoke PO still waiting for Foodiva's transport document.
 *  - Foodiva เปิดชุด ยังไม่มี PO: Foodiva trucked a batch before any smoke PO.
 *  - ปิด Lot แล้ว: Chef House closed the lot. */
export const WorkflowAction: Story = {
  argTypes: { db: workflowState.argType },
  args: { db: workflowState.initial },
  render: ({ db }) => (
    <LotWorkflowAction db={db} lot={db.lots.at(-1)!} open={open} />
  ),
};

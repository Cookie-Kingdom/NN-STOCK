import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  closedDb,
  demoDb,
  dispatchDb,
  multiPoDb,
  multiPoPackedDb,
  open,
  ownerReservedDb,
  packedDb,
  packingShortDb,
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
  "มี Packing List": packedDb,
  "รอ Packing List": dispatchDb,
  "หลาย PO": multiPoPackedDb,
});
const manifestState = pick("สถานะ", {
  ตัวอย่าง: db,
  "รอ Foodiva": dispatchDb,
  "Packing List ต่ำกว่า Request": packingShortDb,
  ขากลับ: returnGapDb,
});
const returnState = pick("สถานะ", {
  รอจองรถ: closedDb,
  รถออกแล้ว: returnTruckDb,
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

/** เลือกสถานะใน Controls:
 *  - ตัวอย่าง: the seven-day demo run.
 *  - มี Packing List: the create button is live and the quantity is the Packing List total.
 *  - รอ Packing List: Request still waiting for Foodiva, the create button is disabled
 *    with its reason.
 *  - หลาย PO: one shipment drawing on three purchase POs (kg each and what each has
 *    left), next to a trucked shipment with no Packing List yet. */
export const SmokingPurchaseOrders: Story = {
  argTypes: { db: smokeState.argType },
  args: { db: smokeState.initial },
  render: ({ db }) => <SmokingPurchaseOrderView db={db} open={open} />,
};

/** เลือกสถานะใน Controls:
 *  - ตัวอย่าง: the seven-day demo run.
 *  - รอ Foodiva: a Request waiting for Foodiva's transport document, no outbound button
 *    for the Owner, only "แก้ไข Request" (A10), which disappears once Foodiva makes the
 *    manifest.
 *  - Packing List ต่ำกว่า Request: Request 1,500 kg, Packing List 70 kg, Chef House
 *    69 kg; the comparison runs on the Packing List (gap −1 kg) and the Request kg shows
 *    on its own line.
 *  - ขากลับ: return leg, Chef House sent 36 kg, Foodiva received 35.5 kg, with the gap
 *    badge. */
export const TransportManifest: Story = {
  argTypes: { db: manifestState.argType },
  args: { db: manifestState.initial },
  render: ({ db }) => (
    <TransportManifestView db={db} open={open} onOpenSmokePo={fn()} />
  ),
};

/** The return-trip tab. เลือกสถานะใน Controls:
 *  - รอจองรถ: Chef House closed the lot, so the Owner books the truck home. The button
 *    opens the same `return` dialog the manifest's workflow action opens.
 *  - รถออกแล้ว: nothing to book, the truck home is already on the road, waiting for
 *    Foodiva. */
export const ReturnShipment: Story = {
  argTypes: { db: returnState.argType },
  args: { db: returnState.initial },
  render: ({ db }) => <ReturnShipmentView db={db} open={open} />,
};

export const Invoices: Story = {
  render: () => <InvoiceView db={db} open={open} />,
};

/** Stage 1 (waiting for Foodiva, Request still editable) and a trucked shipment with its Packing List (go to the smoke PO). */
export const WorkflowAction: Story = {
  parameters: { db: dispatchDb },
  render: () => (
    <div className="flex gap-6">
      <LotWorkflowAction
        db={dispatchDb}
        lot={dispatchDb.lots.at(-1)!}
        open={open}
        onOpenSmokePo={fn()}
      />
      <LotWorkflowAction
        db={packedDb}
        lot={packedDb.lots.at(-1)!}
        open={open}
        onOpenSmokePo={fn()}
      />
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  demoDb,
  dispatchDb,
  multiPoDb,
  multiPoPackedDb,
  open,
  packedDb,
  packingShortDb,
  returnGapDb,
} from "../../../../.storybook/fixtures";
import { InvoiceView } from "./InvoiceView";
import { LotWorkflowAction } from "./LotWorkflowAction";
import { PurchaseOrderView } from "./PurchaseOrderView";
import { SmokingPurchaseOrderView } from "./SmokingPurchaseOrderView";
import { TransportManifestView } from "./TransportManifestView";

const db = demoDb;

const meta: Meta = {
  title: "Organisms/Owner Documents",
  parameters: { db },
};

export default meta;
type Story = StoryObj;

export const PurchaseOrders: Story = {
  render: () => <PurchaseOrderView db={db} open={open} />,
};

/** "คงเหลือส่ง Chef House": PO 1,000 kg with 400 sent shows 600; the others show all of theirs. */
export const PurchaseOrdersRemaining: Story = {
  parameters: { db: multiPoDb },
  render: () => <PurchaseOrderView db={multiPoDb} open={open} />,
};

export const SmokingPurchaseOrders: Story = {
  render: () => <SmokingPurchaseOrderView db={db} open={open} />,
};

/** Packing List in: the create button is live and the quantity is the Packing List total. */
export const SmokingPurchaseOrdersPacked: Story = {
  parameters: { db: packedDb },
  render: () => <SmokingPurchaseOrderView db={packedDb} open={open} />,
};

/** Request still waiting for Foodiva: the create button is disabled with its reason. */
export const SmokingPurchaseOrdersAwaitingPackingList: Story = {
  parameters: { db: dispatchDb },
  render: () => <SmokingPurchaseOrderView db={dispatchDb} open={open} />,
};

/** One shipment drawing on three purchase POs (kg each and what each has left), next to
 * a trucked shipment with no Packing List yet. */
export const SmokingPurchaseOrdersMultiPo: Story = {
  parameters: { db: multiPoPackedDb },
  render: () => <SmokingPurchaseOrderView db={multiPoPackedDb} open={open} />,
};

export const TransportManifest: Story = {
  render: () => (
    <TransportManifestView db={db} open={open} onOpenSmokePo={fn()} />
  ),
};

/** A Request waiting for Foodiva's transport document: no outbound button for the Owner. */
export const TransportManifestAwaitingFoodiva: Story = {
  parameters: { db: dispatchDb },
  render: () => (
    <TransportManifestView db={dispatchDb} open={open} onOpenSmokePo={fn()} />
  ),
};

/** Request 1,500 kg, Packing List 70 kg, Chef House 69 kg: the comparison runs on the
 *  Packing List (gap −1 kg) and the Request kg shows on its own line. */
export const TransportManifestPackingListBelowRequest: Story = {
  parameters: { db: packingShortDb },
  render: () => (
    <TransportManifestView
      db={packingShortDb}
      open={open}
      onOpenSmokePo={fn()}
    />
  ),
};

/** Return leg: Chef House sent 36 kg, Foodiva received 35.5 kg, with the gap badge. */
export const TransportManifestReturnLeg: Story = {
  parameters: { db: returnGapDb },
  render: () => (
    <TransportManifestView db={returnGapDb} open={open} onOpenSmokePo={fn()} />
  ),
};

export const Invoices: Story = {
  render: () => <InvoiceView db={db} open={open} />,
};

/** Stage 1 (waiting for Foodiva) and a trucked shipment with its Packing List (go to the smoke PO). */
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

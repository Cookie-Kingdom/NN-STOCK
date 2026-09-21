import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  demoDb,
  dispatchDb,
  multiPoDb,
  open,
  packedDb,
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

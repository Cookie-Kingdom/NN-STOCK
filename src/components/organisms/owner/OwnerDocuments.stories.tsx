import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  demoDb,
  dispatchDb,
  multiPoPackedDb,
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
  render: () => <PurchaseOrderView db={db} open={open} onOpenSmokePo={fn()} />,
};

export const PurchaseOrdersAwaitingDispatch: Story = {
  parameters: { db: dispatchDb },
  render: () => (
    <PurchaseOrderView db={dispatchDb} open={open} onOpenSmokePo={fn()} />
  ),
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
  render: () => <TransportManifestView db={db} open={open} />,
};

export const Invoices: Story = {
  render: () => <InvoiceView db={db} open={open} />,
};

export const WorkflowAction: Story = {
  parameters: { db: dispatchDb },
  render: () => (
    <div className="flex gap-6">
      <LotWorkflowAction
        db={dispatchDb}
        lot={dispatchDb.lots[0]}
        context="purchase-order"
        open={open}
        onOpenSmokePo={fn()}
      />
      <LotWorkflowAction
        db={dispatchDb}
        lot={dispatchDb.lots[0]}
        context="transport"
        open={open}
      />
    </div>
  ),
};

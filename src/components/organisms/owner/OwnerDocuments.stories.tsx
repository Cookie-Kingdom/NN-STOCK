import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { demoDb, dispatchDb, open } from "../../../../.storybook/fixtures";
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

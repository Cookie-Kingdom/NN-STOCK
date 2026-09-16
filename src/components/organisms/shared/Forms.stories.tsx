import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  centralDb,
  day,
  demoDb,
  dispatchDb,
  smokedDb,
} from "../../../../.storybook/fixtures";
import { ChefLotEditForm } from "@/components/organisms/chef/ChefLotEditForm";
import { SmokeOrderPreviewDialog } from "@/components/organisms/chef/SmokeOrderPreviewDialog";
import { ResetDataDialog } from "@/components/organisms/owner/ResetDataDialog";
import { BagAllocationForm } from "./BagAllocationForm";
import { EntryForm } from "./EntryForm";
import { GeneralPurchaseForm } from "./GeneralPurchaseForm";
import { MaterialPurchaseForm } from "./MaterialPurchaseForm";
import { MaterialTransferForm } from "./MaterialTransferForm";

// Every story opens a native modal <dialog>; a Docs page would stack them all.
// Saves go through the mocked persistence and appear in the Actions panel.
const meta: Meta = {
  title: "Organisms/Forms",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

const onClose = fn();
const onSaved = fn();

export const OwnerPurchase: Story = {
  parameters: { db: demoDb },
  render: () => (
    <EntryForm
      db={demoDb}
      role="owner"
      branch=""
      date={day}
      modal={{ kind: "purchase", lotId: "" }}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
};

// Below lg the form and the PO preview stack in one scroll area.
export const OwnerPurchaseMobile: Story = {
  ...OwnerPurchase,
  globals: { viewport: { value: "mobile2", isRotated: false } },
};

export const OwnerPurchaseTablet: Story = {
  ...OwnerPurchase,
  globals: { viewport: { value: "tablet", isRotated: false } },
};

export const OwnerDispatch: Story = {
  parameters: { db: dispatchDb },
  render: () => (
    <EntryForm
      db={dispatchDb}
      role="owner"
      branch=""
      date={day}
      modal={{ kind: "dispatch", lotId: dispatchDb.lots[0].id }}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
};

export const OwnerReturn: Story = {
  parameters: { db: smokedDb },
  render: () => (
    <EntryForm
      db={smokedDb}
      role="owner"
      branch=""
      date={day}
      modal={{ kind: "return", lotId: smokedDb.lots[0].id }}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
};

export const BranchSale: Story = {
  parameters: { db: demoDb },
  render: () => (
    <EntryForm
      db={demoDb}
      role="branch"
      branch="ศาลาแดง"
      date={day}
      modal={{ kind: "sale", lotId: demoDb.lots[0].id }}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
};

export const BranchInfluencerBox: Story = {
  parameters: { db: demoDb },
  render: () => (
    <EntryForm
      db={demoDb}
      role="branch"
      branch="ศาลาแดง"
      date={day}
      modal={{ kind: "influencerBox", lotId: demoDb.lots[0].id }}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
};

export const BranchInfluencerBoxMobile: Story = {
  ...BranchInfluencerBox,
  globals: { viewport: { value: "mobile2", isRotated: false } },
};

export const BagAllocation: Story = {
  parameters: { db: centralDb },
  render: () => (
    <BagAllocationForm
      db={centralDb}
      lotId={centralDb.lots[0].id}
      date={day}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
};

export const MaterialPurchase: Story = {
  parameters: { db: demoDb },
  render: () => (
    <MaterialPurchaseForm
      db={demoDb}
      date={day}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
};

export const MaterialTransfer: Story = {
  parameters: { db: demoDb },
  render: () => (
    <MaterialTransferForm
      db={demoDb}
      date={day}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
};

export const GeneralPurchase: Story = {
  parameters: { db: demoDb },
  render: () => (
    <GeneralPurchaseForm date={day} onClose={onClose} onSaved={onSaved} />
  ),
};

export const ChefLotEdit: Story = {
  parameters: { db: smokedDb },
  render: () => (
    <ChefLotEditForm
      db={smokedDb}
      lotId={smokedDb.lots[0].id}
      date={day}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
};

export const SmokeOrderPreview: Story = {
  parameters: { db: demoDb },
  render: () => (
    <SmokeOrderPreviewDialog
      db={demoDb}
      lotId={demoDb.lots[0].id}
      onClose={onClose}
    />
  ),
};

export const ResetData: Story = {
  parameters: { db: demoDb },
  render: () => <ResetDataDialog date={day} onClose={onClose} onDone={fn()} />,
};

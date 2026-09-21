import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  centralDb,
  day,
  demoDb,
  dispatchDb,
  rejectedInvoiceDb,
  smokedDb,
} from "../../../../.storybook/fixtures";
import { ChefLotEditForm } from "@/components/organisms/chef/ChefLotEditForm";
import { SmokeOrderPreviewDialog } from "@/components/organisms/chef/SmokeOrderPreviewDialog";
import { BagAllocationForm } from "./BagAllocationForm";
import { EntryForm } from "./EntryForm";
import { GeneralPurchaseForm } from "./GeneralPurchaseForm";
import { MaterialPurchaseForm } from "./MaterialPurchaseForm";
import { MaterialTransferForm } from "./MaterialTransferForm";
import { today } from "@/lib/format";
import { visibleDatabase } from "@/lib/store";

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
// The working date lives in the workspace; the date field reports changes here.
const onDate = fn();

export const OwnerPurchase: Story = {
  parameters: { db: demoDb },
  render: () => (
    <EntryForm
      db={demoDb}
      role="owner"
      branch=""
      date={day}
      onDate={onDate}
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
      onDate={onDate}
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
      onDate={onDate}
      modal={{ kind: "return", lotId: smokedDb.lots[0].id }}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
};

// Edit starts from the saved invoice (28 / 2, number, date, file), not the PO.
export const FoodivaInvoiceEdit: Story = {
  parameters: { db: rejectedInvoiceDb },
  render: () => (
    <EntryForm
      db={rejectedInvoiceDb}
      role="foodiva"
      branch=""
      date={day}
      onDate={onDate}
      modal={{ kind: "foodivaConfirm", lotId: rejectedInvoiceDb.lots[0].id }}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
};

// Sent back by the Owner: the note is shown and the amount comes from the smoke PO.
export const ChefInvoiceSentBack: Story = {
  parameters: { db: rejectedInvoiceDb },
  render: () => (
    <EntryForm
      db={rejectedInvoiceDb}
      role="cm"
      branch=""
      date={day}
      onDate={onDate}
      modal={{ kind: "smokingInvoice", lotId: rejectedInvoiceDb.lots[0].id }}
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
      onDate={onDate}
      modal={{ kind: "sale", lotId: demoDb.lots[0].id }}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
};

// `day` is in the past, so the stories above show the "บันทึกย้อนหลัง" badge; today does not.
export const BranchSaleToday: Story = {
  parameters: { db: demoDb },
  render: () => (
    <EntryForm
      db={demoDb}
      role="branch"
      branch="ศาลาแดง"
      date={today()}
      onDate={onDate}
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
      onDate={onDate}
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
      onDate={onDate}
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
      onDate={onDate}
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
      onDate={onDate}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
};

export const GeneralPurchase: Story = {
  parameters: { db: demoDb },
  render: () => (
    <GeneralPurchaseForm
      date={day}
      onDate={onDate}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
};

/** Before closing, Chef House can still correct the yellow cells of the Packing List. */
export const ChefLotEdit: Story = {
  parameters: { db: smokedDb },
  render: () => (
    <ChefLotEditForm
      db={visibleDatabase(smokedDb, "cm")}
      lotId={smokedDb.lots.at(-1)!.id}
      date={day}
      onDate={onDate}
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

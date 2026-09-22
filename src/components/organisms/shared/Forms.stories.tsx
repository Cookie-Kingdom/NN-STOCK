import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "storybook/test";
import {
  allocatedDb,
  centralDb,
  chillDb,
  day,
  demoDb,
  multiPoPackedDb,
  nextDay,
  rejectedInvoiceDb,
  smokedDb,
} from "../../../../.storybook/fixtures";
import { mutate, visibleDatabase } from "@/lib/store";
import { ChefLotEditForm } from "@/components/organisms/chef/ChefLotEditForm";
import { SmokeOrderPreviewDialog } from "@/components/organisms/chef/SmokeOrderPreviewDialog";
import { AllocationForm } from "./AllocationForm";
import { EntryForm } from "./EntryForm";
import { GeneralPurchaseForm } from "./GeneralPurchaseForm";
import { MaterialPurchaseForm } from "./MaterialPurchaseForm";
import { MaterialTransferForm } from "./MaterialTransferForm";
import { today } from "@/lib/format";

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

// Sent back by the Owner: the note is shown and the amount starts at the sent-back invoice's,
// editable by Chef House (A7).
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

/** Owner types kg per branch; `ที่เหลือทั้งหมด` fills the exact rest of central stock. */
export const Allocation: Story = {
  parameters: { db: centralDb },
  render: () => (
    <AllocationForm
      db={centralDb}
      lotId={centralDb.lots.at(-1)!.id}
      date={day}
      onDate={onDate}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
};

/** A lot already partly sent to ศาลาแดง: only the rest of central stock is offered. */
export const AllocationPartlyAllocated: Story = {
  parameters: { db: allocatedDb },
  render: () => (
    <AllocationForm
      db={allocatedDb}
      lotId={allocatedDb.lots.at(-1)!.id}
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

/** Before closing, Chef House can still correct arrival, pre-smoke kg and the smoke log.
 *  The yellow cells are not here: they are weighed once at cmReceive (A5). */
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

/* The smoke PO of a shipment drawn from three purchase POs, as Chef House's workspace
 * reads it (visibleDatabase): shipment number and Packing List, no purchase PO or meat price. */
const chefSmokeDb = visibleDatabase(
  mutate(
    multiPoPackedDb,
    "owner",
    "smokeOrder",
    { smoker: "Chef House", requestedSmokeDate: day },
    multiPoPackedDb.lots.at(-1)!.id,
    day,
  ),
  "cm",
);

export const SmokeOrderPreview: Story = {
  parameters: { db: chefSmokeDb },
  render: () => (
    <SmokeOrderPreviewDialog
      db={chefSmokeDb}
      lotId={chefSmokeDb.lots[0].id}
      onClose={onClose}
    />
  ),
};

/** 95 g per pack: the form warns, but the sale still saves (no FormError). */
export const BranchSalePackWeightWarning: Story = {
  parameters: { db: chillDb },
  render: () => (
    <EntryForm
      db={chillDb}
      role="branch"
      branch="ศาลาแดง"
      date={nextDay}
      onDate={onDate}
      modal={{ kind: "sale", lotId: chillDb.lots.at(-1)!.id }}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
  play: async ({ canvasElement }) => {
    const form = within(canvasElement.ownerDocument.body);
    const addons = form.getByLabelText(/เนื้อซีล Add-on/);
    await userEvent.clear(addons);
    await userEvent.type(addons, "10");
    await userEvent.type(
      form.getByLabelText(/น้ำหนักที่ใช้ไปจริงวันนี้/),
      "0.95",
    );
  },
};

/** Close dialog with 4.5 kg left: shown as คงเหลือชิล, no "use it all" error. */
export const BranchCloseDayWithChill: Story = {
  parameters: { db: chillDb },
  render: () => (
    <EntryForm
      db={chillDb}
      role="branch"
      branch="ศาลาแดง"
      date={day}
      onDate={onDate}
      modal={{ kind: "closeDay", lotId: "" }}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
};

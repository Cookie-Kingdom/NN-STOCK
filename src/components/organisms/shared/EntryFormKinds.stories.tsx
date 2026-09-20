import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  acceptedInvoiceDb,
  allocatedDb,
  cmReceivedDb,
  confirmedDb,
  day,
  demoDb,
  dispatchedDb,
  preparedDb,
  returnTruckDb,
  returnedDb,
  smokeOrderDb,
  smokedDb,
  submittedInvoiceDb,
} from "../../../../.storybook/fixtures";
import { EntryForm } from "./EntryForm";
import type { Database, Role } from "@/lib/store";

// One story per `titles` kind that EntryForm renders, on top of the kinds already
// covered by Forms.stories.tsx. Every story opens a native modal <dialog>, so a
// Docs page would stack them all — hence `!autodocs`.
const meta: Meta = {
  title: "Organisms/Entry Forms",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

const onClose = fn();
const onSaved = fn();
// The working date lives in the workspace; the date field reports changes here.
const onDate = fn();

/** A story that opens `kind` for `role` on the first lot of `db`. */
const form = (
  db: Database,
  role: Role,
  kind: string,
  branch = "",
  lotId = db.lots[0]?.id ?? "",
): Story => ({
  parameters: { db },
  render: () => (
    <EntryForm
      db={db}
      role={role}
      branch={branch}
      date={day}
      onDate={onDate}
      modal={{ kind, lotId }}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
});

// --- Owner ---------------------------------------------------------------

/** PO for the smoking service, priced from the kg Foodiva confirmed. */
export const OwnerSmokeOrder: Story = form(confirmedDb, "owner", "smokeOrder");

/** The Owner checks Chef_house's submitted bill and accepts or sends it back. */
export const OwnerInvoiceReview: Story = form(
  submittedInvoiceDb,
  "owner",
  "invoiceReview",
);

/** Payment of an already accepted bill; the amount is prefilled from the invoice. */
export const OwnerInvoicePayment: Story = form(
  acceptedInvoiceDb,
  "owner",
  "invoicePayment",
);

/** Weighing the smoked meat into central stock after Foodiva received it back. */
export const OwnerCentral: Story = form(returnedDb, "owner", "central");

/** Chili tubes go to a branch straight from the Owner's stock, no lot involved. */
export const OwnerChiliAllocate: Story = form(demoDb, "owner", "chiliAllocate");

// --- Chef_house ----------------------------------------------------------

/** Chef_house accepts the smoke PO before the meat is trucked up. */
export const ChefSmokeOrderAccept: Story = form(
  smokeOrderDb,
  "cm",
  "smokeOrderAccept",
);

/** Weigh-in on arrival; the scale reading stays blank so the variance is real. */
export const ChefReceive: Story = form(dispatchedDb, "cm", "cmReceive");

/** Weight after trimming and blotting, just before the smoker. */
export const ChefPrepare: Story = form(cmReceivedDb, "cm", "prepare");

/** One smoke round per save, with the per-pack weights entered below the fields. */
export const ChefSmoke: Story = form(preparedDb, "cm", "smoke");

/** Closing the lot freezes the yield and hands it back to the Owner. */
export const ChefCloseLot: Story = form(smokedDb, "cm", "closeLot");

// --- Foodiva -------------------------------------------------------------

/** Foodiva counts the returning bags into its freezer; the bag count is prefilled. */
export const FoodivaReturnReceive: Story = form(
  returnTruckDb,
  "foodiva",
  "foodivaReturnReceive",
);

// --- Branch --------------------------------------------------------------

/** The branch picks the outstanding allocation; the bag count follows it. */
export const BranchReceive: Story = form(
  allocatedDb,
  "branch",
  "receive",
  "ศาลาแดง",
);

/** Moving frozen bags to ready-to-sell stock. */
export const BranchThaw: Story = form(demoDb, "branch", "thaw", "ศาลาแดง");

/** Raw rice for ศาลาแดง, which cooks its own. */
export const BranchRicePurchase: Story = form(
  demoDb,
  "branch",
  "ricePurchase",
  "ศาลาแดง",
);

/** มีนบุรี buys rice already cooked, so the form swaps to the cooked-rice fields. */
export const BranchRicePurchaseMinburi: Story = form(
  demoDb,
  "branch",
  "ricePurchase",
  "มีนบุรี",
);

export const BranchChiliPurchase: Story = form(
  demoDb,
  "branch",
  "chiliPurchase",
  "ศาลาแดง",
);

/** The older combined form: rice and chili bought on one receipt. */
export const BranchSupplyPurchase: Story = form(
  demoDb,
  "branch",
  "supplyPurchase",
  "ศาลาแดง",
);

/** The older combined form: rice and chili issued together. */
export const BranchSupplyIssue: Story = form(
  demoDb,
  "branch",
  "supplyIssue",
  "ศาลาแดง",
);

export const BranchRiceIssue: Story = form(
  demoDb,
  "branch",
  "riceIssue",
  "ศาลาแดง",
);

export const BranchChiliIssue: Story = form(
  demoDb,
  "branch",
  "chiliIssue",
  "ศาลาแดง",
);

/** Morning cook: raw rice in, cooked rice out. */
export const BranchRice: Story = form(demoDb, "branch", "rice", "ศาลาแดง");

/** End of day at มีนบุรี: what is left of the cooked rice and whether it is reheated. */
export const BranchRiceCarry: Story = form(
  demoDb,
  "branch",
  "riceCarry",
  "มีนบุรี",
);

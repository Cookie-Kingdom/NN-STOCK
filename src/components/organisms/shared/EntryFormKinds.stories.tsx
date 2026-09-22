import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "storybook/test";
import {
  acceptedInvoiceDb,
  allocatedDb,
  chillDb,
  closedDb,
  cmReceivedDb,
  day,
  confirmedDb,
  demoDb,
  expenseDb,
  multiPoPackedDb,
  nextInvoiceDb,
  ownerReservedDb,
  packedDb,
  preparedDb,
  returnTruckDb,
  returnedDb,
  smokeOrderDb,
  smokedDb,
  submittedInvoiceDb,
} from "../../../../.storybook/fixtures";
import { EntryForm } from "./EntryForm";
import { riceSources, type Database, type Role } from "@/lib/store";

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

/** A story that opens `kind` for `role` on the newest lot of `db` (the shipment, when there is one). */
const form = (
  db: Database,
  role: Role,
  kind: string,
  branch = "",
  lotId = db.lots.at(-1)?.id ?? "",
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

/** PO for the smoking service: the kg is pre-filled from the Packing List total and editable
 *  (A6); the rate follows the kg entered. */
export const OwnerSmokeOrder: Story = form(
  packedDb,
  "owner",
  "smokeOrder",
  "",
  packedDb.lots.at(-1)!.id,
);

/** One smoke PO for a shipment drawn from three purchase POs (1,390 kg Packing List). */
export const OwnerSmokeOrderMultiPo: Story = form(
  multiPoPackedDb,
  "owner",
  "smokeOrder",
  "",
  multiPoPackedDb.lots.at(-1)!.id,
);

/** The Owner checks Chef House's submitted bill and accepts or sends it back. */
export const OwnerInvoiceReview: Story = form(
  submittedInvoiceDb,
  "owner",
  "invoiceReview",
);

/** Payment of an already accepted bill; the amount is prefilled from the invoice, slips optional. */
export const OwnerInvoicePayment: Story = form(
  acceptedInvoiceDb,
  "owner",
  "invoicePayment",
);

/** Paying Foodiva's meat invoice on the purchase PO; amount prefilled, slips optional. */
export const OwnerMeatPayment: Story = form(
  confirmedDb,
  "owner",
  "meatPayment",
);

/** Weighing the smoked meat into central stock after Foodiva received it back. */
export const OwnerCentral: Story = form(returnedDb, "owner", "central");

/** Chili tubes go to a branch straight from the Owner's stock, no lot involved. The tubes
 *  start at what tops the branch up to its par (capped at the Owner's stock) and the
 *  receiver at the last one for that branch. */
export const OwnerChiliAllocate: Story = form(demoDb, "owner", "chiliAllocate");

/** Switching the branch refills the untouched tubes and receiver for มีนบุรี. */
export const OwnerChiliAllocateMinburi: Story = {
  ...OwnerChiliAllocate,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.selectOptions(
      body.getByLabelText(/สาขาปลายทาง/),
      "มีนบุรี",
    );
  },
};

/** A new purchase PO starts from the last one: pack size, product, kg and price (captioned
 *  "จาก PO-…"); the vendor reference stays blank. */
export const OwnerPurchaseFromLastPo: Story = form(
  confirmedDb,
  "owner",
  "purchase",
  "",
  "",
);

/** A8 — the Owner picks up the meat Foodiva kept: 6 kg still outstanding, prefilled as an
 *  expected weight to check on the scale; the receiver carries from the last pick-up. */
export const OwnerWasteReceive: Story = form(
  ownerReservedDb,
  "owner",
  "ownerWasteReceive",
  "",
  ownerReservedDb.lots[0].id,
);

/** An expense starts on the last category and payer, and that category's last amount. */
export const OwnerExpense: Story = form(expenseDb, "owner", "expense");

/** Picking another category refills the untouched amount with that category's last one. */
export const OwnerExpenseOtherCategory: Story = {
  ...OwnerExpense,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.selectOptions(
      body.getByLabelText(/หมวดค่าใช้จ่าย/),
      "ค่าเช่า",
    );
  },
};

/** The Owner reopens a closed branch day; the reason is always typed. */
export const OwnerUnlock: Story = form(demoDb, "owner", "unlock");

// --- Chef House ----------------------------------------------------------

/** Chef House accepts the smoke PO before the meat is trucked up. */
export const ChefSmokeOrderAccept: Story = form(
  smokeOrderDb,
  "cm",
  "smokeOrderAccept",
);

/** Weight after trimming and blotting, just before the smoker. */
export const ChefPrepare: Story = form(cmReceivedDb, "cm", "prepare");

/** One smoke round per save, with the per-pack weights entered below the fields. */
export const ChefSmoke: Story = form(preparedDb, "cm", "smoke");

/** Closing the lot freezes the yield and hands it back to the Owner. */
export const ChefCloseLot: Story = form(smokedDb, "cm", "closeLot");

/** After close Chef House bills the smoking itself: invoice number, file (required) and an
 *  amount pre-filled from smoke PO kg × rate that Chef House may change (A7). */
export const ChefSmokingInvoice: Story = form(closedDb, "cm", "smokingInvoice");

// --- Foodiva -------------------------------------------------------------

/** A new meat invoice: the number follows the last one (INV-1 → INV-2) and the confirmer
 *  carries; the weights start from the PO as expected values. */
export const FoodivaConfirmNew: Story = form(
  nextInvoiceDb,
  "foodiva",
  "foodivaConfirm",
  "",
  nextInvoiceDb.lots.at(-1)!.id,
);

/** Foodiva counts the returning bags into its freezer; the bag count and kg start from
 *  the return truck (expected), the time from now. */
export const FoodivaReturnReceive: Story = form(
  returnTruckDb,
  "foodiva",
  "foodivaReturnReceive",
);

// --- Branch --------------------------------------------------------------

/** The only outstanding allocation is picked and its kg prefilled (expected); "รับครบใบจัดสรรนี้แล้ว" (on by default) closes it.
 *  The Lot option reads ส่งมา / รับแล้ว / ค้างรับ, not the 0.00 frozen/chill stock. */
export const BranchReceive: Story = form(
  allocatedDb,
  "branch",
  "receive",
  "ศาลาแดง",
);

/** Moving frozen stock to ready-to-sell stock: the oldest frozen lot (FIFO), and the
 *  last thaw's kg within its frozen stock, marked expected. */
export const BranchThaw: Story = form(demoDb, "branch", "thaw", "ศาลาแดง");

/** Only the kg typed, over the frozen stock: the error (with the most allowed) shows at
 *  once and บันทึกรายการ is disabled, although the other fields are still empty. */
export const BranchThawOverStock: Story = {
  ...BranchThaw,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.type(body.getByLabelText(/น้ำหนักละลาย/), "99999");
  },
};

/** Raw rice withdrawn over stock: red error at once, save disabled. */
export const BranchRiceIssueOverStock: Story = {
  ...form(demoDb, "branch", "riceIssue", "ศาลาแดง"),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.type(body.getByLabelText(/ข้าวเหนียวดิบที่เบิก/), "99999");
  },
};

/** Rice purchase with the round's source picked: the fields follow the pick, not the branch. */
const ricePurchase = (branch: string, source: string): Story => ({
  ...form(demoDb, "branch", "ricePurchase", branch),
  play: async ({ canvasElement }) => {
    await userEvent.selectOptions(
      within(canvasElement).getByLabelText(/ข้าวเหนียวมาจาก/),
      source,
    );
  },
});

/** Opens on the branch's last source (captioned), its supplier, the kg that tops the stock
 *  up to par and that kg × the unit price. */
export const BranchRicePurchase: Story = form(
  demoDb,
  "branch",
  "ricePurchase",
  "ศาลาแดง",
);

export const BranchRicePurchaseSelfCook = ricePurchase(
  "ศาลาแดง",
  riceSources[0],
);

export const BranchRicePurchaseBoughtCooked = ricePurchase(
  "ศาลาแดง",
  riceSources[1],
);

export const BranchRicePurchaseMinburiSelfCook = ricePurchase(
  "มีนบุรี",
  riceSources[0],
);

/** Bought cooked: the cooked-rice par shows as a hint, it never blocks the save. */
export const BranchRicePurchaseMinburiBoughtCooked = ricePurchase(
  "มีนบุรี",
  riceSources[1],
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

export const BranchRiceIssueMinburi: Story = form(
  demoDb,
  "branch",
  "riceIssue",
  "มีนบุรี",
);

export const BranchChiliIssue: Story = form(
  demoDb,
  "branch",
  "chiliIssue",
  "ศาลาแดง",
);

/** A filled withdrawal: ตรวจสอบก่อนบันทึก shows what is taken, stock now and stock after. */
const issueFilled = (
  kind: string,
  branch: string,
  typed: [RegExp, string][],
): Story => ({
  ...form(demoDb, "branch", kind, branch),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    for (const [label, value] of typed) {
      const field = body.getByLabelText(label);
      await userEvent.clear(field);
      await userEvent.type(field, value);
    }
  },
});

export const BranchRiceIssueFilled = issueFilled("riceIssue", "ศาลาแดง", [
  [/ข้าวเหนียวดิบที่เบิก/, "2"],
  [/ผู้รับของ/, "ครัวศาลาแดง"],
]);

export const BranchChiliIssueFilled = issueFilled("chiliIssue", "ศาลาแดง", [
  [/น้ำพริกที่เบิก/, "3"],
  [/ผู้รับของ/, "ครัวศาลาแดง"],
]);

export const BranchSupplyIssueFilled = issueFilled("supplyIssue", "ศาลาแดง", [
  [/ข้าวเหนียวดิบที่เบิก/, "2"],
  [/น้ำพริกที่เบิก/, "3"],
  [/ผู้รับของ/, "ครัวศาลาแดง"],
]);

/** Morning cook: raw rice in, cooked rice out. Cooked may weigh more than raw. */
export const BranchRice: Story = form(demoDb, "branch", "rice", "ศาลาแดง");

export const BranchRiceMinburi: Story = form(
  demoDb,
  "branch",
  "rice",
  "มีนบุรี",
);

/** End of day at either branch: what is left of the cooked rice and whether it is reheated. */
export const BranchRiceCarrySaladaeng: Story = form(
  demoDb,
  "branch",
  "riceCarry",
  "ศาลาแดง",
);

export const BranchRiceCarry: Story = form(
  demoDb,
  "branch",
  "riceCarry",
  "มีนบุรี",
);

/** A sale on an open day: the kg used follows the packs typed (× average pack weight)
 *  until the branch types the weighed kg itself; LINE MAN and the chili count stay blank. */
export const BranchSaleFromPacks: Story = {
  ...form(chillDb, "branch", "sale", "ศาลาแดง"),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const addons = body.getByLabelText(/เนื้อซีล Add-on/);
    await userEvent.clear(addons);
    await userEvent.type(addons, "40");
  },
};

/** The influencer form as it stands now: name, boxes, chili tubes, shipping fee, note.
 *  No weight and no add-on packs — the kg is derived from the box count when it saves.
 *  The branch normally fills this inside ยืนยันปิดวัน; here it is the same form alone. */
export const BranchInfluencerBox: Story = form(
  chillDb,
  "branch",
  "influencerBox",
  "ศาลาแดง",
);

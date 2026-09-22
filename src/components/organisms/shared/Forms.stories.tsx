import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "storybook/test";
import {
  allocatedDb,
  centralDb,
  chillDb,
  closeReadyDb,
  closeReadyWithSuppliesDb,
  day,
  demoDb,
  multiPoPackedDb,
  nextDay,
  prefillHistoryDb,
  rejectedInvoiceDb,
  smokedDb,
} from "../../../../.storybook/fixtures";
import { materials, mutate, visibleDatabase } from "@/lib/store";
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
// A close-day checklist's ไปกรอก opens that item's form.
const onOpen = fn().mockName("onOpen");

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

/** The last allocation went ศาลาแดง 6 / มีนบุรี 4, so the 25 kg left open split
 *  15 / 10, captioned ตามสัดส่วนครั้งก่อน. Typing or ที่เหลือทั้งหมด drops the caption. */
export const AllocationLastRatio: Story = {
  parameters: { db: prefillHistoryDb },
  render: () => (
    <AllocationForm
      db={prefillHistoryDb}
      lotId={prefillHistoryDb.lots.at(-1)!.id}
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

/** Ticking a material bought before fills จำนวน ราคา and ผู้จำหน่าย from that
 *  purchase (200 × ฿3 from ร้านวัสดุ), each captioned with its date. */
export const MaterialPurchasePrefilled: Story = {
  parameters: { db: prefillHistoryDb },
  render: () => (
    <MaterialPurchaseForm
      db={prefillHistoryDb}
      date={day}
      onDate={onDate}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
  play: async ({ canvasElement }) => {
    const form = within(canvasElement.ownerDocument.body);
    await userEvent.click(form.getByLabelText(`ซื้อ ${materials[0]}`));
  },
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

/** Ticking ศาลาแดง fills the จำนวน up to the branch's par (เติมถึง par) and ผู้รับ
 *  from the branch's last transfer. */
export const MaterialTransferPrefilled: Story = {
  parameters: { db: prefillHistoryDb },
  render: () => (
    <MaterialTransferForm
      db={prefillHistoryDb}
      date={day}
      onDate={onDate}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
  play: async ({ canvasElement }) => {
    const form = within(canvasElement.ownerDocument.body);
    await userEvent.click(form.getByLabelText(`ส่ง ${materials[0]} ไปศาลาแดง`));
  },
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

/** Picking an item bought before fills หน่วย ราคา and ผู้จำหน่าย (and กลุ่ม) from its
 *  last purchase, each captioned with the date. */
export const GeneralPurchasePrefilled: Story = {
  parameters: { db: prefillHistoryDb },
  render: () => (
    <GeneralPurchaseForm
      date={day}
      onDate={onDate}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
  play: async ({ canvasElement }) => {
    const form = within(canvasElement.ownerDocument.body);
    await userEvent.selectOptions(
      form.getByLabelText("เลือกวัตถุดิบ 1"),
      "น้ำพริกหลอด",
    );
  },
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

/** Close dialog with everything done: the checklist is all ✓ and ยืนยันปิดวัน is enabled
 *  at any time of day (no close-time rule, FB-14). */
export const BranchCloseDayReady: Story = {
  parameters: { db: closeReadyDb },
  render: () => (
    <EntryForm
      db={closeReadyDb}
      role="branch"
      branch="ศาลาแดง"
      date={day}
      onDate={onDate}
      modal={{ kind: "closeDay", lotId: "" }}
      onClose={onClose}
      onSaved={onSaved}
      onOpen={onOpen}
    />
  ),
};

/** The close dialog as it opens: the influencer section is collapsed to
 *  เพิ่มอินฟลูเอนเซอร์, and closing the day with no block added saves only closeDay. */
export const BranchCloseDayInfluencersCollapsed: Story = {
  parameters: { db: closeReadyWithSuppliesDb },
  render: () => (
    <EntryForm
      db={closeReadyWithSuppliesDb}
      role="branch"
      branch="ศาลาแดง"
      date={day}
      onDate={onDate}
      modal={{ kind: "closeDay", lotId: "" }}
      onClose={onClose}
      onSaved={onSaved}
      onOpen={onOpen}
    />
  ),
};

/** One press of เพิ่มอินฟลูเอนเซอร์: one block, focus on ชื่ออินฟลูเอนเซอร์. */
export const BranchCloseDayOneInfluencer: Story = {
  ...BranchCloseDayInfluencersCollapsed,
  play: async ({ canvasElement }) => {
    const form = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      form.getByRole("button", { name: /เพิ่มอินฟลูเอนเซอร์/ }),
    );
    await userEvent.type(form.getByLabelText(/ชื่ออินฟลูเอนเซอร์/), "คุณเอ");
    await userEvent.clear(form.getByLabelText(/กล่องมาตรฐานที่ส่ง/));
    await userEvent.type(form.getByLabelText(/กล่องมาตรฐานที่ส่ง/), "2");
  },
};

/** Pressing it again appends a second block: one close can record several influencers. */
export const BranchCloseDayTwoInfluencers: Story = {
  ...BranchCloseDayInfluencersCollapsed,
  play: async ({ canvasElement }) => {
    const form = within(canvasElement.ownerDocument.body);
    const add = form.getByRole("button", { name: /เพิ่มอินฟลูเอนเซอร์/ });
    await userEvent.click(add);
    await userEvent.type(form.getByLabelText(/ชื่ออินฟลูเอนเซอร์/), "คุณเอ");
    await userEvent.click(add);
    const names = form.getAllByLabelText(/ชื่ออินฟลูเอนเซอร์/);
    await userEvent.type(names[1], "ช่องบี");
  },
};

/** The same two blocks on a phone: the wider close dialog is still one column. */
export const BranchCloseDayTwoInfluencersMobile: Story = {
  ...BranchCloseDayTwoInfluencers,
  globals: { viewport: { value: "mobile2", isRotated: false } },
};

/** Close dialog with 4.5 kg left and materials + cooked rice not yet recorded: the
 *  checklist lists both with ไปกรอก, and ยืนยันปิดวัน stays disabled with the reason.
 *  The 4.5 kg shows as คงเหลือชิล, no "use it all" error. */
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
      onOpen={onOpen}
    />
  ),
};

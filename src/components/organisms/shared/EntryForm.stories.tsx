import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import {
  acceptedInvoiceDb,
  centralDb,
  chillDb,
  closeReadyDb,
  closedDb,
  cmReceivedDb,
  confirmedDb,
  day,
  demoDb,
  expenseDb,
  giveawayReadyDb,
  nextDay,
  nextInvoiceDb,
  ownerReservedDb,
  preparedDb,
  rejectedInvoiceDb,
  returnTruckDb,
  returnedDb,
  smokeOrderDb,
  smokedDb,
  submittedInvoiceDb,
  unlinkedBranchDb,
} from "../../../../.storybook/fixtures";
import { setMockDatabase } from "../../../../.storybook/mocks/persistence";
import { pick } from "../../../../.storybook/pick";
import { today } from "@/lib/format";
import { NO_LOT } from "@/lib/nav";
import {
  branches,
  riceSources,
  type ActingRole,
  type Database,
  type EntryKind,
} from "@/lib/store";
import { EntryForm } from "./EntryForm";

// One story per actor; the `ฟอร์ม` control picks which EntryForm kind opens, on which
// fixture. Separate stories remain only for a `play` or a viewport. Every story opens a
// native modal <dialog>, so a Docs page would stack them all — hence `!autodocs`.
const meta: Meta = {
  title: "Organisms/Shared/EntryForm",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;

/** What one `ฟอร์ม` option opens: `kind` on `lotId` of `db` (default: its newest lot). */
type Setup = { db: Database; kind: EntryKind; lotId?: string };
type Args = {
  form: Setup;
  date: string;
  branch: string;
};
type Story = StoryObj<Args>;

const onClose = fn();
const onSaved = fn();
// 「บันทึกและจดต่อ」: the workspace remounts the form; here it only logs.
const onSavedMore = fn().mockName("onSavedMore");
// The working date lives in the workspace; the date field reports changes here.
const onDate = fn();
// A close-day checklist's ไปกรอก opens that item's form.
const onOpen = fn().mockName("onOpen");

const dates = pick("วันที่", {
  "วันตัวอย่าง (ย้อนหลัง)": day,
  วันถัดไป: nextDay,
  วันนี้: today(),
});

/** A `ฟอร์ม` select over `options`; select, not radio, since the lists are long. */
const forms = (options: Record<string, Setup>) => {
  const picked = pick("ฟอร์ม", options);
  return {
    ...picked,
    argType: { ...picked.argType, control: "select" as const },
  };
};

/** The label of one option, as an arg value (Storybook maps it to the Setup). */
const option = <O extends Record<string, Setup>>(
  _options: O,
  label: keyof O & string,
) => label as unknown as Setup;

function renderForm(
  role: ActingRole,
  { form: { db, kind, lotId = db.lots.at(-1)?.id ?? "" }, date, branch }: Args,
  again?: { lot: string; note: string },
) {
  // ponytail: the preview decorator only syncs an arg named `db`; this one sits in `form`.
  setMockDatabase(db);
  return (
    <EntryForm
      // Keyed so a Controls change reopens the dialog fresh.
      key={`${kind}:${lotId}:${db.entries.length}:${branch}:${date}`}
      db={db}
      role={role}
      branch={branch}
      date={date}
      onDate={onDate}
      modal={{ kind, lotId }}
      onClose={onClose}
      onSaved={onSaved}
      onSavedMore={onSavedMore}
      again={again}
      onOpen={onOpen}
    />
  );
}

/** The Controls every actor story shares; `branch` only shows on Branch. */
const actor = (
  role: ActingRole,
  options: ReturnType<typeof forms>,
  branch = "",
): Story => ({
  argTypes: {
    form: options.argType,
    date: dates.argType,
    branch: branch
      ? { name: "สาขา", control: "radio", options: [...branches] }
      : { table: { disable: true } },
  },
  args: {
    form: options.initial,
    date: dates.initial,
    branch,
  },
  render: (args) => renderForm(role, args),
});

// --- Owner ---------------------------------------------------------------

const owner = {
  /** A new purchase PO starts from the last one: pack size, product, kg and price
   *  (captioned "จาก PO-…"); the vendor reference stays blank. */
  "PO ซื้อเนื้อ (ต่อจาก PO ล่าสุด)": {
    db: confirmedDb,
    kind: "purchase",
    lotId: "",
  },
  "PO ซื้อเนื้อ (ครั้งแรก)": { db: demoDb, kind: "purchase", lotId: "" },
  ใบขนส่งขากลับ: { db: smokedDb, kind: "return", lotId: smokedDb.lots[0].id },
  "ตรวจใบวางบิล Chef House": { db: submittedInvoiceDb, kind: "invoiceReview" },
  "จ่ายใบวางบิล Chef House": { db: acceptedInvoiceDb, kind: "invoicePayment" },
  "จ่ายค่าเนื้อ Foodiva": { db: confirmedDb, kind: "meatPayment" },
  "จ่ายค่าเนื้อ Foodiva (จากจดบันทึก)": {
    db: confirmedDb,
    kind: "meatPayment",
    lotId: "",
  },
  ชั่งเข้าสต๊อกกลาง: { db: returnedDb, kind: "central" },
  "ชั่งเข้าสต๊อกกลาง (จากจดบันทึก)": {
    db: returnedDb,
    kind: "central",
    lotId: "",
  },
  "รับเนื้อที่ Foodiva เก็บไว้ (A8)": {
    db: ownerReservedDb,
    kind: "ownerWasteReceive",
    lotId: ownerReservedDb.lots[0].id,
  },
  ค่าใช้จ่าย: { db: expenseDb, kind: "expense" },
  เปิดวันที่ปิดแล้ว: { db: demoDb, kind: "unlock" },
} satisfies Record<string, Setup>;

/** The Owner's own forms. เลือกฟอร์มใน Controls:
 *  - PO ซื้อเนื้อ: form and PO preview side by side (stacked below lg); the "ต่อจาก PO
 *    ล่าสุด" one starts from the last PO, captioned "จาก PO-…"
 *  - ใบวางบิล: review (accept / send back) and payment, amount prefilled, slips optional
 *  - จ่ายค่าเนื้อ Foodiva: the meat invoice on the purchase PO, amount prefilled
 *  - ชั่งเข้าสต๊อกกลาง: the smoked meat Foodiva received back
 *  - รับเนื้อที่ Foodiva เก็บไว้: 6 kg outstanding, prefilled as expected
 *  - ค่าใช้จ่าย: last category, payer and that category's last amount
 *  - เปิดวันที่ปิดแล้ว: the reason is always typed
 *  - จากจดบันทึก (no lot handed in): the lot is a field. ชั่งเข้าสต๊อกกลาง starts on
 *    "ไม่ระบุ Lot" and saves like that; picking a batch shows its "จดล่าสุด" line and
 *    prefills as if opened from that batch's row. จ่ายค่าเนื้อ is one mutate refuses
 *    without a PO: no "ไม่ระบุ Lot", the select waits for a pick.
 *  Every form but ปิดวัน / ปลดล็อกวัน has 「บันทึกและจดต่อ」 beside the save button. */
export const Owner: Story = actor("owner", forms(owner));

/** The form 「บันทึกและจดต่อ」 leaves open: what was saved is said at the top (the page's
 *  toast is behind the dialog), the fields are fresh and the date is kept. */
export const OwnerSavedAndContinue: Story = {
  ...Owner,
  args: { ...Owner.args, form: option(owner, "ค่าใช้จ่าย") },
  render: (args) =>
    renderForm("owner", args, { lot: "", note: "ค่าใช้จ่าย Owner แล้ว" }),
};

/** Below lg the form and the PO preview stack in one scroll area. */
export const OwnerPurchaseMobile: Story = {
  ...Owner,
  args: { ...Owner.args, form: option(owner, "PO ซื้อเนื้อ (ครั้งแรก)") },
  globals: { viewport: { value: "mobile2", isRotated: false } },
};

export const OwnerPurchaseTablet: Story = {
  ...OwnerPurchaseMobile,
  globals: { viewport: { value: "tablet", isRotated: false } },
};

/** Picking another category refills the untouched amount with that category's last one. */
export const OwnerExpenseOtherCategory: Story = {
  ...Owner,
  args: { ...Owner.args, form: option(owner, "ค่าใช้จ่าย") },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.selectOptions(
      body.getByLabelText(/หมวดค่าใช้จ่าย/),
      "ค่าเช่า",
    );
  },
};

// --- Chef House (recorded by the Owner) ----------------------------------

const chef = {
  "รับ PO รมควัน": { db: smokeOrderDb, kind: "smokeOrderAccept" },
  น้ำหนักก่อนรมควัน: { db: cmReceivedDb, kind: "prepare" },
  "น้ำหนักก่อนรมควัน (จากจดบันทึก)": {
    db: cmReceivedDb,
    kind: "prepare",
    lotId: "",
  },
  บันทึกรอบรมควัน: { db: preparedDb, kind: "smoke" },
  "ปิด Lot": { db: smokedDb, kind: "closeLot" },
  ใบวางบิลค่ารมควัน: { db: closedDb, kind: "smokingInvoice" },
  แก้ใบวางบิลที่ถูกตีกลับ: {
    db: rejectedInvoiceDb,
    kind: "smokingInvoice",
    lotId: rejectedInvoiceDb.lots[0].id,
  },
} satisfies Record<string, Setup>;

/** Chef House's work, typed by the Owner. เลือกฟอร์มใน Controls:
 *  - รับ PO รมควัน: accepted before the meat is trucked up
 *  - น้ำหนักก่อนรมควัน: after trimming and blotting; จากจดบันทึก: the Lot select,
 *    on "ไม่ระบุ Lot" (the save opens a new batch) until a batch is picked
 *  - บันทึกรอบรมควัน: one round per save, per-pack weights below the fields
 *  - ปิด Lot: freezes the yield and hands it back to the Owner
 *  - ใบวางบิลค่ารมควัน: number, file (required), amount from smoke PO kg × rate (A7)
 *  - แก้ใบวางบิลที่ถูกตีกลับ (edit mode): the Owner's note shows and the amount starts at
 *    the sent-back invoice's */
export const ChefHouse: Story = actor("owner", forms(chef));

// --- Foodiva (recorded by the Owner) -------------------------------------

const foodiva = {
  ใบแจ้งหนี้ใหม่: {
    db: nextInvoiceDb,
    kind: "foodivaConfirm",
    lotId: nextInvoiceDb.lots.at(-1)!.id,
  },
  แก้ใบแจ้งหนี้ที่ถูกตีกลับ: {
    db: rejectedInvoiceDb,
    kind: "foodivaConfirm",
    lotId: rejectedInvoiceDb.lots[0].id,
  },
  รับเนื้อกลับเข้าตู้: { db: returnTruckDb, kind: "foodivaReturnReceive" },
} satisfies Record<string, Setup>;

/** Foodiva's work, typed by the Owner. เลือกฟอร์มใน Controls:
 *  - ใบแจ้งหนี้ใหม่: the number follows the last one (INV-1 → INV-2), the confirmer
 *    carries, the weights start from the PO as expected values
 *  - แก้ใบแจ้งหนี้ที่ถูกตีกลับ (edit mode): starts from the saved invoice (28 / 2, number,
 *    date, file), not the PO
 *  - รับเนื้อกลับเข้าตู้: bags and kg from the return truck (expected), time from now */
export const Foodiva: Story = actor("owner", forms(foodiva));

// --- Branch --------------------------------------------------------------

const branch = {
  ขายเนื้อ: { db: demoDb, kind: "sale", lotId: demoDb.lots[0].id },
  "ขายเนื้อ (เนื้อชิลพร้อมขาย)": { db: chillDb, kind: "sale" },
  "ขายเนื้อ (ไม่ระบุ Lot)": {
    db: unlinkedBranchDb,
    kind: "sale",
    lotId: NO_LOT,
  },
  "ขายเนื้อ + อินฟลูเอนเซอร์": { db: giveawayReadyDb, kind: "sale" },
  รับเนื้อ: { db: centralDb, kind: "receive", lotId: "" },
  "รับเนื้อ (ไม่ระบุ Lot)": {
    db: unlinkedBranchDb,
    kind: "receive",
    lotId: NO_LOT,
  },
  ละลายเนื้อ: { db: demoDb, kind: "thaw" },
  "ละลายเนื้อ (ไม่ระบุ Lot)": {
    db: unlinkedBranchDb,
    kind: "thaw",
    lotId: NO_LOT,
  },
  กล่องอินฟลูเอนเซอร์: { db: chillDb, kind: "influencerBox" },
  ซื้อข้าวเหนียว: { db: demoDb, kind: "ricePurchase" },
  เบิกข้าวเหนียว: { db: demoDb, kind: "riceIssue" },
  หุงข้าว: { db: demoDb, kind: "rice" },
  ข้าวเหลือสิ้นวัน: { db: demoDb, kind: "riceCarry" },
  รับน้ำพริกเข้าสาขา: { db: demoDb, kind: "chiliReceive", lotId: "" },
  "ปิดวัน (ยังไม่ครบ)": { db: chillDb, kind: "closeDay", lotId: "" },
  "ปิดวัน (ครบแล้ว)": { db: closeReadyDb, kind: "closeDay", lotId: "" },
} satisfies Record<string, Setup>;

/** A branch's forms at the สาขา picked in Controls. เลือกฟอร์มใน Controls:
 *  - ขายเนื้อ: a past วันที่ shows "บันทึกย้อนหลัง"; the kg follows packs × average pack
 *    weight until typed; the influencer section starts collapsed
 *  - ไม่ระบุ Lot: the bucket with 4 kg frozen and 3 kg chill; receiving on it says the
 *    meat costs 0 until linked (BR-03, BR-08)
 *  - รับเนื้อ: no lot handed in, so it starts on "ไม่ระบุ Lot"; every batch is in the
 *    list to pick instead
 *  - ละลายเนื้อ: the oldest frozen lot (FIFO), last thaw's kg (expected)
 *  - กล่องอินฟลูเอนเซอร์: name, boxes, tubes, shipping fee; kg derived on save
 *  - ข้าว: purchase tops up to par (captioned), withdrawals check stock
 *  - รับน้ำพริกเข้าสาขา (STK-43): tubes, the receiver (carried from the last one), reference
 *  - ปิดวัน: ยังไม่ครบ lists what is missing with ไปกรอก and keeps ยืนยันปิดวัน disabled
 *    (disabled state); ครบแล้ว is all ✓ and enabled at any time (FB-14) */
export const Branch: Story = actor("branch", forms(branch), branches[0]);

const branchPlay = (
  label: keyof typeof branch,
  play: NonNullable<Story["play"]>,
  args: Partial<Args> = {},
): Story => ({
  ...Branch,
  args: { ...Branch.args, form: option(branch, label), ...args },
  play,
});

/** The form's modal <dialog>, once it is open (it opens after the first render). */
const openDialog = async (canvasElement: HTMLElement) =>
  within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));

/** Types `value` into each field matched by label, clearing it first. */
const typeInto =
  (typed: [RegExp, string][]): NonNullable<Story["play"]> =>
  async ({ canvasElement }) => {
    const body = await openDialog(canvasElement);
    for (const [label, value] of typed) {
      const field = body.getByLabelText(label);
      await userEvent.clear(field);
      await userEvent.type(field, value);
    }
  };

/** Only the kg typed, over the frozen stock: the error (with the most allowed) shows at
 *  once and บันทึกรายการ is disabled, although the other fields are still empty. */
export const BranchThawOverStock = branchPlay(
  "ละลายเนื้อ",
  typeInto([[/น้ำหนักละลาย/, "99999"]]),
);

/** Raw rice withdrawn over stock: red error at once, save disabled. */
export const BranchRiceIssueOverStock = branchPlay(
  "เบิกข้าวเหนียว",
  typeInto([[/ข้าวเหนียวดิบที่เบิก/, "99999"]]),
);

/** A filled withdrawal: ตรวจสอบก่อนบันทึก shows what is taken, stock now and after. */
export const BranchRiceIssueFilled = branchPlay(
  "เบิกข้าวเหนียว",
  typeInto([
    [/ข้าวเหนียวดิบที่เบิก/, "2"],
    [/ผู้รับของ/, "ครัวศาลาแดง"],
  ]),
);

/** Rice purchase with the round's source picked: the fields follow the pick. */
const ricePurchase = (source: string) =>
  branchPlay("ซื้อข้าวเหนียว", async ({ canvasElement }) => {
    await userEvent.selectOptions(
      within(canvasElement).getByLabelText(/ข้าวเหนียวมาจาก/),
      source,
    );
  });

export const BranchRicePurchaseSelfCook = ricePurchase(riceSources[0]);

/** Bought cooked: the cooked-rice par shows as a hint, it never blocks the save. */
export const BranchRicePurchaseBoughtCooked = ricePurchase(riceSources[1]);

/** The kg used follows the packs typed (× average pack weight) until the branch types
 *  the weighed kg itself; LINE MAN and the chili count stay blank. */
export const BranchSaleFromPacks = branchPlay(
  "ขายเนื้อ (เนื้อชิลพร้อมขาย)",
  typeInto([[/กล่องมาตรฐาน · เนื้อ 1 ซีล/, "40"]]),
);

/** 95 g per pack: the form warns, but the sale still saves (no FormError). */
export const BranchSalePackWeightWarning = branchPlay(
  "ขายเนื้อ (เนื้อชิลพร้อมขาย)",
  typeInto([
    [/กล่องมาตรฐาน · เนื้อ 1 ซีล/, "10"],
    [/น้ำหนักเนื้อที่ใช้ไปจริงวันนี้/, "0.95"],
  ]),
  { date: "วันถัดไป" },
);

/** One press of เพิ่มอินฟลูเอนเซอร์: one block, focus on ชื่ออินฟลูเอนเซอร์.
 *  ตรวจสอบก่อนบันทึก adds the giveaway (เนื้อ + ค่าส่ง) to cost, not to revenue. */
export const BranchSaleOneInfluencer = branchPlay(
  "ขายเนื้อ + อินฟลูเอนเซอร์",
  async ({ canvasElement }) => {
    const form = await openDialog(canvasElement);
    await userEvent.click(
      form.getByRole("button", { name: /เพิ่มอินฟลูเอนเซอร์/ }),
    );
    await userEvent.type(form.getByLabelText(/ชื่ออินฟลูเอนเซอร์/), "คุณเอ");
    await userEvent.clear(form.getByLabelText(/กล่องมาตรฐานที่ส่ง/));
    await userEvent.type(form.getByLabelText(/กล่องมาตรฐานที่ส่ง/), "2");
    await userEvent.type(form.getByLabelText(/ค่าส่ง/), "80");
    await expect(
      await form.findByText(/ต้นทุนของแจกอินฟลูเอนเซอร์ 1 ราย/),
    ).toBeInTheDocument();
  },
);

/** Pressing it again appends a second block: one sale can record several influencers. */
export const BranchSaleTwoInfluencers = branchPlay(
  "ขายเนื้อ + อินฟลูเอนเซอร์",
  async ({ canvasElement }) => {
    const form = await openDialog(canvasElement);
    const add = form.getByRole("button", { name: /เพิ่มอินฟลูเอนเซอร์/ });
    await userEvent.click(add);
    await userEvent.type(form.getByLabelText(/ชื่ออินฟลูเอนเซอร์/), "คุณเอ");
    await userEvent.click(add);
    const names = form.getAllByLabelText(/ชื่ออินฟลูเอนเซอร์/);
    await userEvent.type(names[1], "ช่องบี");
  },
);

/** The same two blocks on a phone: the wider sale dialog is still one column. */
export const BranchSaleTwoInfluencersMobile: Story = {
  ...BranchSaleTwoInfluencers,
  globals: { viewport: { value: "mobile2", isRotated: false } },
};

export const BranchInfluencerBoxMobile: Story = {
  ...Branch,
  args: { ...Branch.args, form: option(branch, "กล่องอินฟลูเอนเซอร์") },
  globals: { viewport: { value: "mobile2", isRotated: false } },
};

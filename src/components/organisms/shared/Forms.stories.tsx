import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "storybook/test";
import {
  day,
  demoDb,
  multiPoPackedDb,
  nextDay,
  packedDb,
  prefillHistoryDb,
  smokedDb,
} from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import { materials, type Database } from "@/lib/store";
import { SegmentedChoice } from "@/components/molecules/SegmentedChoice";
import { ChefLotEditForm } from "@/components/organisms/owner/ChefLotEditForm";
import { SmokeOrderPreviewDialog } from "@/components/organisms/owner/SmokeOrderPreviewDialog";
import { GeneralPurchaseForm } from "./GeneralPurchaseForm";
import { MaterialPurchaseForm } from "./MaterialPurchaseForm";
import { today } from "@/lib/format";

// The Owner's dialogs other than EntryForm (see EntryForm.stories). Every story opens a
// native modal <dialog>; a Docs page would stack them all. Saves go through the mocked
// persistence and appear in the Actions panel.
const meta: Meta = {
  title: "Organisms/Shared/Forms",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;
type Args = { db: Database; date: string; switcher: boolean };
type Story = StoryObj<Args>;

const onClose = fn();
const onSaved = fn();
// The working date lives in the workspace; the date field reports changes here.
const onDate = fn();

const dates = pick("วันที่", {
  "วันตัวอย่าง (ย้อนหลัง)": day,
  วันถัดไป: nextDay,
  วันนี้: today(),
});

/** Controls: `db` from `states`, the working date, and (when `switcher`) the stock tab's
 *  chooser that swaps the form for its sibling. */
const controls = (
  states: Record<string, Database>,
  switcher = false,
): Pick<Story, "argTypes" | "args"> => {
  const state = pick("สถานะ", states);
  return {
    argTypes: {
      db: state.argType,
      date: dates.argType,
      switcher: switcher
        ? { name: "ตัวเลือกสลับฟอร์ม", control: "boolean" }
        : { table: { disable: true } },
    },
    args: { db: state.initial, date: dates.initial, switcher: false },
  };
};

/** The stock tab's chooser (WorkspaceModals' STOCK_PAIRS) on `value`. */
const chooser = (
  label: string,
  value: string,
  options: { value: string; label: string }[],
) => (
  <SegmentedChoice
    label={label}
    options={options}
    value={value}
    onChange={fn()}
  />
);

const buy = (value: string) =>
  chooser("ซื้ออะไรเข้าคลัง", value, [
    { value: "materialReceive", label: "วัสดุบรรจุภัณฑ์" },
    { value: "generalPurchase", label: "ซื้ออื่น ๆ (น้ำพริก, น้ำดอง ฯลฯ)" },
  ]);

const history = { ไม่มีประวัติ: demoDb, มีประวัติ: prefillHistoryDb };
// The `db` arg holds the option label until Storybook maps it.
const withHistory = "มีประวัติ" as unknown as Database;

/** เลือกสถานะใน Controls: มีประวัติ lets a ticked material fill จำนวน ราคา and
 *  ผู้จำหน่าย from its last purchase (see MaterialPurchasePrefilled). */
export const MaterialPurchase: Story = {
  ...controls(history, true),
  render: ({ db, date, switcher }) => (
    <MaterialPurchaseForm
      key={`${db.entries.length}:${date}`}
      db={db}
      date={date}
      onDate={onDate}
      onClose={onClose}
      onSaved={onSaved}
      switcher={switcher ? buy("materialReceive") : undefined}
    />
  ),
};

/** Ticking a material bought before fills จำนวน ราคา and ผู้จำหน่าย from that
 *  purchase (200 × ฿3 from ร้านวัสดุ), each captioned with its date. */
export const MaterialPurchasePrefilled: Story = {
  ...MaterialPurchase,
  args: { ...MaterialPurchase.args, db: withHistory },
  play: async ({ canvasElement }) => {
    const form = within(canvasElement.ownerDocument.body);
    await userEvent.click(form.getByLabelText(`ซื้อ ${materials[0]}`));
  },
};

/** Reads the database through latestDatabase(), which the สถานะ control feeds.
 *  มีประวัติ: picking an item bought before fills หน่วย ราคา ผู้จำหน่าย and กลุ่ม (see
 *  GeneralPurchasePrefilled). */
export const GeneralPurchase: Story = {
  ...controls(history, true),
  render: ({ db, date, switcher }) => (
    <GeneralPurchaseForm
      key={`${db.entries.length}:${date}`}
      date={date}
      onDate={onDate}
      onClose={onClose}
      onSaved={onSaved}
      switcher={switcher ? buy("generalPurchase") : undefined}
    />
  ),
};

/** Picking an item bought before fills หน่วย ราคา and ผู้จำหน่าย (and กลุ่ม) from its
 *  last purchase, each captioned with the date. */
export const GeneralPurchasePrefilled: Story = {
  ...GeneralPurchase,
  args: { ...GeneralPurchase.args, db: withHistory },
  play: async ({ canvasElement }) => {
    const form = within(canvasElement.ownerDocument.body);
    await userEvent.selectOptions(
      form.getByLabelText("เลือกวัตถุดิบ 1"),
      "น้ำพริกหลอด",
    );
  },
};

/** Corrects arrival, the received total, pre-smoke kg and the smoke log, at any time: after
 *  ปิด Lot it still saves, with a warning. The form renders nothing until the lot has a
 *  weigh-in and a pre-smoke weight (mutate refuses a correction without them); smoke
 *  rounds are optional. The date is the only real control. */
export const ChefLotEdit: Story = {
  ...controls({ รมควันแล้ว: smokedDb }),
  render: ({ db, date }) => (
    <ChefLotEditForm
      key={date}
      db={db}
      lotId={db.lots.at(-1)!.id}
      date={date}
      onDate={onDate}
      onClose={onClose}
      onSaved={onSaved}
    />
  ),
};

/* The smoke PO of a shipment drawn from three purchase POs, as sent to Chef House (Q6): it
 * names the shipment and its Packing List, never a purchase PO or meat price. */
const smokeOrder = pick("สถานะ", {
  // multiPoPackedDb already carries the 1,400 kg smoke PO; packedDb has none yet.
  "มี PO รมควัน": multiPoPackedDb,
  "ยังไม่มี PO": packedDb,
});

/** เลือกสถานะใน Controls: มี PO รมควัน shows the document; ยังไม่มี PO shows the
 *  "ไม่พบเอกสาร PO" warning. */
export const SmokeOrderPreview: StoryObj<{ db: Database }> = {
  argTypes: { db: smokeOrder.argType },
  args: { db: smokeOrder.initial },
  render: ({ db }) => (
    <SmokeOrderPreviewDialog
      key={db.entries.length}
      db={db}
      lotId={db.lots.at(-1)!.id}
      onClose={onClose}
    />
  ),
};

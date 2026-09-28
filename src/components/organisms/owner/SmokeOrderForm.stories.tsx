import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  day,
  multiPoDb,
  noInvoicePosDb,
  packedDb,
} from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import type { Database } from "@/lib/store";
import { SmokeOrderForm } from "./SmokeOrderForm";

// A native modal <dialog>; a Docs page would stack the stories.
const meta: Meta = {
  title: "Organisms/Owner/SmokeOrderForm",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: noInvoicePosDb },
};

export default meta;
type Story = StoryObj<{ db: Database }>;

const poState = pick("PO ซื้อ", {
  "ยังไม่มี Invoice": noInvoicePosDb,
  "หลาย PO": multiPoDb,
});

/** "ออก PO รมควัน" from the page header: a new batch. เลือก PO ซื้อ ใน Controls:
 *  - ยังไม่มี Invoice: two purchase POs (300 / 200 kg) Foodiva has not invoiced, each with a
 *    "ยังไม่มี Invoice" badge. Type kg on both: the น้ำหนัก PO รมควัน field follows the total
 *    (no Packing List to start from) and the footer warns about each missing invoice, but
 *    the PO still saves.
 *  - หลาย PO: PO 1,000 kg with 400 already drawn (600 left) plus 300 / 700 / 500 kg POs. */
export const NewBatch: Story = {
  argTypes: { db: poState.argType },
  args: { db: poState.initial },
  render: ({ db }) => (
    <SmokeOrderForm
      db={db}
      lotId=""
      date={day}
      onDate={fn()}
      onClose={fn()}
      onSaved={fn()}
    />
  ),
};

/** Opened on a batch Foodiva already trucked with its Packing List (25 + 25 kg) and no
 *  smoke PO: the batch is preselected, its "ยังขาด" chips show, and the kg starts at the
 *  Packing List total. The chooser still offers "ชุดใหม่". */
export const ExistingBatch: Story = {
  parameters: { db: packedDb },
  render: () => (
    <SmokeOrderForm
      db={packedDb}
      lotId={packedDb.lots.at(-1)!.id}
      date={day}
      onDate={fn()}
      onClose={fn()}
      onSaved={fn()}
    />
  ),
};

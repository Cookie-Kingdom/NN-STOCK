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

const orderState = pick("PO ซื้อ", {
  "ยังไม่มี Invoice": noInvoicePosDb,
  "หลาย PO": multiPoDb,
  "ชุดที่ Foodiva ส่งแล้ว": packedDb,
});

/** "ออก PO รมควัน". เลือก PO ซื้อ ใน Controls:
 *  - ยังไม่มี Invoice: a new batch from the page header; two purchase POs (300 / 200 kg)
 *    Foodiva has not invoiced, each with a "ยังไม่มี Invoice" badge. Type kg on both: the
 *    น้ำหนัก PO รมควัน field follows the total (no Packing List to start from) and the
 *    footer warns about each missing invoice, but the PO still saves.
 *  - หลาย PO: a new batch; PO 1,000 kg with 400 already drawn (600 left) plus
 *    300 / 700 / 500 kg POs.
 *  - ชุดที่ Foodiva ส่งแล้ว: opened on a batch Foodiva already trucked with its Packing List
 *    (25 + 25 kg) and no smoke PO: the batch is preselected, its "ยังไม่ได้จด" chips show, and
 *    the kg starts at the Packing List total. The chooser still offers "ชุดใหม่". */
export const SmokeOrder: Story = {
  argTypes: { db: orderState.argType },
  args: { db: orderState.initial },
  render: ({ db }) => {
    const lotId = db === packedDb ? db.lots.at(-1)!.id : "";
    return (
      <SmokeOrderForm
        // key: the form reads its start values once; a new state remounts it.
        key={`${db.entries.length}:${lotId}`}
        db={db}
        lotId={lotId}
        date={day}
        onDate={fn()}
        onClose={fn()}
        onSaved={fn()}
      />
    );
  },
};

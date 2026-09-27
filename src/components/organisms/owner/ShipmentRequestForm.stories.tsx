import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  day,
  dispatchDb,
  multiPoDb,
  requestedDb,
} from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import type { Database } from "@/lib/store";
import { ShipmentRequestForm } from "./ShipmentRequestForm";

// A native modal <dialog>; a Docs page would stack the stories.
const meta: Meta = {
  title: "Organisms/Owner/ShipmentRequestForm",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: multiPoDb },
};

export default meta;
type Story = StoryObj<{ db: Database }>;

const poState = pick("PO", {
  "หลาย PO": multiPoDb,
  ไม่เหลือให้ขอ: dispatchDb,
});

/** A new Request. เลือก PO ใน Controls:
 *  - หลาย PO: PO 1,000 kg with 400 already requested (600 left) plus PO 300 / 700 / 500
 *    with nothing sent. A new Request starts with each PO's whole remaining kg,
 *    captioned ยอดคงเหลือ PO.
 *  - ไม่เหลือให้ขอ: the only PO is fully requested already, nothing left to choose. */
export const SeveralPurchasePos: Story = {
  argTypes: { db: poState.argType },
  args: { db: poState.initial },
  render: ({ db }) => (
    <ShipmentRequestForm
      db={db}
      date={day}
      onDate={fn()}
      onClose={fn()}
      onSaved={fn()}
    />
  ),
};

/** แก้ไข Request before Foodiva's manifest: the Request's 200 + 300 kg are pre-filled and
 *  count as still available, so each PO shows its remaining as if this Request were not there. */
export const EditRequest: Story = {
  parameters: { db: requestedDb },
  render: () => (
    <ShipmentRequestForm
      db={requestedDb}
      lotId={requestedDb.lots.at(-1)!.id}
      date={day}
      onDate={fn()}
      onClose={fn()}
      onSaved={fn()}
    />
  ),
};

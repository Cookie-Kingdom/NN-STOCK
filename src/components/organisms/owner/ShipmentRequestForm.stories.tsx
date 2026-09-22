import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  day,
  dispatchDb,
  multiPoDb,
  requestedDb,
} from "../../../../.storybook/fixtures";
import { ShipmentRequestForm } from "./ShipmentRequestForm";

// A native modal <dialog>; a Docs page would stack the stories.
const meta: Meta = {
  title: "Organisms/Owner/ShipmentRequestForm",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: multiPoDb },
};

export default meta;
type Story = StoryObj;

/** PO 1,000 kg with 400 already requested (600 left) plus PO 300 / 700 / 500 with nothing
 *  sent. A new Request starts with each PO's whole remaining kg, captioned ยอดคงเหลือ PO. */
export const SeveralPurchasePos: Story = {
  render: () => (
    <ShipmentRequestForm
      db={multiPoDb}
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

/** The only PO is fully requested already: nothing left to choose. */
export const NothingRemaining: Story = {
  parameters: { db: dispatchDb },
  render: () => (
    <ShipmentRequestForm
      db={dispatchDb}
      date={day}
      onDate={fn()}
      onClose={fn()}
      onSaved={fn()}
    />
  ),
};

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { day, dispatchDb, multiPoDb } from "../../../../.storybook/fixtures";
import { ShipmentRequestForm } from "./ShipmentRequestForm";

// A native modal <dialog>; a Docs page would stack the stories.
const meta: Meta = {
  title: "Organisms/Owner/ShipmentRequestForm",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: multiPoDb },
};

export default meta;
type Story = StoryObj;

/** PO 1,000 kg with 400 already requested (600 left) plus PO 300 / 700 / 500 with nothing sent. */
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

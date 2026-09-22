import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { day, dispatchedDb } from "../../../../.storybook/fixtures";
import { visibleDatabase } from "@/lib/store";
import { ChefReceiveForm } from "./ChefReceiveForm";

// A native modal <dialog>: a Docs page would stack it, hence `!autodocs`.
const meta: Meta = {
  title: "Organisms/Chef/ChefReceiveForm",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

/** Stage 2, as Chef House sees it: the 25 + 25 kg Packing List with the yellow
 *  cells prefilled at 25 and marked "ตาม Packing List" (expected), and the arrival
 *  time at the current slot. Type e.g. 24.5 in a cell — its marker goes, and a total
 *  off the list still saves. */
export const WeighIn: Story = {
  parameters: { db: dispatchedDb },
  render: () => (
    <ChefReceiveForm
      db={visibleDatabase(dispatchedDb, "cm")}
      lotId={dispatchedDb.lots.at(-1)!.id}
      date={day}
      onDate={fn()}
      onClose={fn()}
      onSaved={fn()}
    />
  ),
};

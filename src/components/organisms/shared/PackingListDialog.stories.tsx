import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { cmReceivedDb, packedDb } from "../../../../.storybook/fixtures";
import { PackingListDialog } from "./PackingListDialog";

// A native modal <dialog>; a Docs page would stack it behind the other stories.
const meta: Meta = {
  title: "Organisms/Shared/PackingListDialog",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: packedDb },
};

export default meta;
type Story = StoryObj;

/** What the Owner opens from the smoke PO tab: Foodiva's list and its totals. */
export const Owner: Story = {
  render: () => (
    <PackingListDialog
      db={packedDb}
      lotId={packedDb.lots.at(-1)!.id}
      onClose={fn()}
    />
  ),
};

/** After Chef House weighed in: the yellow cells are filled. */
export const Received: Story = {
  parameters: { db: cmReceivedDb },
  render: () => (
    <PackingListDialog
      db={cmReceivedDb}
      lotId={cmReceivedDb.lots.at(-1)!.id}
      onClose={fn()}
    />
  ),
};

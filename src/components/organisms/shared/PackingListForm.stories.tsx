import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { confirmedDb, day } from "../../../../.storybook/fixtures";
import { PackingListForm } from "./PackingListForm";

// A native modal <dialog>; a Docs page would stack it behind the other stories.
const meta: Meta = {
  title: "Develop/PackingListForm",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: confirmedDb },
};

export default meta;
type Story = StoryObj;

/** Foodiva opens it from its PO row, once the meat Invoice is out. */
export const New: Story = {
  render: () => (
    <PackingListForm
      db={confirmedDb}
      lotId={confirmedDb.lots[0].id}
      date={day}
      onDate={fn()}
      onClose={fn()}
      onSaved={fn()}
    />
  ),
};

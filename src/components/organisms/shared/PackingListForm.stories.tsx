import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { day, dispatchDb, packedDb } from "../../../../.storybook/fixtures";
import { PackingListForm } from "./PackingListForm";

// A native modal <dialog>; a Docs page would stack it behind the other stories.
const meta: Meta = {
  title: "Develop/PackingListForm",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: dispatchDb },
};

export default meta;
type Story = StoryObj;

/** Inside Foodiva's transport form: seeded from the Request's POs, handed back as a draft. */
export const Draft: Story = {
  render: () => (
    <PackingListForm
      db={dispatchDb}
      lotId={dispatchDb.lots.at(-1)!.id}
      date={day}
      onDate={fn()}
      onClose={fn()}
      onDraft={fn()}
    />
  ),
};

/** Editing a saved list from the "Request เข้า" row, before the Owner's smoke PO. */
export const Edit: Story = {
  parameters: { db: packedDb },
  render: () => (
    <PackingListForm
      db={packedDb}
      lotId={packedDb.lots.at(-1)!.id}
      date={day}
      onDate={fn()}
      onClose={fn()}
      onSaved={fn()}
    />
  ),
};

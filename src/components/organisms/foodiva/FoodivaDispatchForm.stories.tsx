import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { confirmedDb, day } from "../../../../.storybook/fixtures";
import { FoodivaDispatchForm } from "./FoodivaDispatchForm";

// Two native modal <dialog>s can stack here (the Packing List opens on top of the
// transport form); a Docs page would try to show them all at once.
const meta: Meta = {
  title: "Develop/FoodivaDispatchForm",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: confirmedDb },
};

export default meta;
type Story = StoryObj;

const lotId = confirmedDb.lots[0].id;

/** The trip as the Owner/Manager's Request set it — here one PO, 18 of its 30 kg. */
export const New: Story = {
  render: () => (
    <FoodivaDispatchForm
      db={confirmedDb}
      request={[{ lotId, kg: 18 }]}
      date={day}
      onDate={fn()}
      onClose={fn()}
      onSubmit={fn()}
    />
  ),
};

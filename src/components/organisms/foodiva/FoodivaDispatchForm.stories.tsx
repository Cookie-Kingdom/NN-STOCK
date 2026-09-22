import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  day,
  dispatchDb,
  packedDb,
  repeatDispatchDb,
} from "../../../../.storybook/fixtures";
import { FoodivaDispatchForm } from "./FoodivaDispatchForm";

// Two native modal <dialog>s can stack here (the Packing List opens on top of the
// transport form); a Docs page would try to show them all at once.
const meta: Meta = {
  title: "Organisms/Foodiva/FoodivaDispatchForm",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: dispatchDb },
};

export default meta;
type Story = StoryObj;

/** The Owner's 50 kg Request, waiting for Foodiva's transport document. Save stays
 *  off until the Packing List is filled in the dialog on top. "เวลารถรับ" starts on the
 *  next half-hour slot but takes any minute (e.g. 08:15). */
export const New: Story = {
  render: () => (
    <FoodivaDispatchForm
      db={dispatchDb}
      lotId={dispatchDb.lots.at(-1)!.id}
      date={day}
      onDate={fn()}
      onClose={fn()}
      onSaved={fn()}
    />
  ),
};

/** A database that already has a trip: its pickup time shows as a one-click shortcut. */
export const RecentPickupTimes: Story = {
  parameters: { db: packedDb },
  render: () => (
    <FoodivaDispatchForm
      db={packedDb}
      lotId={packedDb.lots.at(-1)!.id}
      date={day}
      onDate={fn()}
      onClose={fn()}
      onSaved={fn()}
    />
  ),
};

/** The second trip: trip, vehicle, plate and driver start from the last transport
 *  document, each captioned with its date ("ล่าสุด 09/09"). Editing one drops its caption. */
export const PrefilledFromLastTrip: Story = {
  parameters: { db: repeatDispatchDb },
  render: () => (
    <FoodivaDispatchForm
      db={repeatDispatchDb}
      lotId={repeatDispatchDb.lots.at(-1)!.id}
      date={day}
      onDate={fn()}
      onClose={fn()}
      onSaved={fn()}
    />
  ),
};

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { linkedDb, unlinkedDb } from "../../../../.storybook/fixtures";
import { entries, type Database, type EntryKind } from "@/lib/store";
import { LinkDialog } from "./LinkDialog";

// A native modal <dialog>; a Docs page would stack it behind the other stories.
const meta: Meta = {
  title: "Organisms/Shared/LinkDialog",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: unlinkedDb },
};

export default meta;
type Story = StoryObj;

/** The target as `entries()` shows it, with any earlier link overlaid. */
const target = (db: Database, kind: EntryKind) =>
  entries(db, kind).find((e) => e.branch === "ศาลาแดง")!;

/** ศาลาแดง's 10 kg received with no lot. The choices are every shipment batch with what is
 *  left in central stock; saving records a `link` and the balance moves to that batch. */
export const BranchMeat: Story = {
  render: () => (
    <LinkDialog
      entry={target(unlinkedDb, "receive")}
      db={unlinkedDb}
      role="branch"
      branch="ศาลาแดง"
      onClose={fn()}
      onLinked={fn()}
    />
  ),
};

/** A material receipt recorded before the Owner's transfer: the choices are ศาลาแดง's
 *  transfers no other receipt has taken. */
export const MaterialReceipt: Story = {
  render: () => (
    <LinkDialog
      entry={target(unlinkedDb, "materialConfirm")}
      db={unlinkedDb}
      role="branch"
      branch="ศาลาแดง"
      onClose={fn()}
      onLinked={fn()}
    />
  ),
};

/** The Owner re-linking a receive that already sits on a batch: "ผูกอยู่กับ" names it and
 *  saving the same batch again is disabled; a later link wins (LNK-05). */
export const Relink: Story = {
  parameters: { db: linkedDb },
  render: () => (
    <LinkDialog
      entry={target(linkedDb, "receive")}
      db={linkedDb}
      role="owner"
      onClose={fn()}
      onLinked={fn()}
    />
  ),
};

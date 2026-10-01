import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { changesDb, dayClosedDb } from "../../../../.storybook/fixtures";
import { ChangeLog } from "./ChangeLog";

/** EDT-25 ประวัติการแก้ไขและลบ: the undo stack above the Log. "ย้อนกลับ" saves at once
 *  (see the Actions panel). */
const meta = {
  title: "Organisms/Workspace/ChangeLog",
  component: ChangeLog,
  args: { db: changesDb, role: "owner", branch: "", onChanged: fn() },
} satisfies Meta<typeof ChangeLog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The Owner reads back every account's changes, newest first:
 *  - กู้คืนรายการ: the expense it deleted is back; the delete under it reads "ย้อนกลับแล้ว".
 *  - ลบรายการ by ศาลาแดง (its cooked-rice count): "ย้อนกลับ" puts the entry back.
 *  - ย้อนกลับการแก้ไข: the Owner undid ศาลาแดง's thaw edit, which reads "ย้อนกลับแล้ว".
 *  - แก้ไขรายการ by ศาลาแดง (its sale): before → after, and "ย้อนกลับ" restores 65.5 kg. */
export const Owner: Story = {};

/** ศาลาแดง: its own changes and the Owner's undo of its thaw edit, never the Owner's
 *  expense. It can undo its own edit and delete, not the Owner's undo. */
export const Branch: Story = { args: { role: "branch", branch: "ศาลาแดง" } };

export const Empty: Story = { args: { db: dayClosedDb } };

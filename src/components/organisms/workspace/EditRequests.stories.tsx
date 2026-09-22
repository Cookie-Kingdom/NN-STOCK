import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  day,
  editDecidedDb,
  editPendingDb,
} from "../../../../.storybook/fixtures";
import { Panel } from "@/components/atoms/Panel";
import {
  EditEntryForm,
  EntryDetails,
} from "@/components/organisms/shared/EntryDetails";
import { entries, visibleEntries, type Database } from "@/lib/store";
import { EditRequestList } from "./EditRequestList";
import { editRequestAlerts } from "./editRequestAlerts";
import { HistoryPanel } from "./HistoryPanel";
import { NotificationPopover } from "./NotificationPopover";

/** B5 แก้ไขย้อนหลัง: the edit/request form, the request list, the bells and an edited entry.
 *  Forms inside, so no Docs page. */
const meta: Meta = {
  title: "Organisms/Edit Requests",
  tags: ["!autodocs"],
  parameters: { db: editDecidedDb },
};

export default meta;
type Story = StoryObj;

const asBranch = (db: Database): Database => ({
  ...db,
  entries: visibleEntries(db, "branch", "ศาลาแดง"),
});
const sale = (db: Database) => entries(db, "sale")[0];

/** ศาลาแดง's "ขอแก้ไข" on its closed-day sale: the sale form prefilled, plus the reason. */
export const RequestForm: Story = {
  render: () => (
    <Panel>
      <EditEntryForm
        entry={sale(asBranch(editPendingDb))}
        request
        onCancel={fn()}
        onSubmit={fn()}
      />
    </Panel>
  ),
};

/** The Owner's "แก้ไข": the same form, saved at once. */
export const OwnerEditForm: Story = {
  render: () => (
    <Panel>
      <EditEntryForm
        entry={sale(editPendingDb)}
        request={false}
        error="แก้แล้วเนื้อละลายแล้ว F260909-001 สาขาศาลาแดงจะติดลบ (-15.50) · แก้รายการที่ตามมาก่อน"
        onCancel={fn()}
        onSubmit={fn()}
      />
    </Panel>
  ),
};

/** Owner: the waiting request with อนุมัติ / ไม่อนุมัติ first, then the decided ones. */
export const OwnerRequestList: Story = {
  render: () => (
    <EditRequestList db={editDecidedDb} role="owner" onChanged={fn()} />
  ),
};

/** ศาลาแดง sees only its own requests, with สำเร็จ / ไม่สำเร็จ, and no buttons. */
export const BranchRequestList: Story = {
  render: () => (
    <EditRequestList
      db={asBranch(editDecidedDb)}
      role="branch"
      onChanged={fn()}
    />
  ),
};

function Bell({ db, role }: { db: Database; role: "owner" | "branch" }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex min-h-100 justify-end p-6">
      <NotificationPopover
        notifications={editRequestAlerts(
          db,
          role,
          role === "branch" ? "ศาลาแดง" : "",
          day,
        )}
        open={open}
        onToggle={() => setOpen((value) => !value)}
        onSelect={fn()}
      />
    </div>
  );
}

/** The requester's bell: one waiting, one สำเร็จ, one ไม่สำเร็จ. */
export const RequesterBell: Story = {
  render: () => <Bell db={editDecidedDb} role="branch" />,
};

/** The Owner's bell: "คำขอแก้ไขรอพิจารณา 1 รายการ", opening the history tab. */
export const OwnerBell: Story = {
  render: () => <Bell db={editDecidedDb} role="owner" />,
};

/** The approved sale: badge "แก้ไขแล้ว", current values, and who asked, who approved, when. */
export const EditedEntryDetails: Story = {
  render: () => (
    <Panel>
      <EntryDetails
        entry={sale(editDecidedDb)}
        db={editDecidedDb}
        role="owner"
        open
        onChanged={fn()}
      />
    </Panel>
  ),
};

/** ศาลาแดง's history tab: its requests above the log, "ขอแก้ไข" on its own entries. */
export const BranchHistory: Story = {
  render: () => (
    <HistoryPanel
      db={editDecidedDb}
      role="branch"
      branch="ศาลาแดง"
      onChanged={fn()}
    />
  ),
};

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fireEvent, fn, within } from "storybook/test";
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
import {
  entries,
  visibleEntries,
  type ActingRole,
  type Database,
} from "@/lib/store";
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
type Story = StoryObj<{ role: ActingRole }>;

/** Controls: who is looking, ศาลาแดง or the Owner. */
const byRole = {
  argTypes: {
    role: {
      name: "ผู้ใช้",
      options: ["branch", "owner"],
      control: {
        type: "radio" as const,
        labels: { branch: "ศาลาแดง", owner: "Owner" },
      },
    },
  },
  args: { role: "branch" as ActingRole },
};

const asBranch = (db: Database): Database => ({
  ...db,
  entries: visibleEntries(db, "branch", "ศาลาแดง"),
});
const sale = (db: Database) => entries(db, "sale")[0];

/** Pick ผู้ใช้ in Controls:
 *  - ศาลาแดง: "ขอแก้ไข" on its closed-day sale: the sale form prefilled, plus the reason.
 *  - Owner: "แก้ไข": the same form, saved at once (shown with a validation error). */
export const RequestForm: Story = {
  ...byRole,
  render: ({ role }) => (
    <Panel>
      {role === "branch" ? (
        <EditEntryForm
          entry={sale(asBranch(editPendingDb))}
          request
          onCancel={fn()}
          onSubmit={fn()}
        />
      ) : (
        <EditEntryForm
          entry={sale(editPendingDb)}
          request={false}
          error="แก้แล้วเนื้อละลายแล้ว F260909-001 สาขาศาลาแดงจะติดลบ (-15.50) · แก้รายการที่ตามมาก่อน"
          onCancel={fn()}
          onSubmit={fn()}
        />
      )}
    </Panel>
  ),
};

/** Pick ผู้ใช้ in Controls:
 *  - ศาลาแดง: only its own requests, with สำเร็จ / ไม่สำเร็จ, and no buttons.
 *  - Owner: the waiting request with อนุมัติ / ไม่อนุมัติ first, then the decided ones. */
export const RequestList: Story = {
  ...byRole,
  render: ({ role }) => (
    <EditRequestList
      db={role === "branch" ? asBranch(editDecidedDb) : editDecidedDb}
      role={role}
      onChanged={fn()}
    />
  ),
};

function Bell({ db, role }: { db: Database; role: ActingRole }) {
  return (
    <div className="flex min-h-100 justify-end p-6">
      <NotificationPopover
        notifications={editRequestAlerts(
          db,
          role,
          role === "branch" ? "ศาลาแดง" : "",
          day,
        )}
        onSelect={fn()}
      />
    </div>
  );
}

/** Pick ผู้ใช้ in Controls:
 *  - ศาลาแดง (the requester): one waiting, one สำเร็จ, one ไม่สำเร็จ.
 *  - Owner: "คำขอแก้ไขรอพิจารณา 1 รายการ", opening the history tab. */
export const RequesterBell: Story = {
  ...byRole,
  play: async ({ canvasElement }) => {
    fireEvent.click(
      within(canvasElement).getByRole("button", { name: /^การแจ้งเตือน/ }),
    );
  },
  render: ({ role }) => <Bell db={editDecidedDb} role={role} />,
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

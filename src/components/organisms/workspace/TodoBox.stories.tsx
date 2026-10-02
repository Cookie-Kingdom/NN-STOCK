import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { accountById, type AccountId } from "@/lib/accounts";
import { today } from "@/lib/format";
import { liveEntries, mutate } from "@/lib/store";
import { NotificationPopover } from "./NotificationPopover";
import { WithWorkspace, dbFor, sampleDb } from "./storyWorkspace";
import { TodoBox } from "./TodoBox";

/** The box, and the bell that lists the same things. */
const Box = ({ account }: { account: AccountId }) => (
  <div className="max-w-80">
    <WithWorkspace account={account}>
      {(ws) => (
        <div className="grid gap-4">
          <NotificationPopover ws={ws} />
          <TodoBox ws={ws} />
          {ws.draft && (
            <p className="text-caption text-text-secondary">
              เปิดฟอร์ม: {JSON.stringify(ws.draft)}
            </p>
          )}
        </div>
      )}
    </WithWorkspace>
  </div>
);

/** ศาลาแดง once the sale of today is jotted and the sale with no money is filled in. */
const doneDb = (() => {
  const branch = accountById("saladaeng")!;
  const empty = liveEntries(sampleDb).find(
    (e) => e.kind === "sale" && e.branch === branch.branch && e.values.missing,
  )!;
  const db = mutate(
    sampleDb,
    branch,
    "sale",
    { boxes: "20", lineMan: "6800" },
    "",
    today(),
  );
  return mutate(
    db,
    branch,
    "entryEdit",
    { targetId: empty.id, values: JSON.stringify({ lineMan: "11900" }) },
    "",
    today(),
  );
})();

const meta = {
  title: "Organisms/Workspace/TodoBox",
  component: Box,
  args: { account: "owner" },
  argTypes: { account: { control: false } },
  parameters: { db: sampleDb },
} satisfies Meta<typeof Box>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Owner: ยอดขายและนับเนื้อของสองสาขา Lot ที่ยังจดไม่ครบ ค่าเช่าของเดือน และบันทึกที่ช่องหลักยังว่าง
 *  กดรายการแล้วเปิดฟอร์มของรายการนั้น (บรรทัดใต้กล่องบอกว่าเปิดอะไร) · กระดิ่งด้านบนคือรายการเดียวกัน */
export const Owner: Story = {};

/** Account Manager: ไม่มีรายการยอดขาย */
export const Manager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
};

/** สาขา: เฉพาะของสาขาตัวเอง ไม่มีชื่อสาขานำหน้า */
export const Branch: Story = {
  args: { account: "saladaeng" },
  parameters: { db: dbFor("saladaeng") },
};

/** จดครบแล้ว: กล่องสีเขียว กระดิ่งไม่มีตัวเลข */
export const Done: Story = {
  args: { account: "saladaeng" },
  parameters: { db: dbFor("saladaeng", doneDb) },
};

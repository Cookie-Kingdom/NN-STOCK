import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { accountById, type AccountId } from "@/lib/accounts";
import { today } from "@/lib/format";
import { liveEntries, mutate } from "@/lib/store";
import { NotificationPopover } from "./NotificationPopover";
import { WithWorkspace, dbFor, sampleDb } from "./storyWorkspace";

/** The bell, and under it the form a line opened. */
const Bell = ({ account }: { account: AccountId }) => (
  <div className="max-w-80">
    <WithWorkspace account={account}>
      {(ws) => (
        <div className="grid gap-4">
          <NotificationPopover ws={ws} />
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
  title: "Organisms/Workspace/NotificationPopover",
  component: Bell,
  args: { account: "owner" },
  argTypes: { account: { control: false } },
  parameters: { db: sampleDb },
} satisfies Meta<typeof Bell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Owner: ยอดขายของวันที่สาขาเปิดร้าน (จดอย่างอื่นในวันนั้น) แต่ยังไม่ได้จด (ศาลาแดงวันนี้; วันที่สาขาไม่ได้จดอะไรเลย
 *  และใบสต๊อกรายวันที่ยังไม่บันทึก ไม่ขึ้นรายการ) Lot ที่ยังจดไม่ครบ ค่าเช่าของเดือน และบันทึกที่ช่องหลักยังว่าง
 *  กดกระดิ่งเพื่อเปิดรายการ กดรายการแล้วเปิดฟอร์มของรายการนั้น (บรรทัดใต้กระดิ่งบอกว่าเปิดอะไร)
 *  · รายการของสาขา (ยอดขาย บันทึกของสาขาที่ช่องยังว่าง) เป็นสถานะ ไม่มีลูกศร กดไม่ได้: สาขาเป็นคนจด */
export const Owner: Story = {};

/** สาขา: เฉพาะของสาขาตัวเอง ไม่มีชื่อสาขานำหน้า */
export const Branch: Story = {
  args: { account: "saladaeng" },
  parameters: { db: dbFor("saladaeng") },
};

/** จดครบแล้ว: กระดิ่งไม่มีตัวเลข */
export const Done: Story = {
  args: { account: "saladaeng" },
  parameters: { db: dbFor("saladaeng", doneDb) },
};

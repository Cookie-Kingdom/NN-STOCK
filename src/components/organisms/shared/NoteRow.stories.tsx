import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Panel } from "@/components/atoms/Panel";
import {
  WithWorkspace,
  dbFor,
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import type { AccountId } from "@/lib/accounts";
import { visibleNotes } from "@/lib/store";
import { NoteRow } from "./NoteRow";

/** The newest note of each kind the account sees, plus every yellow one. */
function Rows({ account }: { account: AccountId }) {
  return (
    <WithWorkspace account={account}>
      {(ws) => {
        const seen = new Set<string>();
        return (
          <Panel flush className="max-w-170 overflow-hidden">
            {visibleNotes(ws.db, ws.account)
              .filter((e) => {
                const first = !seen.has(e.kind);
                seen.add(e.kind);
                return first || !!e.values.missing;
              })
              .map((e) => (
                <NoteRow key={e.id} entry={e} ws={ws} />
              ))}
          </Panel>
        );
      }}
    </WithWorkspace>
  );
}

const meta = {
  title: "Organisms/Shared/NoteRow",
  component: Rows,
  args: { account: "owner" },
  argTypes: { account: { control: false } },
  parameters: { db: sampleDb },
} satisfies Meta<typeof Rows>;

export default meta;
type Story = StoryObj<typeof meta>;

/** บันทึกล่าสุดของทุกชนิดที่ Owner เห็น กดที่แถวเพื่อดูทุกช่อง:
 *  - ยอดขาย สีเขียวมีเครื่องหมาย + · จ่ายเงิน สีแดงมีเครื่องหมาย −
 *  - แถวขอบเหลือง: ยอดขายที่ยังไม่ได้จดยอด LINE MAN และ ส่งไปรม ที่ยังไม่ผูก PO เนื้อ
 *  - 「ลบ」 แล้วแถวหายไป (ข้อความแจ้งพร้อม 「เลิกทำ」 อยู่ใน Templates/WorkspaceShell) */
export const Owner: Story = {};

/** Account Manager: ไม่มียอดขาย และไม่มีจ่ายเงินหมวดค่าแรง */
export const Manager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
};

/** สาขา: เห็นเฉพาะบันทึกของสาขาตัวเอง บรรทัดรองไม่บอกชื่อสาขา */
export const Branch: Story = {
  args: { account: "saladaeng" },
  parameters: { db: dbFor("saladaeng") },
};

/** จอ 390px: ยอดอยู่ขวา ข้อความตัดบรรทัดได้ */
export const Phone: Story = { ...phone };

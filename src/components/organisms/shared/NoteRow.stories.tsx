import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Panel } from "@/components/atoms/Panel";
import {
  WithWorkspace,
  dbFor,
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import type { AccountId } from "@/lib/accounts";
import { legacySale, visibleNotes } from "@/lib/store";
import { today } from "@/lib/format";
import { legacyDb } from "../../../../.storybook/fixtures";
import { NoteRow } from "./NoteRow";

/** The newest note of each kind the account sees, plus every yellow one. */
function Rows({ account, dated }: { account: AccountId; dated?: boolean }) {
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
                <NoteRow key={e.id} entry={e} ws={ws} dated={dated} />
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
 *  - 「ลบ」 แล้วแถวหายไป (ข้อความแจ้งพร้อม 「เลิกทำ」 อยู่ใน Templates/WorkspaceShell)
 *  - แถวของสาขา (ยอดขาย นับเนื้อ ฯลฯ) ไม่มีปุ่ม 「แก้ไข」 「ลบ」: สาขาเป็นคนแก้ */
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

/** `dated`: รายการที่รวมบันทึกหลายวัน (Lots, จ่ายเงินล่าสุด) บอกวันที่เหนือเวลา */
export const Dated: Story = { args: { dated: true } };

/** จอ 390px: ยอดอยู่ขวา ข้อความตัดบรรทัดได้ */
export const Phone: Story = { ...phone };

/** ยอดขายที่นำเข้าจากไฟล์เดิม: ยอดอยู่ใต้ 「ยอดเดิม (หลัง GP แล้ว)」 ไม่ขึ้นว่ายังไม่ได้จดยอด
 *  LINE MAN · แถวที่ไฟล์เดิมไม่บอกสาขา บรรทัดรองเขียน 「ไม่ระบุสาขา」 */
export const LegacySale: Story = {
  parameters: { db: legacyDb(today()) },
  render: () => (
    <WithWorkspace account="owner">
      {(ws) => (
        <Panel flush className="max-w-170 overflow-hidden">
          {visibleNotes(ws.db, ws.account)
            .filter((e) => e.values[legacySale.key])
            .map((e) => (
              <NoteRow key={e.id} entry={e} ws={ws} />
            ))}
        </Panel>
      )}
    </WithWorkspace>
  ),
};

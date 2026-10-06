import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  WithWorkspace,
  dbFor,
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import type { AccountId } from "@/lib/accounts";
import { seed } from "@/lib/store";
import { AccountingPage } from "./AccountingPage";

const Accounting = ({ account }: { account: AccountId }) => (
  <WithWorkspace account={account}>
    {(ws) => <AccountingPage ws={ws} />}
  </WithWorkspace>
);

const meta = {
  title: "Organisms/Owner/AccountingPage",
  component: Accounting,
  args: { account: "owner" },
  argTypes: { account: { control: false } },
  parameters: { db: sampleDb },
} satisfies Meta<typeof Accounting>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Owner: การ์ดสองใบ 「งบที่กันไว้จาก PO」 (ยอดของ PO ที่ยังรอจ่าย) และ 「ยอดจ่ายจริงเดือนนี้」
 *  (เทียบเดือนก่อน) คิดจากตารางเสมอ · ค้นหา กรอง Project สถานะ ที่มา และปุ่ม 「PO รอจ่าย (n)」
 *  ที่ตั้ง ที่มา = PO กับ สถานะ = รอจ่าย ในคลิกเดียว (กดซ้ำเพื่อล้าง) ·
 *  PO เนื้อ และ PO รมควัน ขึ้นเองเป็น 「PO เนื้อ」 กับ 「PO รมควัน」 (ยอดจ่ายจริงจากจ่ายเงินให้ผู้ขาย
 *  ตัดใบเก่าก่อน: PO รมควันแรกจ่ายแล้ว PO เนื้อแรกจ่ายไปครึ่งหนึ่งจึงรอจ่าย) ·
 *  ค่าใช้จ่ายที่จดเองครบทุกสถานะ กระดาษ A4 สองครั้งได้ SKU เดียวกัน (ใต้ชื่อรายการ) ·
 *  กดเลข PO เพื่อไปหน้า Lots ที่ PO นั้น · แถวล่างคือยอดรวม ไม่รวมที่ยกเลิก
 *  ใต้ตารางบอก 「แสดง n จาก m รายการ」 */
export const Owner: Story = {};

/** Account Manager: ตารางเดียวกัน แก้ไขและลบแถวที่จดเองได้ */
export const Manager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
};

/** ยังไม่มี PO และไม่มีค่าใช้จ่าย */
export const Empty: Story = { parameters: { db: seed } };

/** จอ 390px: การ์ดเรียงสองคอลัมน์ ตัวกรองขึ้นบรรทัดใหม่ ตารางเลื่อนซ้ายขวา */
export const Phone: Story = { ...phone };

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

/** Owner: PO เนื้อ และ PO รมควัน ขึ้นเองเป็น 「ดึงจากระบบ PO」 (ยอดจ่ายจริงจากจ่ายเงินให้ผู้ขาย
 *  ตัดใบเก่าก่อน: PO รมควันแรกจ่ายแล้ว PO เนื้อแรกจ่ายไปครึ่งหนึ่งจึงรอจ่ายเงิน) ·
 *  ค่าใช้จ่ายที่จดเองครบทุกสถานะ กระดาษ A4 สองครั้งได้ Item No. เดียวกัน ·
 *  กดเลข PO เพื่อไปหน้า Lots ที่ PO นั้น · แถวล่างคือยอดรวม ไม่รวมที่ยกเลิก */
export const Owner: Story = {};

/** Account Manager: ตารางเดียวกัน แก้ไขและลบแถวที่จดเองได้ */
export const Manager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
};

/** ยังไม่มี PO และไม่มีค่าใช้จ่าย */
export const Empty: Story = { parameters: { db: seed } };

/** จอ 390px: ตารางเลื่อนซ้ายขวา */
export const Phone: Story = { ...phone };

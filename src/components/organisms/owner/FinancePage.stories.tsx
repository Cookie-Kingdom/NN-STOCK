import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  WithWorkspace,
  dbFor,
  phone,
  wide,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import type { AccountId } from "@/lib/accounts";
import { seed } from "@/lib/store";
import { FinancePage } from "./FinancePage";

const Finance = ({ account }: { account: AccountId }) => (
  <WithWorkspace account={account}>
    {(ws) => <FinancePage ws={ws} />}
  </WithWorkspace>
);

const meta = {
  title: "Organisms/Owner/FinancePage",
  component: Finance,
  args: { account: "owner" },
  argTypes: { account: { control: false } },
  parameters: { db: sampleDb },
} satisfies Meta<typeof Finance>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Owner: Revenue ของ Project นี้ หน้าตาเดียวกับ Overview (สลับเดือน / ปี กราฟ ตัวเลขของช่วง
 *  จากรายได้ถึงกำไร สาขา ช่องทางขาย P&L) ไม่มีตารางแต่ละ Project · ต่อด้วยยอดคงเหลือที่ยังไม่ได้
 *  จ่ายต่อผู้ขาย (เหลือง = ยังจ่ายไม่ครบ เขียว = จ่ายครบแล้ว) เงินที่พนักงานสำรองจ่าย
 *  และจ่ายเงินล่าสุด 12 รายการ */
export const Owner: Story = {};

/** Account Manager: ไม่มี Revenue เลือกเดือนเดียว ไม่มีบรรทัดของ Owner ในตาราง
 *  ไม่มีเงินที่พนักงานสำรองจ่าย ตารางเป็น「จ่ายเงินแยกหมวด」และจบที่「รวมที่จ่าย」 */
export const Manager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
};

/** ยังไม่มีบันทึก: กราฟว่าง ตัวเลขเป็นศูนย์ ค่าเช่า/น้ำไฟของเดือนเป็นสีเหลือง */
export const Empty: Story = { parameters: { db: seed } };

/** จอ 390px: คอลัมน์เดียว ตัวเลขสองช่องต่อแถว */
export const Phone: Story = { ...phone };

/** จอ 1920px: จ่ายเงินล่าสุดอยู่ข้างยอดคงเหลือต่อผู้ขาย ใต้ P&L */
export const Wide: Story = { ...wide };

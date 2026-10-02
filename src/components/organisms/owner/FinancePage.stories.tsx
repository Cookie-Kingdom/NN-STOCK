import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  WithWorkspace,
  dbFor,
  phone,
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

/** Owner: ตัวเลขสี่ตัวของเดือน P&L ยอดคงเหลือที่ยังไม่ได้จ่ายต่อผู้ขาย (เหลือง = ยังจ่ายไม่ครบ
 *  เขียว = จ่ายครบแล้ว) เงินที่พนักงานสำรองจ่าย และจ่ายเงินล่าสุด 12 รายการ */
export const Owner: Story = {};

/** Account Manager: ไม่มีตัวเลขยอดขาย ไม่มีบรรทัดของ Owner ในตาราง
 *  ไม่มีเงินที่พนักงานสำรองจ่าย ตารางเป็น「จ่ายเงินแยกหมวด」และจบที่「รวมที่จ่าย」 */
export const Manager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
};

/** ยังไม่มีบันทึก: ตัวเลขเป็นศูนย์ ค่าเช่า/น้ำไฟของเดือนเป็นสีเหลือง */
export const Empty: Story = { parameters: { db: seed } };

/** จอ 390px: คอลัมน์เดียว ตัวเลขสองช่องต่อแถว */
export const Phone: Story = { ...phone };

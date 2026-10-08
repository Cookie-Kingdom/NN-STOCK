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

/** Owner: เงินที่จ่ายจริงของ Project สลับดูรายเดือน / รายปี · ตัวเลขหกช่อง (ยอดจ่ายทั้งหมด
 *  บริษัทจ่ายเอง พนักงานสำรองจ่าย เงินคืนพนักงาน เงินออกจากร้านจริง ยอดค้างจ่ายถึงวันนี้)
 *  ยอดจ่ายแยกหมวด ยอดค้างจ่ายแยกผู้ขาย (เหลือง = ยังจ่ายไม่ครบ เขียว = จ่ายครบแล้ว)
 *  เงินที่พนักงานสำรองจ่าย (สำรองจ่าย คืนแล้ว ค้างคืน และปุ่ม "คืนเงิน") และรายการจ่ายเงินล่าสุด
 *  12 รายการ เป็นตาราง (วันที่ หมวด รายการ ผู้ขาย / ผู้รับ ที่มา / ประเภทบิล ยอดจ่าย เอกสารแนบ
 *  และปุ่มแก้ไข / ลบท้ายแถว) · Revenue อยู่ที่หน้า Overview ของ Project */
export const Owner: Story = {};

/** Account Manager: ไม่มีตัวเลขหกช่อง ไม่มีค่าแรงในตาราง ไม่มีเงินที่พนักงานสำรองจ่าย
 *  ไม่เห็นบันทึกคืนเงินพนักงาน */
export const Manager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
};

/** ยังไม่มีบันทึก: ตัวเลขเป็นศูนย์ ค่าเช่า/น้ำไฟของเดือนเป็นสีเหลือง
 *  รายการจ่ายเงินล่าสุดเป็น "ยังไม่มีรายการจ่ายเงิน" */
export const Empty: Story = { parameters: { db: seed } };

/** จอ 390px: คอลัมน์เดียว ตัวเลขสองช่องต่อแถว ตารางรายการจ่ายเงินล่าสุดเลื่อนซ้ายขวาในการ์ด */
export const Phone: Story = { ...phone };

/** จอ 1920px: ตาราง การ์ดผู้ขายและพนักงาน และรายการจ่ายเงินล่าสุด เรียงสามคอลัมน์ */
export const Wide: Story = { ...wide };

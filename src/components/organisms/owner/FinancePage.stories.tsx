import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  WithWorkspace,
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

/** Owner: เงินที่เข้าและออกจริงของ Project สลับดูรายเดือน / รายปี · ตัวเลขนำห้าช่อง (เงินเข้าจริง
 *  เงินออกจากร้านจริง กระแสเงินสดสุทธิ แล้วยอดค้างรับและยอดค้างจ่ายถึงวันนี้) ใต้เส้นคือเงินออก
 *  แยกว่าใครจ่าย (ยอดจ่ายทั้งหมด บริษัทจ่ายเอง พนักงานสำรองจ่าย เงินคืนพนักงาน) · กราฟเงินเข้า–ออก
 *  หกเดือนถึงเดือนที่เลือก (รายปี: สิบสองเดือน) · ยอดจ่ายแยกหมวด ยอดค้างรับแยกช่องทางขาย (ปุ่ม
 *  "รับเงิน") ยอดค้างจ่ายแยกผู้ขาย (เหลือง = ยังไม่ครบ เขียว = ครบแล้ว) เงินที่พนักงานสำรองจ่าย
 *  (ปุ่ม "คืนเงิน") · รายการเงินเข้า–ออกล่าสุด 12 รายการ กรองได้ ทั้งหมด / รายรับ / รายจ่าย
 *  (วันที่ รายรับ / รายจ่าย หมวด รายการ คู่รายการ ที่มา / ประเภทบิล จำนวนเงิน เอกสารแนบ และปุ่ม
 *  แก้ไข / ลบท้ายแถว) · Revenue อยู่ที่หน้า Overview ของ Project */
export const Owner: Story = {};

/** ยังไม่ได้จดรายรับเลย: เงินเข้าจริงเป็นศูนย์ กระแสเงินสดสุทธิติดลบสีแดง ยอดค้างรับถึงวันนี้และ
 *  แถว LINE MAN เป็น "ยังไม่ได้จด" (ไม่เดาตัวเลข) มีปุ่ม "รับเงิน" · ตัวกรอง "รายรับ" ว่าง */
export const NoIncome: Story = {
  parameters: {
    db: {
      ...sampleDb,
      entries: sampleDb.entries.filter((e) => e.kind !== "income"),
    },
  },
};

/** ยังไม่มีบันทึก: ตัวเลขเป็นศูนย์ กราฟเป็น "ยังไม่มีเงินเข้า–ออกในช่วงนี้" ค่าเช่า/น้ำไฟของเดือน
 *  เป็นสีเหลือง รายการล่าสุดเป็น "ยังไม่มีรายการเงินเข้า–ออก" */
export const Empty: Story = { parameters: { db: seed } };

/** จอ 390px: คอลัมน์เดียว ตัวเลขนำสองช่องต่อแถว (กระแสเงินสดสุทธิเต็มแถว)
 *  ตารางรายการล่าสุดเลื่อนซ้ายขวาในการ์ด */
export const Phone: Story = { ...phone };

/** จอ 1920px: ตัวเลขนำสามช่องแล้วสองช่อง ตารางยอดจ่ายแยกหมวดอยู่ข้างการ์ดค้างรับ / ค้างจ่าย */
export const Wide: Story = { ...wide };

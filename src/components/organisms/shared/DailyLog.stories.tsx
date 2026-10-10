import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  WithWorkspace,
  changedDb,
  dbFor,
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import type { AccountId } from "@/lib/accounts";
import { seed } from "@/lib/store";
import { DailyLog } from "./DailyLog";

const Log = ({ account }: { account: AccountId }) => (
  <WithWorkspace account={account}>
    {(ws) => <DailyLog ws={ws} />}
  </WithWorkspace>
);

const meta = {
  title: "Organisms/Shared/DailyLog",
  component: Log,
  args: { account: "owner" },
  argTypes: { account: { control: false } },
  parameters: { db: sampleDb },
} satisfies Meta<typeof Log>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Owner: ตารางเดียว ใหม่สุดอยู่บน เรียงตามเวลาที่บันทึกจริง แถวคั่นบอกวันที่บันทึก
 *  · คอลัมน์「วันที่รายการ」คือวันที่ของบันทึกเอง · กดแถวเพื่อเปิดทุกค่าของบันทึก พร้อม「แก้ไข」「ลบ」
 *  (แถวของสาขาไม่มีปุ่ม: สาขาเป็นคนแก้) · ตัวกรอง ทั้งหมด / Lot / เงิน / สาขา และช่วงวันที่บันทึก
 *  · 50 แถวแรก แล้วมีปุ่ม「ดูเพิ่มเติม」· หน้านี้ไม่มีป้ายเตือนหรือกล่อง「ยังไม่ได้จด」(อยู่ที่กระดิ่ง) */
export const Owner: Story = {};

/** สาขา: เฉพาะบันทึกของสาขาตัวเอง ไม่มีคอลัมน์สาขา ไม่มีตัวกรองกลุ่ม */
export const Branch: Story = {
  args: { account: "saladaeng" },
  parameters: { db: dbFor("saladaeng") },
};

/** จดย้อนหลัง แก้ไข และลบ: บันทึกที่จดวันนี้ของ 5 วันก่อนอยู่บนสุด (วันที่รายการไม่ตรงกับวันที่บันทึก)
 *  · แถว「แก้ไข」บอกค่าก่อน → หลัง · แถว「ลบ」และ「กู้คืนรายการ」เป็นแถวของตัวเอง ไม่มีปุ่ม「ย้อนกลับ」(แก้ไขบันทึกใหม่แทน)
 *  · แถวที่ถูกย้อนกลับ ลบ หรือแก้ไขภายหลัง บอกไว้ด้วยตัวอักษรสีเทา */
export const WithChanges: Story = { parameters: { db: changedDb } };

/** จอ 390px (สาขา): แถวละสองบรรทัด เวลา · การกระทำ · รายการ และจำนวนเงินชิดขวา แล้วรายละเอียด
 *  ไม่มีการเลื่อนแนวนอน */
export const Phone: Story = {
  ...phone,
  args: { account: "saladaeng" },
  parameters: { ...phone.parameters, db: dbFor("saladaeng") },
};

/** จอ 390px (Owner) มีการแก้ไขและลบ: บรรทัดที่สองบอก PO และสาขาด้วย */
export const PhoneWithChanges: Story = {
  ...phone,
  parameters: { ...phone.parameters, db: changedDb },
};

/** ยังไม่มีบันทึกเลย */
export const Empty: Story = { parameters: { db: seed } };

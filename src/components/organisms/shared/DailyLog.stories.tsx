import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  WithWorkspace,
  changedDb,
  dbFor,
  phone,
  wide,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import type { AccountId } from "@/lib/accounts";
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

/** Owner: วันนี้เปิดไว้ วันก่อนหน้าพับเหลือหัววัน (จำนวนบันทึก ยอดเงินเข้าและออก) กดหัววันเพื่อเปิด
 *  · วันที่เปิดแสดง 7 แถวแรก แล้วมีปุ่ม「ดูเพิ่มเติม」· ป้ายยอดขายของสองสาขาที่หัววัน วันที่มีสาขายังไม่ได้จดยอดขายเป็นสีเหลือง
 *  ป้ายเหลืองและกล่อง「ยังไม่ได้จด」เป็นสถานะ กดไม่ได้ (หน้านี้ไว้ดู ไม่ได้ไว้จด) · แถวของสาขาไม่มีปุ่มแก้ไขและลบ
 *  · ตัวกรอง ทั้งหมด / ยังไม่ได้จด / Lot / เงิน / สาขา */
export const Owner: Story = {};

/** สาขา: ป้ายของสาขาตัวเอง ตัวกรองเหลือสองตัว และกล่องเนื้อคงเหลือ · สาขาจดจากหน้า Inventory */
export const Branch: Story = {
  args: { account: "saladaeng" },
  parameters: { db: dbFor("saladaeng") },
};

/** มีการแก้ไขและลบ: ท้ายรายการวัน ซ้ายเป็น「ดูย้อนหลังอีก 7 วัน」ขวาเป็น「ประวัติการแก้ไขและลบ」กดแล้วเปิดประวัติใต้แถวนั้น บอกค่าก่อนและหลัง กด「ย้อนกลับ」ได้ */
export const WithChanges: Story = { parameters: { db: changedDb } };

/** จอ 390px: คอลัมน์เดียว กล่องยังไม่ได้จดอยู่ใต้รายการ */
export const Phone: Story = { ...phone };

/** จอ 1920px: สองคอลัมน์เหมือนจอปกติ */
export const Wide: Story = {
  ...wide,
  parameters: { ...wide.parameters, db: changedDb },
};

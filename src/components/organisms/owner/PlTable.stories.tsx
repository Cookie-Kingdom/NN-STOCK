import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import { today } from "@/lib/format";
import { seed } from "@/lib/store";
import { shopProject } from "@/lib/store/ledger";
import { PlTable } from "./PlTable";

const meta = {
  title: "Organisms/Owner/PlTable",
  component: PlTable,
  args: { db: sampleDb, month: today().slice(0, 7), full: true },
  argTypes: { db: { control: false } },
} satisfies Meta<typeof PlTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Owner: ยอดขาย GP รายได้อื่น (สีเขียว รวมของบริษัทส่วนกลาง) ทุกหมวด กำไรจากการดำเนินงาน
 *  (ยอดขาย − GP + รายได้อื่น − ค่าใช้จ่าย) แล้วอุปกรณ์/ลงทุนแยกบรรทัด
 *  ค่าเช่า/น้ำไฟของเดือนที่ยังไม่มีรายการเป็นสีเหลือง · คอลัมน์「% ของรายได้รวม」ของช่วงนี้
 *  (ซ่อนบนจอมือถือ) และหมายเหตุว่าเป็นตัวเลขประมาณ ไม่ใช่งบยื่นภาษี */
export const Full: Story = {};

/** ของ Project: รายได้อื่นนับเฉพาะที่จดให้ Project นั้น ไม่รวมดอกเบี้ยรับของบริษัทส่วนกลาง */
export const Project: Story = { args: { project: shopProject } };

/** ยังไม่มียอดขายและรายได้อื่น: ไม่มีบรรทัดรายได้อื่น 「% ของรายได้รวม」เป็น — ทุกบรรทัด
 *  ไม่มี 0% หรือ NaN */
export const NoSales: Story = { args: { db: seed } };

/** จอ 390px: ไม่มีคอลัมน์「% ของรายได้รวม」 */
export const Phone: Story = { ...phone };

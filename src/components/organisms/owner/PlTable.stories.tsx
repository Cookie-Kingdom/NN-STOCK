import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  dbFor,
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import { today } from "@/lib/format";
import { seed } from "@/lib/store";
import { PlTable } from "./PlTable";

const meta = {
  title: "Organisms/Owner/PlTable",
  component: PlTable,
  args: { db: sampleDb, month: today().slice(0, 7), full: true },
  argTypes: { db: { control: false } },
} satisfies Meta<typeof PlTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Owner: ยอดขาย GP ทุกหมวด กำไรจากการดำเนินงาน แล้วอุปกรณ์/ลงทุนแยกบรรทัด
 *  ค่าเช่า/น้ำไฟของเดือนที่ยังไม่มีรายการเป็นสีเหลือง · คอลัมน์「% ของยอดขาย」ของช่วงนี้
 *  (ซ่อนบนจอมือถือ) และหมายเหตุว่าเป็นตัวเลขประมาณ ไม่ใช่งบยื่นภาษี */
export const Full: Story = {};

/** ยังไม่มียอดขาย: 「% ของยอดขาย」เป็น — ทุกบรรทัด ไม่มี 0% หรือ NaN */
export const NoSales: Story = { args: { db: seed } };

/** จอ 390px: ไม่มีคอลัมน์「% ของยอดขาย」 */
export const Phone: Story = { ...phone };

/** Account Manager: เฉพาะหมวดจ่ายเงินที่เห็นได้ จบที่「รวมยอดจ่าย」
 *  ไม่มีคอลัมน์ % และไม่มีหมายเหตุงบ: คิดย้อนเป็นยอดขายไม่ได้ */
export const Manager: Story = {
  args: { db: dbFor("manager"), full: false },
};

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  dbFor,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import { today } from "@/lib/format";
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
 *  ค่าเช่า/น้ำไฟของเดือนที่ยังไม่มีรายการเป็นสีเหลือง */
export const Full: Story = {};

/** Account Manager: เฉพาะหมวดจ่ายเงินที่เห็นได้ จบที่「รวมที่จ่าย」 */
export const Manager: Story = {
  args: { db: dbFor("manager"), full: false },
};

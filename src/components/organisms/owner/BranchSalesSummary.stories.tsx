import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import { today } from "@/lib/format";
import { seed } from "@/lib/store";
import { legacyDb } from "../../../../.storybook/fixtures";
import { BranchSalesSummary } from "./BranchSalesSummary";

const meta = {
  title: "Organisms/Owner/BranchSalesSummary",
  component: BranchSalesSummary,
  args: { db: sampleDb, period: today().slice(0, 7) },
  argTypes: { db: { control: false } },
} satisfies Meta<typeof BranchSalesSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

/** สรุปยอดขายสาขา (ที่ Overview และ Finance ของ Project): หนึ่งแถวต่อวัน สาขา และสินค้า
 *  ใหม่สุดก่อน กับจำนวนที่สาขาจด แถว「รวม」ท้ายตารางรวมจำนวนของแถวที่กรองอยู่
 *  · สลับ「รายวัน | รายเดือน」 · กรองตามวันที่ สาขา สินค้า · แถวเกิน 20 แถวมีปุ่ม「ดูเพิ่มเติม」 */
export const Month: Story = {};

/** มุมมองปี: รายเดือนเป็นหนึ่งแถวต่อเดือนต่อสาขา */
export const Year: Story = { args: { period: today().slice(0, 4) } };

/** ยอดจากไฟล์เดิมที่ไม่บอกสาขา: แถว「ไม่ระบุสาขา」 อยู่ท้ายของวันนั้น */
export const LegacySales: Story = {
  args: { db: legacyDb(today()) },
};

/** ยังไม่มียอดขายในช่วงนี้ */
export const Empty: Story = { args: { db: seed } };

/** จอ 390px: ตารางเลื่อนในการ์ด หน้าไม่เลื่อนออกข้าง */
export const Phone: Story = { ...phone };

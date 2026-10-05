import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import {
  WithWorkspace,
  dbFor,
  phone,
  wide,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import type { AccountId } from "@/lib/accounts";
import { today } from "@/lib/format";
import { countedDb, emptyDb } from "../../../../.storybook/fixtures";
import { OwnerStock } from "./OwnerStock";

const Stock = ({ account }: { account: AccountId }) => (
  <WithWorkspace account={account}>
    {(ws) => <OwnerStock ws={ws} />}
  </WithWorkspace>
);

const meta = {
  title: "Organisms/Owner/OwnerStock",
  component: Stock,
  args: { account: "owner" },
  argTypes: { account: { control: false } },
  parameters: { db: sampleDb },
} satisfies Meta<typeof Stock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Owner: บนสุดคือสินทรัพย์ที่ซื้อเข้า Project จากหน้า Accounting: มูลค่ารวมและจำนวนรายการ แล้วตารางละ
 *  ประเภทสินค้า (SKU · รายการ · รายละเอียด / สเปก · คลังกลาง · สาขาศาลาแดง · สาขามีนบุรี · ระหว่างส่ง ·
 *  คงเหลือรวม · ผู้ขาย · ซื้อล่าสุด · จำนวนซื้อ · มูลค่า) รายการเดียวกันที่ซื้อหลายครั้งรวมเป็นแถวเดียว ·
 *  รายการที่ยกเลิกและที่ซื้อเข้าส่วนกลางไม่ขึ้น · ยอดของแต่ละที่เป็นตัวเลขธรรมดา ติดลบเป็นสีแดง ·
 *  คงเหลือรวม = ทุกที่ + ระหว่างส่ง · แถวที่ไม่มี SKU หรือไม่เคยใส่จำนวนเป็น「—」·
 *  ถุงสูญญากาศ: คลังกลาง 700 ระหว่างส่ง 300 (รอศาลาแดงยืนยันรับ) รวม 1,000 · ตู้เย็น: คลังกลาง 1 ศาลาแดง 1 ·
 *  เครื่องซีลสูญญากาศซื้อเข้าศาลาแดงโดยตรง: ศาลาแดง 1 ·
 *  ถัดมาคือตารางวัสดุ แถวละรายการ คอลัมน์ละที่: SKU · รายการ · คลังกลาง · สาขาศาลาแดง ·
 *  สาขามีนบุรี · ระหว่างส่ง · รวม · สถานะ · คลังกลางคือยอดซื้อเข้า − จัดสรรออก ไม่มีการนับ
 *  (ถุงหิ้วกระดาษ 1,500) เป็น「—」เฉพาะวัสดุที่ยังไม่มี SKU · รวม = คลังกลาง + ทุกสาขา + ระหว่างส่ง ·
 *  ใต้ตัวเลขของแต่ละสาขาบอกยอดนับล่าสุด (นับวันนี้ / นับ <วันที่> / นับ <วันที่> · เกิน 7 วัน /
 *  ยังไม่เคยนับ) · ช่องที่ยังไม่ได้นับเป็นสีเหลือง ช่องที่ไม่เหลือเป็นสีแดง · หน่วย (ชิ้น) บอกครั้งเดียวใต้ตาราง ·
 *  สถานะของแถว: หมด / ยังไม่ได้นับ: สาขา… / พร้อมใช้ (คลังกลางไม่มีการนับ จึงไม่ขึ้น「ยังไม่ได้นับ」) ·
 *  ไม่มีช่องนับ · ปุ่ม「จัดสรรสินค้า」อยู่ที่หัวหน้า (Templates/WorkspaceShell → InventoryButton) ·
 *  SKU คือเลขที่เว็บออกให้วัสดุ (SKU-0001…) วัสดุที่ยังไม่มี SKU เป็น「—」จนกว่าจะบันทึกรายชื่อวัสดุอีกครั้ง ·
 *  เนื้อ ข้าวเหนียว และน้ำพริกอยู่ที่หน้า Stock (OwnerMeatStock) */
export const Owner: Story = {};

/** Account Manager: เห็นเหมือน Owner */
export const Manager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
};

/** ค้นหา「sku-000」เหลือ SKU-0001 ถึง SKU-0009 ตัวนับบอกจำนวนแถวที่แสดง */
export const Filtered: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("ค้นหา"), "sku-000");
    const rows = within(canvas.getByRole("region", { name: "วัสดุ" }))
      .getAllByRole("row")
      .slice(1);
    await expect(rows).toHaveLength(9);
    await expect(
      canvas.getByText(new RegExp(`^แสดง ${rows.length} จาก`)),
    ).toBeVisible();
  },
};

/** ค้นหาแล้วไม่พบ: แถวเดียวบอกว่าไม่มีรายการที่ตรง */
export const NoMatch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("ค้นหา"), "zzz");
    await expect(
      canvas.getByText("ไม่พบรายการที่ตรงกับที่ค้นหา"),
    ).toBeVisible();
  },
};

/** ฐานข้อมูลเปล่า: ทุกแถว「หมด」 */
export const Empty: Story = { parameters: { db: emptyDb } };

/** ส่วนต่างตอนนับล่าสุด (นับได้ − ควรเหลือ) ในช่องของสาขา ใต้วันที่นับ เป็นตัวเลขธรรมดา ไม่ใช่คำเตือน ·
 *  มีตั้งแต่การนับครั้งที่สอง · ศาลาแดง แถวแรก「ส่วนต่าง 0 ชิ้น」「ควรเหลือ 100 · นับได้ 100」
 *  แถวที่สอง「ส่วนต่าง −3 ชิ้น」「ควรเหลือ 50 · นับได้ 47」แถวที่สามนับครั้งเดียว (30) ไม่มีบรรทัดส่วนต่าง ·
 *  แถวอื่นและมีนบุรียังไม่เคยนับ ไม่มีบรรทัดส่วนต่าง */
export const Variance: Story = { parameters: { db: countedDb(today()) } };

/** จอ 390px: ตารางสินทรัพย์เหลือ รายการ ยอดของแต่ละที่ ระหว่างส่ง และคงเหลือรวม (ไม่มี SKU รายละเอียด
 *  และคอลัมน์การซื้อ) · ตารางเลื่อนในกรอบของตัวเอง หน้าไม่เลื่อนข้าง */
export const Phone: Story = { ...phone };

/** จอ 1920px: ตารางเต็มความกว้างของหน้า */
export const Wide: Story = { ...wide };

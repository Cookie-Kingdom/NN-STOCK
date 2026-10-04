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
import { emptyDb } from "../../../../.storybook/fixtures";
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

/** Owner: ตารางวัสดุ แถวละรายการ คอลัมน์ละที่: SKU · สินค้า · คลังกลาง · สาขาศาลาแดง ·
 *  สาขามีนบุรี · รวม · สถานะ (คลังกลางเป็น「—」ทุกแถว ยังไม่มีคลังกลางของวัสดุ) ·
 *  ใต้ตัวเลขของแต่ละสาขาบอกยอดนับล่าสุด (นับวันนี้ / นับ <วันที่> / นับ <วันที่> · เกิน 7 วัน /
 *  ยังไม่เคยนับ) · ช่องที่ยังไม่ได้นับเป็นสีเหลือง ช่องที่ไม่เหลือเป็นสีแดง · หน่วย (ชิ้น) บอกครั้งเดียวใต้ตาราง ·
 *  สถานะของแถว: หมด / ยังไม่ได้นับ: สาขา… / พร้อมใช้ · ดูได้อย่างเดียว ไม่มีปุ่มจดและช่องนับ ·
 *  SKU คือเลขที่เว็บออกให้วัสดุ (SKU-0001…) วัสดุที่ยังไม่มี SKU เป็น「—」จนกว่าจะบันทึกรายชื่อวัสดุอีกครั้ง ·
 *  เนื้อ ข้าวเหนียว และน้ำพริกอยู่ที่หน้า Stock (OwnerMeatStock) */
export const Owner: Story = {};

/** Account Manager: เห็นเหมือน Owner */
export const Manager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
};

/** กรอง: เลือก「สาขาศาลาแดง」เหลือคอลัมน์ของสาขานั้นคอลัมน์เดียว (ไม่มี รวม) แล้วค้นหา「sku-000」
 *  เหลือ SKU-0001 ถึง SKU-0009 ตัวนับบอกจำนวนแถวที่แสดง */
export const Filtered: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(
      canvas.getByLabelText("อยู่ที่"),
      "สาขาศาลาแดง",
    );
    await expect(
      canvas.getAllByRole("columnheader").map((th) => th.textContent),
    ).toEqual(["SKU", "สินค้า", "สาขาศาลาแดง", "สถานะ"]);
    await userEvent.type(canvas.getByLabelText("ค้นหา"), "sku-000");
    const rows = canvas.getAllByRole("row").slice(1);
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

/** จอ 390px: ช่องค้นหาและตัวกรองขึ้นบรรทัดใหม่ ตารางเลื่อนในกรอบของตัวเอง หน้าไม่เลื่อนข้าง */
export const Phone: Story = { ...phone };

/** จอ 1920px: ตารางเต็มความกว้างของหน้า */
export const Wide: Story = { ...wide };

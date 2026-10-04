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

/** Owner: สองกล่องเรียงลงมา · 「เนื้อ (กก.)」: เนื้อที่ฝากไว้ที่ร้านขายเนื้อ สต๊อกกลางของแต่ละ Lot
 *  และเนื้อของแต่ละสาขาพร้อมสถานะการนับ ·「วัสดุและน้ำพริก」: แถวละรายการ คอลัมน์ละที่
 *  SKU · สินค้า · ประเภท · คลังกลาง · สาขาศาลาแดง · สาขามีนบุรี · รวม · สถานะ (คลังกลางเป็น「—」
 *  ทุกแถว ยังไม่มีคลังกลางของวัสดุ) · ช่องของสาขาที่ยังไม่ได้นับเป็นสีเหลืองพร้อมเหตุผล
 *  ช่องที่ไม่เหลือเป็นสีแดง · สถานะของแถว: หมด / ยังไม่ได้นับ: สาขา… / พร้อมใช้ ·
 *  ช่องค้นหาและตัวกรองใช้กับกล่องวัสดุเท่านั้น · ดูได้อย่างเดียว ไม่มีปุ่มจดและช่องนับ */
export const Owner: Story = {};

/** Account Manager: เห็นเหมือน Owner */
export const Manager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
};

/** กรอง: เลือก「สาขาศาลาแดง」กับประเภท「วัสดุ」ตารางวัสดุเหลือคอลัมน์ของสาขานั้นคอลัมน์เดียว
 *  (ไม่มี รวม) และเฉพาะแถววัสดุ ตัวนับบอกจำนวนแถวที่แสดง · กล่องเนื้อไม่เปลี่ยน */
export const Filtered: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const canvas = within(
      page.getByRole("region", { name: "วัสดุและน้ำพริก" }),
    );
    await userEvent.selectOptions(
      page.getByLabelText("อยู่ที่"),
      "สาขาศาลาแดง",
    );
    await userEvent.selectOptions(page.getByLabelText("ประเภท"), "วัสดุ");
    await expect(
      canvas.getAllByRole("columnheader").map((th) => th.textContent),
    ).toEqual(["SKU", "สินค้า", "ประเภท", "สาขาศาลาแดง", "สถานะ"]);
    const rows = canvas.getAllByRole("row").slice(1);
    for (const row of rows) await expect(row).toHaveTextContent("วัสดุ");
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

/** ฐานข้อมูลเปล่า: กล่องเนื้อมีแต่แถวของสองสาขา · วัสดุและน้ำพริกทุกแถว「หมด」 */
export const Empty: Story = { parameters: { db: emptyDb } };

/** จอ 390px: ช่องค้นหาและตัวกรองขึ้นบรรทัดใหม่ แต่ละตารางเลื่อนในกรอบของตัวเอง หน้าไม่เลื่อนข้าง */
export const Phone: Story = { ...phone };

/** จอ 1920px: สองกล่องเรียงลงมา เต็มความกว้างของหน้า ไม่วางเคียงกัน */
export const Wide: Story = { ...wide };

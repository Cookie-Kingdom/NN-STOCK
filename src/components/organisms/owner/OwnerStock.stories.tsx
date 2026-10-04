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

/** Owner: ตารางเดียว SKU · สินค้า · ประเภท · คงเหลือ · อยู่ที่ · สถานะ ·
 *  เนื้อที่ฝากไว้ที่ร้านขายเนื้อ เนื้อในคลังกลาง แล้วเนื้อ วัสดุ และน้ำพริกของแต่ละสาขา ·
 *  สถานะ: หมด (แดง) นับช้า (เหลือง) พร้อมใช้ (เขียว) · ดูได้อย่างเดียว ไม่มีปุ่มจดและช่องนับ */
export const Owner: Story = {};

/** Account Manager: เห็นเหมือน Owner */
export const Manager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
};

/** กรอง: เลือก「สาขาศาลาแดง」กับประเภท「วัสดุ」เหลือเฉพาะวัสดุของสาขานั้น ตัวนับบอกจำนวนแถวที่แสดง */
export const Filtered: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(
      canvas.getByLabelText("อยู่ที่"),
      "สาขาศาลาแดง",
    );
    await userEvent.selectOptions(canvas.getByLabelText("ประเภท"), "วัสดุ");
    const rows = canvas.getAllByRole("row").slice(1);
    for (const row of rows) {
      await expect(row).toHaveTextContent("สาขาศาลาแดง");
      await expect(row).toHaveTextContent("วัสดุ");
    }
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

/** ฐานข้อมูลเปล่า: มีแต่แถวของสาขา ทุกแถว「หมด」 */
export const Empty: Story = { parameters: { db: emptyDb } };

/** จอ 390px: ช่องค้นหาและตัวกรองขึ้นบรรทัดใหม่ ตารางเลื่อนในกรอบของตัวเอง หน้าไม่เลื่อนข้าง */
export const Phone: Story = { ...phone };

/** จอ 1920px: ตารางเต็มความกว้างของหน้า */
export const Wide: Story = { ...wide };

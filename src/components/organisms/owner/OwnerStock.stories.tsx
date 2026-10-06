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

/** Owner: บนสุดคือมูลค่าของที่ซื้อเข้า Project และจำนวนสินทรัพย์ ช่องที่สามของแถวเดียวกันคือปุ่ม
 *  「จัดสรรสินค้า」(สูงและกว้างเท่าการ์ดตัวเลข สี accent) เปิดฟอร์มจัดสรร · ถัดมาคือช่องค้นหากับตัวกรอง
 *  ประเภท · สถานะ · ที่เก็บ แล้วตารางเดียว แถวละรายการ (SKU): SKU · รายการ · ประเภท · รายละเอียด / สเปก ·
 *  คลังกลาง · สาขาศาลาแดง · สาขามีนบุรี · ระหว่างส่ง · รวม · สถานะ · ผู้ขาย · วันที่ซื้อล่าสุด · จำนวนซื้อ · มูลค่า ·
 *  วัสดุจาก Settings ขึ้นก่อน: ช่องของสาขาบอกยอดนับล่าสุด (นับวันนี้ / นับ <วันที่> / นับ <วันที่> · เกิน 7 วัน /
 *  ยังไม่เคยนับ) ยังไม่ได้นับเป็นสีเหลือง ไม่เหลือเป็นสีแดง สถานะ: หมด / ยังไม่ได้นับ: สาขา… / พร้อมใช้ ·
 *  วัสดุที่ซื้อผ่าน Accounting ด้วย (ถุงหิ้วกระดาษ คลังกลาง 1,500) เป็นแถวเดียว มีทั้งยอดนับและข้อมูลการซื้อ
 *  วัสดุที่ไม่เคยซื้อ ประเภทเป็น「วัสดุ」ช่องการซื้อเป็น「—」· ของอื่นที่ซื้อเข้า Project: ยอดของแต่ละที่เป็นตัวเลขธรรมดา
 *  ติดลบเป็นสีแดง สถานะเป็น「—」(ถุงสูญญากาศ: คลังกลาง 700 ระหว่างส่ง 300 รวม 1,000 · ตู้เย็น: คลังกลาง 1
 *  ศาลาแดง 1 · เครื่องซีลสูญญากาศ: ศาลาแดง 1) · รายการที่ยกเลิกและที่ซื้อเข้าบริษัทส่วนกลางไม่ขึ้น ·
 *  ท้ายตาราง: จำนวนแถวที่แสดงและมูลค่ารวมของแถวที่แสดง · แถบชื่อตาราง หัวและท้ายตารางพื้นเข้มกว่าแถวข้อมูล ·
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
    // Without the head and the foot.
    const rows = within(canvas.getByRole("region", { name: "รายการทั้งหมด" }))
      .getAllByRole("row")
      .slice(1, -1);
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
    await expect(canvas.getByText("ไม่พบรายการที่ค้นหา")).toBeVisible();
  },
};

/** ตัวกรองประเภท「สินทรัพย์」: เหลือตู้เย็นกับเครื่องซีลสูญญากาศ ท้ายตารางรวมเฉพาะสองแถวนี้ */
export const ByType: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(canvas.getByLabelText("ประเภท"), "สินทรัพย์");
    await expect(canvas.getByText("รวม 2 รายการ")).toBeVisible();
  },
};

/** ตัวกรองที่เก็บ「ระหว่างส่ง」: เหลือเฉพาะถุงสูญญากาศ (300 รอศาลาแดงยืนยันรับ) */
export const ByPlace: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(
      canvas.getByLabelText("ที่เก็บ"),
      "ระหว่างส่ง",
    );
    await expect(canvas.getByText("รวม 1 รายการ")).toBeVisible();
  },
};

/** ตัวกรองสถานะ「หมด」: เฉพาะวัสดุที่ไม่เหลือเลย */
export const ByStatus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(canvas.getByLabelText("สถานะ"), "หมด");
    await expect(canvas.queryByText("พร้อมใช้", { selector: "td" })).toBeNull();
  },
};

/** ปุ่ม「จัดสรรสินค้า」ในแถวการ์ดตัวเลข: ปุ่มเดียวของกลุ่ม「จดบันทึก」 */
export const TransferButton: Story = {
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole("group", {
      name: "จดบันทึก",
    });
    await expect(
      within(group).getByRole("button", { name: "จัดสรรสินค้า" }),
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

/** จอ 390px: ตารางเหลือ รายการ ยอดของแต่ละที่ ระหว่างส่ง รวม และสถานะ (ไม่มี SKU ประเภท รายละเอียด
 *  และคอลัมน์การซื้อ) · ปุ่มจัดสรรเต็มความกว้างใต้การ์ดตัวเลข · ตารางเลื่อนในกรอบของตัวเอง หน้าไม่เลื่อนข้าง */
export const Phone: Story = { ...phone };

/** จอ 1920px: ตารางเต็มความกว้างของหน้า */
export const Wide: Story = { ...wide };

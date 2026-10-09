import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import {
  WithWorkspace,
  phone,
  wide,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import type { AccountId } from "@/lib/accounts";
import { accountById } from "@/lib/accounts";
import { today } from "@/lib/format";
import { mutate, seed, type Database, type Values } from "@/lib/store";
import { OwnerStock } from "./OwnerStock";

const emptyDb: Database = structuredClone(seed);
/** `db` with the notes of today's Inventory sheet (`materials`) laid on it, by the real `mutate`. */
const withNotes = (
  db: Database,
  ...notes: [AccountId, "daily" | "opening", Values][]
) =>
  notes.reduce(
    (next, [id, kind, values]) =>
      mutate(
        next,
        accountById(id)!,
        kind,
        { sheet: "materials", ...values },
        "",
        today(),
      ),
    db,
  );
const saladaengSaved: [AccountId, "daily", Values] = [
  "saladaeng",
  "daily",
  { "used.m1": "24", "used.m2": "24", "used.m4": "10", reporter: "น้องฝน" },
];

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
 *  หัวตารางมีป้ายสถานะของแต่ละสาขา (บันทึกวันนี้แล้ว · <ผู้บันทึก> / รอบันทึกวันนี้ / ยังไม่ตั้งสต๊อก) ·
 *  วัสดุของรายชื่อวัสดุขึ้นก่อน: ช่องของสาขาคือคงเหลือตามใบสต๊อกรายวัน พร้อมหน่วยของวัสดุนั้น ติดลบเป็นสีแดง
 *  ใต้ตัวเลขคือ Waste วันนี้กับสาเหตุ ·「ยังไม่บันทึกวันนี้」เมื่อเป็นยอดล่าสุดที่ยกมา (ข้อมูลตัวอย่าง: สองสาขา) ·
 *  สถานะ: หมด / พร้อมใช้ · วัสดุที่ซื้อผ่าน Accounting ด้วยเป็นแถวเดียว มีทั้งคงเหลือและข้อมูลการซื้อ
 *  วัสดุที่ไม่เคยซื้อ ประเภทเป็น「วัสดุ」ช่องการซื้อเป็น「—」· ของอื่นที่ซื้อเข้า Project: ยอดของแต่ละที่เป็นตัวเลขธรรมดา
 *  ติดลบเป็นสีแดง สถานะเป็น「—」· รายการที่ยกเลิกและที่ซื้อเข้าบริษัทส่วนกลางไม่ขึ้น ·
 *  ท้ายตาราง: จำนวนแถวที่แสดงและมูลค่ารวมของแถวที่แสดง · ใต้ตารางคือ「Waste ย้อนหลัง 7 วัน」ของวัสดุ
 *  (ถุงกระดาษ ศาลาแดง 4 ถุง「ถุงเปียกน้ำ」) หัวกล่องบอกจำนวนใบที่บันทึกแล้วจาก 14 ใบ ·
 *  เนื้อ ข้าวเหนียว และน้ำพริกอยู่ที่หน้า Stock (OwnerMeatStock) */
export const Owner: Story = {};

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

/** ฐานข้อมูลเปล่า: สองสาขา「ยังไม่ตั้งสต๊อก」ช่องของสาขาทุกแถว「ยังไม่มีสต๊อกตั้งต้น」ทุกแถว「หมด」·
 *  「Waste ย้อนหลัง 7 วัน」บอก「ยังไม่มี waste ที่บันทึกในช่วงนี้」 */
export const Empty: Story = { parameters: { db: emptyDb } };

/** สองสาขาบันทึกวันนี้แล้ว: ป้ายเขียว「บันทึกวันนี้แล้ว · <ผู้บันทึก>」ช่องของสาขาไม่มี「ยังไม่บันทึกวันนี้」 */
export const BothSavedToday: Story = {
  parameters: {
    db: withNotes(sampleDb, saladaengSaved, [
      "minburi",
      "daily",
      { "used.m1": "20", "used.m2": "20", reporter: "พี่เอ" },
    ]),
  },
};

/** ศาลาแดงบันทึกแล้ว มีนบุรียังไม่บันทึก: มีนบุรีป้ายเหลือง「รอบันทึกวันนี้」ช่องของมีนบุรีเป็นยอดล่าสุด
 *  มี「ยังไม่บันทึกวันนี้」ใต้ตัวเลข */
export const OneNotSavedToday: Story = {
  parameters: { db: withNotes(sampleDb, saladaengSaved) },
};

/** มีนบุรียังไม่เคยตั้งสต๊อก: ป้ายสีเทา「ยังไม่ตั้งสต๊อก」ช่องของมีนบุรีทุกแถวเป็น「ยังไม่มีสต๊อกตั้งต้น」ไม่ใช่ 0 ·
 *  ศาลาแดงตั้งสต๊อกวันนี้และบันทึกแล้ว */
export const NoOpening: Story = {
  parameters: {
    db: withNotes(
      emptyDb,
      [
        "saladaeng",
        "opening",
        { "qty.m1": "500", "qty.m2": "900", "qty.m4": "240" },
      ],
      saladaengSaved,
    ),
  },
};

/** Waste วันนี้พร้อมสาเหตุ: ศาลาแดง ถุงกระดาษ ใต้คงเหลือ「Waste 4 ถุง」「ถุงเปียกน้ำ」·
 *  มีนบุรี กล่องบรรจุ「Waste 3 กล่อง」ไม่ได้จดสาเหตุ ขึ้นป้ายเหลือง「ยังไม่ได้จดสาเหตุ」·
 *  สองบรรทัดนี้อยู่ใน「Waste ย้อนหลัง 7 วัน」ด้วย */
export const WasteWithReason: Story = {
  parameters: {
    db: withNotes(
      sampleDb,
      [
        "saladaeng",
        "daily",
        {
          "used.m4": "14",
          "waste.m4": "4",
          "reason.m4": "ถุงเปียกน้ำ",
          reporter: "น้องฝน",
        },
      ],
      [
        "minburi",
        "daily",
        { "used.m1": "23", "waste.m1": "3", reporter: "พี่เอ" },
      ],
    ),
  },
};

/** ใช้ไปมากกว่าที่มี: ช่องกล่องบรรจุของมีนบุรีติดลบ เป็นสีแดง ตัวกรองสถานะ「ติดลบ」เหลือแถวนี้ */
export const NegativeRemaining: Story = {
  parameters: {
    db: withNotes(sampleDb, [
      "minburi",
      "daily",
      { "used.m1": "9000", reporter: "พี่เอ" },
    ]),
  },
};

/** ไม่มี Waste ใน 7 วัน: สองสาขาตั้งสต๊อกวันนี้ ยังไม่บันทึก ·「Waste ย้อนหลัง 7 วัน」บอก
 *  「ยังไม่มี waste ที่บันทึกในช่วงนี้」และ「บันทึกแล้ว 0 จาก 14 ใบ」 */
export const WasteWeekEmpty: Story = {
  parameters: {
    db: withNotes(
      emptyDb,
      ["saladaeng", "opening", { "qty.m1": "500", "qty.m2": "900" }],
      ["minburi", "opening", { "qty.m1": "380", "qty.m2": "420" }],
    ),
  },
};

/** จอ 390px: ตารางเหลือ รายการ ยอดของแต่ละที่ ระหว่างส่ง รวม และสถานะ (ไม่มี SKU ประเภท รายละเอียด
 *  และคอลัมน์การซื้อ) · ปุ่มจัดสรรเต็มความกว้างใต้การ์ดตัวเลข · ตารางเลื่อนในกรอบของตัวเอง หน้าไม่เลื่อนข้าง */
export const Phone: Story = { ...phone };

/** จอ 1920px: ตารางเต็มความกว้างของหน้า */
export const Wide: Story = { ...wide };

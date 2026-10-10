import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within } from "storybook/test";
import { Caption } from "@/components/atoms/Text";
import {
  WithWorkspace,
  phone,
  wide,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import { accountById } from "@/lib/accounts";
import { fields } from "@/lib/forms";
import { today } from "@/lib/format";
import { mutate } from "@/lib/store";
import { SettingsPage } from "./SettingsPage";

/** The page, and under it what the sale form now asks for: a channel added above shows here. */
const Settings = ({ project = false }: { project?: boolean }) => (
  <WithWorkspace account="owner">
    {(ws) => (
      <div className="flex flex-col gap-4">
        <SettingsPage ws={ws} project={project} />
        <Caption data-testid="sale-fields">
          ช่องของฟอร์มยอดขายตอนนี้:{" "}
          {fields("sale", ws.db, ws.account)
            .map((f) => f.label)
            .join(" · ")}
        </Caption>
      </div>
    )}
  </WithWorkspace>
);

const meta = {
  title: "Organisms/Owner/SettingsPage",
  component: Settings,
  parameters: { db: sampleDb },
} satisfies Meta<typeof Settings>;

export default meta;
type Story = StoryObj<typeof meta>;

/** หน้า Settings ของร้าน (/owner/settings): ช่องทางขาย หมวดจ่ายเงิน รายการสินค้า (SKU) และ
 *  ข้อมูลหัวเอกสาร · ส่วนของโปรเจกต์อยู่ที่ story「Project」
 *  กด「แก้ไข」ของส่วนใดส่วนหนึ่งเพื่อแก้ แล้ว「บันทึก」ส่วนนั้น (เปิดได้ทีละส่วน)
 *  ค่าที่เว็บไม่รับ เช่น ตัวเลขติดลบหรือชื่อว่าง ขึ้นข้อความสีแดงข้างปุ่ม
 *  เพิ่มช่องทางขายแล้วบรรทัดล่างสุดมีช่องยอดขายของช่องทางนั้นเพิ่ม ·
 *  「สาขาที่ใช้ข้าวเหนียวดิบ」: ช่องติ๊กต่อสาขา (ตั้งต้นศาลาแดง) กด「แก้ไข」จึงติ๊กได้ ·
 *  「รายชื่อวัสดุ」มีคอลัมน์ SKU (เว็บออกให้ แก้ไม่ได้ แถวที่เพิ่งเพิ่มเป็น「รอบันทึก」) วัสดุ และ
 *  「หน่วยนับ」(กล่อง ซอง ถุง …) กด「แก้ไข」แล้วพิมพ์หน่วยได้ทีละแถว ·
 *  「รายการสินค้า (SKU)」: จำนวนรายการ กด「เปิดรายการ」เพื่อดูและแก้ชื่อใน popup (SkuDialog) */
export const Default: Story = {};

/** หน้า Settings ของโปรเจกต์ (/owner/nn-x-lm/settings): ตัวเลขสำหรับคำนวณ
 *  สาขาที่ใช้ข้าวเหนียวดิบ รายการสินค้า และรายชื่อวัสดุ ·
 *  「รายการสินค้า」: แถวละสินค้า ชื่อ (กดเพื่อแก้ไข) ส่วนประกอบในบรรทัดเดียวใต้ชื่อ ราคา และ
 *  ต้นทุนอื่น · ยังไม่เคยตั้งจะมี「กล่องมาตรฐาน」รายการเดียว「ยังไม่ตั้งส่วนประกอบ」
 *  ราคาและต้นทุนอื่นมาจากค่าเดิม (350 / 25 บาท) · บรรทัดล่างสุดคือช่องของฟอร์มยอดขาย:
 *  สินค้าละช่อง */
export const Project: Story = { args: { project: true } };

/** สาขาเพิ่มรายการในใบสต๊อกของตัวเอง (ถุงซิปล็อก · ห่อ): ขึ้นเป็นแถวสุดท้ายของ「รายชื่อวัสดุ」
 *  พร้อม SKU และหน่วยนับ */
export const BranchAddedMaterial: Story = {
  args: { project: true },
  parameters: {
    db: mutate(
      sampleDb,
      accountById("saladaeng")!,
      "stockItem",
      { id: "", name: "ถุงซิปล็อก", unit: "ห่อ" },
      "",
      today(),
    ),
  },
};

/** กด「แก้ไข」ของ「รายชื่อวัสดุ」: แต่ละแถวมีช่องชื่อและช่อง「หน่วยนับ」 */
export const EditMaterials: Story = {
  args: { project: true },
  play: async ({ canvas, userEvent }) =>
    userEvent.click(
      within(
        await canvas.findByRole("region", { name: "รายชื่อวัสดุ" }),
      ).getByRole("button", { name: "แก้ไข" }),
    ),
};

/** Settings ของโปรเจกต์ มีสินค้าสองรายการ: กล่องมาตรฐาน (เนื้อ 120 กรัม · น้ำพริก 1 หลอด ·
 *  กล่องบรรจุ 1 · ซองเนื้อ 2) และน้ำพริกหลอด (น้ำพริก 1 หลอด ราคา 30 ต้นทุนอื่น 12) ·
 *  ฟอร์มยอดขายมีช่อง「น้ำพริกหลอด」เพิ่ม */
export const Products: Story = {
  args: { project: true },
  parameters: {
    db: mutate(
      sampleDb,
      accountById("owner")!,
      "config",
      {
        products: JSON.stringify([
          {
            id: "box",
            name: "กล่องมาตรฐาน",
            items: [
              { id: "meat", qty: "120" },
              { id: "chili", qty: "1" },
              { id: "m1", qty: "1" },
              { id: "m2", qty: "2" },
            ],
          },
          { id: "p1", name: "น้ำพริกหลอด", items: [{ id: "chili", qty: "1" }] },
        ]),
        productMoney: JSON.stringify([
          { id: "box", price: "350", cost: "25" },
          { id: "p1", price: "30", cost: "12" },
        ]),
      },
      "",
      today(),
    ),
  },
};

/** กดชื่อสินค้า: popup แก้ชื่อ ราคา ต้นทุนอื่น และส่วนประกอบ (แถวละรายการ จำนวนพร้อมหน่วย ปุ่ม「ลบ」)
 *  dropdown「เพิ่มส่วนประกอบ」มีเฉพาะรายการที่ยังไม่อยู่ในสินค้า · พิมพ์ตัวอักษรหรือเลขติดลบแล้วกด
 *  「บันทึก」ขึ้นข้อความสีแดงเหนือปุ่ม · กล่องมาตรฐานไม่มีปุ่ม「ลบสินค้า」 */
export const EditProduct: Story = {
  ...Products,
  play: async ({ canvas, userEvent }) =>
    userEvent.click(
      await canvas.findByRole("button", { name: "แก้ไข กล่องมาตรฐาน" }),
    ),
};

/** กดชื่อสินค้าที่เพิ่มเอง: มีปุ่ม「ลบสินค้า」 */
export const EditAddedProduct: Story = {
  ...Products,
  play: async ({ canvas, userEvent }) =>
    userEvent.click(
      await canvas.findByRole("button", { name: "แก้ไข น้ำพริกหลอด" }),
    ),
};

/** กด「เพิ่มสินค้า」: popup ว่าง ยังไม่มีส่วนประกอบ */
export const AddProduct: Story = {
  args: { project: true },
  play: async ({ canvas, userEvent }) =>
    userEvent.click(await canvas.findByRole("button", { name: "เพิ่มสินค้า" })),
};

/** จอ 390px มีสินค้าสองรายการ */
export const PhoneProducts: Story = {
  ...Products,
  parameters: { ...phone.parameters, ...Products.parameters },
};

/** กด「เปิดรายการ」ของ「รายการสินค้า (SKU)」: popup ค้นหาและแก้ชื่อ */
export const OpenSkus: Story = {
  play: async ({ canvas, userEvent }) =>
    userEvent.click(
      within(
        await canvas.findByRole("region", { name: "รายการสินค้า (SKU)" }),
      ).getByRole("button", { name: "เปิดรายการ" }),
    ),
};

/** จอ 390px */
export const Phone: Story = { ...phone };

/** จอ 1920px: ส่วนต่าง ๆ เรียงสองคอลัมน์ */
export const Wide: Story = { ...wide };

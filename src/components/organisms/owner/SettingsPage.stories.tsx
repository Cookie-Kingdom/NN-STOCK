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
 *  สาขาที่ใช้ข้าวเหนียวดิบ สูตรต่อกล่อง และรายชื่อวัสดุ ·
 *  「สูตรต่อกล่อง」: แถวละรายการ (เนื้อ · ข้าวเหนียวดิบ เป็นกรัม น้ำพริกเป็นหลอด แล้ววัสดุทุกรายการ
 *  ตามหน่วยของมัน) ยังไม่ตั้งเป็น「—」 */
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

/** Settings ของโปรเจกต์ ตั้ง「สูตรต่อกล่อง」แล้ว: เนื้อ 120 กรัม น้ำพริก 1 หลอด กล่องบรรจุ 1 กล่อง ซองเนื้อ 2 ซอง
 *  รายการอื่นเป็น「—」(ขายแล้วไม่ตัด) */
export const Recipe: Story = {
  args: { project: true },
  parameters: {
    db: mutate(
      sampleDb,
      accountById("owner")!,
      "config",
      {
        boxRecipe: JSON.stringify([
          { id: "meat", qty: "120" },
          { id: "chili", qty: "1" },
          { id: "m1", qty: "1" },
          { id: "m2", qty: "2" },
        ]),
      },
      "",
      today(),
    ),
  },
};

/** กด「แก้ไข」ของ「สูตรต่อกล่อง」: แต่ละแถวมีช่องจำนวนต่อกล่อง พร้อมหน่วย · พิมพ์ตัวอักษรหรือ
 *  เลขติดลบแล้วกด「บันทึก」ขึ้น「สูตรต่อกล่อง: ใส่เป็นตัวเลข 0 ขึ้นไป」ข้างปุ่ม */
export const EditRecipe: Story = {
  ...Recipe,
  play: async ({ canvas, userEvent }) =>
    userEvent.click(
      within(
        await canvas.findByRole("region", { name: "สูตรต่อกล่อง" }),
      ).getByRole("button", { name: "แก้ไข" }),
    ),
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

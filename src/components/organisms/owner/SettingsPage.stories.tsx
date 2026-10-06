import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within } from "storybook/test";
import { Caption } from "@/components/atoms/Text";
import {
  WithWorkspace,
  phone,
  wide,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import { fields } from "@/lib/forms";
import { SettingsPage } from "./SettingsPage";

/** The page, and under it what the sale form now asks for: a channel added above shows here. */
const Settings = () => (
  <WithWorkspace account="owner">
    {(ws) => (
      <div className="flex flex-col gap-4">
        <SettingsPage ws={ws} />
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

/** กด「แก้ไข」ของส่วนใดส่วนหนึ่งเพื่อแก้ แล้ว「บันทึก」ส่วนนั้น (เปิดได้ทีละส่วน)
 *  ค่าที่เว็บไม่รับ เช่น ตัวเลขติดลบหรือชื่อว่าง ขึ้นข้อความสีแดงข้างปุ่ม
 *  เพิ่มช่องทางขายแล้วบรรทัดล่างสุดมีช่องยอดขายของช่องทางนั้นเพิ่ม ·
 *  「สาขาที่ใช้ข้าวเหนียวดิบ」: ช่องติ๊กต่อสาขา (ตั้งต้นศาลาแดง) กด「แก้ไข」จึงติ๊กได้ ·
 *  「รายชื่อวัสดุ」มีคอลัมน์ SKU (เว็บออกให้ แก้ไม่ได้ แถวที่เพิ่งเพิ่มเป็น「รอบันทึก」) ·
 *  「รายการสินค้า (SKU)」: จำนวนรายการ กด「เปิดรายการ」เพื่อดูและแก้ชื่อใน popup (SkuDialog) */
export const Default: Story = {};

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

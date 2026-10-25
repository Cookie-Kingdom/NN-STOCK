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
 *  「รายชื่อวัสดุ」(หน้า Settings ของโปรเจกต์): จำนวนวัสดุ กด「เปิดรายการ」เพื่อดูและแก้ใน popup
 *  (MaterialsDialog) ·
 *  「รายการสินค้า (SKU)」: จำนวนรายการ กด「เปิดรายการ」เพื่อดูและแก้ชื่อใน popup (SkuDialog) */
export const Default: Story = {};

/** หน้า Settings ของโปรเจกต์ (/owner/nn-x-lm/settings): ตัวเลขสำหรับคำนวณ
 *  รายการเนื้อ (คอลัมน์รหัส RM-0001) รายการสินค้า รายชื่อวัตถุดิบ (2 รายการ) และรายชื่อวัสดุ ·
 *  「รายการสินค้า」: แถวละสินค้า ชื่อ (กดเพื่อแก้ไข) ส่วนประกอบในบรรทัดเดียวใต้ชื่อ ราคา และ
 *  ต้นทุนอื่น · ยังไม่เคยตั้งจะมี「กล่องมาตรฐาน」รายการเดียว「ยังไม่ตั้งส่วนประกอบ」
 *  ราคาและต้นทุนอื่นมาจากค่าเดิม (350 / 25 บาท) · บรรทัดล่างสุดคือช่องของฟอร์มยอดขาย:
 *  สินค้าละช่อง */
export const Project: Story = { args: { project: true } };

/** 「รายการเนื้อ」มีสองชนิด: เนื้อ (RM-0001 ชนิดแรก ลบไม่ได้) และวากิว · ใบพาย (RM-0002) · ฟอร์ม PO เนื้อ, PO รมควัน
 *  และรับเนื้อเข้าสาขามีช่อง「ชนิดเนื้อ」 ใบสต๊อกหน้า Stock ของสาขามีแถวละชนิด และส่วนประกอบของ
 *  สินค้าเลือกเนื้อแต่ละชนิดเป็นกรัมได้ */
export const MeatTypes: Story = {
  args: { project: true },
  parameters: {
    db: mutate(
      sampleDb,
      accountById("owner")!,
      "config",
      {
        meatTypes: JSON.stringify([
          { id: "meat", name: "เนื้อ" },
          { id: "meat-wagyu", name: "วากิว · ใบพาย" },
        ]),
      },
      "",
      today(),
    ),
  },
};

/** สาขาเพิ่มรายการในใบสต๊อกของตัวเอง (ถุงซิปล็อก · ห่อ): นับรวมใน「รายชื่อวัสดุ」และอยู่ใน
 *  popup พร้อม SKU และหน่วยนับ */
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

/** กด「เปิดรายการ」ของ「รายชื่อวัสดุ」: popup มีช่องค้นหา ปุ่ม「เพิ่มวัสดุ」แถวละช่องชื่อและช่อง
 *  「หน่วยนับ」แสดงทีละ 10 แถว */
export const EditMaterials: Story = {
  args: { project: true },
  play: async ({ canvas, userEvent }) =>
    userEvent.click(
      within(
        await canvas.findByRole("region", { name: "รายชื่อวัสดุ" }),
      ).getByRole("button", { name: "เปิดรายการ" }),
    ),
};

/** กด「เปิดรายการ」ของ「รายชื่อวัตถุดิบ」: popup แบบเดียวกับรายชื่อวัสดุ คอลัมน์「รหัส」
 *  (ING-0001 ข้าวเหนียวดิบ · กก., ING-0002 น้ำพริก · หลอด) ปุ่ม「เพิ่มวัตถุดิบ」 */
export const EditIngredients: Story = {
  args: { project: true },
  play: async ({ canvas, userEvent }) =>
    userEvent.click(
      within(
        await canvas.findByRole("region", { name: "รายชื่อวัตถุดิบ" }),
      ).getByRole("button", { name: "เปิดรายการ" }),
    ),
};

/** Settings ของโปรเจกต์ มีสินค้าสองรายการ: กล่องมาตรฐาน (เนื้อ 120 กรัม · น้ำพริก 1 หลอด ·
 *  กล่องบรรจุ 1 · ซองเนื้อ 2) และน้ำพริกหลอด (หน่วยนับ「หลอด」 น้ำพริก 1 หลอด ราคา 30
 *  ต้นทุนอื่น 12 ต่อหลอด) ·
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
              { id: "ing-chili", qty: "1" },
              { id: "m1", qty: "1" },
              { id: "m2", qty: "2" },
            ],
          },
          {
            id: "p1",
            name: "น้ำพริกหลอด",
            unit: "หลอด",
            items: [{ id: "ing-chili", qty: "1" }],
          },
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

const channelKey = "sales.grab";
/** Products แล้วเพิ่มช่องทางขาย Grab · กล่องมาตรฐานตั้งราคา Grab 380 (ราคาขาย 350) ·
 *  น้ำพริกหลอด「หยุดขาย」: มีป้ายข้างชื่อ และไม่มีช่องในฟอร์มยอดขาย (บรรทัดล่างสุด) ·
 *  รหัสสินค้า PRD-0001 / PRD-0002 อยู่ข้างชื่อ · คอลัมน์ราคาบอกเฉพาะช่องทางที่ราคาต่างจากราคาขาย */
export const StoppedAndChannelPrices: Story = {
  args: { project: true },
  parameters: {
    db: mutate(
      Products.parameters!.db,
      accountById("owner")!,
      "config",
      {
        salesChannels: JSON.stringify([
          { key: "lineMan", name: "LINE MAN", gp: "10" },
          { key: channelKey, name: "Grab", gp: "30" },
        ]),
        products: JSON.stringify([
          {
            id: "box",
            name: "กล่องมาตรฐาน",
            items: [
              { id: "meat", qty: "120" },
              { id: "ing-chili", qty: "1" },
            ],
          },
          {
            id: "p1",
            name: "น้ำพริกหลอด",
            unit: "หลอด",
            off: true,
            items: [{ id: "ing-chili", qty: "1" }],
          },
        ]),
        productMoney: JSON.stringify([
          {
            id: "box",
            price: "350",
            cost: "25",
            prices: { lineMan: "350", [channelKey]: "380" },
          },
          { id: "p1", price: "30", cost: "12" },
        ]),
      },
      "",
      today(),
    ),
  },
};

/** popup ของสินค้าที่มีรหัส: บรรทัด「รหัสสินค้า PRD-0001」(แก้ไม่ได้) และ「ราคาขายแยกตามช่องทางขาย」
 *  ช่องละช่องทาง ช่องที่เว้นว่างขึ้นราคาขายเป็นตัวจาง */
export const EditChannelPrices: Story = {
  ...StoppedAndChannelPrices,
  play: async ({ canvas, userEvent }) =>
    userEvent.click(
      await canvas.findByRole("button", { name: "แก้ไข กล่องมาตรฐาน" }),
    ),
};

/** popup ของสินค้าที่หยุดขาย:「หยุดขาย」ติ๊กอยู่ เอาออกแล้วบันทึกเพื่อกลับมาขาย ·
 *  กด「ลบสินค้า」ข้อความยืนยันบอกว่าสินค้าจะหายจากรายการและฟอร์มใหม่ แต่ยอดที่เคยจดยังนับ */
export const EditStoppedProduct: Story = {
  ...StoppedAndChannelPrices,
  play: async ({ canvas, userEvent }) =>
    userEvent.click(
      await canvas.findByRole("button", { name: "แก้ไข น้ำพริกหลอด" }),
    ),
};

/** ทุกแถวที่ลบได้มีปุ่ม「ลบ」ท้ายแถวโดยไม่ต้องกด「แก้ไข」ก่อน (ชนิดแรกและกล่องมาตรฐานไม่มี) ·
 *  วากิว · ใบพาย และน้ำพริกหลอดถูกลบแล้ว: ไม่อยู่ในรายการ และไม่มีช่องในฟอร์มยอดขาย
 *  (บรรทัดล่างสุด) แต่ยังอยู่ใน config จึงนับยอดที่เคยจดตามเดิม */
export const RemovedRows: Story = {
  args: { project: true },
  parameters: {
    db: mutate(
      mutate(
        MeatTypes.parameters!.db,
        accountById("owner")!,
        "config",
        {
          meatTypes: JSON.stringify([
            { id: "meat", name: "เนื้อ" },
            { id: "meat-wagyu", name: "วากิว · ใบพาย", removed: "1" },
            { id: "meat-kobe", name: "โกเบ · สันใน" },
          ]),
        },
        "",
        today(),
      ),
      accountById("owner")!,
      "config",
      {
        products: JSON.stringify([
          ...JSON.parse(Products.parameters!.db.config.products).slice(0, 1),
          {
            ...JSON.parse(Products.parameters!.db.config.products)[1],
            removed: true,
          },
          { id: "p2", name: "ข้าวเหนียวกล่อง", items: [] },
        ]),
      },
      "",
      today(),
    ),
  },
};

/** กด「ลบ」ของสินค้า: popup กลางจอถามก่อนหนึ่งครั้ง「ลบ「ข้าวเหนียวกล่อง」? จะหายจากรายการและ
 *  ฟอร์มใหม่ ส่วนยอดที่เคยจดยังนับตามเดิม」พร้อม「ไม่ลบ」/「ยืนยันลบ」 (`ConfirmDialog`) */
export const ConfirmRemove: Story = {
  ...RemovedRows,
  play: async ({ canvas, userEvent }) =>
    userEvent.click(
      await canvas.findByRole("button", { name: "ลบ ข้าวเหนียวกล่อง" }),
    ),
};

/** จอ 390px: popup ราคาแยกช่องทาง */
export const PhoneEditChannelPrices: Story = {
  ...EditChannelPrices,
  globals: phone.globals,
  parameters: {
    ...phone.parameters,
    ...StoppedAndChannelPrices.parameters,
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

/** กดชื่อสินค้าที่เพิ่มเอง: มีปุ่ม「ลบสินค้า」 · หน่วยนับที่พิมพ์ไว้「หลอด」อยู่ในช่อง และป้าย
 *  「ราคาขายต่อหลอด」「ต้นทุนอื่นต่อหลอด」「ส่วนประกอบต่อ 1 หลอด」ใช้หน่วยนั้น */
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

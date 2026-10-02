import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { day, demoDb } from "../../../.storybook/fixtures";
import { pick } from "../../../.storybook/pick";
import { DocumentPrintButton } from "./DocumentPrintButton";

const rows = (pairs: [string, string][]) => pairs;

const doc = pick("เอกสาร", {
  "PO ซื้อเนื้อ (กระดาษ PO)": {
    title: "Purchase Order",
    number: "PO-0909-01",
    rows: rows([
      ["วันที่ PO", day],
      ["Supplier", "Foodiva"],
      ["ผู้รับออเดอร์", "คุณสมชาย"],
      ["ที่อยู่ผู้ให้บริการ", "เชียงใหม่"],
      ["ลูกค้า", "NerdNuea Stock"],
      ["ที่อยู่", "กรุงเทพฯ"],
      ["Attention", "คุณเจ้าของร้าน"],
      ["โทร.", "02-000-0000"],
      ["Tax ID", "0105500000000"],
      ["สินค้า", "เนื้อวัว"],
      ["ขนาดบรรจุ", "5 กก."],
      ["จำนวน", "200.00 กก."],
      ["ราคา / กก.", "฿700.00"],
      ["ยอดรวมก่อน VAT", "฿140,000.00"],
      ["อ้างอิงผู้ขาย", "—"],
      ["หมายเหตุ", "—"],
    ]),
  },
  "เอกสารอื่น (ตารางรายละเอียด)": {
    title: "Transport Manifest",
    number: "TM-0909-01",
    rows: rows([
      ["Lot", "LOT-0909-01"],
      ["ผู้ขาย", "Foodiva"],
      ["น้ำหนักสั่ง", "200 กก."],
      ["หมายเหตุ", ""],
    ]),
  },
});

type Args = {
  doc: typeof doc.initial;
  label: string;
  preview: boolean;
};

const meta: Meta<Args> = {
  title: "Molecules/DocumentPrintButton",
  parameters: { db: demoDb },
};

export default meta;

/** กดปุ่มแล้วเปิดหน้าต่างใหม่ (อนุญาต Pop-up ก่อน) เลือกใน Controls:
 *  - เอกสาร: `Purchase Order` / Smoke PO พิมพ์เป็นกระดาษ PO, title อื่นพิมพ์เป็นตาราง
 *    ป้าย–ค่า (ค่าว่างอ่าน "—")
 *  - `preview` ปิด: เปิดหน้าต่างแล้วสั่งพิมพ์ทันทีเมื่อฟอนต์ไทยโหลดเสร็จ
 *  - `preview` เปิด: เปิดดูก่อน มีปุ่ม "ดาวน์โหลด / พิมพ์ PDF" ในหน้าต่าง
 *  - `label`: ข้อความบนปุ่ม ("ดู PO / PDF", "พรีวิว / PDF" ในหน้าจริง) */
export const Default: StoryObj<Args> = {
  argTypes: {
    doc: doc.argType,
    label: { control: "text" },
    preview: { control: "boolean" },
  },
  args: { doc: doc.initial, label: "พิมพ์ / PDF", preview: false },
  render: ({ doc, label, preview }) => (
    <DocumentPrintButton {...doc} label={label} preview={preview} />
  ),
};

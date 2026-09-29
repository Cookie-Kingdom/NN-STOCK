import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { demoDb } from "../../../.storybook/fixtures";
import { pick } from "../../../.storybook/pick";
import { purchaseOrderRows } from "@/components/organisms/shared/documentRows";
import { DocumentPrintButton } from "./DocumentPrintButton";

const lot = demoDb.lots[0];

const doc = pick("เอกสาร", {
  "PO ซื้อเนื้อ (กระดาษ PO)": {
    title: "Purchase Order",
    number: lot.poId,
    rows: purchaseOrderRows(lot, demoDb),
  },
  "เอกสารอื่น (ตารางรายละเอียด)": {
    title: "Transport Manifest",
    number: `TM-${lot.id}`,
    rows: [
      ["Lot", lot.id],
      ["ผู้ขาย", lot.values.supplier],
      ["น้ำหนักสั่ง", `${lot.values.orderedKg} กก.`],
      ["หมายเหตุ", ""],
    ] as [string, string][],
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

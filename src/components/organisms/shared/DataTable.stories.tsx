import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { PoLotCell } from "@/components/molecules/PoLotCell";
import { pick } from "../../../../.storybook/pick";
import { DataTable } from "./DataTable";

const rows = Array.from({ length: 45 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return [
    <PoLotCell key="lot" poId={`PO-0412-${n}`} lotId={`LOT-0915-${n}`} />,
    `${(80 + i * 1.5).toFixed(2)} กก.`,
    `฿${(320 + i).toFixed(2)}`,
    <Badge key="state" tone={i % 3 === 0 ? "warning" : "success"}>
      {i % 3 === 0 ? "รอรับ" : "รับแล้ว"}
    </Badge>,
  ];
});

const meta = {
  title: "Organisms/DataTable",
  component: DataTable,
  args: {
    title: "ล็อตที่รับเข้า",
    columns: ["PO / ล็อต", "น้ำหนัก", "ราคา/กก.", "สถานะ"],
    rows,
    action: <Button variant="secondary">ส่งออก</Button>,
  },
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

const rowCount = pick("จำนวนแถว", {
  หลายหน้า: rows,
  หน้าเดียว: rows.slice(0, 5),
  แถวเดียว: rows.slice(0, 1),
  ไม่มีรายการ: [] as typeof rows,
});
const sort = pick("เรียงตาม", {
  ค่าเริ่มต้น: undefined,
  "น้ำหนัก มากไปน้อย": { column: "น้ำหนัก", desc: true },
});

/** เลือกใน Controls:
 *  - จำนวนแถว: หลายหน้า (มีปุ่มเปลี่ยนหน้า), หน้าเดียว, แถวเดียว (ยังแสดง "เรียงตาม"
 *    แถบเครื่องมือจึงไม่ขยับเมื่อกรอง), หรือไม่มีรายการ
 *  - เรียงตาม: `defaultSort` เลือกคอลัมน์เริ่มต้น; dropdown แสดงทุกคอลัมน์ที่เป็นข้อความ */
export const Paginated: Story = {
  argTypes: { rows: rowCount.argType, defaultSort: sort.argType },
  args: { rows: rowCount.initial, defaultSort: sort.initial },
};

/** `columnWidths` fixes the layout: the columns hold their width as rows are filtered,
 *  long text wraps inside its cell, and a phone pans sideways past the summed width. */
export const FixedColumns: Story = {
  args: {
    columns: ["PO / ล็อต", "น้ำหนัก", "ราคา/กก.", "สถานะ", "รายละเอียด"],
    columnWidths: ["12rem", "8rem", "8rem", "7rem", "18rem"],
    rows: rows
      .slice(0, 6)
      .map((row, i) => [
        ...row,
        i % 2
          ? "รับเข้าสต๊อกกลางแล้ว"
          : "จากรับเข้าสต๊อกกลาง · เก็บที่ Foodiva รอ Owner จัดสรรไปสาขา ข้อความยาวจึงขึ้นบรรทัดใหม่",
      ]),
  },
};

/** `footer` is the total row: it sits on the head's band below the body and stays put
 *  while the rows sort and page. */
export const WithTotal: Story = {
  args: {
    columns: ["Lot", "รับเข้า", "ใช้แล้ว", "คงเหลือ"],
    rows: [
      ["S260923-001", "30.00 กก.", "11.47 กก.", "18.53 กก."],
      ["S260924-015", "45.00 กก.", "0.00 กก.", "45.00 กก."],
    ],
    footer: ["รวม", "75.00 กก.", "11.47 กก.", "63.53 กก."],
    action: undefined,
  },
};

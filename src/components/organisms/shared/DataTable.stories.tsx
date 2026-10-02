import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { pick } from "../../../../.storybook/pick";
import { DataTable } from "./DataTable";

const weights = Array.from({ length: 45 }, (_, i) => 80 + i * 1.5);

const rows = weights.map((kg, i) => {
  const n = String(i + 1).padStart(2, "0");
  return [
    `PO-0412-${n} · LOT-0915-${n}`,
    `${kg.toFixed(2)} กก.`,
    `฿${(320 + i).toFixed(2)}`,
    <Badge key="state" tone={i % 3 === 0 ? "warning" : "success"}>
      {i % 3 === 0 ? "รอรับ" : "รับแล้ว"}
    </Badge>,
    i % 2
      ? "รับเข้าสต๊อกกลางแล้ว"
      : "จากรับเข้าสต๊อกกลาง · เก็บที่ Foodiva รอ Owner จัดสรรไปสาขา ข้อความยาวจึงขึ้นบรรทัดใหม่",
  ];
});

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
const widths = pick("ความกว้างคอลัมน์", {
  อัตโนมัติ: undefined,
  คงที่: ["12rem", "8rem", "8rem", "7rem", "18rem"],
});
const action = pick("ปุ่มหัวตาราง", {
  มี: <Button variant="secondary">ส่งออก</Button>,
  ไม่มี: undefined,
});

type Args = ComponentProps<typeof DataTable> & { total: boolean };

const meta = {
  title: "Organisms/Shared/DataTable",
  component: DataTable,
  args: {
    title: "ล็อตที่รับเข้า",
    columns: ["PO / ล็อต", "น้ำหนัก", "ราคา/กก.", "สถานะ", "รายละเอียด"],
    rows: rowCount.initial,
    defaultSort: sort.initial,
    columnWidths: widths.initial,
    action: action.initial,
    emptyText: "ยังไม่มีรายการ",
    total: false,
  },
  argTypes: {
    rows: rowCount.argType,
    defaultSort: sort.argType,
    columnWidths: widths.argType,
    action: action.argType,
    total: { name: "แถวรวม", control: "boolean" },
    columns: { control: false },
    footer: { control: false },
    rowKeys: { control: false },
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

/** เลือกใน Controls:
 *  - จำนวนแถว: หลายหน้า (มีปุ่มเปลี่ยนหน้า), หน้าเดียว, แถวเดียว (ยังแสดง "เรียงตาม"
 *    แถบเครื่องมือจึงไม่ขยับเมื่อกรอง), หรือไม่มีรายการ (`emptyText`)
 *  - เรียงตาม: `defaultSort` เลือกคอลัมน์เริ่มต้น; dropdown แสดงทุกคอลัมน์ที่เป็นข้อความ
 *  - ความกว้างคอลัมน์ คงที่: `columnWidths` คอลัมน์ไม่ขยับเมื่อกรอง ข้อความยาวขึ้น
 *    บรรทัดใหม่ในช่อง และบนมือถือเลื่อนซ้ายขวาได้
 *  - แถวรวม: `footer` อยู่ใต้ตารางบนแถบสีเดียวกับหัว ไม่ขยับเมื่อเรียงหรือเปลี่ยนหน้า
 *  - ปุ่มหัวตาราง: ช่อง `action` */
export const Table: Story = {
  render: ({ total, ...args }) => (
    <DataTable
      {...args}
      footer={
        total
          ? [
              "รวม",
              `${weights
                .slice(0, args.rows.length)
                .reduce((sum, kg) => sum + kg, 0)
                .toFixed(2)} กก.`,
              "",
              "",
              "",
            ]
          : undefined
      }
    />
  ),
};

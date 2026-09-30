import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { pick } from "../../../../.storybook/pick";
import { PackingListTable, type PackingListBox } from "./PackingListTable";

/** Transcribed from the sheet Foodiva sent on 16/9/2026 (vault: Feedback/20-09-2026). */
const header = {
  date: "16/9/2026",
  invoiceNo: "26028992",
  product: "NERD NUEA FZ .. SLICED 6mm.",
  code: "0037 Aust.Beef Icon XB Wagyu Chuck Roll 6/7",
  invWeight: 356.95,
  slicedNet: 325.76,
  // A2: Foodiva types Lost — the usable meat after cutting, in line with the box total.
  // It stays as typed however Chef House fills the yellow cells.
  slicedLost: 325.76,
};

// 22 boxes adding up to the sheet's GRAND TOTAL of 325.76.
const weights = [
  14.5, 14.14, 13.76, 15.02, 14.88, 13.94, 15.4, 14.06, 13.62, 14.7, 15.18,
  15.1, 15.46, 15.84, 14.58, 14.72, 15.66, 14.2, 15.54, 15.98, 14.9, 14.58,
];

const boxes: PackingListBox[] = weights.map((weight, index) => ({
  no: index + 1,
  weight,
}));

/** What Chef House ends up with: a little lighter on most boxes, heavier on one. */
const drift = [-0.12, 0, -0.24, 0.08, -0.06, 0, -0.18, 0.14, -0.3, 0, -0.1];
const weighed = boxes.map((box, index) => ({
  ...box,
  received: Number(
    ((box.weight ?? 0) + drift[index % drift.length]).toFixed(2),
  ),
}));

/** Ten empty rows, the count the Foodiva form starts with. */
const emptyRows: PackingListBox[] = Array.from({ length: 10 }, (_, index) => ({
  no: index + 1,
}));

type Mode = "foodiva" | "chef" | "owner";

function Editable({ start, mode }: { start: PackingListBox[]; mode: Mode }) {
  const [rows, setRows] = useState(start);
  const column = mode === "foodiva" ? "weight" : "received";
  const edit = (no: number, value: number | undefined) =>
    setRows((current) =>
      current.map((box) => (box.no === no ? { ...box, [column]: value } : box)),
    );
  // Foodiva types the list, so it also says how long it is; Chef House cannot.
  const resize = (count: number) =>
    setRows((current) =>
      Array.from({ length: count }, (_, index) => ({
        ...current[index],
        no: index + 1,
      })),
    );
  const foodiva = mode === "foodiva";
  return (
    <PackingListTable
      header={foodiva ? { ...header, slicedNet: undefined } : header}
      boxes={rows}
      onRows={foodiva ? resize : undefined}
      onRemoveRow={
        foodiva
          ? (no) =>
              setRows((current) =>
                current
                  .filter((box) => box.no !== no)
                  .map((box, index) => ({ ...box, no: index + 1 })),
              )
          : undefined
      }
      onWeight={foodiva ? edit : undefined}
      onReceived={mode === "chef" ? edit : undefined}
    />
  );
}

const start = pick("แถว", {
  "ว่าง 10 แถว (Foodiva เริ่มกรอก)": emptyRows,
  ยังไม่ชั่ง: boxes,
  ชั่งไปครึ่งหนึ่ง: boxes.map((box, i) => (i < 8 ? weighed[i] : box)),
  ชั่งครบ: weighed,
});

const meta: Meta<{ mode: Mode; start: PackingListBox[] }> = {
  title: "Organisms/Shared/PackingListTable",
  argTypes: {
    mode: {
      name: "ผู้กรอก",
      control: {
        type: "radio",
        labels: {
          foodiva: "Foodiva (กรอก Packing List)",
          chef: "Chef House (ช่องเหลือง)",
          owner: "Owner (อ่านอย่างเดียว)",
        },
      },
      options: ["foodiva", "chef", "owner"],
    },
    start: start.argType,
  },
  args: { mode: "foodiva", start: start.initial },
};

export default meta;

/** เลือกใน Controls:
 *  - ผู้กรอก:
 *    - Foodiva: กรอกเองทั้งรายการ เพิ่มแถวท้ายตาราง ลบแถวทีละแถว (มียืนยัน) และนับจำนวนแถว
 *      ในช่องหัวตาราง; แก้ได้เฉพาะคอลัมน์ Packing List
 *    - Chef House: เปิดรายการที่บันทึกแล้วกรอกช่องเหลือง
 *    - Owner: ไม่มี callback — มุมมองอ่านอย่างเดียวต่อการส่ง จำนวนแถวแสดงแต่แก้ไม่ได้
 *  - แถว: ว่าง / ยังไม่ชั่ง / ชั่งไปครึ่งหนึ่ง (badge นับที่ยังขาด ยอดรวมรอ) / ชั่งครบ */
export const Table: StoryObj<typeof meta> = {
  render: ({ mode, start }) => (
    <Editable
      key={`${mode}-${start.length}-${start.filter((box) => box.received !== undefined).length}`}
      start={start}
      mode={mode}
    />
  ),
};

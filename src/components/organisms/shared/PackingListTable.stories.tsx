import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
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

function Editable({
  start,
  column,
}: {
  start: PackingListBox[];
  column: "weight" | "received";
}) {
  const [rows, setRows] = useState(start);
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
  return (
    <PackingListTable
      header={
        column === "weight" ? { ...header, slicedNet: undefined } : header
      }
      boxes={rows}
      onRows={column === "weight" ? resize : undefined}
      onRemoveRow={
        column === "weight"
          ? (no) =>
              setRows((current) =>
                current
                  .filter((box) => box.no !== no)
                  .map((box, index) => ({ ...box, no: index + 1 })),
              )
          : undefined
      }
      onWeight={column === "weight" ? edit : undefined}
      onReceived={column === "received" ? edit : undefined}
    />
  );
}

const meta = {
  title: "Develop/PackingListTable",
  component: PackingListTable,
  args: { header, boxes },
} satisfies Meta<typeof PackingListTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Foodiva types the list itself: rows are added at the foot, deleted per row behind
 *  a confirmation, and counted in the field at the head. Only the Packing List column
 *  is editable. */
export const FoodivaFill: Story = {
  render: () => <Editable start={emptyRows} column="weight" />,
};

/** Chef House opens the saved list and fills the yellow cells. */
export const ChefHouseFill: Story = {
  render: () => <Editable start={boxes} column="received" />,
};

/** Half done — the badge counts what is still missing and the totals hold off. */
export const PartlyWeighed: Story = {
  render: () => (
    <Editable
      start={boxes.map((box, i) => (i < 8 ? weighed[i] : box))}
      column="received"
    />
  ),
};

/** Neither callback: the read-only view Owner/Manager sees per shipment. The row
 *  count is shown but cannot be changed. */
export const OwnerView: Story = { args: { boxes: weighed } };

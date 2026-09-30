import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { pick } from "../../../.storybook/pick";
import { Button } from "@/components/atoms/Button";
import { ReferenceCard } from "./ReferenceCard";

const rows = pick<[string, ReactNode][]>("rows", {
  ใบสั่งซื้อ: [
    ["ผู้ขาย", "Foodiva"],
    ["น้ำหนักสั่ง", "120.00 กก."],
    ["ราคา/กก.", "฿320.00"],
    ["หมายเหตุ", ""],
  ],
  ตรวจสอบก่อนบันทึก: [
    ["น้ำหนักรับจริง", "118.40 กก."],
    ["ส่วนต่างจากที่สั่ง", "1.60 กก."],
    ["มูลค่ารวม", "฿37,888.00"],
  ],
});

const action = pick<ReactNode>("action", {
  ปุ่มดูเอกสาร: <Button variant="table">ดูเอกสาร</Button>,
  ไม่มี: undefined,
});

const meta = {
  title: "Molecules/ReferenceCard",
  component: ReferenceCard,
  argTypes: {
    title: { control: "text" },
    number: { control: "text" },
    rows: rows.argType,
    action: action.argType,
  },
  args: {
    title: "ใบสั่งซื้อ",
    number: "PO-2026-0412",
    rows: rows.initial,
    action: action.initial,
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReferenceCard>;

export default meta;

/** Pick the state in Controls:
 *  - `number` set: a saved document, its number in the heading
 *  - `number` empty: the heading is the plain title — how the pre-save preview of a
 *    form's own values uses the card (rows ตรวจสอบก่อนบันทึก, no action)
 *  - `action`: e.g. a document preview button on the right of the heading
 *  - rows: an empty value (หมายเหตุ) prints "—" */
export const Default: StoryObj<typeof meta> = {
  render: ({ number, ...args }) => (
    <ReferenceCard {...args} number={number || undefined} />
  ),
};

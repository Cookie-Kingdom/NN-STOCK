import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { day } from "../../../.storybook/fixtures";
import { pick } from "../../../.storybook/pick";
import { today } from "@/lib/format";
import { PageHeading } from "./PageHeading";

const meta = {
  title: "Molecules/PageHeading",
  component: PageHeading,
  args: {
    overline: "เจ้าของร้าน",
    title: "ภาพรวมวันนี้",
    description: "สรุปยอดขาย ต้นทุน และงานที่ต้องทำต่อ",
    date: today(),
    onDate: fn(),
  },
} satisfies Meta<typeof PageHeading>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The workspace owns the working date, so the story does too. */
function Controlled({
  initial,
  onDate,
  ...props
}: Omit<Parameters<typeof PageHeading>[0], "date"> & { initial: string }) {
  const [date, setDate] = useState(initial);
  return (
    <PageHeading
      {...props}
      date={date}
      onDate={(next) => {
        setDate(next);
        onDate(next);
      }}
    />
  );
}

const date = pick("วันที่ทำงาน", {
  วันนี้: today(),
  ย้อนหลัง: day,
  เกินวันนี้: "2099-01-01",
});

/** เลือกใน Controls:
 *  - วันที่ทำงาน วันนี้: ไม่มีป้าย
 *  - ย้อนหลัง: ป้าย "บันทึกย้อนหลัง" เหนือช่องวันที่; "ใช้วันนี้" พากลับมาวันนี้
 *  - เกินวันนี้: วันที่พิมพ์เองหลังวันนี้ (`max` ของ picker กันพิมพ์ไม่ได้) มีคำเตือนใต้ช่อง
 *  - `overline` / `title` / `description`: ข้อความหัวแท็บ; จอเล็กชื่อยาวจะตัดบรรทัด
 *    ไม่เบียดช่องวันที่ */
export const Default: Story = {
  argTypes: {
    date: date.argType,
    overline: { control: "text" },
    title: { control: "text" },
    description: { control: "text" },
  },
  args: { date: date.initial },
  render: ({ date, ...args }) => (
    <Controlled key={date} initial={date} {...args} />
  ),
};

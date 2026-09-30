import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { pick } from "../../../.storybook/pick";
import { Button } from "@/components/atoms/Button";
import { Select } from "@/components/atoms/Select";
import { TableFilter } from "./TableFilter";
import { SectionHeading } from "./SectionHeading";

const actions = pick<ReactNode>("actions", {
  ปุ่มบันทึก: <Button variant="primary">บันทึกการตั้งค่า</Button>,
  ตัวกรอง: (
    <>
      <TableFilter label="สาขา">
        <Select variant="filter">
          <option>ทั้งหมด</option>
          <option>ศาลาแดง</option>
          <option>มีนบุรี</option>
        </Select>
      </TableFilter>
      <Button variant="secondary">ส่งออก</Button>
    </>
  ),
  ไม่มี: undefined,
});

const meta = {
  title: "Molecules/SectionHeading",
  component: SectionHeading,
  argTypes: {
    framed: { control: "boolean" },
    align: { control: "inline-radio", options: ["center", "end"] },
    overline: { control: "text" },
    title: { control: "text" },
    description: { control: "text" },
    actions: actions.argType,
  },
  args: {
    framed: true,
    align: "center",
    overline: "ตั้งค่า",
    title: "ราคาและต้นทุน",
    description:
      "กำหนดราคาเนื้อดิบ ค่ารมควัน และค่าขนส่งที่ใช้คำนวณต้นทุนต่อล็อต",
    actions: actions.initial,
  },
} satisfies Meta<typeof SectionHeading>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Toggle in Controls:
 *  - `framed`: on = the heading is the view's panel (overline + title + actions row);
 *    off = a bare heading row that sits inside an existing panel, e.g. above a table
 *  - `align` (framed only): `end` lines the actions up with the last text line — use
 *    it with actions ตัวกรอง
 *  - clear `title` for an overline-only panel (a filter bar); clear `overline` /
 *    `description` to drop those lines */
export const Default: Story = {};

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/atoms/Button";
import { SectionHeading } from "./SectionHeading";

const meta = {
  title: "Molecules/SectionHeading",
  component: SectionHeading,
  argTypes: {
    framed: { control: "boolean" },
    align: { control: "inline-radio", options: ["center", "end"] },
    overline: { control: "text" },
    title: { control: "text" },
    description: { control: "text" },
  },
  args: {
    framed: true,
    align: "center",
    overline: "ตั้งค่า",
    title: "ราคาและต้นทุน",
    description:
      "กำหนดราคาเนื้อดิบ ค่ารมควัน และค่าขนส่งที่ใช้คำนวณต้นทุนต่อล็อต",
    actions: <Button variant="primary">บันทึกการตั้งค่า</Button>,
  },
} satisfies Meta<typeof SectionHeading>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Toggle in Controls:
 *  - `framed`: on = the heading is the view's panel (overline + title + actions row);
 *    off = a bare heading row that sits inside an existing panel
 *  - `align` (framed only): `end` lines the actions up with the last text line */
export const Default: Story = {};

/** Unframed, as used above a table inside a panel. */
export const Section: Story = {
  args: {
    framed: false,
    overline: "",
    title: "รายการล็อต",
    description: "ล็อตที่ยังไม่ปิด 4 รายการ",
    actions: <Button variant="secondary">ส่งออก</Button>,
  },
};

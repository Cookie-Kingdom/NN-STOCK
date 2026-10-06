import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { StatusTile } from "./StatusTile";

const meta = {
  title: "Molecules/StatusTile",
  component: StatusTile,
  args: { label: "ส่งไปรม", value: "200 กก.", onJot: fn() },
  argTypes: { value: { control: "text" } },
} satisfies Meta<typeof StatusTile>;

export default meta;
type Story = StoryObj<typeof meta>;

/** จดแล้ว: สีเขียว พร้อมตัวเลขที่จด · ลบ `value` ใน Controls เพื่อดูสีเหลือง */
export const Jotted: Story = {};

/** ยังไม่ได้จด: ทั้งกล่องเป็นปุ่ม กดแล้วเปิดฟอร์ม */
export const NotJotted: Story = { args: { value: undefined } };

/** `jotText` เปลี่ยนคำบนปุ่มเหลือง เช่น Lot ที่ส่งไปรมแล้วแต่ยังไม่ได้เลือก PO เนื้อ */
export const NotLinked: Story = {
  args: {
    label: "PO เนื้อที่ใช้",
    value: undefined,
    jotText: "ยังไม่ได้เลือก PO เนื้อ",
  },
};

/** ยังไม่ได้จด และบัญชีนี้จดเองไม่ได้: ไม่มี `onJot` จึงไม่ใช่ปุ่ม */
export const NotJottedReadOnly: Story = {
  args: { value: undefined, onJot: undefined },
};

/** สี่บันทึกหลักของ Lot เรียงกันแบบในหน้า Lots */
export const Row: Story = {
  render: ({ onJot }) => (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
      <StatusTile label="PO รมควัน" value="100 กก." />
      <StatusTile label="ส่งไปรม" value="100 กก." />
      <StatusTile label="ส่งกลับ" onJot={onJot} />
      <StatusTile label="Invoice Chef House" onJot={onJot} />
    </div>
  ),
};

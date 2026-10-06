import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { DayCard } from "./DayCard";
import { SectionAction } from "./SectionAction";

type Args = {
  state: "ล็อกอยู่" | "กำลังแก้ส่วนนี้" | "กำลังแก้ส่วนอื่น";
  saving: boolean;
  message: string;
  error: string;
  onCancel: () => void;
  onSave: () => void;
  onStartEdit: (section: "prices" | "materials") => void;
};

const editing = {
  ล็อกอยู่: null,
  กำลังแก้ส่วนนี้: "prices",
  กำลังแก้ส่วนอื่น: "materials",
} as const;

const meta: Meta<Args> = {
  title: "Molecules/SectionAction",
};

export default meta;

/** The locked / editing switch in the title bar of a Settings section. เลือกใน Controls:
 *  - `state` ล็อกอยู่: ปุ่ม "แก้ไข" ปุ่มเดียว
 *  - `state` กำลังแก้ส่วนนี้: "ยกเลิก" + "บันทึก"; `message` อยู่ข้างปุ่ม
 *    `error` แทนที่ message เป็นสีแดงและปิดปุ่มบันทึก
 *  - `state` กำลังแก้ส่วนอื่น: ปุ่มถูกปิด อ่าน "กำลังแก้ส่วนอื่น" (เปิดได้ทีละส่วน)
 *  - `saving`: ระหว่างบันทึก ปุ่มบันทึกหมุนและอ่าน "กำลังบันทึก…" */
export const Default: StoryObj<Args> = {
  argTypes: {
    state: {
      control: "inline-radio",
      options: Object.keys(editing),
    },
    saving: { control: "boolean" },
    message: { control: "text" },
    error: { control: "text" },
  },
  args: {
    state: "ล็อกอยู่",
    saving: false,
    message: "แก้ราคาแล้วกดบันทึก",
    error: "",
    onCancel: fn(),
    onSave: fn(),
    onStartEdit: fn(),
  },
  render: ({ state, ...args }) => (
    <DayCard
      title="ตัวเลขสำหรับคำนวณ"
      aside={
        <SectionAction {...args} section="prices" editing={editing[state]} />
      }
    >
      <div className="px-5 py-4 text-body text-text-secondary">ราคากล่อง</div>
    </DayCard>
  ),
};

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { TableSection } from "./TableSection";
import { SectionAction } from "./SectionAction";

type Args = {
  state: "ล็อกอยู่" | "กำลังแก้ตารางนี้" | "กำลังแก้ตารางอื่น";
  saving: boolean;
  message: string;
  error: string;
  lockedMessage: string;
  onCancel: () => void;
  onSave: () => void;
  onStartEdit: (section: "prices" | "materials") => void;
};

const editing = {
  ล็อกอยู่: null,
  กำลังแก้ตารางนี้: "prices",
  กำลังแก้ตารางอื่น: "materials",
} as const;

const meta: Meta<Args> = {
  title: "Molecules/SectionAction",
};

export default meta;

/** The locked / editing switch in a TableSection's title bar (ConfigView, Branch
 *  materials). เลือกใน Controls:
 *  - `state` ล็อกอยู่: ปุ่ม "ขอแก้ไข" ปุ่มเดียว; `lockedMessage` ขึ้นสีเขียวข้างปุ่ม
 *    (ยืนยันว่าเพิ่งบันทึกสำเร็จ)
 *  - `state` กำลังแก้ตารางนี้: "ยกเลิก" + "บันทึกและล็อก"; `message` อยู่ข้างปุ่ม
 *    `error` แทนที่ message เป็นสีแดงและปิดปุ่มบันทึก
 *  - `state` กำลังแก้ตารางอื่น: ปุ่มถูกปิด อ่าน "กำลังแก้ตารางอื่น" (เปิดได้ทีละตาราง)
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
    lockedMessage: { control: "text" },
  },
  args: {
    state: "ล็อกอยู่",
    saving: false,
    message: "แก้ราคาแล้วกดบันทึกเพื่อล็อก",
    error: "",
    lockedMessage: "",
    onCancel: fn(),
    onSave: fn(),
    onStartEdit: fn(),
  },
  render: ({ state, lockedMessage, ...args }) => (
    <TableSection
      title="ราคาขาย"
      actions={
        <SectionAction
          {...args}
          section="prices"
          editing={editing[state]}
          lockedMessage={lockedMessage || undefined}
        />
      }
    >
      <div className="px-6 py-5 text-body text-text-secondary">ตารางราคา</div>
    </TableSection>
  ),
};

import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { pick } from "../../../.storybook/pick";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { Textarea } from "@/components/atoms/Textarea";
import { FieldGroup } from "./FieldGroup";
import { FileUploadField } from "./FileUploadField";
import { FormField } from "./FormField";

const meta = {
  title: "Molecules/FormField",
  component: FormField,
  args: {
    label: "น้ำหนักรับเข้า (กก.)",
    children: <Input type="number" step="0.01" placeholder="0.00" />,
  },
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

type Props = ComponentProps<typeof FormField>;

const state = pick<Partial<Props>>("สถานะ", {
  ปกติ: {},
  ไม่บังคับพร้อมคำแนะนำ: {
    label: "หมายเหตุ",
    optional: true,
    hint: "แสดงในเอกสารส่งมอบ",
    children: <Textarea compact />,
  },
  ระบบกรอกให้: {
    label: "ชื่อผู้รับ",
    prefilled: { label: "ล่าสุด 18/09" },
    children: <Input defaultValue="สมชาย" />,
  },
  ค่าคาดการณ์: {
    label: "จำนวนกล่องรมควันที่รับ",
    prefilled: { label: "ตามยอดส่ง", expected: true },
    children: <Input type="number" defaultValue="360" />,
  },
});

/** Pick the state in Controls:
 *  - ปกติ: a label over one control
 *  - ไม่บังคับพร้อมคำแนะนำ: `optional` mark and a `hint` line
 *  - ระบบกรอกให้: a value the system filled in — a faint tint and where it came from
 *  - ค่าคาดการณ์: a predicted scale or count reading — a warning look so it is
 *    weighed, not trusted */
export const Default: StoryObj<Props & { state: Partial<Props> }> = {
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  argTypes: { state: state.argType },
  args: { state: state.initial },
  render: ({ state, ...args }) => <FormField {...args} {...state} />,
};

/** Both kinds side by side with an untouched field, as they appear in a form. */
export const PrefilledStates: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
      <FormField label="ต้นทาง" prefilled={{ label: "ค่าเริ่มต้น" }}>
        <Select defaultValue="กรุงเทพฯ">
          <option>เชียงใหม่</option>
          <option>กรุงเทพฯ</option>
        </Select>
      </FormField>
      <FormField label="ทะเบียนรถ" prefilled={{ label: "ตามเที่ยวขาไป" }}>
        <Input defaultValue="กข123" />
      </FormField>
      <FormField
        label="น้ำหนักส่งจาก Chef House (กก.)"
        prefilled={{ label: "ตามยอดสโมค", expected: true }}
      >
        <Input type="number" defaultValue="28.50" />
      </FormField>
      <FormField label="ผู้ตรวจรับ">
        <Input />
      </FormField>
    </div>
  ),
};

/** How lot forms lay fields out: a 2-column grid, `wide` spans both columns. */
export const FormGrid: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
      <FormField label="วันที่รับ">
        <Input type="date" />
      </FormField>
      <FormField label="สาขา">
        <Select>
          <option>ศาลาแดง</option>
          <option>มีนบุรี</option>
        </Select>
      </FormField>
      <FieldGroup label="น้ำหนักต่อแพ็ก" hint="กรอกทีละแพ็ก">
        <div className="flex gap-2">
          <Input aria-label="แพ็ก 1" placeholder="แพ็ก 1" />
          <Input aria-label="แพ็ก 2" placeholder="แพ็ก 2" />
        </div>
      </FieldGroup>
      <FileUploadField
        label="ใบส่งของ"
        optional
        accept="image/*,application/pdf"
        maxBytes={2 * 1024 * 1024}
        onFile={fn()}
      />
      <FormField label="หมายเหตุ" optional wide>
        <Textarea />
      </FormField>
    </div>
  ),
};

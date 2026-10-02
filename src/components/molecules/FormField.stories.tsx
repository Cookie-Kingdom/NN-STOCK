import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { pick } from "../../../.storybook/pick";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { Textarea } from "@/components/atoms/Textarea";
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
});

/** Pick the state in Controls:
 *  - ปกติ: a label over one control
 *  - ไม่บังคับพร้อมคำแนะนำ: `optional` mark and a `hint` line
 *  - `as` div: a `<span>` label for a field holding several controls;
 *    `wide` only shows inside a grid, see the FormGrid and Group stories */
export const Default: StoryObj<Props & { state: Partial<Props> }> = {
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    state: state.argType,
    as: { control: "inline-radio", options: ["label", "div"] },
  },
  args: { state: state.initial, as: "label" },
  render: ({ state, ...args }) => <FormField {...args} {...state} />,
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
      <FormField as="div" label="น้ำหนักต่อแพ็ก" hint="กรอกทีละแพ็ก">
        <div className="flex gap-2">
          <Input aria-label="แพ็ก 1" placeholder="แพ็ก 1" />
          <Input aria-label="แพ็ก 2" placeholder="แพ็ก 2" />
        </div>
      </FormField>
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

/** `as="div"`: one label over several controls (a `<label>` around several inputs is
 *  invalid), so each control carries its own `aria-label`. `wide` spans both columns. */
export const Group: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
      <FormField as="div" label="สาขาและรอบส่ง">
        <div className="flex gap-2">
          <Select aria-label="สาขา">
            <option>ศาลาแดง</option>
            <option>มีนบุรี</option>
          </Select>
          <Select aria-label="รอบส่ง">
            <option>รอบเช้า</option>
            <option>รอบบ่าย</option>
          </Select>
        </div>
      </FormField>
      <FormField
        as="div"
        label="จำนวนกล่อง"
        optional
        hint="กล่องเต็ม / กล่องเศษ"
      >
        <div className="flex gap-2">
          <Input aria-label="กล่องเต็ม" placeholder="เต็ม" />
          <Input aria-label="กล่องเศษ" placeholder="เศษ" />
        </div>
      </FormField>
      <FormField
        as="div"
        label="น้ำหนักเนื้อรมควันต่อล็อต (กก.)"
        hint="กรอกทีละแพ็กตามที่ชั่งจริง"
        wide
      >
        <div className="grid grid-cols-4 gap-2 max-md:grid-cols-2">
          <Input aria-label="แพ็ก 1" placeholder="แพ็ก 1" />
          <Input aria-label="แพ็ก 2" placeholder="แพ็ก 2" />
          <Input aria-label="แพ็ก 3" placeholder="แพ็ก 3" />
          <Input aria-label="แพ็ก 4" placeholder="แพ็ก 4" />
        </div>
      </FormField>
    </div>
  ),
};

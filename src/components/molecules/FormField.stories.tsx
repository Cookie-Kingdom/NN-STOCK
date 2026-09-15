import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
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

const narrow: Story["decorators"] = [
  (Story) => (
    <div className="max-w-md">
      <Story />
    </div>
  ),
];

export const Default: Story = { decorators: narrow };
export const OptionalWithHint: Story = {
  decorators: narrow,
  args: {
    label: "หมายเหตุ",
    optional: true,
    hint: "แสดงในเอกสารส่งมอบ",
    children: <Textarea compact />,
  },
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

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { FieldGroup } from "./FieldGroup";

const meta = {
  title: "Molecules/FieldGroup",
  component: FieldGroup,
  args: {
    label: "น้ำหนักต่อแพ็ก (กก.)",
    children: (
      <div className="flex gap-2">
        <Input
          type="number"
          step="0.01"
          aria-label="แพ็ก 1 (กก.)"
          placeholder="แพ็ก 1"
        />
        <Input
          type="number"
          step="0.01"
          aria-label="แพ็ก 2 (กก.)"
          placeholder="แพ็ก 2"
        />
        <Input
          type="number"
          step="0.01"
          aria-label="แพ็ก 3 (กก.)"
          placeholder="แพ็ก 3"
        />
      </div>
    ),
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FieldGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Several controls under one label; each one carries its own `aria-label`. */
export const Default: Story = {};

/** `optional` adds the optional mark, `hint` the line under the label. */
export const OptionalWithHint: Story = {
  args: {
    label: "ช่วงอุณหภูมิห้องรมควัน (°C)",
    optional: true,
    hint: "เว้นว่างได้ถ้าใช้ค่ามาตรฐานของเตา",
  },
};

/** `wide` makes the group span both columns of a two-column lot form. */
export const Wide: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
      <FieldGroup label="สาขาและรอบส่ง">
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
      </FieldGroup>
      <FieldGroup label="จำนวนกล่อง" hint="กล่องเต็ม / กล่องเศษ">
        <div className="flex gap-2">
          <Input aria-label="กล่องเต็ม" placeholder="เต็ม" />
          <Input aria-label="กล่องเศษ" placeholder="เศษ" />
        </div>
      </FieldGroup>
      <FieldGroup
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
      </FieldGroup>
    </div>
  ),
};

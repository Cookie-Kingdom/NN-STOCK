import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { Textarea } from "@/components/atoms/Textarea";
import { FormField } from "./FormField";
import { FormGrid } from "./FormGrid";

const meta = {
  title: "Molecules/FormGrid",
  component: FormGrid,
  args: {
    children: (
      <>
        <FormField label="น้ำหนักรับจริง (กก.)">
          <Input
            variant="form"
            type="number"
            step="0.001"
            inputMode="decimal"
            defaultValue="42.5"
          />
        </FormField>
        <FormField label="สาขาปลายทาง">
          <Select variant="form" defaultValue="ศาลาแดง">
            <option>ศาลาแดง</option>
            <option>มีนบุรี</option>
          </Select>
        </FormField>
        <FormField label="ผู้รับของ">
          <Input variant="form" type="text" defaultValue="คุณสมชาย" />
        </FormField>
        <FormField label="เลขที่ใบส่งของ" optional>
          <Input variant="form" type="text" />
        </FormField>
        <FormField label="หมายเหตุ" hint="เห็นเฉพาะภายใน ไม่ขึ้นบนเอกสาร" wide>
          <Textarea variant="form" rows={2} />
        </FormField>
      </>
    ),
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FormGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two columns of FormFields; the last one is `wide`, so it spans both. Below `md`
 * the grid collapses to a single column and every field goes full width. */
export const Default: Story = {};

/** The same grid drawn as a card — the transfer form groups its receivers this way.
 * The caller's classes win over the grid's own, so the margin and gaps are its call. */
export const OnACard: Story = {
  args: {
    className: "my-0 gap-x-6 gap-y-5 rounded-lg border border-border bg-bg p-5",
  },
};

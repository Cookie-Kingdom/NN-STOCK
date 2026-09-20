import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { ButtonRow } from "./ButtonRow";
import { FormError } from "./FormError";
import { FormField } from "./FormField";

const meta = {
  title: "Molecules/FormError",
  component: FormError,
  args: { error: "น้ำหนักรับเข้าต้องมากกว่า 0 กก." },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FormError>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A rejected save: a danger Notice that scrolls itself into view. */
export const WithError: Story = {};

/** Longer text from the store's validation still reads as one block. */
export const LongMessage: Story = {
  args: {
    error:
      "บันทึกไม่สำเร็จ: ล็อต LOT-0915-01 ปิดแล้ว จึงแก้ไขน้ำหนักรับเข้าของสาขาศาลาแดงไม่ได้ กรุณาเปิดล็อตใหม่หรือบันทึกเป็นรายการปรับปรุงสต๊อก",
  },
};

/** No error — the component renders nothing, so the form keeps its spacing. */
export const NoError: Story = { args: { error: null } };

/** Where it actually sits: last thing in a form body, above the buttons. */
export const InForm: Story = {
  render: () => (
    <form className="grid gap-4">
      <FormField label="สาขา">
        <Select>
          <option>ศาลาแดง</option>
          <option>มีนบุรี</option>
        </Select>
      </FormField>
      <FormField label="น้ำหนักรับเข้า (กก.)">
        <Input type="number" step="0.01" defaultValue="0" />
      </FormField>
      <FormError error="น้ำหนักรับเข้าต้องมากกว่า 0 กก." />
      <ButtonRow>
        <Button variant="primary">บันทึก</Button>
        <Button variant="secondary">ยกเลิก</Button>
      </ButtonRow>
    </form>
  ),
};

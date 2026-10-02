import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { pick } from "../../../.storybook/pick";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { FormError } from "./FormError";
import { FormField } from "./FormField";

const meta = {
  title: "Molecules/FormError",
  component: FormError,
  args: { error: "น้ำหนักที่รับ: เว็บไม่รับตัวเลขติดลบหรือค่าที่ไม่ใช่ตัวเลข" },
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

const error = pick("error", {
  สั้น: "น้ำหนักที่รับ: เว็บไม่รับตัวเลขติดลบหรือค่าที่ไม่ใช่ตัวเลข",
  ยาว: "บันทึกไม่สำเร็จ: ข้อมูลบนเซิร์ฟเวอร์เปลี่ยนไประหว่างที่เปิดฟอร์มนี้ เว็บโหลดข้อมูลล่าสุดมาแล้ว ดูรายการของสาขาศาลาแดงอีกครั้ง แล้วจดใหม่",
  ไม่มี: null,
});

/** Pick the state in Controls:
 *  - สั้น: a rejected save, a danger Notice that scrolls itself into view
 *  - ยาว: longer text from the store's validation still reads as one block
 *  - ไม่มี: the component renders nothing, so the form keeps its spacing */
export const Default: Story = {
  argTypes: { error: error.argType },
  args: { error: error.initial },
};

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
      <FormError error="น้ำหนักที่รับ: เว็บไม่รับตัวเลขติดลบหรือค่าที่ไม่ใช่ตัวเลข" />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary">บันทึก</Button>
        <Button variant="secondary">ยกเลิก</Button>
      </div>
    </form>
  ),
};

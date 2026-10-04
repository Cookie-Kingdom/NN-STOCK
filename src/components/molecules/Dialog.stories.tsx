import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { FormField } from "@/components/molecules/FormField";
import { phone } from "@/components/organisms/workspace/storyWorkspace";
import { Dialog } from "./Dialog";

const meta = {
  title: "Molecules/Dialog",
  component: Dialog,
  // A modal <dialog> per story would stack on a Docs page.
  tags: ["!autodocs"],
  args: {
    title: "จ่ายเงิน",
    subtitle: "PO-2610-001 · 4 ต.ค. 2569",
    size: "lg",
    onClose: fn(),
    children: null,
  },
  argTypes: { children: { control: false }, alert: { control: false } },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A form as the composer lays one out: its body scrolls, the action row stays at the
 *  bottom. The first field has focus when it opens (`data-autofocus`). Escape or ✕ calls
 *  `onClose` (Actions panel). Switch `size` in Controls: sm 420 · md 520 · lg 860 · xl 1280px. */
export const Form: Story = {
  render: (args) => (
    <Dialog {...args}>
      <form className="flex min-h-0 flex-auto flex-col">
        <div className="grid min-h-0 flex-auto grid-cols-2 content-start gap-4 overflow-auto p-6.5 max-md:grid-cols-1 max-md:p-4">
          {Array.from({ length: 14 }, (_, i) => (
            <FormField key={i} label={`ช่อง ${i + 1}`}>
              <Input data-autofocus={i === 0 || undefined} />
            </FormField>
          ))}
        </div>
        <footer className="flex flex-wrap items-center justify-end gap-2.5 border-t border-border bg-bg px-6.5 py-4 max-md:px-4 max-md:py-3">
          <Button
            variant="link"
            className="min-h-11 px-2"
            onClick={args.onClose}
          >
            ยกเลิก
          </Button>
          <Button type="submit" variant="primary">
            บันทึก
          </Button>
        </footer>
      </form>
    </Dialog>
  ),
};

/** A confirm: `sm`, `role="alertdialog"` described by its text, no ✕, focus on 「ยกเลิก」. */
export const Confirm: Story = {
  args: {
    title: "ลบบันทึกนี้?",
    subtitle: undefined,
    size: "sm",
    alert: { describedBy: "confirm-text" },
  },
  render: (args) => (
    <Dialog {...args}>
      <div className="flex flex-col gap-4 px-6.5 pt-3 pb-6 max-md:px-4 max-md:pb-4">
        <p id="confirm-text" className="m-0 text-body-sm text-text-secondary">
          ตัวเลขที่คิดจากบันทึกนี้จะเปลี่ยนตาม · ยังดูได้ใน Change log
        </p>
        <div className="flex justify-end gap-2.5 max-md:[&>*]:flex-1">
          <Button data-autofocus onClick={args.onClose}>
            ยกเลิก
          </Button>
          <Button variant="danger" onClick={args.onClose}>
            ลบ
          </Button>
        </div>
      </div>
    </Dialog>
  ),
};

/** จอ 390px: เต็มจอ */
export const Phone: Story = { ...Form, ...phone };

/** จอ 390px: `sm` เป็น bottom sheet ชิดล่างจอ ไม่เต็มจอ */
export const PhoneConfirm: Story = { ...Confirm, ...phone };

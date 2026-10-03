import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { Badge } from "@/components/atoms/Badge";
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
    className: "w-180",
    onClose: fn(),
    children: null,
  },
  argTypes: { children: { control: false }, meta: { control: false } },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A form as the composer lays one out: its body scrolls, the action row stays at the
 *  bottom. The first field has focus when it opens (`data-autofocus`). Escape or ✕ calls
 *  `onClose` (Actions panel). */
export const Form: Story = {
  args: {
    meta: <Badge tone="warning">ช่องสีเหลือง = ยังไม่ได้จด</Badge>,
  },
  render: (args) => (
    <Dialog {...args}>
      <form className="flex min-h-0 flex-auto flex-col">
        <div className="grid min-h-0 flex-auto grid-cols-[repeat(auto-fill,minmax(180px,1fr))] content-start gap-4 overflow-auto p-6.5 max-md:p-4">
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

/** จอ 390px: เต็มจอ */
export const Phone: Story = { ...Form, ...phone };

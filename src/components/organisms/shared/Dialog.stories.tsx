import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { FormField } from "@/components/molecules/FormField";
import { Dialog } from "./Dialog";
import { DialogBody } from "./DialogBody";
import { DialogFooter } from "./DialogFooter";

const meta = {
  title: "Organisms/Dialog",
  component: Dialog,
  args: { title: "รับเนื้อเข้า", overline: "Chef_house", onClose: () => {} },
  argTypes: {
    size: {
      control: "select",
      options: ["document", "default", "wide", "xl", "preview"],
    },
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// Dialog opens on mount and closes on unmount, so the story toggles mounting.
function FormDialog(args: Story["args"]) {
  const [open, setOpen] = useState(true);
  const close = () => setOpen(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        เปิดฟอร์ม
      </Button>
      {open && (
        <Dialog {...args} title={args?.title ?? ""} onClose={close}>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              close();
            }}
          >
            <DialogBody>
              <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                <FormField label="เลขล็อต">
                  <Input defaultValue="LOT-0915-01" />
                </FormField>
                <FormField label="น้ำหนัก (กก.)">
                  <Input type="number" step="0.01" />
                </FormField>
              </div>
            </DialogBody>
            <DialogFooter
              hint="ตรวจสอบน้ำหนักก่อนบันทึก"
              onCancel={close}
              submitLabel="บันทึก"
            />
          </form>
        </Dialog>
      )}
    </>
  );
}

export const Form: Story = { render: (args) => <FormDialog {...args} /> };

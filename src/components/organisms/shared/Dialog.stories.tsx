import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { FormField } from "@/components/molecules/FormField";
import { SegmentedChoice } from "@/components/molecules/SegmentedChoice";
import { pick } from "../../../../.storybook/pick";
import { Dialog, type DialogProps } from "./Dialog";
import { DialogBody } from "./DialogBody";
import { DialogFooter } from "./DialogFooter";

type Args = Pick<DialogProps, "title" | "overline" | "size" | "onClose"> & {
  toolbar: boolean;
  hint: string;
  error: string;
  warning: string[];
  submitLabel: string;
  cancel: boolean;
  submitDisabled: boolean;
  submitting: boolean;
};

const warning = pick("คำเตือน", {
  ไม่มี: [] as string[],
  บรรทัดเดียว: ["สต๊อกแช่แข็งไม่พอ · กรอกได้สูงสุด 12.50 กก."],
  สองบรรทัด: [
    "สต๊อกแช่แข็งไม่พอ · กรอกได้สูงสุด 12.50 กก.",
    "ยอดรวมไม่ตรงกับ Invoice 0.50 กก.",
  ],
});

// A native modal <dialog>; a Docs page would stack it behind the other stories.
const meta = {
  title: "Organisms/Shared/Dialog",
  tags: ["!autodocs"],
  args: {
    title: "รับเนื้อเข้า",
    overline: "Chef House",
    size: "default",
    onClose: fn(),
    toolbar: false,
    hint: "ตรวจสอบน้ำหนักก่อนบันทึก",
    error: "",
    warning: warning.initial,
    submitLabel: "บันทึก",
    cancel: true,
    submitDisabled: false,
    submitting: false,
  },
  argTypes: {
    size: {
      control: "select",
      options: ["document", "default", "formWide", "wide", "xl", "preview"],
    },
    toolbar: { name: "แถบเครื่องมือ (toolbar)", control: "boolean" },
    hint: { control: "text" },
    error: { name: "error (ปิดปุ่มบันทึก)", control: "text" },
    warning: warning.argType,
    submitLabel: {
      name: "submitLabel (ว่าง = ไม่มีปุ่มบันทึก)",
      control: "text",
    },
    cancel: { name: "ปุ่มยกเลิก", control: "boolean" },
    submitDisabled: { control: "boolean" },
    submitting: { name: "กำลังบันทึก", control: "boolean" },
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

// Dialog opens on mount and closes on unmount, so the story toggles mounting.
function FormDialog({
  toolbar,
  hint,
  error,
  warning,
  submitLabel,
  cancel,
  submitDisabled,
  submitting,
  onClose,
  ...dialog
}: Args) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"meat" | "material">("meat");
  const close = () => {
    setOpen(false);
    onClose();
  };
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        เปิดฟอร์ม
      </Button>
      {open && (
        <Dialog
          {...dialog}
          onClose={close}
          toolbar={
            toolbar && (
              <SegmentedChoice
                label="ประเภท"
                value={tab}
                onChange={setTab}
                options={[
                  { value: "meat", label: "เนื้อ" },
                  { value: "material", label: "วัสดุ" },
                ]}
              />
            )
          }
        >
          <form
            className="flex min-h-0 flex-auto flex-col"
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
              hint={hint}
              error={error || undefined}
              warning={warning}
              onCancel={cancel ? close : undefined}
              submitLabel={submitLabel || undefined}
              submitDisabled={submitDisabled}
              submitting={submitting}
            />
          </form>
        </Dialog>
      )}
    </>
  );
}

/** Dialog + DialogBody + DialogFooter. เลือกใน Controls:
 *  - size: ความกว้างของ popup; overline / title: หัว
 *  - แถบเครื่องมือ: `toolbar` ใต้หัว ไม่เลื่อนตามเนื้อหา
 *  - hint: ข้อความซ้ายของ footer (ซ่อนบนมือถือ); error แทนที่ hint และปิดปุ่มบันทึก
 *  - คำเตือน: สีเตือน ปุ่มบันทึกยังกดได้
 *  - submitLabel ว่าง + ปิดปุ่มยกเลิก: footer ไม่มีปุ่ม
 *  - submitDisabled / กำลังบันทึก: ปุ่มบันทึกถูกปิด / หมุน */
export const Form: Story = {
  render: (args) => <FormDialog {...args} />,
};

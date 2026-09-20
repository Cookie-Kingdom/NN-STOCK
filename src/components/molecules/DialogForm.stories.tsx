import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { ButtonRow } from "./ButtonRow";
import { DialogForm } from "./DialogForm";
import { FormField } from "./FormField";
import { FormGrid } from "./FormGrid";

const meta = {
  title: "Molecules/DialogForm",
  component: DialogForm,
  args: { onSubmit: fn() },
  /** A Dialog is a fixed-height flex column; this stands in for one. */
  decorators: [
    (Story) => (
      <div className="flex h-96 w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-surface">
        <header className="border-b border-border px-6.5 py-5.5 text-h2">
          บันทึกการรับเข้า
        </header>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DialogForm>;

export default meta;
type Story = StoryObj<typeof meta>;

function Body({ rows }: { rows: number }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto p-6.5">
      <FormGrid className="my-0">
        {Array.from({ length: rows }, (_, index) => (
          <FormField key={index} label={`น้ำหนักแพ็กที่ ${index + 1} (กก.)`}>
            <Input
              variant="form"
              type="number"
              step="0.001"
              inputMode="decimal"
            />
          </FormField>
        ))}
      </FormGrid>
    </div>
  );
}

function Footer() {
  return (
    <ButtonRow className="my-0 justify-end border-t border-border px-6.5 py-4.5">
      <Button variant="secondary">ยกเลิก</Button>
      <Button variant="primary" type="submit">
        บันทึก
      </Button>
    </ButtonRow>
  );
}

/** A short form: the body takes the height it needs and the footer sits under it. */
export const Default: Story = {
  render: (args) => (
    <DialogForm {...args}>
      <Body rows={4} />
      <Footer />
    </DialogForm>
  ),
};

/** `min-h-0` earning its place: with more fields than fit, the body scrolls and the
 * footer stays on screen instead of being pushed out of the dialog. */
export const Scrolling: Story = {
  render: (args) => (
    <DialogForm {...args}>
      <Body rows={16} />
      <Footer />
    </DialogForm>
  ),
};

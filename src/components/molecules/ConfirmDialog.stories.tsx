import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ConfirmDialog } from "./ConfirmDialog";

const meta = {
  title: "Molecules/ConfirmDialog",
  component: ConfirmDialog,
  // A modal <dialog> per story would stack on a Docs page.
  tags: ["!autodocs"],
  args: {
    title: "ลบรายการ",
    children:
      "ลบ「เนื้อวากิว」? จะหายจากรายการและฟอร์มใหม่ ส่วนยอดที่เคยจดยังนับตามเดิม",
    onConfirm: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The ask before a Settings row is deleted: 「ไม่ลบ」 has focus, so Enter does no harm. */
export const Default: Story = {};

/** 「ยืนยันลบ」 pressed: both buttons off while the save runs. */
export const Saving: Story = { args: { saving: true } };

/** The save was refused: the reason in place of the message, the confirm off. */
export const Error: Story = {
  args: { error: "รายการเนื้อ: 「เนื้อ」ลบไม่ได้" },
};

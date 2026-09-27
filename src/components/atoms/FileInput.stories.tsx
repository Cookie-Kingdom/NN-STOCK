import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FileInput } from "./FileInput";

const meta = {
  title: "Atoms/FileInput",
  component: FileInput,
  args: { "aria-label": "เลือกไฟล์ Invoice" },
} satisfies Meta<typeof FileInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick the state in Controls:
 *  - `accept`: e.g. `image/*` to limit the picker to images
 *  - `disabled`: not clickable */
export const Default: Story = {
  argTypes: {
    accept: { control: "text" },
    disabled: { control: "boolean" },
  },
  args: { accept: "", disabled: false },
};

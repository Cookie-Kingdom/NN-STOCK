import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Textarea } from "./Textarea";

const meta = {
  title: "Atoms/Textarea",
  component: Textarea,
  args: { placeholder: "หมายเหตุ" },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick the state in Controls:
 *  - `compact`: starts one line high, for a short reason or memo
 *  - `disabled`: locked */
export const Default: Story = {
  argTypes: {
    compact: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  args: { compact: false, disabled: false },
};

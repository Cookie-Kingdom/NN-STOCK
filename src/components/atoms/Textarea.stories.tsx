import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Textarea } from "./Textarea";

const meta = {
  title: "Atoms/Textarea",
  component: Textarea,
  args: { placeholder: "หมายเหตุ" },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Form: Story = {};
export const Compact: Story = { args: { compact: true } };
export const Disabled: Story = { args: { disabled: true } };

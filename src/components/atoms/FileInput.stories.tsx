import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FileInput } from "./FileInput";

const meta = {
  title: "Atoms/FileInput",
  component: FileInput,
  args: { "aria-label": "เลือกไฟล์ Invoice" },
} satisfies Meta<typeof FileInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Images: Story = { args: { accept: "image/*" } };
export const Disabled: Story = { args: { disabled: true } };

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Pencil, X } from "lucide-react";
import { fn } from "storybook/test";
import { pick } from "../../../.storybook/pick";
import { IconButton } from "./IconButton";

const icon = pick("icon", {
  X: <X size={18} />,
  Pencil: <Pencil size={16} />,
});

const meta = {
  title: "Atoms/IconButton",
  component: IconButton,
  args: { label: "ปิด", icon: <X size={18} />, onClick: fn() },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick the state in Controls:
 *  - `size`: md (default) or sm (e.g. Pencil "แก้ไข" in a table row)
 *  - `disabled`: not clickable */
export const Default: Story = {
  argTypes: {
    size: { control: "inline-radio", options: ["md", "sm"] },
    disabled: { control: "boolean" },
    label: { control: "text" },
    icon: icon.argType,
  },
  args: { size: "md", disabled: false, icon: icon.initial },
};

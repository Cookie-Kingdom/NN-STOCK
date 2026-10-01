import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CircleCheck } from "lucide-react";
import { pick } from "../../../.storybook/pick";
import { EmptyState } from "./EmptyState";

const icon = pick("icon", {
  ไม่มี: undefined,
  CircleCheck: <CircleCheck size={16} />,
});

const meta = {
  title: "Molecules/EmptyState",
  component: EmptyState,
  args: { text: "ยังไม่มีล็อตในระบบ" },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick the state in Controls:
 *  - `compact`: the small inline version, e.g. "ไม่มีรายการที่ยังไม่ได้จด" with the CircleCheck
 *    icon */
export const Default: Story = {
  argTypes: {
    compact: { control: "boolean" },
    text: { control: "text" },
    icon: icon.argType,
  },
  args: { compact: false, icon: icon.initial },
};

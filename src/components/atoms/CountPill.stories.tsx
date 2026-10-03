import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Bell } from "lucide-react";
import { CountPill } from "./CountPill";

const meta = {
  title: "Atoms/CountPill",
  component: CountPill,
  args: { children: 3 },
} satisfies Meta<typeof CountPill>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A count of things not recorded yet: a red pill (the `destructive` tokens, contrast
 *  ≥ 4.5:1 in both themes) so it stands out, and the number carries the meaning. Pick `variant` in Controls; each one renders where it is used:
 *  - `menu`: after a sidebar menu label
 *  - `overlay`: on the corner of an icon button (the bell) */
export const Default: Story = {
  argTypes: {
    variant: { control: "inline-radio", options: ["menu", "overlay"] },
    children: { control: "text" },
  },
  args: { variant: "menu" },
  render: (args) =>
    args.variant === "overlay" ? (
      <span className="relative grid size-11 place-items-center rounded-md border border-border">
        <Bell size={19} />
        <CountPill {...args} />
      </span>
    ) : (
      <div className="flex w-56 items-center gap-2 rounded-md border border-border p-3">
        สต๊อกกลาง
        <CountPill {...args} />
      </div>
    ),
};

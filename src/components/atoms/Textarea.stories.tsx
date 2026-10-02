import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Textarea } from "./Textarea";

const meta = {
  title: "Atoms/Textarea",
  component: Textarea,
  args: { placeholder: "หมายเหตุ" },
  argTypes: {
    variant: { control: "inline-radio", options: ["form", "table", "filter"] },
    compact: { control: "boolean" },
    disabled: { control: "boolean" },
    defaultValue: { control: "text" },
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick the state in Controls:
 *  - `variant`: form (default); table/filter exist via the shared control styles
 *  - `compact`: starts one line high, for a short note
 *  - `disabled`: cannot be typed in */
export const Default: Story = {
  args: {
    variant: "form",
    compact: false,
    disabled: false,
    defaultValue: "",
  },
  // defaultValue only applies on mount, so remount when it changes.
  render: (args) => <Textarea key={String(args.defaultValue)} {...args} />,
};

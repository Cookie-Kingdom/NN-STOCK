import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Textarea } from "./Textarea";

const meta = {
  title: "Atoms/Textarea",
  component: Textarea,
  args: { placeholder: "หมายเหตุ" },
  argTypes: {
    variant: { control: "inline-radio", options: ["form", "table", "filter"] },
    prefilled: {
      control: "inline-radio",
      options: [undefined, "auto", "expected"],
    },
    reason: { control: "boolean" },
    compact: { control: "boolean" },
    disabled: { control: "boolean" },
    defaultValue: { control: "text" },
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick the state in Controls:
 *  - `variant`: form (default); table/filter exist via the shared control styles
 *  - `prefilled`: auto (system-filled tint) or expected (predicted, warning tint)
 *  - `reason`: the free-text reason look inside a table row
 *  - `compact`: starts one line high, for a short reason or memo
 *  - `disabled`: locked */
export const Default: Story = {
  args: {
    variant: "form",
    prefilled: undefined,
    reason: false,
    compact: false,
    disabled: false,
    defaultValue: "",
  },
  // defaultValue only applies on mount, so remount when it changes.
  render: (args) => <Textarea key={String(args.defaultValue)} {...args} />,
};

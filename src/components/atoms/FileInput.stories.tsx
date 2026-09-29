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
 *  - `multiple`: pick several files at once (slips)
 *  - `disabled`: not clickable */
export const Default: Story = {
  argTypes: {
    accept: { control: "text" },
    multiple: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  args: { accept: "", multiple: false, disabled: false },
  // multiple/accept change the native picker; remount so the browser drops a stale file name.
  render: (args) => (
    <FileInput key={`${args.multiple}|${args.accept}`} {...args} />
  ),
};

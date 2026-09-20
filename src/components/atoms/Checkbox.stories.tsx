import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Checkbox } from "./Checkbox";

const meta = {
  title: "Atoms/Checkbox",
  component: Checkbox,
  args: { "aria-label": "เลือกรายการ" },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {};
export const Checked: Story = { args: { defaultChecked: true } };
export const Disabled: Story = {
  args: { disabled: true, defaultChecked: true },
};

/** How the forms use it: the whole row is the label, so the box itself stays bare. */
export const InRow: Story = {
  render: () => (
    <div className="grid max-w-100 gap-2">
      {["เนื้อสไลด์", "เนื้อสันคอ", "เนื้อบด"].map((item, index) => (
        <label
          key={item}
          className="grid cursor-pointer grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3"
        >
          <Checkbox defaultChecked={index === 0} />
          <span className="text-body-sm">{item}</span>
          <span className="text-caption text-text-secondary tabular-nums">
            12.50 กก.
          </span>
        </label>
      ))}
    </div>
  ),
};

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SegmentedChoice } from "./SegmentedChoice";

const meta = {
  title: "Molecules/SegmentedChoice",
  component: SegmentedChoice,
  args: {
    label: "ประเภทการซื้อ",
    value: "material",
    onChange: () => {},
    options: [
      { value: "material", label: "วัสดุบรรจุภัณฑ์" },
      { value: "other", label: "ซื้ออื่น ๆ (น้ำพริก, น้ำดอง ฯลฯ)" },
    ],
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <SegmentedChoice {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof SegmentedChoice>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The first choice picked — how "+ ซื้อเข้าคลัง" opens. */
export const FirstPicked: Story = {};

/** The second choice picked. */
export const SecondPicked: Story = { args: { value: "other" } };

/** A narrow column wraps the choices instead of overflowing. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-60">
        <Story />
      </div>
    ),
  ],
};

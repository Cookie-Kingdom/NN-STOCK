import { useState, type ComponentProps } from "react";
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
  // The key remounts it when the `value` control changes.
  render: (args) => <Stateful key={args.value} {...args} />,
} satisfies Meta<typeof SegmentedChoice>;

function Stateful(args: ComponentProps<typeof SegmentedChoice>) {
  const [value, setValue] = useState(args.value);
  return <SegmentedChoice {...args} value={value} onChange={setValue} />;
}

export default meta;

/** Pick the state in Controls:
 *  - `value` material: the first choice picked — how "+ ซื้อเข้าคลัง" opens
 *  - `value` other: the second choice picked
 *  - `narrow`: a narrow column wraps the choices instead of overflowing */
export const Default: StoryObj<
  ComponentProps<typeof SegmentedChoice> & { narrow: boolean }
> = {
  decorators: [
    (Story, { args }) => (
      <div className={args.narrow ? "max-w-60" : undefined}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    value: { control: "inline-radio", options: ["material", "other"] },
    narrow: { control: "boolean" },
  },
  args: { narrow: false },
};

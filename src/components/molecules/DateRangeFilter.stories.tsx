import { useState } from "react";
import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { pick } from "../../../.storybook/pick";
import { DateRangeFilter } from "./DateRangeFilter";
import { FilterBar } from "./FilterBar";

const meta = {
  title: "Molecules/DateRangeFilter",
  component: DateRangeFilter,
  args: {
    from: "2026-09-01",
    to: "2026-09-15",
    onFromChange: fn(),
    onToChange: fn(),
  },
  // It renders a fragment, so it always sits inside a FilterBar.
  decorators: [
    (Story) => (
      <FilterBar>
        <Story />
      </FilterBar>
    ),
  ],
} satisfies Meta<typeof DateRangeFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

type Range = { from: string; to: string };
const range = pick<Range>("ช่วงวันที่", {
  ถูกต้อง: { from: "2026-09-01", to: "2026-09-15" },
  เริ่มหลังสิ้นสุด: { from: "2026-09-20", to: "2026-09-05" },
});

/** Pick the state in Controls:
 *  - ช่วงวันที่ ถูกต้อง: each field bounds the other through `min` / `max`
 *  - ช่วงวันที่ เริ่มหลังสิ้นสุด: the fragment adds a full-width `role="alert"` line
 *  - `fromLabel` / `toLabel`: both are overridable when the range means something
 *    more specific (e.g. "วันผลิตตั้งแต่" / "ถึงวันผลิต") */
export const Default: StoryObj<
  ComponentProps<typeof DateRangeFilter> & { range: Range }
> = {
  argTypes: {
    range: range.argType,
    fromLabel: { control: "text" },
    toLabel: { control: "text" },
  },
  args: { range: range.initial },
  render: ({ range, ...args }) => <DateRangeFilter {...args} {...range} />,
};

function LotDateRange() {
  const [from, setFrom] = useState("2026-09-01");
  const [to, setTo] = useState("2026-09-15");
  return (
    <DateRangeFilter
      from={from}
      to={to}
      onFromChange={setFrom}
      onToChange={setTo}
    />
  );
}

/** Wired up: picking a start date caps how far back the end date can go. */
export const Interactive: Story = { render: () => <LotDateRange /> };

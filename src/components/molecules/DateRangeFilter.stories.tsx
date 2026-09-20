import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
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

/** A valid range: each field bounds the other through `min` / `max`. */
export const Default: Story = {};

/** Start after end — the fragment adds a full-width `role="alert"` line. */
export const InvalidRange: Story = {
  args: { from: "2026-09-20", to: "2026-09-05" },
};

/** Both labels are overridable when the range means something more specific. */
export const CustomLabels: Story = {
  args: { fromLabel: "วันผลิตตั้งแต่", toLabel: "ถึงวันผลิต" },
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

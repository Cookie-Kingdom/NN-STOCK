import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { day } from "../../../.storybook/fixtures";
import { today } from "@/lib/format";
import { FilterBar } from "./FilterBar";
import { WorkingDateField } from "./WorkingDateField";

const meta = {
  title: "Molecules/WorkingDateField",
  component: WorkingDateField,
  args: { date: today(), onDate: fn() },
} satisfies Meta<typeof WorkingDateField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The picker only moves when the workspace date does, so every story owns the date. */
function Picker({
  initial,
  variant,
  minDate,
}: {
  initial: string;
  variant?: "form" | "filter";
  minDate?: string;
}) {
  const [date, setDate] = useState(initial);
  return (
    <WorkingDateField
      date={date}
      onDate={setDate}
      variant={variant}
      minDate={minDate}
    />
  );
}

/** Full-size field, as every lot form shows it. Today's date, so no badge. */
export const Form: Story = { render: () => <Picker initial={today()} /> };

/** The compact `filter` input, sized for a filter bar next to the other filters. */
export const Filter: Story = {
  render: () => (
    <FilterBar>
      <Picker initial={today()} variant="filter" />
    </FilterBar>
  ),
};

/** A date before today: the "บันทึกย้อนหลัง" badge warns that this is a back-dated entry. */
export const BackDated: Story = { render: () => <Picker initial={day} /> };

/** The same warning in the filter variant — the badge wraps above the input. */
export const BackDatedFilter: Story = {
  render: () => (
    <FilterBar>
      <Picker initial={day} variant="filter" />
    </FilterBar>
  ),
};

/** min/max only limit the picker; a typed date outside the range lands here and
 * gets the `role="alert"` message, the same one `mutate` would refuse on. */
export const OutOfRange: Story = {
  render: () => <Picker initial="2020-01-01" minDate={day} />,
};

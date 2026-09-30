import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { BranchSelectFilter } from "./BranchSelectFilter";
import { DateRangeFilter } from "./DateRangeFilter";
import { FilterBar } from "./FilterBar";
import { TableFilter } from "./TableFilter";

const meta = {
  title: "Molecules/FilterBar",
  component: FilterBar,
} satisfies Meta<typeof FilterBar>;

export default meta;
function Filters() {
  const [branch, setBranch] = useState("ทั้งหมด");
  const [from, setFrom] = useState("2026-09-01");
  const [to, setTo] = useState("2026-09-15");
  return (
    <FilterBar>
      <BranchSelectFilter
        value={branch}
        onChange={setBranch}
        branches={["ศาลาแดง", "มีนบุรี"]}
      />
      <DateRangeFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
      />
      <TableFilter label="ค้นหา">
        <Input variant="filter" placeholder="เลขล็อต / PO" />
      </TableFilter>
      <Button variant="secondary" size="sm">
        ล้างตัวกรอง
      </Button>
    </FilterBar>
  );
}

/** Filters sit level on their bottom edge and wrap onto a second line when the row
 *  runs out of room. Drag `width` in Controls to see the wrap. */
export const Default: StoryObj<{ width: number }> = {
  argTypes: {
    width: { control: { type: "range", min: 280, max: 1200, step: 20 } },
  },
  args: { width: 1200 },
  render: ({ width }) => (
    <div style={{ maxWidth: width }}>
      <Filters />
    </div>
  ),
};

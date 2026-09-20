import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { BranchSelectFilter } from "./BranchSelectFilter";
import { FilterBar } from "./FilterBar";

const meta = {
  title: "Molecules/BranchSelectFilter",
  component: BranchSelectFilter,
  args: {
    value: "ทั้งหมด",
    onChange: fn(),
    branches: ["ศาลาแดง", "มีนบุรี"],
  },
} satisfies Meta<typeof BranchSelectFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing picked yet: the leading "ทั้งหมด" option is selected. */
export const AllBranches: Story = {};

/** A branch is picked, so the table below it shows only that branch's lots. */
export const OneBranch: Story = { args: { value: "มีนบุรี" } };

/** Both labels are overridable — the owner's PO list asks for a destination. */
export const CustomLabels: Story = {
  args: {
    label: "สาขาปลายทาง",
    allLabel: "ทุกสาขา",
    value: "ศาลาแดง",
  },
};

function BranchPicker() {
  const [branch, setBranch] = useState("ทั้งหมด");
  return (
    <div className="grid gap-3">
      <FilterBar>
        <BranchSelectFilter
          value={branch}
          onChange={setBranch}
          branches={["ศาลาแดง", "มีนบุรี"]}
        />
      </FilterBar>
      <p className="text-body-sm text-text-secondary">
        กำลังแสดงล็อตของ: {branch}
      </p>
    </div>
  );
}

/** Wired up inside a FilterBar, the way every workspace table uses it. */
export const Interactive: Story = { render: () => <BranchPicker /> };

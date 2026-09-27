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

/** Pick the state in Controls:
 *  - `value` "ทั้งหมด": nothing picked yet, the leading all option is selected
 *  - `value` a branch: the table below it shows only that branch's lots
 *  - `label` / `allLabel`: both are overridable — the owner's PO list asks for a
 *    destination ("สาขาปลายทาง" / "ทุกสาขา") */
export const Default: Story = {
  argTypes: {
    value: {
      control: "inline-radio",
      options: ["ทั้งหมด", "ศาลาแดง", "มีนบุรี"],
    },
    label: { control: "text" },
    allLabel: { control: "text" },
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

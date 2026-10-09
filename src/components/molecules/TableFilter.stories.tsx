import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { pick } from "../../../.storybook/pick";
import { DatePicker } from "@/components/atoms/DatePicker";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { TableFilter } from "./TableFilter";

const meta = {
  title: "Molecules/TableFilter",
  component: TableFilter,
  args: {
    label: "สาขา",
    children: (
      <Select
        variant="filter"
        value="ศาลาแดง"
        onChange={() => {}}
        options={[
          { value: "ทั้งหมด" },
          { value: "ศาลาแดง" },
          { value: "มีนบุรี" },
        ]}
      />
    ),
  },
} satisfies Meta<typeof TableFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

type Props = ComponentProps<typeof TableFilter>;

const state = pick<Partial<Props>>("ตัวกรอง", {
  เลือกสาขา: {},
  ค้นหา: {
    label: "ค้นหา",
    children: <Input variant="filter" placeholder="เลขล็อต / PO" />,
  },
  วันที่: {
    label: "วันที่ผลิต",
    children: (
      <DatePicker variant="filter" value="2026-09-15" onChange={() => {}} />
    ),
  },
});

/** Pick the filter in Controls:
 *  - เลือกสาขา: a `Select` with `variant="filter"` — the most common filter in the app
 *  - ค้นหา: free-text search over lot and PO numbers
 *  - วันที่: a single date, for tables that filter on one day instead of a range */
export const Default: StoryObj<Props & { state: Partial<Props> }> = {
  argTypes: { state: state.argType },
  args: { state: state.initial },
  render: ({ state, ...args }) => <TableFilter {...args} {...state} />,
};

/** Several of them wrap in a row above the table. */
export const InRow: Story = {
  render: () => (
    <div className="flex flex-wrap items-end gap-3">
      <TableFilter label="สาขา">
        <Select
          variant="filter"
          value="ทั้งหมด"
          onChange={() => {}}
          options={[
            { value: "ทั้งหมด" },
            { value: "ศาลาแดง" },
            { value: "มีนบุรี" },
          ]}
        />
      </TableFilter>
      <TableFilter label="สถานะล็อต">
        <Select
          variant="filter"
          value="ทั้งหมด"
          onChange={() => {}}
          options={[
            { value: "ทั้งหมด" },
            { value: "รอรับเข้า" },
            { value: "กำลังรมควัน" },
            { value: "ปิดล็อตแล้ว" },
          ]}
        />
      </TableFilter>
      <TableFilter label="ค้นหา">
        <Input variant="filter" placeholder="เลขล็อต / PO" />
      </TableFilter>
    </div>
  ),
};

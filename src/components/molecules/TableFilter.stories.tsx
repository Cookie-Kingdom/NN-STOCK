import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { FilterBar } from "./FilterBar";
import { TableFilter } from "./TableFilter";

const meta = {
  title: "Molecules/TableFilter",
  component: TableFilter,
  args: {
    label: "สาขา",
    children: (
      <Select variant="filter" defaultValue="ศาลาแดง">
        <option>ทั้งหมด</option>
        <option>ศาลาแดง</option>
        <option>มีนบุรี</option>
      </Select>
    ),
  },
} satisfies Meta<typeof TableFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A `Select` with `variant="filter"` — the most common filter in the app. */
export const WithSelect: Story = {};

/** Free-text search over lot and PO numbers. */
export const WithInput: Story = {
  args: {
    label: "ค้นหา",
    children: <Input variant="filter" placeholder="เลขล็อต / PO" />,
  },
};

/** A single date, for tables that filter on one day instead of a range. */
export const WithDate: Story = {
  args: {
    label: "วันที่ผลิต",
    children: <Input variant="filter" type="date" defaultValue="2026-09-15" />,
  },
};

/** Several of them wrap in a FilterBar above the table. */
export const InFilterBar: Story = {
  render: () => (
    <FilterBar>
      <TableFilter label="สาขา">
        <Select variant="filter">
          <option>ทั้งหมด</option>
          <option>ศาลาแดง</option>
          <option>มีนบุรี</option>
        </Select>
      </TableFilter>
      <TableFilter label="สถานะล็อต">
        <Select variant="filter">
          <option>ทั้งหมด</option>
          <option>รอรับเข้า</option>
          <option>กำลังรมควัน</option>
          <option>ปิดล็อตแล้ว</option>
        </Select>
      </TableFilter>
      <TableFilter label="ค้นหา">
        <Input variant="filter" placeholder="เลขล็อต / PO" />
      </TableFilter>
    </FilterBar>
  ),
};

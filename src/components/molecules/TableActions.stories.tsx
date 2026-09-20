import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/atoms/Button";
import { Select } from "@/components/atoms/Select";
import { Muted } from "@/components/atoms/Text";
import { TableActions } from "./TableActions";
import { TableFilter } from "./TableFilter";

const meta = {
  title: "Molecules/TableActions",
  component: TableActions,
  args: {
    children: (
      <>
        <Muted as="span" className="text-caption">
          กด ดู เพื่อเปิดเส้นทางเอกสาร
        </Muted>
        <TableFilter label="เรียงตาม">
          <Select variant="filter" defaultValue="date-desc">
            <option value="date-desc">วันที่ออก PO (ล่าสุดก่อน)</option>
            <option value="po">เลข PO</option>
            <option value="lot">Lot</option>
          </Select>
        </TableFilter>
      </>
    ),
  },
} satisfies Meta<typeof TableActions>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The `actions` slot of a table: a note on the left, the sort control on the right. */
export const Default: Story = {};

/** Below `md` the two ends are pushed apart instead of stacking to the left. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-80">
        <Story />
      </div>
    ),
  ],
};

/** A button works in the slot just as well as a filter. */
export const WithButton: Story = {
  args: {
    children: (
      <>
        <Button variant="table">พิมพ์ทะเบียน</Button>
        <TableFilter label="เรียงตาม">
          <Select variant="filter" defaultValue="lot">
            <option value="lot">Lot</option>
            <option value="po">เลข PO</option>
          </Select>
        </TableFilter>
      </>
    ),
  },
};

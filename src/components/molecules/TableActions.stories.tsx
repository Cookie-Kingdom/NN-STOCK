import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { pick } from "../../../.storybook/pick";
import { Button } from "@/components/atoms/Button";
import { Select } from "@/components/atoms/Select";
import { Muted } from "@/components/atoms/Text";
import { TableActions } from "./TableActions";
import { TableFilter } from "./TableFilter";

const content = pick("children", {
  ข้อความและการเรียง: (
    <>
      <Muted as="span" className="text-caption">
        กดที่แถวเพื่อเปิดเส้นทางเอกสาร
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
  ปุ่มและการเรียง: (
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
});

const meta = {
  title: "Molecules/TableActions",
  component: TableActions,
  args: { children: content.initial },
  argTypes: { children: content.argType },
} satisfies Meta<typeof TableActions>;

export default meta;

/** The `actions` slot of a table. Pick in Controls:
 *  - children ข้อความและการเรียง: a note on the left, the sort control on the right
 *  - children ปุ่มและการเรียง: a button works in the slot just as well as a filter
 *  - `narrow`: below `md` the two ends are pushed apart instead of stacking to the
 *    left */
export const Default: StoryObj<
  ComponentProps<typeof TableActions> & { narrow: boolean }
> = {
  decorators: [
    (Story, { args }) => (
      <div className={args.narrow ? "max-w-80" : undefined}>
        <Story />
      </div>
    ),
  ],
  argTypes: { narrow: { control: "boolean" } },
  args: { narrow: false },
};

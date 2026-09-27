import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { pick } from "../../../.storybook/pick";
import { Muted } from "@/components/atoms/Text";
import { PoLotCell } from "./PoLotCell";

const meta = {
  title: "Molecules/PoLotCell",
  component: PoLotCell,
  args: { poId: "PO-2026-0412", lotId: "LOT-0915-01" },
} satisfies Meta<typeof PoLotCell>;

export default meta;
type Story = StoryObj<typeof meta>;

const po = pick("poId", { "PO-2026-0412": "PO-2026-0412", ยังไม่มี: null });

/** PO number in bold with the lot id on the line below. Pick in Controls:
 *  - `sub`: a muted third line — branch, weight or status (e.g. "ศาลาแดง · 24.5 กก.")
 *  - `poId` ยังไม่มี: the lot has not been ordered, so the first line falls back
 *    to "-" */
export const Default: Story = {
  argTypes: {
    poId: po.argType,
    lotId: { control: "text" },
    sub: { control: "text" },
  },
  args: { poId: po.initial, sub: "" },
};

/** How the traceability table stacks them, one cell per row. */
export const InTable: Story = {
  render: () => (
    <table className="text-body-sm">
      <tbody>
        <tr>
          <td className="py-2 pr-8 align-top">
            <PoLotCell
              poId="PO-2026-0412"
              lotId="LOT-0915-01"
              sub="ศาลาแดง · 24.5 กก."
            />
          </td>
          <td className="py-2 align-top">฿7,644</td>
        </tr>
        <tr>
          <td className="py-2 pr-8 align-top">
            <PoLotCell
              poId="PO-2026-0413"
              lotId={<Muted as="span">LOT-0915-02</Muted>}
              sub="มีนบุรี · 18.0 กก."
            />
          </td>
          <td className="py-2 align-top">฿5,616</td>
        </tr>
        <tr>
          <td className="py-2 pr-8 align-top">
            <PoLotCell lotId="LOT-0915-03" sub="ยังไม่ออก PO" />
          </td>
          <td className="py-2 align-top">—</td>
        </tr>
      </tbody>
    </table>
  ),
};

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { day } from "../../../.storybook/fixtures";
import { pick } from "../../../.storybook/pick";
import { today } from "@/lib/format";
import { FilterBar } from "./FilterBar";
import { Notice } from "./Notice";
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
  asField,
}: {
  initial: string;
  variant?: "form" | "filter";
  asField?: boolean;
}) {
  const [date, setDate] = useState(initial);
  return (
    <WorkingDateField
      date={date}
      onDate={setDate}
      variant={variant}
      asField={asField}
    />
  );
}

const date = pick("วันที่", { วันนี้: today(), ย้อนหลัง: day });

/** Pick the state in Controls:
 *  - `variant` form: full-size field, as every lot form shows it
 *  - `variant` filter: the compact input, sized for a filter bar next to the other
 *    filters (shown inside a FilterBar)
 *  - `asField`: gives the wrapper the label typography and width of a FormField and
 *    the gap under it — how every dialog form opens (shown above a Notice)
 *  - วันที่ วันนี้: no badge
 *  - วันที่ ย้อนหลัง: a date before today, the "บันทึกย้อนหลัง" badge warns that this
 *    is a back-dated entry; in the filter variant the badge wraps above the input */
export const Default: Story = {
  argTypes: {
    date: date.argType,
    variant: { control: "inline-radio", options: ["form", "filter"] },
    asField: { control: "boolean" },
  },
  args: { date: date.initial, variant: "form", asField: false },
  render: ({ date, variant, asField }) => {
    const picker = (
      <Picker
        key={`${date}|${variant}`}
        initial={date}
        variant={variant}
        asField={asField}
      />
    );
    if (variant === "filter") return <FilterBar>{picker}</FilterBar>;
    if (asField)
      return (
        <>
          {picker}
          <Notice>ติ๊กวัสดุที่ซื้อ แล้วกรอกจำนวนของรายการนั้น</Notice>
        </>
      );
    return picker;
  },
};

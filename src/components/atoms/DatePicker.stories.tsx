import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FormField } from "@/components/molecules/FormField";
import { DatePicker } from "./DatePicker";
import { Input } from "./Input";
import { Select } from "./Select";
import { TimePicker } from "./TimePicker";

const meta = {
  title: "Atoms/DatePicker",
  component: DatePicker,
  args: {
    value: "2026-10-09",
    onChange: () => {},
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["form", "filter"] },
    value: { control: "text" },
    min: { control: "text" },
    max: { control: "text" },
    clearable: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  // The story holds the day, so picking one shows on the control. Remounted when the
  // Controls panel types another.
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <div className="w-72">
        <DatePicker
          {...args}
          key={args.value}
          value={value}
          min={args.min || undefined}
          max={args.max || undefined}
          onChange={setValue}
        />
      </div>
    );
  },
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick the state in Controls:
 *  - `variant`: form (default) or filter (compact, for a filter bar)
 *  - `min` / `max`: `YYYY-MM-DD`; the days outside them cannot be picked
 *  - `clearable`: 「ล้าง」 in the calendar, which empties the field
 *  - `disabled`: cannot be changed
 *
 *  Click it to open the calendar: a panel under the field from md up, a sheet at the
 *  bottom of the screen below md (narrow the viewport to see it). The month's name opens
 *  the twelve months, and the arrows then step a year. */
export const Default: Story = {
  args: { variant: "form", clearable: false, disabled: false },
};

/** Nothing picked yet: the placeholder, and the calendar opens on today's month. */
export const Empty: Story = {
  args: { value: "" },
};

/** How a note's date is set: no day after today (`max`), as `mutate` refuses a future
 *  date. 「วันนี้」 jumps back to today from any month. */
export const NoFutureDay: Story = {
  args: { value: "2026-10-05", max: "2026-10-09" },
};

/** A date that may stay blank (a PO's Invoice date): 「ล้าง」 empties it. */
export const Clearable: Story = {
  args: { clearable: true },
};

/** In a filter bar: as wide as its text. */
export const Filter: Story = {
  args: { variant: "filter" },
};

export const Disabled: Story = {
  args: { disabled: true },
};

/** One form row with the other controls: the heights and the text baselines match. */
export const BesideOtherControls: Story = {
  parameters: { controls: { disable: true } },
  render: function Render() {
    const [date, setDate] = useState("2026-10-09");
    const [time, setTime] = useState("09:30");
    const [branch, setBranch] = useState("saladaeng");
    return (
      <div className="grid max-w-2xl grid-cols-2 gap-4 max-md:grid-cols-1">
        <FormField label="วันที่">
          <DatePicker value={date} onChange={setDate} title="วันที่" />
        </FormField>
        <FormField label="เวลารับ">
          <TimePicker value={time} onChange={setTime} title="เวลารับ" />
        </FormField>
        <FormField label="สาขา">
          <Select
            value={branch}
            onChange={setBranch}
            options={[
              { value: "saladaeng", label: "ศาลาแดง" },
              { value: "minburi", label: "มีนบุรี" },
            ]}
          />
        </FormField>
        <FormField label="เลขที่ใบเสร็จ">
          <Input defaultValue="RC-2569-0142" />
        </FormField>
      </div>
    );
  },
};

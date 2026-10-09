import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TimePicker } from "./TimePicker";

const meta = {
  title: "Atoms/TimePicker",
  component: TimePicker,
  args: {
    value: "09:30",
    onChange: () => {},
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["form", "filter"] },
    value: { control: "text" },
    minuteStep: { control: "inline-radio", options: [5, 15, 30] },
    clearable: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  // The story holds the time, so picking one shows on the control. Remounted when the
  // Controls panel types another.
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <div className="w-72">
        <TimePicker
          {...args}
          key={args.value}
          value={value}
          onChange={setValue}
        />
      </div>
    );
  },
} satisfies Meta<typeof TimePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick the state in Controls:
 *  - `variant`: form (default) or filter (compact, for a filter bar)
 *  - `minuteStep`: 30 (default: every time the app records lands on a half hour), 15 or 5
 *  - `clearable`: 「ล้าง」 under the lists, which empties the field
 *  - `disabled`: cannot be changed
 *
 *  Click it to open the two lists: a panel under the field from md up, a sheet at the
 *  bottom of the screen below md. An hour stays open for the minute; a minute closes. */
export const Default: Story = {
  args: { variant: "form", minuteStep: 30, clearable: false, disabled: false },
};

/** Nothing picked yet: the placeholder, and the hours open around 09. */
export const Empty: Story = {
  args: { value: "" },
};

/** A time off the half-hour grid that an older entry already holds: 08:57 stays in the
 *  minutes, so reopening its form never silently drops it. */
export const OffTheStep: Story = {
  args: { value: "08:57" },
};

/** A time that may stay blank (when the truck came): 「ล้าง」 empties it. */
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

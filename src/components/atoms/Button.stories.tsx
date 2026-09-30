import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Plus } from "lucide-react";
import { fn } from "storybook/test";
import { pick } from "../../../.storybook/pick";
import { Button, type ButtonProps } from "./Button";
import { Spinner } from "./Spinner";

const icon = pick("icon", { ไม่มี: undefined, Plus: <Plus /> });

/** `busy` is story-only: the app shows a save in flight as Spinner + disabled. */
type Args = ButtonProps & { busy?: boolean };

const meta = {
  title: "Atoms/Button",
  component: Button,
  args: { children: "บันทึก", onClick: fn() },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "primary",
        "secondary",
        "danger",
        "table",
        "table-secondary",
        "text",
        "link",
      ],
    },
    size: {
      control: "select",
      options: [undefined, "md", "sm", "lg", "inline"],
      labels: { undefined: "(auto)" },
    },
    disabled: { control: "boolean" },
    "aria-disabled": { control: "boolean" },
    busy: { control: "boolean" },
    children: { control: "text" },
    icon: icon.argType,
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

/** Pick the state in Controls:
 *  - `variant`: primary, secondary, danger (e.g. "ลบ"), and the table/text/link kinds
 *  - `icon`: Plus in front of the label (e.g. "เพิ่มล็อต")
 *  - `size`: (auto) = md for boxed variants, inline for table/text/link
 *  - `disabled`: greyed out and not clickable
 *  - `aria-disabled`: looks disabled but stays focusable (explains why on click)
 *  - `busy`: save in flight: Spinner as the icon, button disabled */
export const Default: Story = {
  args: {
    variant: "primary",
    size: undefined,
    disabled: false,
    "aria-disabled": false,
    busy: false,
    icon: icon.initial,
  },
  render: ({ busy, ...args }) => (
    <Button
      {...args}
      disabled={busy || args.disabled}
      icon={busy ? <Spinner /> : args.icon}
    />
  ),
};

export const AllVariants: Story = {
  // Every variant is drawn below; the variant control would do nothing here.
  argTypes: {
    variant: { table: { disable: true } },
    size: { table: { disable: true } },
    busy: { table: { disable: true } },
  },
  // busy is unset here (only Default sets it), so the spread passes nothing extra.
  render: (args) => (
    <div className="grid gap-4">
      {(["primary", "secondary", "danger"] as const).map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-3">
          {(["sm", "md", "lg"] as const).map((size) => (
            <Button key={size} {...args} variant={variant} size={size}>
              {variant} {size}
            </Button>
          ))}
          <Button {...args} variant={variant} disabled>
            disabled
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button {...args} variant="table">
          table
        </Button>
        <Button {...args} variant="table-secondary">
          table-secondary
        </Button>
        <Button {...args} variant="text">
          text
        </Button>
        <Button {...args} variant="link">
          link
        </Button>
      </div>
    </div>
  ),
};

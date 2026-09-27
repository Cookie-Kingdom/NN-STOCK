import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Plus } from "lucide-react";
import { fn } from "storybook/test";
import { pick } from "../../../.storybook/pick";
import { Button } from "./Button";

const icon = pick("icon", { ไม่มี: undefined, Plus: <Plus /> });

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
    size: { control: "select", options: ["md", "sm", "lg", "inline"] },
    disabled: { control: "boolean" },
    children: { control: "text" },
    icon: icon.argType,
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick the state in Controls:
 *  - `variant`: primary, secondary, danger (e.g. "ลบ"), and the table/text/link kinds
 *  - `icon`: Plus in front of the label (e.g. "เพิ่มล็อต")
 *  - `disabled`: greyed out and not clickable */
export const Default: Story = {
  args: { variant: "primary", disabled: false, icon: icon.initial },
};

export const AllVariants: Story = {
  // Every variant is drawn below; the variant control would do nothing here.
  argTypes: { variant: { table: { disable: true } } },
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

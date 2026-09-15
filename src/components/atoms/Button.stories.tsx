import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Plus } from "lucide-react";
import { fn } from "storybook/test";
import { Button } from "./Button";

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
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: "primary" } };
export const Secondary: Story = { args: { variant: "secondary" } };
export const Danger: Story = { args: { variant: "danger", children: "ลบ" } };
export const WithIcon: Story = {
  args: { variant: "primary", icon: <Plus />, children: "เพิ่มล็อต" },
};
export const Disabled: Story = { args: { variant: "primary", disabled: true } };

export const AllVariants: Story = {
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

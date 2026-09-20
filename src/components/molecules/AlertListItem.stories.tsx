import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { Button } from "@/components/atoms/Button";
import { AlertListItem } from "./AlertListItem";

// Props are a div/button union, so stories use render instead of typed args.
const meta: Meta = {
  title: "Molecules/AlertListItem",
  component: AlertListItem,
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj;

const title = "ล็อต LOT-0915-01 รอรับเข้าสต๊อกกลาง";
const detail = "Chef House ส่งมอบแล้ว 2 วัน";

export const Card: Story = {
  render: () => (
    <AlertListItem
      title={title}
      detail={detail}
      action={<Button variant="text">ไปที่งาน</Button>}
    />
  ),
};

export const ButtonRow: Story = {
  render: () => (
    <AlertListItem as="button" title={title} detail={detail} onClick={fn()} />
  ),
};

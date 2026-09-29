import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PackageCheck } from "lucide-react";
import { fn } from "storybook/test";
import { Button } from "@/components/atoms/Button";
import { pick } from "../../../.storybook/pick";
import { AlertListItem } from "./AlertListItem";

type Args = {
  as: "div" | "button";
  title: string;
  detail: string;
  icon: ReactNode;
  action: ReactNode;
  onClick: () => void;
};

const icon = pick<ReactNode>("ไอคอน", {
  "ค่าเริ่มต้น (CircleAlert)": undefined,
  กำหนดเอง: <PackageCheck size={15} />,
});

const action = pick<ReactNode>("ปุ่ม action (เฉพาะ div)", {
  มีปุ่ม: <Button variant="text">ไปที่งาน</Button>,
  ไม่มี: undefined,
});

// Props are a div/button union, so the story renders from flat args.
const meta: Meta<Args> = {
  title: "Molecules/AlertListItem",
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    as: { control: "inline-radio", options: ["div", "button"] },
    icon: icon.argType,
    action: action.argType,
  },
  args: {
    as: "div",
    title: "ล็อต LOT-0915-01 รอรับเข้าสต๊อกกลาง",
    detail: "Chef House ส่งมอบแล้ว 2 วัน",
    icon: icon.initial,
    action: action.initial,
    onClick: fn(),
  },
};

export default meta;
type Story = StoryObj<Args>;

/** เลือกใน Controls:
 *  - as: `div` = dashboard alert card (action shown under the detail); `button` =
 *    notification row, whole row clickable with a trailing arrow (action ignored).
 *  - icon: default CircleAlert or a custom icon.
 *  - detail: clear the text to hide the caption line. */
export const AlertItem: Story = {
  render: ({ as, title, detail, icon, action, onClick }) =>
    as === "button" ? (
      <AlertListItem
        as="button"
        title={title}
        detail={detail || undefined}
        icon={icon}
        onClick={onClick}
      />
    ) : (
      <AlertListItem
        title={title}
        detail={detail || undefined}
        icon={icon}
        action={action}
      />
    ),
};

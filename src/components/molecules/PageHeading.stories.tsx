import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PageHeading } from "./PageHeading";

const meta = {
  title: "Molecules/PageHeading",
  component: PageHeading,
  args: {
    overline: "เจ้าของร้าน",
    title: "Overview",
    description: "สรุปของเดือน และสิ่งที่ยังไม่ได้จด",
  },
} satisfies Meta<typeof PageHeading>;

export default meta;
type Story = StoryObj<typeof meta>;

/** `overline` / `title` / `description`: ข้อความหัวแท็บ แก้ได้ใน Controls */
export const Default: Story = {
  argTypes: {
    overline: { control: "text" },
    title: { control: "text" },
    description: { control: "text" },
  },
};

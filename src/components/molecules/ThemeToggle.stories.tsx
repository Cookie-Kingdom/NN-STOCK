import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Press to cycle ระบบ → สว่าง → มืด. The choice is saved in this browser's localStorage
 * and applies the `.dark` class to the whole page, so it overrides the toolbar Theme
 * until the toolbar is switched again.
 */
const meta = {
  title: "Molecules/ThemeToggle",
  component: ThemeToggle,
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

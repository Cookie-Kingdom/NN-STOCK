import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Press to switch สว่าง ↔ มืด (a first visit follows the OS theme). The choice is saved in this browser's localStorage
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

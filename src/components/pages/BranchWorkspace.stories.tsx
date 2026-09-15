import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { demoDb } from "../../../.storybook/fixtures";
import { accountById } from "@/lib/accounts";
import type { Tab } from "@/lib/nav";
import { BranchWorkspace } from "./BranchWorkspace";

// See OwnerWorkspace.stories.tsx for why each story sets the URL segment.
const at = (tab: Tab) => ({ nextjs: { navigation: { segments: [tab] } } });

const meta: Meta = {
  title: "Pages/Branch",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: demoDb },
  render: () => <BranchWorkspace account={accountById("saladaeng")!} />,
};

export default meta;
type Story = StoryObj;

export const Day: Story = { parameters: at("day") };
export const Stock: Story = { parameters: at("stock") };
export const Summary: Story = { parameters: at("branch-summary") };
export const MinburiDay: Story = {
  parameters: at("day"),
  render: () => <BranchWorkspace account={accountById("minburi")!} />,
};

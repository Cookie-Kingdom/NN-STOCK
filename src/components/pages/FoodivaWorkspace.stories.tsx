import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { demoDb, dispatchDb } from "../../../.storybook/fixtures";
import { accountById } from "@/lib/accounts";
import type { Tab } from "@/lib/nav";
import { FoodivaWorkspace } from "./FoodivaWorkspace";

// See OwnerWorkspace.stories.tsx for why each story sets the URL segment.
const at = (tab: Tab) => ({ nextjs: { navigation: { segments: [tab] } } });

const meta: Meta = {
  title: "Pages/Foodiva",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: dispatchDb },
  render: () => <FoodivaWorkspace account={accountById("foodiva")!} />,
};

export default meta;
type Story = StoryObj;

export const WaitingForDispatch: Story = { parameters: at("foodiva") };
export const Completed: Story = {
  parameters: { ...at("foodiva"), db: demoDb },
};
export const History: Story = { parameters: { ...at("history"), db: demoDb } };

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { centralDb, demoDb } from "../../../.storybook/fixtures";
import { accountById } from "@/lib/accounts";
import type { Tab } from "@/lib/nav";
import { OwnerWorkspace } from "./OwnerWorkspace";

// The tab comes from the URL segment (useSelectedLayoutSegment), so each story sets it.
// Sidebar clicks only log router.push in Actions. !autodocs: pages mount modal dialogs.
const at = (tab: Tab) => ({ nextjs: { navigation: { segments: [tab] } } });

const meta: Meta = {
  title: "Pages/Owner",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: demoDb },
  render: () => <OwnerWorkspace account={accountById("owner")!} />,
};

export default meta;
type Story = StoryObj;

export const Dashboard: Story = { parameters: at("owner-dashboard") };
export const PurchaseOrders: Story = { parameters: at("po") };
export const CentralReceive: Story = {
  parameters: { ...at("central-receive"), db: centralDb },
};
export const BranchStatus: Story = { parameters: at("branch-status") };
export const Stock: Story = { parameters: at("stock") };
export const Documents: Story = { parameters: at("documents") };
export const Report: Story = { parameters: at("report") };
export const Config: Story = { parameters: at("config") };
export const History: Story = { parameters: at("history") };

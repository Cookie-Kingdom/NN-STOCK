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

/* One story per entry in `ownerNav`, in sidebar order, so a gap here is a gap the
 * Owner can see. The heading above each block is the sidebar group it belongs to. */

// ภาพรวม
export const Dashboard: Story = { parameters: at("owner-dashboard") };

// จัดซื้อและใบสั่ง
export const PurchaseOrders: Story = { parameters: at("po") };
export const SmokingPurchaseOrders: Story = { parameters: at("smoke-po") };
export const Invoices: Story = { parameters: at("invoices") };

// ขนส่งและรับเข้า
export const TransportManifests: Story = { parameters: at("transport") };
export const CentralReceive: Story = {
  parameters: { ...at("central-receive"), db: centralDb },
};

// สต๊อกและสาขา
export const BranchStatus: Story = { parameters: at("branch-status") };
export const Stock: Story = { parameters: at("stock") };
export const MeatMovementLog: Story = { parameters: at("meat-log") };

// เอกสารและรายงาน
export const Documents: Story = { parameters: at("documents") };
export const Report: Story = { parameters: at("report") };
export const History: Story = { parameters: at("history") };

// ระบบ
export const Config: Story = { parameters: at("config") };

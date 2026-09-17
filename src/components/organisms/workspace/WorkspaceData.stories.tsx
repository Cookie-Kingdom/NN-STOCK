import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { demoDb } from "../../../../.storybook/fixtures";
import { EntryDetails } from "@/components/organisms/shared/EntryDetails";
import { accountById } from "@/lib/accounts";
import { branchNav, chefNav, ownerNav } from "@/lib/nav";
import { AppSidebar } from "./AppSidebar";
import { HistoryPanel } from "./HistoryPanel";

const db = demoDb;

const meta: Meta = {
  title: "Organisms/Workspace Data",
  parameters: { db },
};

export default meta;
type Story = StoryObj;

export const SidebarOwner: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="flex h-160">
      <AppSidebar
        account={accountById("owner")!}
        nav={ownerNav}
        tab="owner-dashboard"
        onTab={fn()}
        badges={{ po: 2, invoices: 1 }}
      />
    </div>
  ),
};

export const SidebarChef: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="flex h-160">
      <AppSidebar
        account={accountById("chef")!}
        nav={chefNav}
        tab="work"
        onTab={fn()}
      />
    </div>
  ),
};

export const SidebarBranch: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="flex h-160">
      <AppSidebar
        account={accountById("saladaeng")!}
        nav={branchNav}
        tab={branchNav[0].items[0].id}
        onTab={fn()}
      />
    </div>
  ),
};

export const HistoryOwner: Story = {
  render: () => (
    <HistoryPanel db={db} role="owner" branch="" onChanged={fn()} />
  ),
};

export const HistoryBranch: Story = {
  render: () => (
    <HistoryPanel db={db} role="branch" branch="ศาลาแดง" onChanged={fn()} />
  ),
};

export const EntryDetail: Story = {
  render: () => (
    <EntryDetails entry={db.entries.at(-1)!} owner onChanged={fn()} />
  ),
};

export const EntryDetailVoided: Story = {
  render: () => (
    <EntryDetails entry={db.entries.at(-1)!} owner voided onChanged={fn()} />
  ),
};

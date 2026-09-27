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
type Story = StoryObj<{
  account: keyof typeof sidebars;
  role: "owner" | "branch";
  voided: boolean;
}>;

/** Each account's menu, open on its first tab; only the Owner has badges. */
const sidebars = {
  owner: {
    nav: ownerNav,
    tab: "owner-dashboard",
    badges: { po: 2, invoices: 1 },
  },
  chef: { nav: chefNav, tab: "work", badges: undefined },
  saladaeng: {
    nav: branchNav,
    tab: branchNav[0].items[0].id,
    badges: undefined,
  },
} as const;

/** Pick บัญชี in Controls: Owner (with PO and invoice badges), Chef House or ศาลาแดง. */
export const Sidebar: Story = {
  parameters: { layout: "fullscreen" },
  argTypes: {
    account: {
      name: "บัญชี",
      options: Object.keys(sidebars),
      control: {
        type: "radio",
        labels: { owner: "Owner", chef: "Chef House", saladaeng: "ศาลาแดง" },
      },
    },
  },
  args: { account: "owner" },
  render: ({ account }) => (
    <div className="flex h-160">
      <AppSidebar
        account={accountById(account)!}
        nav={sidebars[account].nav}
        tab={sidebars[account].tab}
        onTab={fn()}
        badges={sidebars[account].badges}
      />
    </div>
  ),
};

/** Pick ผู้ใช้ in Controls: the Owner's full log, or ศาลาแดง's own entries. */
export const History: Story = {
  argTypes: {
    role: {
      name: "ผู้ใช้",
      options: ["owner", "branch"],
      control: {
        type: "radio",
        labels: { owner: "Owner", branch: "ศาลาแดง" },
      },
    },
  },
  args: { role: "owner" },
  render: ({ role }) => (
    <HistoryPanel
      db={db}
      role={role}
      branch={role === "branch" ? "ศาลาแดง" : ""}
      onChanged={fn()}
    />
  ),
};

/** Toggle ยกเลิกแล้ว in Controls to show the entry as voided. */
export const EntryDetail: Story = {
  argTypes: { voided: { name: "ยกเลิกแล้ว", control: "boolean" } },
  args: { voided: false },
  render: ({ voided }) => (
    <EntryDetails
      entry={db.entries.at(-1)!}
      role="owner"
      voided={voided}
      onChanged={fn()}
    />
  ),
};

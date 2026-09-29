import { useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { accountById, type Account } from "@/lib/accounts";
import {
  branchNav,
  managerNav,
  ownerNav,
  type NavGroup,
  type Tab,
} from "@/lib/nav";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { demoDb } from "../../../.storybook/fixtures";
import { WorkspaceShell, type Notification } from "./WorkspaceShell";

// A template is the page layout with placeholder content; real data lives in Pages/*.
const meta: Meta = {
  title: "Templates/WorkspaceShell",
  parameters: { layout: "fullscreen" },
};

export default meta;
type Page = "short" | "normal" | "long";
type Story = StoryObj<{
  account: "owner" | "manager" | "saladaeng";
  toast: string;
  page: Page;
}>;

/** A page is often one short panel, sometimes far taller than the screen. */
const blocks: Record<Page, number> = { short: 1, normal: 3, long: 12 };

function Placeholder({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
        <div
          key={n}
          className="grid h-40 place-items-center rounded-lg border border-dashed border-border text-caption text-text-secondary"
        >
          เนื้อหาของแท็บ {n}
        </div>
      ))}
    </div>
  );
}

function Shell({
  account,
  nav,
  badges,
  notifications,
  toast: initialToast = "",
  children = <Placeholder />,
}: {
  account: Account;
  nav: NavGroup[];
  badges?: Partial<Record<Tab, number>>;
  notifications?: Notification[];
  toast?: string;
  children?: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>(account.homeTab);
  const [date, setDate] = useState("2026-09-15");
  const [toast, setToast] = useState(initialToast);
  // The shell reads tab, date, toast and loading from the workspace; no dialog is open.
  const ws: Workspace = {
    db: demoDb,
    loaded: true,
    role: account.role,
    branch: account.branch ?? "",
    tab,
    setTab,
    date,
    setDate,
    chosen: "",
    setChosen: () => {},
    modal: null,
    setModal: () => {},
    toast,
    setToast,
    lots: demoDb.lots,
    lot: demoDb.lots[0],
    open: () => {},
    closed: false,
  };
  return (
    <WorkspaceShell
      account={account}
      nav={nav}
      badges={badges}
      notifications={notifications}
      ws={ws}
    >
      {children}
    </WorkspaceShell>
  );
}

const ownerProps = {
  nav: ownerNav,
  badges: { foodiva: 1, "return-shipment": 1, invoices: 2 },
  notifications: [
    {
      title: "ล็อต LOT-0915-01 รอรับเข้าสต๊อกกลาง",
      detail: "Chef House ส่งมอบแล้ว",
      tab: "central-receive",
    },
    {
      title: "PO-0412 รอออกใบแจ้งหนี้",
      detail: "Foodiva",
      tab: "invoices",
    },
  ],
} satisfies Partial<Parameters<typeof Shell>[0]>;

/** Controls:
 *  - บัญชี: Owner (badges and a bell with two lines), Account Manager (no dashboard in
 *    the menu), or ศาลาแดง: branch accounts show their branch in the overline and have
 *    no notification bell.
 *  - ข้อความแจ้ง: type a message to show the toast (e.g. "บันทึกเรียบร้อยแล้ว").
 *  - ความยาวหน้า: สั้น — the sidebar still reaches the bottom of the screen, so its
 *    sign-out block never floats mid-page; ยาว — only the content column scrolls, so
 *    sign-out stays in view under the menu. */
export const Default: Story = {
  argTypes: {
    account: {
      name: "บัญชี",
      options: ["owner", "manager", "saladaeng"],
      control: {
        type: "radio",
        labels: {
          owner: "Owner",
          manager: "Account Manager",
          saladaeng: "ศาลาแดง",
        },
      },
    },
    toast: { name: "ข้อความแจ้ง", control: "text" },
    page: {
      name: "ความยาวหน้า",
      options: ["short", "normal", "long"],
      control: {
        type: "radio",
        labels: { short: "สั้น", normal: "ปกติ", long: "ยาว" },
      },
    },
  },
  args: { account: "owner", toast: "", page: "normal" },
  render: ({ account, toast, page }) => (
    // key: the shell keeps tab and toast in state, so start over when a control changes.
    <Shell
      key={`${account}:${toast}`}
      account={accountById(account)!}
      toast={toast}
      {...(account === "saladaeng"
        ? { nav: branchNav }
        : {
            ...ownerProps,
            nav: account === "manager" ? managerNav : ownerNav,
          })}
    >
      <Placeholder count={blocks[page]} />
    </Shell>
  ),
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile1" } },
  render: () => <Shell account={accountById("minburi")!} nav={branchNav} />,
};

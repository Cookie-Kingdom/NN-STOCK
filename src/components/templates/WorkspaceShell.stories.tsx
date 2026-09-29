import { useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { accountById, type Account } from "@/lib/accounts";
import { branchNav, ownerNav, type NavGroup, type Tab } from "@/lib/nav";
import { WorkspaceShell, type Notification } from "./WorkspaceShell";

// A template is the page layout with placeholder content; real data lives in Pages/*.
const meta: Meta = {
  title: "Templates/WorkspaceShell",
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<{ account: "owner" | "saladaeng"; toast: string }>;

function Placeholder() {
  return (
    <div className="grid gap-4">
      {[1, 2, 3].map((n) => (
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
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(initialToast);
  return (
    <WorkspaceShell
      account={account}
      nav={nav}
      tab={tab}
      onTab={setTab}
      date={date}
      onDate={setDate}
      badges={badges}
      notifications={notifications}
      showNotifications={open}
      onToggleNotifications={() => setOpen((value) => !value)}
      toast={toast}
      onCloseToast={() => setToast("")}
    >
      {children}
    </WorkspaceShell>
  );
}

const ownerProps = {
  nav: ownerNav,
  badges: { transport: 1, "return-shipment": 1, invoices: 2 },
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
 *  - บัญชี: Owner (badges and a bell with two lines), or ศาลาแดง: branch accounts show
 *    their branch in the overline and have no notification bell.
 *  - ข้อความแจ้ง: type a message to show the toast (e.g. "บันทึกเรียบร้อยแล้ว"). */
export const Owner: Story = {
  argTypes: {
    account: {
      name: "บัญชี",
      options: ["owner", "saladaeng"],
      control: {
        type: "radio",
        labels: { owner: "Owner", saladaeng: "ศาลาแดง" },
      },
    },
    toast: { name: "ข้อความแจ้ง", control: "text" },
  },
  args: { account: "owner", toast: "" },
  render: ({ account, toast }) => (
    // key: the shell keeps tab and toast in state, so start over when a control changes.
    <Shell
      key={`${account}:${toast}`}
      account={accountById(account)!}
      toast={toast}
      {...(account === "owner" ? ownerProps : { nav: branchNav })}
    />
  ),
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile1" } },
  render: () => <Shell account={accountById("minburi")!} nav={branchNav} />,
};

/** A page far taller than the screen: only the content column scrolls, so the
 *  owner's sign-out stays in view under the menu without scrolling to the end. */
export const OwnerLongPage: Story = {
  render: () => (
    <Shell account={accountById("owner")!} nav={ownerNav}>
      <div className="grid gap-4">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="grid h-40 place-items-center rounded-lg border border-dashed border-border text-caption text-text-secondary"
          >
            เนื้อหาของแท็บ {i + 1}
          </div>
        ))}
      </div>
    </Shell>
  ),
};

/** A page is often one short panel. The sidebar still has to reach the
 *  bottom of the screen, or its sign-out block floats in the middle of the page. */
export const ShortPage: Story = {
  render: () => (
    <Shell account={accountById("minburi")!} nav={branchNav}>
      <div className="grid h-40 place-items-center rounded-lg border border-dashed border-border text-caption text-text-secondary">
        ไม่มีล็อตรอรับวันนี้
      </div>
    </Shell>
  ),
};

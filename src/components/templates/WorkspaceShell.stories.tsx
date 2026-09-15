import { useState } from "react";
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
type Story = StoryObj;

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
}: {
  account: Account;
  nav: NavGroup[];
  badges?: Partial<Record<Tab, number>>;
  notifications?: Notification[];
  toast?: string;
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
      <Placeholder />
    </WorkspaceShell>
  );
}

export const Owner: Story = {
  render: () => (
    <Shell
      account={accountById("owner")!}
      nav={ownerNav}
      badges={{ transport: 1, invoices: 2 }}
      notifications={[
        {
          title: "ล็อต LOT-0915-01 รอรับเข้าสต๊อกกลาง",
          detail: "Chef_house ส่งมอบแล้ว",
          tab: "central-receive",
        },
        {
          title: "PO-0412 รอออกใบแจ้งหนี้",
          detail: "Foodiva",
          tab: "invoices",
        },
      ]}
    />
  ),
};

/** Branch accounts show their branch in the overline and have no notification bell. */
export const Branch: Story = {
  render: () => <Shell account={accountById("saladaeng")!} nav={branchNav} />,
};

export const WithToast: Story = {
  render: () => (
    <Shell
      account={accountById("owner")!}
      nav={ownerNav}
      toast="บันทึกเรียบร้อยแล้ว"
    />
  ),
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile1" } },
  render: () => <Shell account={accountById("minburi")!} nav={branchNav} />,
};

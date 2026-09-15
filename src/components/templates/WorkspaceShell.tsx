"use client";

import type { ReactNode } from "react";
import { AppHeader } from "@/components/organisms/workspace/AppHeader";
import { AppSidebar } from "@/components/organisms/workspace/AppSidebar";
import {
  NotificationPopover,
  type Notification,
} from "@/components/organisms/workspace/NotificationPopover";
import { PageHeading } from "@/components/organisms/workspace/PageHeading";
import {
  DatabaseErrorToast,
  Toast,
} from "@/components/organisms/workspace/Toast";
import type { Account } from "@/lib/accounts";
import { navLabel, type NavGroup, type Tab } from "@/lib/nav";

export type { Notification };

type Props = {
  account: Account;
  nav: NavGroup[];
  tab: Tab;
  onTab: (tab: Tab) => void;
  date: string;
  onDate: (date: string) => void;
  /** Per-tab counters rendered as a red pill in the sidebar. */
  badges?: Partial<Record<Tab, number>>;
  notifications?: Notification[];
  showNotifications?: boolean;
  onToggleNotifications?: () => void;
  toast: string;
  onCloseToast: () => void;
  children: ReactNode;
};

export function WorkspaceShell({
  account,
  nav,
  tab,
  onTab,
  date,
  onDate,
  badges,
  notifications,
  showNotifications = false,
  onToggleNotifications,
  toast,
  onCloseToast,
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-bg text-body text-text-primary">
      <AppHeader
        actions={
          notifications && (
            <NotificationPopover
              notifications={notifications}
              open={showNotifications}
              onToggle={onToggleNotifications}
              onSelect={onTab}
            />
          )
        }
      />
      <div className="grid grid-cols-[218px_minmax(0,1fr)] max-[1100px]:grid-cols-[205px_minmax(0,1fr)] max-md:block">
        <AppSidebar
          account={account}
          nav={nav}
          tab={tab}
          onTab={onTab}
          badges={badges}
        />
        <main className="mx-auto w-full max-w-375 px-9 py-7.5 max-[1100px]:p-6 max-md:px-4 max-md:py-5 min-[1600px]:px-12.5 min-[1600px]:py-10.5">
          <PageHeading
            overline={`${account.name}${account.branch ? ` · ${account.branch}` : ""}`}
            title={navLabel(nav, tab)}
            description={account.summary}
            date={date}
            onDate={onDate}
          />
          <Toast message={toast} onClose={onCloseToast} />
          <DatabaseErrorToast />
          {/* Views are conditionally rendered per tab, so remounting on tab change loses no state. */}
          <div key={tab} className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

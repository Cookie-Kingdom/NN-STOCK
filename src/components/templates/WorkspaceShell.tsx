"use client";

import type { ReactNode } from "react";
import { LoadingPanel } from "@/components/molecules/LoadingState";
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
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { WorkspaceModals } from "@/components/organisms/workspace/WorkspaceModals";
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
  /** Server payload still loading: the views would show seed data, so show its shape instead. */
  loading?: boolean;
  /**
   * The workspace the page runs on. Only the dialog layer needs it — every other prop is
   * passed apart so a story can drive the shell without a database. Leave it out and the
   * page keeps no dialogs.
   */
  ws?: Workspace;
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
  loading = false,
  ws,
  children,
}: Props) {
  return (
    /* From md up the shell is exactly one screen tall and only the content column
     * scrolls, so the sidebar (menu + sign-out) is sized by the screen, not by the
     * page: sign-out stays in view on a long page without scrolling to its end.
     * Below md the menu is a bar above the page and the window scrolls as before. */
    <div className="flex min-h-screen flex-col bg-bg text-body text-text-primary md:h-dvh">
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
      <div className="grid flex-1 grid-cols-[218px_minmax(0,1fr)] max-[1100px]:grid-cols-[205px_minmax(0,1fr)] max-md:block md:min-h-0 md:grid-rows-[minmax(0,1fr)]">
        <AppSidebar
          account={account}
          nav={nav}
          tab={tab}
          onTab={onTab}
          badges={badges}
        />
        {/* The scroller spans the whole column so its scrollbar sits at the screen's
            right edge, not beside the centred, max-width <main>. */}
        <div className="md:overflow-y-auto">
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
            {loading ? (
              <LoadingPanel />
            ) : (
              <div key={tab} className="animate-fade-in">
                {children}
              </div>
            )}
          </main>
        </div>
      </div>
      {/* Last, not inside <main>: a showModal() dialog renders in the top layer, so it is
       * placed here only to keep the layout's own markup above it. */}
      {ws && <WorkspaceModals ws={ws} />}
    </div>
  );
}

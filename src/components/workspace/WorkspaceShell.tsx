"use client";

import { useRouter } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { ArrowRight, Beef, Bell, CircleAlert, Download, LogOut, X } from "lucide-react";
import type { Account } from "@/lib/accounts";
import { today } from "@/lib/format";
import { navLabel, type NavGroup, type Tab } from "@/lib/nav";
import { signOut } from "@/lib/session";

export type Notification = { title: string; detail: string; tab: Tab };

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
  headerActions?: ReactNode;
  onExport: () => void;
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
  badges = {},
  notifications,
  showNotifications = false,
  onToggleNotifications,
  headerActions,
  onExport,
  toast,
  onCloseToast,
  children,
}: Props) {
  const router = useRouter();
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <span className="brand-icon">
            <Beef size={24} />
          </span>
          <div>
            <strong>
              NerdNuea <span className="muted">Stock</span>
            </strong>
            <small>ระบบสต๊อกและต้นทุนเนื้อรมควัน</small>
          </div>
        </div>
        <div className="header-actions">
          {notifications && (
            <div className="notification-shell">
              <button
                type="button"
                className="bell-button"
                aria-label={`การแจ้งเตือน ${notifications.length} รายการ`}
                aria-expanded={showNotifications}
                onClick={onToggleNotifications}
              >
                <Bell size={19} />
                {notifications.length > 0 && (
                  <span className="notification-count">{notifications.length}</span>
                )}
              </button>
              {showNotifications && (
                <section className="notification-popover" aria-label="รายการที่ต้องทำต่อ">
                  <div className="notification-heading">
                    <div>
                      <strong>การแจ้งเตือน</strong>
                      <span>
                        {notifications.length
                          ? `ต้องทำต่อ ${notifications.length} รายการ`
                          : "ไม่มีงานค้าง"}
                      </span>
                    </div>
                    <button type="button" className="text-button" onClick={onToggleNotifications}>
                      ปิด
                    </button>
                  </div>
                  {notifications.length ? (
                    <div className="notification-list">
                      {notifications.map((notification) => (
                        <button
                          type="button"
                          className="notification-item"
                          key={`${notification.tab}-${notification.title}`}
                          onClick={() => {
                            onTab(notification.tab);
                            onToggleNotifications?.();
                          }}
                        >
                          <span className="notification-dot">
                            <CircleAlert size={15} />
                          </span>
                          <span>
                            <strong>{notification.title}</strong>
                            <small>{notification.detail}</small>
                          </span>
                          <ArrowRight size={16} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="notification-empty">ยังไม่มีงานที่ต้องทำต่อ</p>
                  )}
                </section>
              )}
            </div>
          )}
          <button className="secondary" onClick={onExport}>
            <Download size={16} /> ส่งออก
          </button>
          {headerActions}
        </div>
      </header>
      <div className="app-layout">
        <aside className="app-sidebar">
          <nav>
            {nav.map((group, index) => (
              <Fragment key={group.label ?? index}>
                {group.label && <span className="nav-group-label">{group.label}</span>}
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    className={tab === item.id ? "selected" : ""}
                    onClick={() => onTab(item.id)}
                  >
                    <item.icon size={18} />
                    {item.label}
                    {!!badges[item.id] && <span className="menu-alert">{badges[item.id]}</span>}
                  </button>
                ))}
              </Fragment>
            ))}
          </nav>
          <div className="sidebar-account">
            <span className="sidebar-account-avatar">
              <account.icon size={18} />
            </span>
            <span className="sidebar-account-name">
              <strong>{account.name}</strong>
              <small>{account.title}</small>
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label="ออกจากระบบ"
              title="ออกจากระบบ"
              onClick={() => {
                signOut();
                router.replace("/");
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </aside>
        <main className="app-main">
          <div className="page-heading">
            <div>
              <span className="overline">
                {account.name}
                {account.branch ? ` · ${account.branch}` : ""}
              </span>
              <h1>{navLabel(nav, tab)}</h1>
              <p className="muted">{account.summary}</p>
            </div>
            <label className="date-select">
              วันที่ทำรายการ
              <input
                aria-label="วันที่ทำรายการ"
                type="date"
                value={date}
                onChange={(e) => onDate(e.target.value)}
              />
              <button className="text-button" onClick={() => onDate(today())}>
                ใช้วันนี้
              </button>
            </label>
          </div>
          {toast && (
            <div role="status" className="notice success">
              {toast}
              <button aria-label="ปิดข้อความ" onClick={onCloseToast}>
                <X size={16} />
              </button>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

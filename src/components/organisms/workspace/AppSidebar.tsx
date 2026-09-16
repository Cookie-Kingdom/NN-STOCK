"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect } from "react";
import { LogOut } from "lucide-react";
import { CountPill } from "@/components/atoms/CountPill";
import { IconButton } from "@/components/atoms/IconButton";
import type { Account } from "@/lib/accounts";
import type { NavGroup, Tab } from "@/lib/nav";
import { signOut } from "@/lib/session";
import { cn } from "@/lib/utils";

/** Grouped tab navigation plus the signed-in account and sign-out. */
export function AppSidebar({
  account,
  nav,
  tab,
  onTab,
  badges = {},
}: {
  account: Account;
  nav: NavGroup[];
  tab: Tab;
  onTab: (tab: Tab) => void;
  /** Per-tab counters rendered as a red pill. */
  badges?: Partial<Record<Tab, number>>;
}) {
  const router = useRouter();
  /* Tabs are buttons, not <Link>s, so nothing prefetches them on its own. Every
   * tab route is a static page that renders nothing, so warming all of them up
   * front is cheap and keeps the URL from lagging behind the clicked tab. */
  useEffect(() => {
    for (const group of nav)
      for (const item of group.items)
        router.prefetch(`${account.path}/${item.id}`);
  }, [nav, account.path, router]);

  return (
    <aside className="flex flex-col border-r border-border bg-surface px-4.5 py-5.5 max-md:block max-md:border-r-0 max-md:border-b max-md:px-4 max-md:py-3">
      <nav className="grid content-start gap-1 max-md:flex max-md:flex-wrap max-md:gap-1.5">
        {nav.map((group, index) => (
          <Fragment key={group.label ?? index}>
            {group.label && (
              <span className="mt-4 mb-1 block px-3 text-caption font-bold tracking-[0.08em] text-text-muted uppercase first:mt-0 max-md:mx-0 max-md:mt-2.5 max-md:mb-0 max-md:basis-full max-md:px-0.5 max-md:first:mt-0">
                {group.label}
              </span>
            )}
            {group.items.map((item) => {
              const selected = tab === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md p-3 text-left text-body-sm transition-colors duration-(--motion-fast) ease-(--ease-standard) max-md:gap-1.5 max-md:p-2.5 max-md:text-caption max-md:whitespace-nowrap",
                    selected
                      ? "bg-accent text-accent-fg"
                      : "text-text-secondary hover:bg-bg hover:text-text-primary",
                  )}
                  onClick={() => onTab(item.id)}
                >
                  <item.icon size={18} />
                  {item.label}
                  {!!badges[item.id] && (
                    <CountPill variant="menu">{badges[item.id]}</CountPill>
                  )}
                </button>
              );
            })}
          </Fragment>
        ))}
      </nav>
      <div className="mt-auto flex items-center gap-2.5 border-t border-border px-2.5 pt-3 pb-0.5 max-md:mt-3 max-md:px-0 max-md:pt-2.5 max-md:pb-0">
        <span className="grid size-8.5 flex-none place-items-center rounded-md bg-accent-subtle text-accent">
          <account.icon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block text-body-sm font-semibold [overflow-wrap:anywhere]">
            {account.name}
          </strong>
          <small className="mt-0.5 block text-caption [overflow-wrap:anywhere] text-text-secondary">
            {account.title}
          </small>
        </span>
        <IconButton
          size="sm"
          label="ออกจากระบบ"
          icon={<LogOut size={16} />}
          onClick={async () => {
            await signOut();
            router.replace("/");
          }}
        />
      </div>
    </aside>
  );
}

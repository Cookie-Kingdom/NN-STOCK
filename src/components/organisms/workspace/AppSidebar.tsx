"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogOut } from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import { ThemeToggle } from "@/components/molecules/ThemeToggle";
import { AppBrand } from "@/components/organisms/workspace/AppHeader";
import { NotificationPopover } from "@/components/organisms/workspace/NotificationPopover";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { navFor, pages } from "@/lib/nav";
import { signOut } from "@/lib/session";
import { cn } from "@/lib/utils";

/** The workspace's frame. From md up a 224px column: brand, the account's pages (Daily Log, Lots
 *  and Stock under the "Nerdnuea x LINE MAN" caption, `pages[].group`), then the
 *  bell, the theme switch, the account and sign-out. Below md it is a top bar (brand, bell,
 *  theme, sign-out) and the pages become tabs fixed to the bottom of the screen. */
export function AppSidebar({ ws }: { ws: Workspace }) {
  const { account, tab, setTab } = ws;
  const router = useRouter();
  /* The pages are buttons, not <Link>s, so nothing prefetches them on its own. Every page
   * route is static and renders nothing, so warming all of them up front is cheap and keeps
   * the URL from lagging behind the pressed page. */
  useEffect(() => {
    for (const id of navFor(account)) router.prefetch(`${account.path}/${id}`);
  }, [account, router]);

  return (
    <aside className="sticky top-0 z-10 flex h-dvh flex-col gap-6 border-r border-border bg-surface px-3 py-6 max-md:h-auto max-md:flex-row max-md:items-center max-md:gap-1 max-md:border-r-0 max-md:border-b max-md:px-4 max-md:py-2">
      <div className="px-2 max-md:mr-auto max-md:min-w-0 max-md:px-0">
        <AppBrand
          compact
          caption={
            <small className="block truncate text-caption text-text-secondary md:hidden">
              {account.name}
            </small>
          }
        />
      </div>
      <nav
        aria-label="หน้า"
        className="flex flex-col gap-0.5 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-20 max-md:flex-row max-md:gap-0 max-md:border-t max-md:border-border max-md:bg-surface max-md:pb-[env(safe-area-inset-bottom)]"
      >
        {navFor(account).map((id, i, ids) => {
          const page = pages[id];
          const selected = tab === id;
          /* A section's caption goes above its first page; below md the tabs keep the
           * order but carry no caption. */
          const caption =
            page.group && page.group !== pages[ids[i - 1]]?.group
              ? page.group
              : undefined;
          return [
            caption && (
              <p
                key={`group-${caption}`}
                className={cn(
                  "px-3 pb-1 text-caption font-semibold text-text-secondary max-md:hidden",
                  i > 0 && "pt-3",
                )}
              >
                {caption}
              </p>
            ),
            <button
              type="button"
              key={id}
              aria-current={selected ? "page" : undefined}
              onClick={() => setTab(id)}
              className={cn(
                /* the first page after a section steps away from it */
                !page.group && pages[ids[i - 1]]?.group && "md:mt-3",
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-left text-label -outline-offset-2 transition-colors duration-(--motion-fast) ease-(--ease-standard) max-md:min-h-14 max-md:flex-1 max-md:flex-col max-md:justify-center max-md:gap-0.5 max-md:rounded-none max-md:px-0.5 max-md:text-caption max-md:font-medium",
                selected
                  ? "bg-accent text-accent-fg max-md:bg-transparent max-md:text-accent max-md:shadow-[inset_0_3px_0_var(--color-accent)]"
                  : "text-text-secondary hover:bg-bg hover:text-text-primary",
              )}
            >
              <page.icon size={18} aria-hidden />
              {page.label}
            </button>,
          ];
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-3 max-md:mt-0 max-md:flex-row max-md:items-center max-md:gap-1">
        <div className="flex items-center gap-1 px-1 max-md:px-0">
          <NotificationPopover ws={ws} />
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-2.5 border-t border-border px-1 pt-3 max-md:border-0 max-md:p-0">
          <span className="grid size-8.5 flex-none place-items-center rounded-md bg-accent-subtle text-accent max-md:hidden">
            <account.icon size={18} />
          </span>
          <span className="min-w-0 flex-1 max-md:hidden">
            <strong className="block text-body-sm font-semibold [overflow-wrap:anywhere]">
              {account.name}
            </strong>
            <small className="block text-caption [overflow-wrap:anywhere] text-text-secondary">
              {account.title}
            </small>
          </span>
          <IconButton
            size="sm"
            className="max-md:min-h-11 max-md:min-w-11"
            label="ออกจากระบบ"
            icon={<LogOut size={16} />}
            onClick={async () => {
              await signOut();
              router.replace("/");
            }}
          />
        </div>
      </div>
    </aside>
  );
}

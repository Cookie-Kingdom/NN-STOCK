"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LogOut, Menu, Store } from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import { ThemeToggle } from "@/components/molecules/ThemeToggle";
import { AppBrand } from "@/components/organisms/workspace/AppHeader";
import { NotificationPopover } from "@/components/organisms/workspace/NotificationPopover";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { barFor, navFor, pagePath, pages, type Tab } from "@/lib/nav";
import { signOut } from "@/lib/session";
import { cn } from "@/lib/utils";

/** The account's pages cut into runs: a section's pages together, each page outside one alone. */
function sections(ids: Tab[]) {
  const runs: { group?: string; ids: Tab[] }[] = [];
  for (const id of ids) {
    const group = pages[id].group;
    const last = runs.at(-1);
    if (group && last?.group === group) last.ids.push(id);
    else runs.push({ group, ids: [id] });
  }
  return runs;
}

/** A page's row in the sidebar and in the phone's menu; `tabClass` turns it into a bottom tab
 *  below md. */
const rowClass =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-left text-label -outline-offset-2 transition-colors duration-(--motion-fast) ease-(--ease-standard)";
const tabClass =
  "max-md:min-h-14 max-md:min-w-11 max-md:flex-col max-md:justify-center max-md:gap-0.5 max-md:rounded-none max-md:px-0.5 max-md:text-caption max-md:font-medium";
const idleClass = "text-text-secondary hover:bg-bg hover:text-text-primary";
const openTabClass =
  "max-md:bg-transparent max-md:text-accent max-md:shadow-[inset_0_3px_0_var(--color-accent)]";

/** The workspace's frame. From md up a 256px column: brand, the account's pages (Lots, Inventory,
 *  Daily Log and Finance under the "Nerdnuea x LINE MAN" section, `pages[].group`: a page-sized header that
 *  expands and collapses, its pages indented behind a guide line), then the bell, the theme
 *  switch, the account and sign-out. Below md it is a top bar (brand, bell,
 *  theme, sign-out) and the pages become tabs fixed to the bottom of the screen: all of them
 *  for a branch, four for an account with more than five (`barFor`), beside a fifth button,
 *  "เมนู". That one opens a sheet over the page, above the bar, listing every page the way
 *  the sidebar does: the section's heading as a label, its pages in two columns behind the
 *  guide line. The sheet is a native `popover`, as the bell's panel is: the browser owns
 *  Escape, a tap outside and a second press on "เมนู". */
export function AppSidebar({ ws }: { ws: Workspace }) {
  const { account, tab, setTab } = ws;
  const router = useRouter();
  const [closed, setClosed] = useState<string[]>([]);
  const all = navFor(account);
  const bar = barFor(account);
  const hasMenu = bar.length < all.length;
  const menuId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  /* The pages are buttons, not <Link>s, so nothing prefetches them on its own. Every page
   * route is static and renders nothing, so warming all of them up front is cheap and keeps
   * the URL from lagging behind the pressed page. */
  useEffect(() => {
    for (const id of navFor(account)) router.prefetch(pagePath(account, id));
  }, [account, router]);

  return (
    <aside className="sticky top-0 z-10 flex h-dvh flex-col gap-6 border-r border-border bg-surface px-3 py-6 max-md:h-auto max-md:flex-row max-md:items-center max-md:gap-1 max-md:border-r-0 max-md:border-b max-md:px-4 max-md:py-2 md:overflow-y-auto">
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
        {sections(all).map(({ group, ids: own }, i, runs) => {
          const pageButton = (id: Tab) => {
            const page = pages[id];
            const selected = tab === id;
            return (
              <button
                type="button"
                key={id}
                aria-current={selected ? "page" : undefined}
                onClick={() => setTab(id)}
                className={cn(
                  /* the first page after a section steps away from it */
                  !group && runs[i - 1]?.group && id === own[0] && "md:mt-3",
                  rowClass,
                  tabClass,
                  /* five share the bar by the length of their names, so the longest fits 320px */
                  hasMenu ? "max-md:flex-auto" : "max-md:flex-1",
                  !bar.includes(id) && "max-md:hidden",
                  selected
                    ? cn("bg-accent text-accent-fg", openTabClass)
                    : idleClass,
                )}
              >
                <page.icon size={18} aria-hidden />
                {page.label}
              </button>
            );
          };
          if (!group) return own.map(pageButton);
          const folded = closed.includes(group);
          return [
            <button
              type="button"
              key={`group-${group}`}
              aria-expanded={!folded}
              onClick={() =>
                setClosed((c) =>
                  folded ? c.filter((g) => g !== group) : [...c, group],
                )
              }
              className={cn(
                rowClass,
                "hover:bg-bg hover:text-text-primary max-md:hidden",
                /* a folded section still says it holds the open page */
                folded && own.includes(tab)
                  ? "text-accent"
                  : "text-text-secondary",
                i > 0 && "mt-3",
              )}
            >
              <Store size={18} aria-hidden className="flex-none" />
              <span className="min-w-0 flex-1 whitespace-nowrap">{group}</span>
              <ChevronDown
                size={16}
                aria-hidden
                className={cn(
                  "-ml-1 flex-none transition-transform duration-(--motion-base) ease-(--ease-standard)",
                  folded && "-rotate-90",
                )}
              />
            </button>,
            /* md up the pages fold by easing the grid row between 1fr and 0fr; `invisible`
             * takes them out of the tab order once folded (visibility flips at the end of a
             * fold and at the start of an unfold). The inner one hangs a guide line under the
             * header's icon and indents the pages so their icons sit under the header's label.
             * Below md both wrappers are `contents`, so the pages stay plain bottom tabs. */
            <div
              key={`pages-${group}`}
              className={cn(
                "max-md:contents md:grid md:transition-[grid-template-rows] md:duration-(--motion-base) md:ease-(--ease-standard)",
                folded ? "md:grid-rows-[0fr]" : "md:grid-rows-[1fr]",
              )}
            >
              <div
                className={cn(
                  "max-md:contents md:ml-5.25 md:flex md:min-h-0 md:flex-col md:gap-0.5 md:overflow-hidden md:border-l md:border-border md:pl-2 md:transition-[visibility] md:duration-(--motion-base)",
                  folded && "md:invisible",
                )}
              >
                {own.map(pageButton)}
              </div>
            </div>,
          ];
        })}
        {hasMenu && (
          <button
            type="button"
            ref={menuButton}
            popoverTarget={menuId}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            className={cn(
              rowClass,
              tabClass,
              "max-md:flex-auto md:hidden",
              /* the open page is not in the bar: the bar still says where you are */
              bar.includes(tab) ? idleClass : openTabClass,
            )}
          >
            <Menu size={18} aria-hidden />
            เมนู
          </button>
        )}
      </nav>
      {hasMenu && (
        /* Sits on the bar's top edge (a 56px tab, its border, the home indicator's inset) and
         * dims the page but not the bar. It rises as it fades in and leaves faster, the way
         * the bell's panel does; a phone on its side scrolls the list inside the sheet. */
        <div
          ref={menu}
          id={menuId}
          popover="auto"
          role="dialog"
          aria-label="เมนู"
          onToggle={(event) => {
            const open = event.newState === "open";
            setMenuOpen(open);
            if (open)
              menu.current
                ?.querySelector<HTMLElement>('[aria-current="page"]')
                ?.focus();
            // A browser that does not focus a pressed button has nowhere to return to.
            else if (document.activeElement === document.body)
              menuButton.current?.focus();
          }}
          className="inset-x-0 top-auto bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] m-0 max-h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))] w-auto max-w-none translate-y-2 overflow-y-auto overscroll-contain rounded-t-lg border-t border-border bg-surface p-3 text-text-primary opacity-0 transition-[opacity,translate,display,overlay] transition-discrete duration-(--motion-fast) ease-(--ease-exit) backdrop:bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] backdrop:bg-text-primary/55 open:translate-y-0 open:opacity-100 open:duration-(--motion-base) open:ease-(--ease-enter) open:backdrop:animate-fade-in md:hidden dark:backdrop:bg-black/65 starting:open:translate-y-2 starting:open:opacity-0"
        >
          <div className="flex flex-col gap-0.5">
            {sections(all).map(({ group, ids: own }) => {
              const pageRow = (id: Tab) => {
                const page = pages[id];
                const selected = tab === id;
                return (
                  <button
                    type="button"
                    key={id}
                    aria-current={selected ? "page" : undefined}
                    onClick={() => {
                      setTab(id);
                      menu.current?.hidePopover();
                    }}
                    className={cn(
                      rowClass,
                      "min-w-0",
                      selected ? "bg-accent text-accent-fg" : idleClass,
                    )}
                  >
                    <page.icon size={18} aria-hidden className="flex-none" />
                    <span className="min-w-0 truncate">{page.label}</span>
                  </button>
                );
              };
              if (!group) return own.map(pageRow);
              return (
                <div key={group} role="group" aria-label={group}>
                  <p
                    aria-hidden
                    className="m-0 flex min-h-9 items-center gap-3 px-3 text-label text-text-secondary"
                  >
                    <Store size={18} className="flex-none" />
                    {group}
                  </p>
                  <div className="ml-5.25 grid grid-cols-2 gap-0.5 border-l border-border pl-2">
                    {own.map(pageRow)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
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

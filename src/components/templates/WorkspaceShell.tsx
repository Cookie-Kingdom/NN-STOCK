"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { LoadingPanel } from "@/components/molecules/LoadingState";
import { PageHeading } from "@/components/molecules/PageHeading";
import { DatabaseErrorToast, Toast } from "@/components/molecules/Toast";
import { AppSidebar } from "@/components/organisms/workspace/AppSidebar";
import { Composer } from "@/components/organisms/workspace/Composer";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { descriptionFor, pages } from "@/lib/nav";
import { kindsForPage, titles } from "@/lib/store";

/** The layout of every signed-in page: the sidebar (a top bar and bottom tabs on a phone)
 *  beside one column holding the page's head with a button per note kind of the page, and
 *  the page (`children`). The composer opens as a dialog over it; toasts float at the bottom
 *  of the screen. */
export function WorkspaceShell({
  ws,
  children,
}: {
  ws: Workspace;
  children: ReactNode;
}) {
  const page = pages[ws.tab];
  const kinds = kindsForPage(ws.account, ws.tab);
  return (
    <div className="grid min-h-dvh grid-cols-[256px_minmax(0,1fr)] items-start bg-bg text-body text-text-primary tabular-nums max-md:block">
      <AppSidebar ws={ws} />
      <main className="mx-auto flex w-full min-w-0 flex-col gap-6 px-8 pt-7 pb-16 max-md:gap-4 max-md:px-4 max-md:pt-5 max-md:pb-24">
        <PageHeading
          title={page.label}
          description={descriptionFor(ws.account, ws.tab)}
          action={
            // Lots and the Owner's Inventory draw their own jot buttons on the page; Overview,
            // Daily Log, Old Lots and Settings have none.
            ws.tab !== "lots" &&
            !(ws.tab === "stock" && ws.account.role !== "branch") &&
            kinds.length > 0 && (
              <div
                role="group"
                aria-label="จดบันทึก"
                className="flex flex-wrap gap-2"
              >
                {kinds.map((kind) => (
                  <Button
                    key={kind}
                    icon={<Plus />}
                    // A branch's Stock is where it jots its day: its buttons stand out.
                    variant={
                      ws.tab === "meatStock" && ws.account.role === "branch"
                        ? "primary"
                        : undefined
                    }
                    // Not while the seed stands in for the server payload: a form would read it.
                    disabled={!ws.loaded}
                    onClick={() => ws.jot({ kind })}
                  >
                    {titles[kind]}
                  </Button>
                ))}
              </div>
            )
          }
        />
        {/* Server payload still loading: the page would show seed data, so show its shape instead. */}
        {!ws.loaded ? (
          <LoadingPanel />
        ) : (
          <div key={ws.tab} className="animate-fade-in">
            {children}
          </div>
        )}
        {/* A modal dialog over the page: it takes no room in the column. */}
        <Composer ws={ws} />
        {/* Above the bottom tabs on a phone. Only the toasts take clicks, not the strip. */}
        <div className="pointer-events-none fixed inset-x-4 bottom-6 z-30 mx-auto grid max-w-md gap-2 *:pointer-events-auto max-md:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]">
          <Toast
            key={ws.toast.id}
            className="my-0 shadow-lg"
            message={ws.toast.message}
            tone={ws.toast.tone ?? "success"}
            action={
              ws.toast.undo && { label: "เลิกทำ", onClick: ws.toast.undo }
            }
            onClose={() => ws.setToast("")}
          />
          <DatabaseErrorToast className="my-0 shadow-lg" />
        </div>
      </main>
    </div>
  );
}

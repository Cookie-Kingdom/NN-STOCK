"use client";

import { FoodivaView } from "@/components/organisms/foodiva/FoodivaView";
import { HistoryPanel } from "@/components/organisms/workspace/HistoryPanel";
import { WorkspaceShell } from "@/components/templates/WorkspaceShell";
import { useWorkspace } from "@/components/organisms/workspace/useWorkspace";
import type { Account } from "@/lib/accounts";
import { foodivaNav } from "@/lib/nav";
import { entries, purchaseLots, shipments } from "@/lib/store";

export function FoodivaWorkspace({ account }: { account: Account }) {
  const ws = useWorkspace(account);
  const { db, tab } = ws;

  // Invoices to issue, Requests to truck, smoked meat to take into the freezer.
  const openTasks =
    purchaseLots(db).filter(
      (lot) => !entries(db, "foodivaConfirm", lot.id).length,
    ).length +
    shipments(db).filter(
      (lot) =>
        lot.stage === 1 ||
        (lot.stage === 7 &&
          !entries(db, "foodivaReturnReceive", lot.id).length),
    ).length;

  return (
    <WorkspaceShell
      account={account}
      nav={foodivaNav}
      tab={tab}
      onTab={ws.setTab}
      date={ws.date}
      onDate={ws.setDate}
      minDate={ws.db.config.systemStartDate}
      badges={ws.loaded ? { foodiva: openTasks } : {}}
      loading={!ws.loaded}
      toast={ws.toast}
      onCloseToast={() => ws.setToast("")}
      ws={ws}
    >
      {tab === "foodiva" && <FoodivaView db={db} open={ws.open} />}
      {tab === "history" && (
        <HistoryPanel
          db={db}
          role={ws.role}
          branch={ws.branch}
          onChanged={ws.setToast}
        />
      )}
    </WorkspaceShell>
  );
}

"use client";

import { FoodDivaView } from "@/components/fooddiva/FoodDivaView";
import { HistoryPanel } from "@/components/workspace/HistoryPanel";
import { WorkspaceModals } from "@/components/workspace/WorkspaceModals";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { useWorkspace } from "@/components/workspace/useWorkspace";
import type { Account } from "@/lib/accounts";
import { exportWorkspaceData } from "@/lib/export-data";
import { foodDivaNav } from "@/lib/nav";
import { entries } from "@/lib/store";

export function FoodDivaWorkspace({ account }: { account: Account }) {
  const ws = useWorkspace(account);
  const { db, tab } = ws;

  const openTasks = db.lots.filter(
    (lot) =>
      !entries(db, "foodDivaConfirm", lot.id).length ||
      (lot.stage === 7 && !entries(db, "foodDivaReturnReceive", lot.id).length),
  ).length;

  return (
    <>
      <WorkspaceShell
        account={account}
        nav={foodDivaNav}
        tab={tab}
        onTab={ws.setTab}
        date={ws.date}
        onDate={ws.setDate}
        badges={{ "food-diva": openTasks }}
        onExport={() => exportWorkspaceData(db, account, ws.date)}
        toast={ws.toast}
        onCloseToast={() => ws.setToast("")}
      >
        {tab === "food-diva" && <FoodDivaView db={db} open={ws.open} />}
        {tab === "history" && <HistoryPanel db={db} role={ws.role} onChanged={ws.setToast} />}
      </WorkspaceShell>
      <WorkspaceModals ws={ws} />
    </>
  );
}

"use client";

import { FoodivaView } from "@/components/organisms/foodiva/FoodivaView";
import { HistoryPanel } from "@/components/organisms/workspace/HistoryPanel";
import { WorkspaceModals } from "@/components/organisms/workspace/WorkspaceModals";
import { WorkspaceShell } from "@/components/templates/WorkspaceShell";
import { useWorkspace } from "@/components/organisms/workspace/useWorkspace";
import type { Account } from "@/lib/accounts";
import { foodivaNav } from "@/lib/nav";
import { entries } from "@/lib/store";

export function FoodivaWorkspace({ account }: { account: Account }) {
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
        nav={foodivaNav}
        tab={tab}
        onTab={ws.setTab}
        date={ws.date}
        onDate={ws.setDate}
        badges={{ "foodiva": openTasks }}
        toast={ws.toast}
        onCloseToast={() => ws.setToast("")}
      >
        {tab === "foodiva" && <FoodivaView db={db} open={ws.open} />}
        {tab === "history" && <HistoryPanel db={db} role={ws.role} onChanged={ws.setToast} />}
      </WorkspaceShell>
      <WorkspaceModals ws={ws} />
    </>
  );
}

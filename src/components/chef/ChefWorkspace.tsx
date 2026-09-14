"use client";

import { ChefLotTable } from "@/components/chef/ChefLotTable";
import { ChefReceiveTable } from "@/components/chef/ChefReceiveTable";
import { MeatStockTable } from "@/components/shared/MeatStockTable";
import { HistoryPanel } from "@/components/workspace/HistoryPanel";
import { WorkspaceModals } from "@/components/workspace/WorkspaceModals";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { useWorkspace } from "@/components/workspace/useWorkspace";
import type { Account } from "@/lib/accounts";
import { exportWorkspaceData } from "@/lib/export-data";
import { chefNav } from "@/lib/nav";
import { entries, smokingInvoiceStatus } from "@/lib/store";

export function ChefWorkspace({ account }: { account: Account }) {
  const ws = useWorkspace(account);
  const { db, tab } = ws;

  const waitingReceipt = db.lots.filter((lot) => lot.stage === 2).length;
  const inProduction = db.lots.filter((lot) => {
    const ordered = entries(db, "smokeOrder", lot.id).length > 0;
    const accepted = entries(db, "smokeOrderAccept", lot.id).length > 0;
    const invoice = entries(db, "smokingInvoice", lot.id).at(-1);
    return (
      [3, 4, 5].includes(lot.stage) ||
      (ordered && (!accepted || !invoice || smokingInvoiceStatus(db, invoice) === "ส่งกลับแก้ไข"))
    );
  }).length;

  return (
    <>
      <WorkspaceShell
        account={account}
        nav={chefNav}
        tab={tab}
        onTab={ws.setTab}
        date={ws.date}
        onDate={ws.setDate}
        badges={{ "cm-receive": waitingReceipt, work: inProduction }}
        onExport={() => exportWorkspaceData(db, account, ws.date)}
        toast={ws.toast}
        onCloseToast={() => ws.setToast("")}
      >
        {tab === "cm-receive" && <ChefReceiveTable db={db} open={ws.open} />}
        {tab === "work" && <ChefLotTable db={db} lots={ws.lots} open={ws.open} />}
        {tab === "stock" && (
          <>
            <div className="section-heading">
              <h2>ความคืบหน้างานผลิต</h2>
            </div>
            <MeatStockTable
              db={db}
              role={ws.role}
              branch={ws.branch}
              lots={ws.lots}
              open={ws.open}
            />
          </>
        )}
        {tab === "history" && <HistoryPanel db={db} role={ws.role} onChanged={ws.setToast} />}
      </WorkspaceShell>
      <WorkspaceModals ws={ws} />
    </>
  );
}

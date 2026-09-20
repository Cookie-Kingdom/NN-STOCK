"use client";

import { SectionHeading } from "@/components/molecules/SectionHeading";
import { ChefLotTable } from "@/components/organisms/chef/ChefLotTable";
import { ChefReceiveTable } from "@/components/organisms/chef/ChefReceiveTable";
import { MeatStockTable } from "@/components/organisms/shared/MeatStockTable";
import { HistoryPanel } from "@/components/organisms/workspace/HistoryPanel";
import { WorkspaceModals } from "@/components/organisms/workspace/WorkspaceModals";
import { WorkspaceShell } from "@/components/templates/WorkspaceShell";
import { useWorkspace } from "@/components/organisms/workspace/useWorkspace";
import type { Account } from "@/lib/accounts";
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
      (ordered &&
        (!accepted ||
          !invoice ||
          smokingInvoiceStatus(db, invoice) === "ส่งกลับแก้ไข"))
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
        minDate={ws.db.config.systemStartDate}
        badges={
          ws.loaded ? { "cm-receive": waitingReceipt, work: inProduction } : {}
        }
        loading={!ws.loaded}
        toast={ws.toast}
        onCloseToast={() => ws.setToast("")}
      >
        {tab === "cm-receive" && <ChefReceiveTable db={db} open={ws.open} />}
        {tab === "work" && (
          <ChefLotTable db={db} lots={ws.lots} open={ws.open} />
        )}
        {tab === "stock" && (
          <>
            <SectionHeading title="ความคืบหน้างานผลิต" />
            <MeatStockTable
              db={db}
              role={ws.role}
              branch={ws.branch}
              lots={ws.lots}
              open={ws.open}
            />
          </>
        )}
        {tab === "history" && (
          <HistoryPanel
            db={db}
            role={ws.role}
            branch={ws.branch}
            onChanged={ws.setToast}
          />
        )}
      </WorkspaceShell>
      <WorkspaceModals ws={ws} />
    </>
  );
}

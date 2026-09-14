"use client";

import { BranchDailyWorkflow } from "@/components/branch/BranchDailyWorkflow";
import { ChiliDailySummary } from "@/components/branch/ChiliDailySummary";
import { DailyMaterialsTable } from "@/components/branch/DailyMaterialsTable";
import { DailySummary } from "@/components/branch/DailySummary";
import { DailyTaskTable } from "@/components/branch/DailyTaskTable";
import { MaterialReceiptConfirmation } from "@/components/branch/MaterialReceiptConfirmation";
import { MaterialStockTable } from "@/components/shared/MaterialStockTable";
import { MeatStockTable } from "@/components/shared/MeatStockTable";
import { SupplyStock } from "@/components/shared/SupplyStock";
import { HistoryPanel } from "@/components/workspace/HistoryPanel";
import { WorkspaceModals } from "@/components/workspace/WorkspaceModals";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { useWorkspace } from "@/components/workspace/useWorkspace";
import type { Account } from "@/lib/accounts";
import { exportWorkspaceData } from "@/lib/export-data";
import { branchNav } from "@/lib/nav";

export function BranchWorkspace({ account }: { account: Account }) {
  const ws = useWorkspace(account);
  const { branch, closed, date, db, tab } = ws;

  return (
    <>
      <WorkspaceShell
        account={account}
        nav={branchNav}
        tab={tab}
        onTab={ws.setTab}
        date={date}
        onDate={ws.setDate}
        onExport={() => exportWorkspaceData(db, account, date)}
        toast={ws.toast}
        onCloseToast={() => ws.setToast("")}
      >
        {closed && (
          <div className="notice warning">
            วันที่ {date} ปิดแล้ว ฟอร์มวันนี้ถูกล็อก Owner ปลดล็อกได้จากหน้ารายงาน
          </div>
        )}
        {tab === "day" && (
          <>
            <div className="notice">
              วันที่ทำรายการ {date} · สาขา {branch} ·
              ข้าวคงเหลือยกไปวันถัดไปได้ ส่วนเนื้อละลายต้องขายหรือบันทึก Waste ให้หมดก่อนปิดวัน
            </div>
            <BranchDailyWorkflow
              db={db}
              branch={branch}
              date={date}
              lots={ws.lots}
              closed={closed}
              open={ws.open}
            />
            <MaterialReceiptConfirmation db={db} branch={branch} date={date} closed={closed} />
            <DailyMaterialsTable
              key={`${branch}-${date}`}
              db={db}
              branch={branch}
              date={date}
              disabled={closed}
            />
            <DailyTaskTable
              title={
                branch === "ศาลาแดง"
                  ? "ข้าวเหนียวดิบ · ซื้อที่สาขาศาลาแดง"
                  : "ข้าวเหนียวสุก · ซื้อที่สาขามีนบุรี"
              }
              kinds={[
                "ricePurchase",
                ...(branch === "ศาลาแดง" ? ["riceIssue"] : []),
                branch === "มีนบุรี" ? "riceCarry" : "rice",
              ]}
              db={db}
              branch={branch}
              date={date}
              disabled={closed}
              hasLots={!!ws.lots.length}
              open={ws.open}
            />
            <ChiliDailySummary db={db} branch={branch} date={date} />
            <DailyTaskTable
              title="ยอดขายและปิดวัน (Sales & day close)"
              kinds={["sale", "closeDay"]}
              db={db}
              branch={branch}
              date={date}
              disabled={closed}
              hasLots={!!ws.lots.length}
              open={ws.open}
            />
          </>
        )}
        {tab === "stock" && (
          <>
            <div className="section-heading">
              <h2>สต๊อกแยก Lot</h2>
            </div>
            <MeatStockTable
              db={db}
              role={ws.role}
              branch={branch}
              lots={ws.lots}
              open={ws.open}
            />
            <SupplyStock db={db} branches={[branch]} />
            <MaterialStockTable db={db} stockBranches={[branch]} ownerView={false} />
          </>
        )}
        {tab === "branch-summary" && (
          <>
            <div className="notice">
              ภาพรวมประจำวันที่ {date} · สาขา {branch}
            </div>
            <DailySummary db={db} date={date} branch={branch} />
            <SupplyStock db={db} branches={[branch]} />
          </>
        )}
        {tab === "history" && <HistoryPanel db={db} role={ws.role} onChanged={ws.setToast} />}
      </WorkspaceShell>
      <WorkspaceModals ws={ws} />
    </>
  );
}

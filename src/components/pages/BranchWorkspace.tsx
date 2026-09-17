"use client";

import { Notice } from "@/components/molecules/Notice";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { BranchDailyWorkflow } from "@/components/organisms/branch/BranchDailyWorkflow";
import { ChiliDailySummary } from "@/components/organisms/branch/ChiliDailySummary";
import { DailyMaterialsTable } from "@/components/organisms/branch/DailyMaterialsTable";
import { DailySummary } from "@/components/organisms/branch/DailySummary";
import { DailyTaskTable } from "@/components/organisms/branch/DailyTaskTable";
import { MaterialReceiptConfirmation } from "@/components/organisms/branch/MaterialReceiptConfirmation";
import { MaterialStockTable } from "@/components/organisms/shared/MaterialStockTable";
import { MeatStockTable } from "@/components/organisms/shared/MeatStockTable";
import { SupplyStock } from "@/components/organisms/shared/SupplyStock";
import { HistoryPanel } from "@/components/organisms/workspace/HistoryPanel";
import { WorkspaceModals } from "@/components/organisms/workspace/WorkspaceModals";
import { WorkspaceShell } from "@/components/templates/WorkspaceShell";
import { useWorkspace } from "@/components/organisms/workspace/useWorkspace";
import type { Account } from "@/lib/accounts";
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
        toast={ws.toast}
        onCloseToast={() => ws.setToast("")}
      >
        {closed && (
          <Notice tone="warning">
            วันที่ {date} ปิดแล้ว ฟอร์มวันนี้ถูกล็อก Owner
            ปลดล็อกได้จากหน้ารายงาน
          </Notice>
        )}
        {tab === "day" && (
          <>
            <Notice>
              วันที่ทำรายการ {date} · สาขา {branch} · ข้าวคงเหลือยกไปวันถัดไปได้
              ส่วนเนื้อละลายต้องขายหรือบันทึก Waste ให้หมดก่อนปิดวัน
            </Notice>
            <BranchDailyWorkflow
              db={db}
              branch={branch}
              date={date}
              lots={ws.lots}
              closed={closed}
              open={ws.open}
            />
            <MaterialReceiptConfirmation
              db={db}
              branch={branch}
              date={date}
              closed={closed}
            />
            <DailyMaterialsTable
              /* The draft is seeded once from the saved entry, so remount when the
               * server payload replaces the seed db, or saved usage reads as 0. */
              key={`${branch}-${date}-${ws.loaded}`}
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
              title="ยอดขาย กล่องโปรโมท และปิดวัน"
              kinds={["sale", "influencerBox", "closeDay"]}
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
            <SectionHeading title="สต๊อกแยก Lot" />
            <MeatStockTable
              db={db}
              role={ws.role}
              branch={branch}
              lots={ws.lots}
              open={ws.open}
            />
            <SupplyStock db={db} branches={[branch]} />
            <MaterialStockTable
              db={db}
              stockBranches={[branch]}
              ownerView={false}
            />
          </>
        )}
        {tab === "branch-summary" && (
          <>
            <Notice>
              ภาพรวมประจำวันที่ {date} · สาขา {branch}
            </Notice>
            <DailySummary db={db} date={date} branch={branch} />
            <SupplyStock db={db} branches={[branch]} />
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

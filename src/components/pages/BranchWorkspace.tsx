"use client";

import { Notice } from "@/components/molecules/Notice";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { BranchDailyWorkflow } from "@/components/organisms/branch/BranchDailyWorkflow";
import { ChiliDailySummary } from "@/components/organisms/branch/ChiliDailySummary";
import { DailyMaterialsTable } from "@/components/organisms/branch/DailyMaterialsTable";
import { DailySummary } from "@/components/organisms/branch/DailySummary";
import { DailyTaskTable } from "@/components/organisms/branch/DailyTaskTable";
import { MaterialReceiptConfirmation } from "@/components/organisms/branch/MaterialReceiptConfirmation";
import { MeatDaySummary } from "@/components/organisms/branch/MeatDaySummary";
import { BranchStockSummary } from "@/components/organisms/shared/BranchStockSummary";
import { MaterialStockTable } from "@/components/organisms/shared/MaterialStockTable";
import { MeatStockTable } from "@/components/organisms/shared/MeatStockTable";
import { SupplyStock } from "@/components/organisms/shared/SupplyStock";
import { HistoryPanel } from "@/components/organisms/workspace/HistoryPanel";
import { WorkspaceShell } from "@/components/templates/WorkspaceShell";
import { useWorkspace } from "@/components/organisms/workspace/useWorkspace";
import type { Account } from "@/lib/accounts";
import { branchNav } from "@/lib/nav";
import { requiredRiceKinds } from "@/lib/store";

/** Same rice rows at every branch: each round is self-cooked or bought cooked (B2). */
const riceTaskTitle = "ข้าวเหนียว · นึ่งเอง หรือซื้อข้าวสุกจากข้างนอก";
const riceTaskKinds = ["ricePurchase", "riceIssue", "rice", "riceCarry"];

export function BranchWorkspace({ account }: { account: Account }) {
  const ws = useWorkspace(account);
  const { branch, closed, date, db, tab } = ws;

  return (
    <WorkspaceShell
      account={account}
      nav={branchNav}
      tab={tab}
      onTab={ws.setTab}
      date={date}
      onDate={ws.setDate}
      minDate={ws.db.config.systemStartDate}
      loading={!ws.loaded}
      toast={ws.toast}
      onCloseToast={() => ws.setToast("")}
      ws={ws}
    >
      {closed && (
        <Notice tone="warning">
          ปิดวันแล้ว · ข้อมูลวันที่ {date} ถูกล็อก แก้ไขไม่ได้ · Owner
          ปลดล็อกได้จากหน้ารายงาน
        </Notice>
      )}
      {tab === "day" && (
        <>
          <Notice>
            วันที่ทำรายการ {date} · สาขา {branch} · ข้าวคงเหลือยกไปวันถัดไปได้ ·
            เนื้อละลายแล้วที่ใช้ไม่หมดเก็บเป็นคงเหลือชิล ยกไปวันถัดไปได้
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
            onDate={ws.setDate}
            minDate={db.config.systemStartDate}
            closed={closed}
          />
          <DailyMaterialsTable
            /* The draft is seeded once from the saved entry, so remount when the
             * server payload replaces the seed db, or saved usage reads as 0. */
            key={`${branch}-${date}-${ws.loaded}`}
            db={db}
            branch={branch}
            date={date}
            onDate={ws.setDate}
            minDate={db.config.systemStartDate}
            disabled={closed}
          />
          <DailyTaskTable
            title={riceTaskTitle}
            kinds={riceTaskKinds}
            required={requiredRiceKinds(db, branch, date)}
            db={db}
            branch={branch}
            date={date}
            disabled={closed}
            hasLots={!!ws.lots.length}
            open={ws.open}
          />
          <ChiliDailySummary db={db} branch={branch} date={date} />
          <MeatDaySummary db={db} branch={branch} date={date} />
          <DailyTaskTable
            title="ยอดขายและกล่องโปรโมท"
            kinds={["sale", "influencerBox"]}
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
          <BranchStockSummary
            key={branch}
            db={db}
            branches={[branch]}
            initialDate={date}
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
  );
}

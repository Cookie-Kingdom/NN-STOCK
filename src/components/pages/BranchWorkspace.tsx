"use client";

import { Notice } from "@/components/molecules/Notice";
import { BranchDailyWorkflow } from "@/components/organisms/branch/BranchDailyWorkflow";
import { BranchStockView } from "@/components/organisms/branch/BranchStockView";
import { ChiliDailySummary } from "@/components/organisms/branch/ChiliDailySummary";
import { DailyMaterialsTable } from "@/components/organisms/branch/DailyMaterialsTable";
import { DailySummary } from "@/components/organisms/branch/DailySummary";
import { DailyTaskTable } from "@/components/organisms/branch/DailyTaskTable";
import { MaterialReceiptConfirmation } from "@/components/organisms/branch/MaterialReceiptConfirmation";
import { MeatDaySummary } from "@/components/organisms/branch/MeatDaySummary";
import {
  noBranchAlerts,
  useBranchAlerts,
} from "@/components/organisms/branch/useBranchAlerts";
import { BranchStockSummary } from "@/components/organisms/shared/BranchStockSummary";
import { SupplyStock } from "@/components/organisms/shared/SupplyStock";
import { HistoryPanel } from "@/components/organisms/workspace/HistoryPanel";
import { WorkspaceShell } from "@/components/templates/WorkspaceShell";
import { useWorkspace } from "@/components/organisms/workspace/useWorkspace";
import type { Account } from "@/lib/accounts";
import { branchNav } from "@/lib/nav";
import { requiredRiceKinds, type EntryKind } from "@/lib/store";

/** Every branch self-cooks or buys cooked each round (B2). */
const riceTask: { title: string; kinds: EntryKind[] } = {
  title: "ข้าวเหนียว · นึ่งเอง หรือซื้อข้าวสุกจากข้างนอก",
  kinds: ["ricePurchase", "riceIssue", "rice", "riceCarry"],
};

export function BranchWorkspace({ account }: { account: Account }) {
  const ws = useWorkspace(account);
  const { branch, closed, date, db, tab } = ws;

  // Meat and material to take in, and the day's own work on `date`. Held back until the
  // server payload replaces the seed.
  const alerts = useBranchAlerts(db, branch, date);
  const { badges, notifications } = ws.loaded ? alerts : noBranchAlerts;

  return (
    <WorkspaceShell
      account={account}
      nav={branchNav}
      badges={badges}
      notifications={notifications}
      ws={ws}
    >
      {closed && (
        <Notice>
          ปิดยอดวันที่ {date} แล้ว · ยังบันทึกเพิ่มหรือแก้ไขได้
          (มีบันทึกประวัติ)
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
            onTab={ws.setTab}
          />
          {/* ยอดขาย/ของเสีย อยู่ที่ขั้นที่ 4 ของ BranchDailyWorkflow ที่เดียว ·
           * กล่องโปรโมทอินฟลูเอนเซอร์ย้ายไปอยู่ในฟอร์ม "ยืนยันปิดวัน" (ขั้นที่ 5) */}
          {/* การนับน้ำพริกประจำวัน ไม่ใช่รายการสต๊อก จึงอยู่ที่หน้ากรอกรายวัน */}
          <ChiliDailySummary db={db} branch={branch} date={date} />
        </>
      )}
      {tab === "material-receive" && (
        <>
          <Notice>
            วันที่ทำรายการ {date} · สาขา {branch}
          </Notice>
          <MaterialReceiptConfirmation
            db={db}
            branch={branch}
            date={date}
            onDate={ws.setDate}
          />
        </>
      )}
      {tab === "material-count" && (
        <>
          <Notice>
            วันที่ทำรายการ {date} · สาขา {branch}
          </Notice>
          <DailyMaterialsTable
            /* The draft is seeded once from the saved entry, so remount when the
             * server payload replaces the seed db, or saved usage reads as 0. */
            key={`${branch}-${date}-${ws.loaded}`}
            db={db}
            branch={branch}
            date={date}
            onDate={ws.setDate}
          />
        </>
      )}
      {tab === "rice" && (
        <>
          <Notice>
            วันที่ทำรายการ {date} · สาขา {branch} · ข้าวคงเหลือยกไปวันถัดไปได้
          </Notice>
          <DailyTaskTable
            title={riceTask.title}
            kinds={riceTask.kinds}
            required={requiredRiceKinds(db, branch, date)}
            db={db}
            branch={branch}
            date={date}
            hasLots={!!ws.lots.length}
            open={ws.open}
          />
        </>
      )}
      {tab === "stock" && (
        <BranchStockView db={db} branch={branch} lots={ws.lots} />
      )}
      {tab === "meat-summary" && (
        <>
          <BranchStockSummary
            key={branch}
            db={db}
            branches={[branch]}
            initialDate={date}
          />
          <MeatDaySummary db={db} branch={branch} date={date} />
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

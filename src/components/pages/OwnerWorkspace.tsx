"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { Notice } from "@/components/molecules/Notice";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { CentralReceiveView } from "@/components/organisms/owner/CentralReceiveView";
import { ConfigView } from "@/components/organisms/owner/ConfigView";
import { InvoiceView } from "@/components/organisms/owner/InvoiceView";
import { MeatMovementLogView } from "@/components/organisms/owner/MeatMovementLogView";
import { OwnerDailyStatus } from "@/components/organisms/owner/OwnerDailyStatus";
import { OwnerDashboard } from "@/components/organisms/owner/OwnerDashboard";
import { OwnerStockView } from "@/components/organisms/owner/OwnerStockView";
import { PurchaseOrderView } from "@/components/organisms/owner/PurchaseOrderView";
import { Report } from "@/components/organisms/owner/Report";
import { SimpleTraceabilityView } from "@/components/organisms/owner/SimpleTraceabilityView";
import { SmokingPurchaseOrderView } from "@/components/organisms/owner/SmokingPurchaseOrderView";
import { TransportManifestView } from "@/components/organisms/owner/TransportManifestView";
import {
  noOwnerAlerts,
  useOwnerAlerts,
} from "@/components/organisms/owner/useOwnerAlerts";
import { MeatStockTable } from "@/components/organisms/shared/MeatStockTable";
import { HistoryPanel } from "@/components/organisms/workspace/HistoryPanel";
import { WorkspaceModals } from "@/components/organisms/workspace/WorkspaceModals";
import { WorkspaceShell } from "@/components/templates/WorkspaceShell";
import { useWorkspace } from "@/components/organisms/workspace/useWorkspace";
import type { Account } from "@/lib/accounts";
import { fmt } from "@/lib/format";
import { ownerNav } from "@/lib/nav";
import { produced } from "@/lib/store";

export function OwnerWorkspace({ account }: { account: Account }) {
  const ws = useWorkspace(account);
  const { db, date, open, setTab, tab } = ws;
  const [showNotifications, setShowNotifications] = useState(false);
  const everyAlert = useOwnerAlerts(db);
  const alerts = ws.loaded ? everyAlert : noOwnerAlerts;

  return (
    <>
      <WorkspaceShell
        account={account}
        nav={ownerNav}
        tab={tab}
        onTab={setTab}
        date={date}
        onDate={ws.setDate}
        minDate={ws.db.config.systemStartDate}
        badges={alerts.badges}
        notifications={alerts.notifications}
        showNotifications={showNotifications}
        onToggleNotifications={() => setShowNotifications((value) => !value)}
        loading={!ws.loaded}
        toast={ws.toast}
        onCloseToast={() => ws.setToast("")}
      >
        {alerts.missingMaterialSettings > 0 && tab !== "config" && (
          <Notice
            tone="warning"
            action={
              <Button onClick={() => setTab("config")}>ไปหน้าตั้งค่า</Button>
            }
          >
            ตั้งค่าวัสดุยังไม่ครบ {alerts.missingMaterialSettings} รายการ
            กรุณากำหนดจำนวนฐานและราคาต่อหน่วยก่อนส่งวัสดุครั้งถัดไป
          </Notice>
        )}
        {alerts.returnReady.length > 0 && tab !== "transport" && (
          <Notice
            tone="danger"
            action={
              <Button onClick={() => setTab("transport")}>
                ไปเรียกรถขากลับ
              </Button>
            }
          >
            งานใหม่จาก Chef_house · ปิด Lot แล้ว {alerts.returnReady.length}{" "}
            รายการ · ต้องเรียกรถขากลับรวม{" "}
            {fmt(
              alerts.returnReady.reduce(
                (total, item) => total + produced(db, item.id),
                0,
              ),
            )}{" "}
            กก.
          </Notice>
        )}

        {tab === "owner-dashboard" && (
          <OwnerDashboard db={db} date={date} onNavigate={setTab} />
        )}
        {tab === "po" && (
          <PurchaseOrderView
            db={db}
            open={open}
            onOpenSmokePo={() => setTab("smoke-po")}
          />
        )}
        {tab === "smoke-po" && <SmokingPurchaseOrderView db={db} open={open} />}
        {tab === "invoices" && <InvoiceView db={db} open={open} />}
        {tab === "transport" && <TransportManifestView db={db} open={open} />}
        {tab === "central-receive" && (
          <CentralReceiveView db={db} open={open} />
        )}
        {tab === "documents" && <SimpleTraceabilityView db={db} />}
        {tab === "meat-log" && <MeatMovementLogView db={db} />}

        {tab === "branch-status" && (
          <>
            <SectionHeading
              title="จัดสรรเนื้อและสต๊อกไปสาขา"
              description="เลือก Lot ที่มีเนื้อในสต๊อกกลาง แล้วระบุสาขาและน้ำหนักที่ต้องการส่ง"
            />
            <MeatStockTable
              db={db}
              role={ws.role}
              branch={ws.branch}
              lots={ws.lots}
              open={open}
            />
          </>
        )}

        {tab === "stock" && (
          <>
            <SectionHeading
              title="สต๊อกกลางและสาขา"
              actions={
                <ButtonRow>
                  <Button onClick={() => open("materialReceive", "")}>
                    + ซื้อวัสดุเข้าคลัง
                  </Button>
                  <Button onClick={() => open("generalPurchase", "")}>
                    + บันทึกการซื้ออื่น ๆ
                  </Button>
                  <Button onClick={() => open("chiliAllocate", "")}>
                    จัดสรรน้ำพริกไปสาขา
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => open("materialTransfer", "")}
                  >
                    ส่งวัสดุไปสาขา
                  </Button>
                </ButtonRow>
              }
            />
            <OwnerStockView db={db} lots={ws.lots} open={open} />
          </>
        )}

        {tab === "report" && (
          <>
            <ButtonRow>
              <Button
                variant="primary"
                icon={<Plus />}
                onClick={() => open("expense", "")}
              >
                ค่าใช้จ่าย Owner
              </Button>
              <Button onClick={() => open("unlock", "")}>ปลดล็อกวัน</Button>
            </ButtonRow>
            <OwnerDailyStatus db={db} date={date} />
            <Report db={db} />
          </>
        )}

        {tab === "config" && <ConfigView db={db} />}
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

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { CentralReceiveView } from "@/components/organisms/owner/CentralReceiveView";
import { ConfigView } from "@/components/organisms/owner/ConfigView";
import { InvoiceView } from "@/components/organisms/owner/InvoiceView";
import { MeatMovementLogView } from "@/components/organisms/owner/MeatMovementLogView";
import { OwnerAlertBanners } from "@/components/organisms/owner/OwnerAlertBanners";
import { OwnerDailyStatus } from "@/components/organisms/owner/OwnerDailyStatus";
import { OwnerDashboard } from "@/components/organisms/owner/OwnerDashboard";
import { OwnerStockView } from "@/components/organisms/owner/OwnerStockView";
import { PurchaseOrderView } from "@/components/organisms/owner/PurchaseOrderView";
import { Report } from "@/components/organisms/owner/Report";
import { ReturnShipmentView } from "@/components/organisms/owner/ReturnShipmentView";
import { SimpleTraceabilityView } from "@/components/organisms/owner/SimpleTraceabilityView";
import { SmokingPurchaseOrderView } from "@/components/organisms/owner/SmokingPurchaseOrderView";
import { TransportManifestView } from "@/components/organisms/owner/TransportManifestView";
import {
  noOwnerAlerts,
  useOwnerAlerts,
} from "@/components/organisms/owner/useOwnerAlerts";
import { BranchStockSummary } from "@/components/organisms/shared/BranchStockSummary";
import { MeatStockTable } from "@/components/organisms/shared/MeatStockTable";
import { HistoryPanel } from "@/components/organisms/workspace/HistoryPanel";
import { WorkspaceShell } from "@/components/templates/WorkspaceShell";
import { useWorkspace } from "@/components/organisms/workspace/useWorkspace";
import type { Account } from "@/lib/accounts";
import { managerNav, ownerNav } from "@/lib/nav";
import { branches, shipments } from "@/lib/store";

/** The Owner's workspace, also the Account Manager's (`hidesSales`): same screens minus the
 *  dashboard, and useWorkspace hands it a database without sales money. */
export function OwnerWorkspace({ account }: { account: Account }) {
  const ws = useWorkspace(account);
  const { db, date, open, setTab, tab } = ws;
  const [showNotifications, setShowNotifications] = useState(false);
  const everyAlert = useOwnerAlerts(db);
  const alerts = ws.loaded ? everyAlert : noOwnerAlerts;
  const hideSales = !!account.hidesSales;
  const router = useRouter();
  // /owner lands on the dashboard; send the manager to its own home tab instead.
  const noDashboard = hideSales && tab === "owner-dashboard";
  useEffect(() => {
    if (noDashboard) router.replace(`${account.path}/${account.homeTab}`);
  }, [noDashboard, router, account.path, account.homeTab]);

  return (
    <WorkspaceShell
      account={account}
      nav={hideSales ? managerNav : ownerNav}
      tab={tab}
      onTab={setTab}
      date={date}
      onDate={ws.setDate}
      badges={alerts.badges}
      notifications={alerts.notifications}
      showNotifications={showNotifications}
      onToggleNotifications={() => setShowNotifications((value) => !value)}
      loading={!ws.loaded}
      toast={ws.toast}
      onCloseToast={() => ws.setToast("")}
      ws={ws}
    >
      <OwnerAlertBanners db={db} alerts={alerts} tab={tab} onTab={setTab} />

      {tab === "owner-dashboard" && !hideSales && (
        <OwnerDashboard db={db} date={date} onNavigate={setTab} />
      )}
      {tab === "po" && <PurchaseOrderView db={db} open={open} />}
      {tab === "smoke-po" && <SmokingPurchaseOrderView db={db} open={open} />}
      {tab === "invoices" && <InvoiceView db={db} open={open} />}
      {tab === "transport" && <TransportManifestView db={db} open={open} />}
      {tab === "return-shipment" && <ReturnShipmentView db={db} open={open} />}
      {tab === "central-receive" && <CentralReceiveView db={db} open={open} />}
      {tab === "documents" && <SimpleTraceabilityView db={db} />}
      {tab === "meat-log" && <MeatMovementLogView db={db} />}

      {tab === "branch-status" && (
        <>
          <SectionHeading
            title="จัดสรรเนื้อและสต๊อกไปสาขา"
            description="จัดสรรได้ทุกชุด ระบุสาขาและน้ำหนักที่ต้องการส่ง · เกินสต๊อกกลางระบบจะเตือนแต่ยังบันทึกได้"
          />
          <MeatStockTable
            db={db}
            role={ws.role}
            branch={ws.branch}
            lots={shipments(db)}
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
                {/* Each opens a pair of forms; a chooser at the top of the dialog
                    swaps materials for the other purchase / the chili tubes. */}
                <Button onClick={() => open("materialReceive", "")}>
                  + ซื้อเข้าคลัง
                </Button>
                <Button
                  variant="primary"
                  onClick={() => open("materialTransfer", "")}
                >
                  ส่งของไปสาขา
                </Button>
              </ButtonRow>
            }
          />
          <OwnerStockView db={db} lots={ws.lots} open={open} />
          <BranchStockSummary db={db} branches={branches} initialDate={date} />
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
          <Report db={db} hideSales={hideSales} />
        </>
      )}

      {tab === "config" && <ConfigView db={db} />}
      {tab === "history" && (
        <HistoryPanel
          db={db}
          role={ws.role}
          branch={ws.branch}
          hideSales={hideSales}
          onChanged={ws.setToast}
        />
      )}
    </WorkspaceShell>
  );
}

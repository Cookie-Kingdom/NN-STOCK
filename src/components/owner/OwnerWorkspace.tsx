"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CentralReceiveView } from "@/components/owner/CentralReceiveView";
import { ConfigView } from "@/components/owner/ConfigView";
import { InvoiceView } from "@/components/owner/InvoiceView";
import { MeatMovementLogView } from "@/components/owner/MeatMovementLogView";
import { OwnerDailyStatus } from "@/components/owner/OwnerDailyStatus";
import { OwnerDashboard } from "@/components/owner/OwnerDashboard";
import { OwnerStockView } from "@/components/owner/OwnerStockView";
import { Report } from "@/components/owner/Report";
import { SimpleTraceabilityView } from "@/components/owner/SimpleTraceabilityView";
import { SmokingPurchaseOrderView } from "@/components/owner/SmokingPurchaseOrderView";
import { TransportManifestView } from "@/components/owner/TransportManifestView";
import { useOwnerAlerts } from "@/components/owner/useOwnerAlerts";
import { DataTable } from "@/components/shared/DataTable";
import { DocumentPrintButton } from "@/components/shared/DocumentPrintButton";
import { MeatStockTable } from "@/components/shared/MeatStockTable";
import { purchaseOrderRows } from "@/components/shared/documents";
import { HistoryPanel } from "@/components/workspace/HistoryPanel";
import { WorkspaceModals } from "@/components/workspace/WorkspaceModals";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { useWorkspace } from "@/components/workspace/useWorkspace";
import type { Account } from "@/lib/accounts";
import { fmt } from "@/lib/format";
import { ownerNav } from "@/lib/nav";
import { entries, n, produced, smokingInvoiceStatus, stages } from "@/lib/store";

export function OwnerWorkspace({ account }: { account: Account }) {
  const ws = useWorkspace(account);
  const { db, date, open, setTab, tab } = ws;
  const [showNotifications, setShowNotifications] = useState(false);
  const alerts = useOwnerAlerts(db);

  return (
    <>
      <WorkspaceShell
        account={account}
        nav={ownerNav}
        tab={tab}
        onTab={setTab}
        date={date}
        onDate={ws.setDate}
        badges={alerts.badges}
        notifications={alerts.notifications}
        showNotifications={showNotifications}
        onToggleNotifications={() => setShowNotifications((value) => !value)}
        toast={ws.toast}
        onCloseToast={() => ws.setToast("")}
      >
        {alerts.missingMaterialSettings > 0 && tab !== "config" && (
          <div className="notice warning onboarding-notice">
            <span>
              ตั้งค่าวัสดุยังไม่ครบ {alerts.missingMaterialSettings} รายการ
              กรุณากำหนดจำนวนฐานและราคาต่อหน่วยก่อนส่งวัสดุครั้งถัดไป
            </span>
            <button className="secondary" onClick={() => setTab("config")}>
              ไปหน้าตั้งค่า
            </button>
          </div>
        )}
        {alerts.returnReady.length > 0 && tab !== "transport" && (
          <div className="notice danger">
            <span>
              งานใหม่จาก Chef_house · ปิด Lot แล้ว {alerts.returnReady.length} รายการ ·
              ต้องเรียกรถขากลับรวม{" "}
              {fmt(alerts.returnReady.reduce((total, item) => total + produced(db, item.id), 0))} กก.
            </span>
            <button className="secondary" onClick={() => setTab("transport")}>
              ไปเรียกรถขากลับ
            </button>
          </div>
        )}

        {tab === "owner-dashboard" && <OwnerDashboard db={db} date={date} onNavigate={setTab} />}

        {tab === "po" && (
          <>
            <div className="section-heading">
              <div>
                <h2>ใบสั่งซื้อเนื้อ (Purchase orders)</h2>
                <p className="muted">สร้าง PO ใหม่และดูรายการที่เคยสร้าง</p>
              </div>
              <div className="button-row">
                <button className="primary" onClick={() => open("purchase", "")}>
                  <Plus size={17} /> สร้าง PO เนื้อ
                </button>
              </div>
            </div>
            <DataTable
              title="รายการใบสั่งซื้อ PO"
              columns={[
                "เลข PO",
                "Lot",
                "ลูกค้า / Attention",
                "สินค้า / ขนาดบรรจุ",
                "น้ำหนักสั่งซื้อ",
                "Invoice Foodiva",
                "สถานะ",
                "การทำงาน",
              ]}
              rows={db.lots.map((item) => [
                item.poId,
                item.id,
                `${item.values.customerName || "-"} / ${item.values.attention || "-"}`,
                `${item.values.productName || "เนื้อวัว"} / ${item.values.packSize || "-"}`,
                `${fmt(n(item.values, "orderedKg"))} กก.`,
                entries(db, "foodDivaConfirm", item.id).at(-1)?.values.invoiceNo || "รอยืนยัน",
                stages[item.stage],
                item.stage === 1 ? (
                  <div className="button-row" key={item.id}>
                    {!entries(db, "foodDivaConfirm", item.id).length ? (
                      <span className="badge danger">รอ Foodiva ออก Invoice</span>
                    ) : !entries(db, "smokeOrder", item.id).length ? (
                      <button className="table-action" onClick={() => setTab("smoke-po")}>
                        ไปใบสั่ง PO โรงรมควัน
                      </button>
                    ) : !entries(db, "smokeOrderAccept", item.id).length ? (
                      <span className="badge danger">รอ Chef_house รับ PO</span>
                    ) : !entries(db, "smokingInvoice", item.id).length ? (
                      <span className="badge danger">รอ Chef_house Submit ใบวางบิล</span>
                    ) : smokingInvoiceStatus(db, entries(db, "smokingInvoice", item.id).at(-1)!) ===
                      "รอตรวจยอด" ? (
                      <button className="table-action" onClick={() => open("invoiceReview", item.id)}>
                        ตรวจ Invoice เพื่อเรียกรถ
                      </button>
                    ) : smokingInvoiceStatus(db, entries(db, "smokingInvoice", item.id).at(-1)!) ===
                      "รอชำระ" ? (
                      <button className="table-action" onClick={() => open("invoicePayment", item.id)}>
                        ชำระ Invoice เพื่อเรียกรถ
                      </button>
                    ) : smokingInvoiceStatus(db, entries(db, "smokingInvoice", item.id).at(-1)!) ===
                      "ส่งกลับแก้ไข" ? (
                      <span className="badge danger">รอ Chef_house แก้ Invoice</span>
                    ) : (
                      <button className="table-action" onClick={() => open("dispatch", item.id)}>
                        เรียกรถ / ทำใบขนส่ง
                      </button>
                    )}
                    <DocumentPrintButton
                      title="Purchase Order"
                      number={item.poId}
                      rows={purchaseOrderRows(item, db)}
                    />
                  </div>
                ) : (
                  <DocumentPrintButton
                    title="Purchase Order"
                    number={item.poId}
                    rows={purchaseOrderRows(item, db)}
                  />
                ),
              ])}
            />
          </>
        )}

        {tab === "smoke-po" && <SmokingPurchaseOrderView db={db} open={open} />}
        {tab === "invoices" && <InvoiceView db={db} open={open} />}
        {tab === "transport" && <TransportManifestView db={db} open={open} />}
        {tab === "central-receive" && <CentralReceiveView db={db} open={open} />}
        {tab === "documents" && <SimpleTraceabilityView db={db} />}
        {tab === "meat-log" && <MeatMovementLogView db={db} />}

        {tab === "branch-status" && (
          <>
            <div className="section-heading">
              <div>
                <h2>จัดสรรเนื้อและสต๊อกไปสาขา</h2>
                <p className="muted">
                  เลือก Lot ที่มีเนื้อในสต๊อกกลาง แล้วระบุสาขาและน้ำหนักที่ต้องการส่ง
                </p>
              </div>
            </div>
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
            <div className="section-heading">
              <h2>สต๊อกกลางและสาขา</h2>
              <div className="button-row">
                <button className="secondary" onClick={() => open("materialReceive", "")}>
                  + ซื้อวัสดุเข้าคลัง
                </button>
                <button className="secondary" onClick={() => open("generalPurchase", "")}>
                  + บันทึกการซื้ออื่น ๆ
                </button>
                <button className="secondary" onClick={() => open("chiliAllocate", "")}>
                  จัดสรรน้ำพริกไปสาขา
                </button>
                <button className="primary" onClick={() => open("materialTransfer", "")}>
                  ส่งวัสดุไปสาขา
                </button>
              </div>
            </div>
            <OwnerStockView db={db} lots={ws.lots} open={open} />
          </>
        )}

        {tab === "report" && (
          <>
            <div className="button-row">
              <button className="primary" onClick={() => open("expense", "")}>
                <Plus size={16} /> ค่าใช้จ่าย Owner
              </button>
              <button className="secondary" onClick={() => open("unlock", "")}>
                ปลดล็อกวัน
              </button>
            </div>
            <OwnerDailyStatus db={db} date={date} />
            <Report db={db} />
          </>
        )}

        {tab === "config" && <ConfigView db={db} />}
        {tab === "history" && <HistoryPanel db={db} role={ws.role} onChanged={ws.setToast} />}
      </WorkspaceShell>
      <WorkspaceModals ws={ws} />
    </>
  );
}

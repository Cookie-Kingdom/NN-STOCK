"use client";

import { Fragment, useRef, useState, type ReactNode } from "react";
import {
  Beef,
  Building2,
  Factory,
  Store,
  Plus,
  ArrowRight,
  Check,
  X,
  Package,
  ClipboardList,
  BarChart3,
  Settings,
  History,
  Download,
  RotateCcw,
  FilePlus2,
  ListChecks,
  LayoutDashboard,
  TrendingUp,
  CircleAlert,
  Bell,
  Warehouse,
} from "lucide-react";
import {
  balance,
  availableBags,
  branchMaterialStock,
  branches,
  chiliAllocated,
  chiliSold,
  chiliStock,
  centralBagStock,
  centralStock,
  cookedRiceStock,
  entries,
  issuedRawRiceStock,
  isClosed,
  lotCost,
  materials,
  materialPar,
  materialUnitPrice,
  mutate,
  n,
  ownerChiliStock,
  ownerMaterialStock,
  ownerWasteOutstanding,
  ownerWasteReceived,
  processed,
  processLoss,
  produced,
  producedBags,
  rawRiceStock,
  rawAtFoodDiva,
  rawAtSmoker,
  readyForChefHouse,
  roleName,
  reservedForOwnerContent,
  seed,
  sevenDayRoleplay,
  thirtyDayRoleplay,
  stageAction,
  stageRole,
  stages,
  steakRawStock,
  smokeServiceRate,
  smokingInvoiceStatus,
  averageYield,
  titles,
  visibleEntries,
  type Database,
  type Entry,
  type Lot,
  type Role,
  type Values,
} from "@/lib/demo-store";
import { defaults, forms } from "@/lib/demo-forms";
import {
  latestDatabase,
  migrateLegacyAttachments,
  saveDatabase,
  useDatabase,
} from "@/lib/demo-persistence";
import { getAttachment, saveAttachment } from "@/lib/attachment-store";
import "./demo.css";

const fmt = (x: number) =>
  new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(x);
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
type Tab =
  | "owner-dashboard"
  | "work"
  | "cm-receive"
  | "po"
  | "smoke-po"
  | "invoices"
  | "documents"
  | "food-diva"
  | "transport"
  | "central-receive"
  | "branch-status"
  | "branch-summary"
  | "stock"
  | "meat-log"
  | "day"
  | "report"
  | "history"
  | "config";
type Modal = { kind: string; lotId: string };
const tabs: { id: Tab; label: string; ownerLabel?: string; icon: typeof Package }[] = [
  { id: "owner-dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { id: "po", label: "ใบสั่งซื้อ PO", icon: FilePlus2 },
  { id: "smoke-po", label: "ใบสั่ง PO โรงรมควัน", icon: Factory },
  { id: "invoices", label: "ใบ Invoice", icon: ClipboardList },
  { id: "food-diva", label: "PO และสต๊อก Food Diva", icon: Beef },
  { id: "transport", label: "ใบขนส่ง", icon: ArrowRight },
  { id: "central-receive", label: "รับเนื้อเข้าสต๊อกกลาง", icon: Warehouse },
  { id: "work", label: "งานผลิต", ownerLabel: "ใบสั่งซื้อและ Lot ทั้งหมด", icon: ClipboardList },
  { id: "cm-receive", label: "ยืนยันรับเนื้อ", icon: Warehouse },
  { id: "branch-status", label: "ติดตามสาขา", ownerLabel: "จัดสรรเนื้อ และสต๊อกไปสาขา", icon: ListChecks },
  { id: "stock", label: "สต๊อก", ownerLabel: "สต๊อกของทั้งหมด", icon: Package },
  { id: "documents", label: "เอกสารและ Traceability", icon: ClipboardList },
  { id: "meat-log", label: "Log เนื้อคงเหลือ", icon: Beef },
  { id: "report", label: "รายงาน", icon: BarChart3 },
  { id: "history", label: "ประวัติ", ownerLabel: "Log", icon: History },
  { id: "config", label: "ตั้งค่า", icon: Settings },
  { id: "branch-summary", label: "สรุปสาขา", icon: LayoutDashboard },
  { id: "day", label: "กรอกรายวัน", icon: Store },
];
const roles = [
  {
    key: "owner",
    id: "owner" as Role,
    label: "Owner",
    detail: "เจ้าของร้าน",
    icon: Building2,
  },
  {
    key: "fooddiva",
    id: "fooddiva" as Role,
    label: "Food Diva",
    detail: "ผู้ขายเนื้อ / ออก Invoice",
    icon: Beef,
  },
  {
    key: "cm",
    id: "cm" as Role,
    label: "Chef_house",
    detail: "ฝ่ายผลิต",
    icon: Factory,
  },
  {
    key: "branch-saladaeng",
    id: "branch" as Role,
    label: "สาขาศาลาแดง",
    detail: "ผู้ดูแลสาขา",
    branch: "ศาลาแดง",
    icon: Store,
  },
  {
    key: "branch-minburi",
    id: "branch" as Role,
    label: "สาขามีนบุรี",
    detail: "ผู้ดูแลสาขา",
    branch: "มีนบุรี",
    icon: Store,
  },
];

export default function Demo() {
  const db = useDatabase();
  const [role, setRole] = useState<Role>("owner");
  const [tab, setTab] = useState<Tab>("owner-dashboard");
  const [date, setDate] = useState(today);
  const [chosen, setChosen] = useState("");
  const [modal, setModal] = useState<Modal | null>(null);
  const [toast, setToast] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [reset, setReset] = useState(false);
  const [search, setSearch] = useState("");
  const branch = db.config.branch;
  const lots = db.lots.filter(
    (l) =>
      role === "owner" ||
      role === "fooddiva" ||
      (role === "cm" && (l.stage >= 2 || entries(db, "smokeOrder", l.id).length > 0)) ||
      (role === "branch" && entries(db, "allocate", l.id, branch).length > 0),
  );
  const lot = lots.find((l) => l.id === chosen) || lots[0];
  const open = (kind: string, lotId = lot?.id || "") =>
    setModal({ kind, lotId });
  const closed = isClosed(db, branch, date);
  const missingMaterialSettings = materials.filter(
    (_, index) =>
      materialPar(db, "ศาลาแดง", index) <= 0 ||
      materialUnitPrice(db, "ศาลาแดง", index) <= 0,
  ).length;
  const chefReceiveCount = db.lots.filter((item) => item.stage === 2).length;
  const chefProductionCount = db.lots.filter((item) => {
    const hasSmokeOrder = entries(db, "smokeOrder", item.id).length > 0;
    const accepted = entries(db, "smokeOrderAccept", item.id).length > 0;
    const invoice = entries(db, "smokingInvoice", item.id).at(-1);
    return [3, 4, 5].includes(item.stage) || (hasSmokeOrder && (!accepted || !invoice || smokingInvoiceStatus(db, invoice) === "ส่งกลับแก้ไข"));
  }).length;
  const foodDivaTaskCount = db.lots.filter((item) => !entries(db, "foodDivaConfirm", item.id).length || (item.stage === 7 && !entries(db, "foodDivaReturnReceive", item.id).length)).length;
  const ownerTransportCount = db.lots.filter((item) => item.stage === 1 || item.stage === 6).length;
  const ownerReturnReady = db.lots.filter(
    (item) => item.stage === 6 && !entries(db, "return", item.id).length,
  );
  const ownerCentralReceiveCount = db.lots.filter((item) => item.stage === 7 && entries(db, "foodDivaReturnReceive", item.id).length).length;
  const ownerAllocationCount = db.lots.filter((item) => item.stage >= 8 && centralStock(db, item.id) > 0.001).length;
  const ownerBillingCount = entries(db, "smokingInvoice").filter((invoice) => smokingInvoiceStatus(db, invoice) === "รอตรวจยอด").length;
  const ownerFoodDivaInvoiceCount = db.lots.filter(
    (item) => entries(db, "foodDivaConfirm", item.id).length > 0 && !entries(db, "smokeOrder", item.id).length,
  ).length;
  const ownerNotifications: { title: string; detail: string; tab: Tab }[] = [
    ...db.lots.flatMap((item) => {
      const foodInvoice = entries(db, "foodDivaConfirm", item.id).at(-1);
      const smokeOrder = entries(db, "smokeOrder", item.id).at(-1);
      const accepted = entries(db, "smokeOrderAccept", item.id).at(-1);
      const smokeInvoice = entries(db, "smokingInvoice", item.id).at(-1);
      if (!foodInvoice) return [{
        title: `รอ Food Diva ออก Invoice · ${item.id}`,
        detail: "ติดตาม Food Diva ให้ยืนยันน้ำหนักและแนบ Invoice เนื้อ",
        tab: "po" as Tab,
      }];
      if (!smokeOrder) return [{
        title: `Food Diva ออก Invoice แล้ว · ${item.id}`,
        detail: `Owner ต้องออก PO โรงรมควันต่อ · พร้อมส่งเชียงใหม่ ${fmt(readyForChefHouse(db, item.id))} กก.`,
        tab: "smoke-po" as Tab,
      }];
      if (!accepted) return [{
        title: `รอ Chef_house ยืนยัน PO โรงรมควัน · ${item.id}`,
        detail: "Chef_house ต้องกดยืนยันรับ PO ก่อน Owner เรียกรถส่งเนื้อ",
        tab: "smoke-po" as Tab,
      }];
      if (!smokeInvoice) return [{
        title: `รอ Chef_house Submit Invoice ค่ารมควัน · ${item.id}`,
        detail: "รอเลข Invoice และไฟล์แนบเพื่อให้ Owner ตรวจยอด",
        tab: "invoices" as Tab,
      }];
      const invoiceStatus = smokingInvoiceStatus(db, smokeInvoice);
      if (invoiceStatus === "รอตรวจยอด") return [{
        title: `รอตรวจ Invoice ค่ารมควัน · ${smokeInvoice.values.invoiceNumber}`,
        detail: `ตรวจยอด Lot ${item.id} ก่อนชำระและเรียกรถ`,
        tab: "invoices" as Tab,
      }];
      if (invoiceStatus === "รอชำระ") return [{
        title: `รอชำระ Invoice ค่ารมควัน · ${smokeInvoice.values.invoiceNumber}`,
        detail: `ชำระเงิน Lot ${item.id} ก่อนทำใบขนส่งขาไป`,
        tab: "invoices" as Tab,
      }];
      if (invoiceStatus === "ส่งกลับแก้ไข") return [{
        title: `รอ Chef_house แก้ Invoice · ${smokeInvoice.values.invoiceNumber}`,
        detail: "Owner ส่งกลับแก้ไขแล้ว รอ Chef_house Submit ใหม่",
        tab: "invoices" as Tab,
      }];
      if (item.stage === 1) return [{
        title: `พร้อมทำใบขนส่งไป Chef_house · ${item.id}`,
        detail: `เรียกรถรับเนื้อพร้อมส่ง ${fmt(readyForChefHouse(db, item.id))} กก.`,
        tab: "transport" as Tab,
      }];
      if (item.stage === 7 && !entries(db, "foodDivaReturnReceive", item.id).length) return [{
        title: `รอ Food Diva รับเนื้อรมควัน · ${item.id}`,
        detail: "ติดตาม Food Diva ให้ชั่งรับเนื้อจาก Chef_house เข้าตู้",
        tab: "transport" as Tab,
      }];
      return [];
    }),
    ...ownerReturnReady.map((item) => ({
      title: `Chef_house ปิด Lot แล้ว · ${item.id}`,
      detail: `เรียกรถขากลับ ${fmt(produced(db, item.id))} กก. · ${producedBags(db, item.id)} ถุง`,
      tab: "transport" as Tab,
    })),
    ...(ownerCentralReceiveCount ? [{
      title: `Food Diva รับเนื้อรมควันแล้ว ${ownerCentralReceiveCount} Lot`,
      detail: "รับเนื้อเข้าสต๊อกกลางก่อนจัดสรรไปสาขา",
      tab: "central-receive" as Tab,
    }] : []),
    ...(ownerAllocationCount ? [{
      title: `มีเนื้อพร้อมจัดสรร ${ownerAllocationCount} Lot`,
      detail: "เลือกสาขาและจัดสรรเนื้อจากคลังกลาง",
      tab: "branch-status" as Tab,
    }] : []),
    ...(missingMaterialSettings ? [{
      title: `ตั้งค่าวัสดุยังไม่ครบ ${missingMaterialSettings} รายการ`,
      detail: "กำหนดจำนวนฐานและราคาต่อหน่วยก่อนใช้งานจริง",
      tab: "config" as Tab,
    }] : []),
  ];
  function changeRole(value: Role, selectedBranch?: string) {
    if (value === "branch" && selectedBranch && selectedBranch !== branch) {
      const current = latestDatabase();
      saveDatabase({
        ...current,
        config: { ...current.config, branch: selectedBranch },
      });
    }
    setRole(value);
    setTab(value === "owner" ? "owner-dashboard" : value === "fooddiva" ? "food-diva" : value === "cm" ? "cm-receive" : "day");
    setSearch("");
    setToast("");
    setShowNotifications(false);
  }
  function exported() {
    const data =
      role === "owner"
        ? db
        : { role, branch, entries: visibleEntries(db, role) };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `nerdnuea-demo-${role}-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="demo-app">
      <header className="demo-header">
        <div className="demo-brand">
          <span className="brand-icon">
            <Beef size={24} />
          </span>
          <div>
            <strong>
              NerdNuea <span className="muted">Stock</span>
            </strong>
            <small>DEMO · บันทึกในเบราว์เซอร์นี้</small>
          </div>
        </div>
        <div className="header-actions">
          {role === "owner" && (
            <div className="notification-shell">
              <button
                type="button"
                className="bell-button"
                aria-label={`การแจ้งเตือน ${ownerNotifications.length} รายการ`}
                aria-expanded={showNotifications}
                onClick={() => setShowNotifications((value) => !value)}
              >
                <Bell size={19} />
                {ownerNotifications.length > 0 && <span className="notification-count">{ownerNotifications.length}</span>}
              </button>
              {showNotifications && (
                <section className="notification-popover" aria-label="รายการที่ Owner ต้องทำต่อ">
                  <div className="notification-heading">
                    <div><strong>การแจ้งเตือน</strong><span>{ownerNotifications.length ? `ต้องทำต่อ ${ownerNotifications.length} รายการ` : "ไม่มีงานค้าง"}</span></div>
                    <button type="button" className="text-button" onClick={() => setShowNotifications(false)}>ปิด</button>
                  </div>
                  {ownerNotifications.length ? (
                    <div className="notification-list">
                      {ownerNotifications.map((notification) => (
                        <button
                          type="button"
                          className="notification-item"
                          key={`${notification.tab}-${notification.title}`}
                          onClick={() => { setTab(notification.tab); setShowNotifications(false); }}
                        >
                          <span className="notification-dot"><CircleAlert size={15} /></span>
                          <span><strong>{notification.title}</strong><small>{notification.detail}</small></span>
                          <ArrowRight size={16} />
                        </button>
                      ))}
                    </div>
                  ) : <p className="notification-empty">ยังไม่มีงานที่ต้องทำต่อ</p>}
                </section>
              )}
            </div>
          )}
          <button className="secondary" onClick={exported}>
            <Download size={16} /> ส่งออก
          </button>
          {role === "owner" && (
            <button className="secondary" onClick={() => setReset(true)}>
              <RotateCcw size={16} /> เริ่มใหม่
            </button>
          )}
        </div>
      </header>
      <div className="demo-layout">
        <aside className="demo-sidebar">
          <span className="overline">บัญชีทดลอง</span>
          {roles.map((r) => (
            <button
              key={r.key}
              className={`role-button ${role === r.id && (!r.branch || branch === r.branch) ? "active" : ""}`}
              onClick={() => changeRole(r.id, r.branch)}
            >
              <r.icon size={20} />
              <span>
                <strong>{r.label}</strong>
                <small>{r.detail}</small>
              </span>
              {role === r.id && (!r.branch || branch === r.branch) && (
                <Check size={16} />
              )}
            </button>
          ))}
          <p className="sidebar-note">
            สลับบทบาทเพื่อทดลองส่งต่องาน
            <br />
            เป็นสิทธิ์จำลอง ยังไม่มีระบบล็อกอินจริง
          </p>
          <nav>
            {tabs
              .filter(
                (t) =>
                  role === "owner"
                    ? !["day", "branch-summary", "work", "food-diva"].includes(t.id)
                    : role === "fooddiva"
                      ? ["food-diva", "history"].includes(t.id)
                    : role === "cm"
                      ? ["cm-receive", "work", "stock", "history"].includes(t.id)
                      : ["day", "stock", "branch-summary", "history"].includes(t.id),
              )
              .sort((a, b) =>
                role === "branch"
                  ? ["day", "stock", "branch-summary", "history"].indexOf(a.id) -
                    ["day", "stock", "branch-summary", "history"].indexOf(b.id)
                  : 0,
              )
              .map((t) => (
                <button
                  key={t.id}
                  className={tab === t.id ? "selected" : ""}
                  onClick={() => setTab(t.id)}
                >
                  <t.icon size={18} />
                  {role === "owner" ? t.ownerLabel || t.label : t.label}
                  {role === "cm" && t.id === "cm-receive" && chefReceiveCount > 0 && (
                    <span className="menu-alert">{chefReceiveCount}</span>
                  )}
                  {role === "cm" && t.id === "work" && chefProductionCount > 0 && (
                    <span className="menu-alert">{chefProductionCount}</span>
                  )}
                  {role === "fooddiva" && t.id === "food-diva" && foodDivaTaskCount > 0 && (
                    <span className="menu-alert">{foodDivaTaskCount}</span>
                  )}
                  {role === "owner" && t.id === "transport" && ownerTransportCount > 0 && (
                    <span className="menu-alert">{ownerTransportCount}</span>
                  )}
                  {role === "owner" && t.id === "invoices" && ownerBillingCount + ownerFoodDivaInvoiceCount > 0 && (
                    <span className="menu-alert">{ownerBillingCount + ownerFoodDivaInvoiceCount}</span>
                  )}
                  {role === "owner" && t.id === "central-receive" && ownerCentralReceiveCount > 0 && (
                    <span className="menu-alert">{ownerCentralReceiveCount}</span>
                  )}
                  {role === "owner" && t.id === "branch-status" && ownerAllocationCount > 0 && (
                    <span className="menu-alert">{ownerAllocationCount}</span>
                  )}
                  {role === "owner" && t.id === "config" && missingMaterialSettings > 0 && (
                    <span className="menu-alert">{missingMaterialSettings}</span>
                  )}
                </button>
              ))}
          </nav>
        </aside>
        <main className="demo-main">
          <div className="page-heading">
            <div>
              <span className="overline">
                {roleName[role]}
                {role === "branch" ? ` · ${branch}` : ""}
              </span>
              <h1>{(() => { const current = tabs.find((t) => t.id === tab); return role === "owner" ? current?.ownerLabel || current?.label : current?.label; })()}</h1>
              <p className="muted">
                {role === "owner"
                  ? "จัดซื้อ จัดสรร ตั้งค่า และติดตามรายงานของทุกสาขา"
                  : role === "fooddiva"
                    ? "รับ PO ออก Invoice เก็บเนื้อรอรถ และยืนยันรับเนื้อรมควันกลับเข้าสต๊อก"
                  : role === "cm"
                    ? "รับเนื้อ ผลิต และส่งมอบสต๊อกกลับส่วนกลาง"
                    : "รับของ บันทึกการใช้ ขาย และปิดยอดประจำวัน"}
              </p>
            </div>
            <label className="date-select">
              วันที่ทำรายการ
              <input
                aria-label="วันที่ทำรายการ"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <button className="text-button" onClick={() => setDate(today())}>
                ใช้วันนี้
              </button>
            </label>
          </div>
          {toast && (
            <div role="status" className="notice success">
              {toast}
              <button aria-label="ปิดข้อความ" onClick={() => setToast("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {role === "owner" && missingMaterialSettings > 0 && tab !== "config" && (
            <div className="notice warning onboarding-notice">
              <span>
                ตั้งค่าวัสดุยังไม่ครบ {missingMaterialSettings} รายการ
                กรุณากำหนดจำนวนฐานและราคาต่อหน่วยก่อนส่งวัสดุครั้งถัดไป
              </span>
              <button className="secondary" onClick={() => setTab("config")}>
                ไปหน้าตั้งค่า
              </button>
            </div>
          )}
          {role === "owner" && ownerReturnReady.length > 0 && tab !== "transport" && (
            <div className="notice danger">
              <span>
                งานใหม่จาก Chef_house · ปิด Lot แล้ว {ownerReturnReady.length} รายการ · ต้องเรียกรถขากลับรวม {fmt(ownerReturnReady.reduce((total, item) => total + produced(db, item.id), 0))} กก.
              </span>
              <button className="secondary" onClick={() => setTab("transport")}>
                ไปเรียกรถขากลับ
              </button>
            </div>
          )}
          {role === "branch" && closed && (
            <div className="notice warning">
              วันที่ {date} ปิดแล้ว ฟอร์มวันนี้ถูกล็อก Owner
              ปลดล็อกได้จากหน้ารายงาน
            </div>
          )}
          {tab === "owner-dashboard" && role === "owner" && (
            <OwnerDashboard db={db} date={date} onNavigate={setTab} />
          )}
          {tab === "food-diva" && role === "fooddiva" && (
            <FoodDivaView db={db} open={open} />
          )}
          {tab === "invoices" && role === "owner" && (
            <InvoiceView db={db} open={open} />
          )}
          {tab === "cm-receive" && role === "cm" && (
            <ChefReceiveTable db={db} open={open} />
          )}
          {tab === "work" && role === "cm" && (
            <ChefLotTable db={db} lots={lots} open={open} />
          )}
          {tab === "work" && role !== "cm" && (
            <>
              <div className="section-heading">
                <h2>
                  {role === "owner"
                    ? "ใบสั่งซื้อและ Lot ทั้งหมด"
                    : `Lot ของสาขา ${branch}`}
                </h2>
              </div>
              {lots.length > 4 && (
                <input
                  className="search"
                  placeholder="ค้นหารหัส Lot"
                  aria-label="ค้นหารหัส Lot"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              )}
              {!lots.length ? (
                role === "owner" ? (
                  <Empty text="ยังไม่มี Lot · เริ่มสร้างรายการจากเมนูใบสั่งซื้อ PO" />
                ) : (
                  <Empty text="ยังไม่มีสต๊อก · รอ Owner จัดสรรจากสต๊อกกลางมายังสาขานี้" />
                )
              ) : (
                <div
                  className={`workspace-grid ${lots.length === 1 ? "single-lot" : ""}`}
                >
                  {lots.length > 1 && (
                    <div className="lot-list">
                      {lots
                        .filter((l) =>
                          l.id.toLowerCase().includes(search.toLowerCase()),
                        )
                        .map((l) => (
                          <button
                            key={l.id}
                            onClick={() => setChosen(l.id)}
                            className={`lot-choice ${lot?.id === l.id ? "active" : ""}`}
                          >
                            <strong>{l.id}</strong>
                            <small>{stages[l.stage]}</small>
                            <span>
                              {role === "branch"
                                ? `${fmt(balance(db, l.id, branch).received)} กก. รับแล้ว`
                                : role === "owner" && l.stage === 1
                                  ? "รอระบุขนส่ง"
                                  : `${fmt(n(l.values, "dispatchKg"))} กก. ส่งจากผู้ขาย`}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                  {lot && (
                    <div className="stack">
                      <section className="panel next-action">
                        <span className="overline">ทำรายการต่อจากตรงนี้</span>
                        <h2>
                          {lot.stage < 8
                            ? titles[stageAction[lot.stage]]
                            : "งานสต๊อกและสาขา"}
                        </h2>
                        {lot.stage < 8 ? (
                          <>
                            <p className="muted">
                              ผู้รับผิดชอบ · {roleName[stageRole[lot.stage]]}
                            </p>
                            {stageRole[lot.stage] === role ? (
                              <button
                                className="primary"
                                onClick={() => open(stageAction[lot.stage])}
                              >
                                เริ่มกรอกข้อมูล
                                <ArrowRight size={16} />
                              </button>
                            ) : (
                              <p className="notice">
                                งานนี้อยู่ที่บัญชี{" "}
                                <strong>
                                  {roleName[stageRole[lot.stage]]}
                                </strong>
                                <br />
                                เลือกบัญชีด้านซ้ายเพื่อทำต่อ
                              </p>
                            )}
                          </>
                        ) : role === "owner" ? (
                          <button
                            className="primary"
                            disabled={centralStock(db, lot.id) <= 0.001}
                            onClick={() => open("allocate")}
                          >
                            จัดสรรไปสาขา <ArrowRight size={16} />
                          </button>
                        ) : role === "branch" ? (
                          <div className="button-row">
                            {["receive", "thaw", "sale"].map((k) => (
                              <button
                                key={k}
                                disabled={closed}
                                className="primary"
                                onClick={() => open(k)}
                              >
                                {titles[k]}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="notice success">
                            ปิดงานผลิตแล้ว ข้อมูล Lot ถูกล็อก
                          </div>
                        )}
                      </section>
                      <LotDetails db={db} lot={lot} role={role} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {tab === "po" && role === "owner" && (
            <>
              <div className="section-heading">
                <div>
                  <h2>ใบสั่งซื้อเนื้อ (Purchase orders)</h2>
                  <p className="muted">สร้าง PO ใหม่และดูรายการที่เคยสร้าง</p>
                </div>
                <div className="button-row">
                  <button className="primary" onClick={() => open("purchase", "")}><Plus size={17} /> สร้าง PO เนื้อ</button>
                </div>
              </div>
              <DataTable
                title="รายการใบสั่งซื้อ PO"
                columns={["เลข PO", "Lot", "ลูกค้า / Attention", "สินค้า / ขนาดบรรจุ", "น้ำหนักสั่งซื้อ", "Invoice Food Diva", "สถานะ", "การทำงาน"]}
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
                      {!entries(db, "foodDivaConfirm", item.id).length ? <span className="badge danger">รอ Food Diva ออก Invoice</span>
                        : !entries(db, "smokeOrder", item.id).length ? <button className="table-action" onClick={() => setTab("smoke-po")}>ไปใบสั่ง PO โรงรมควัน</button>
                        : !entries(db, "smokeOrderAccept", item.id).length ? <span className="badge danger">รอ Chef_house รับ PO</span>
                        : !entries(db, "smokingInvoice", item.id).length ? <span className="badge danger">รอ Chef_house Submit ใบวางบิล</span>
                        : smokingInvoiceStatus(db, entries(db, "smokingInvoice", item.id).at(-1)!) === "รอตรวจยอด" ? <button className="table-action" onClick={() => open("invoiceReview", item.id)}>ตรวจ Invoice เพื่อเรียกรถ</button>
                        : smokingInvoiceStatus(db, entries(db, "smokingInvoice", item.id).at(-1)!) === "รอชำระ" ? <button className="table-action" onClick={() => open("invoicePayment", item.id)}>ชำระ Invoice เพื่อเรียกรถ</button>
                        : smokingInvoiceStatus(db, entries(db, "smokingInvoice", item.id).at(-1)!) === "ส่งกลับแก้ไข" ? <span className="badge danger">รอ Chef_house แก้ Invoice</span>
                        : item.stage === 1 ? <button className="table-action" onClick={() => open("dispatch", item.id)}>เรียกรถ / ทำใบขนส่ง</button>
                        : "ส่งต่อ Chef_house แล้ว"}
                      <DocumentPrintButton title="Purchase Order" number={item.poId} rows={purchaseOrderRows(item, db)} />
                    </div>
                  ) : <DocumentPrintButton title="Purchase Order" number={item.poId} rows={purchaseOrderRows(item, db)} />,
                ])}
              />
            </>
          )}
          {tab === "smoke-po" && role === "owner" && (
            <SmokingPurchaseOrderView db={db} open={open} />
          )}
          {tab === "documents" && role === "owner" && (
            <SimpleTraceabilityView db={db} />
          )}
          {tab === "transport" && role === "owner" && (
            <TransportManifestView db={db} open={open} />
          )}
          {tab === "central-receive" && role === "owner" && (
            <CentralReceiveView db={db} open={open} />
          )}
          {tab === "branch-status" && role === "owner" && (
            <>
              <div className="section-heading">
                <div>
                  <h2>จัดสรรเนื้อและสต๊อกไปสาขา</h2>
                  <p className="muted">เลือก Lot ที่มีเนื้อในสต๊อกกลาง แล้วระบุสาขาและน้ำหนักที่ต้องการส่ง</p>
                </div>
              </div>
              <MeatStockTable db={db} role={role} branch={branch} lots={lots} open={open} />
            </>
          )}
          {tab === "stock" && (
            <>
              <div className="section-heading">
                <h2>
                  {role === "owner"
                    ? "สต๊อกกลางและสาขา"
                    : role === "cm"
                      ? "ความคืบหน้างานผลิต"
                      : "สต๊อกแยก Lot"}
                </h2>
                {role === "owner" && (
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
                )}
              </div>
              {role === "owner" ? (
                <OwnerStockView db={db} lots={lots} open={open} />
              ) : (
                <>
                  <MeatStockTable
                    db={db}
                    role={role}
                    branch={branch}
                    lots={lots}
                    open={open}
                  />
                  {role !== "cm" && <SupplyStock db={db} branches={[branch]} />}
                  {role !== "cm" && (
                    <MaterialStockTable
                      db={db}
                      stockBranches={[branch]}
                      ownerView={false}
                    />
                  )}
                </>
              )}
            </>
          )}
          {tab === "meat-log" && role === "owner" && (
            <MeatMovementLogView db={db} />
          )}
          {tab === "branch-summary" && role === "branch" && (
            <>
              <div className="notice">
                ภาพรวมประจำวันที่ {date} · สาขา {branch}
              </div>
              <DailySummary db={db} date={date} branch={branch} />
              <SupplyStock db={db} branches={[branch]} />
            </>
          )}
          {tab === "day" && role === "branch" && (
            <>
              <div className="notice">
                วันที่ทำรายการ {date} · สาขา {branch} ·
                ข้าวคงเหลือยกไปวันถัดไปได้ ส่วนเนื้อละลายต้องขายหรือบันทึก Waste
                ให้หมดก่อนปิดวัน
              </div>
              <BranchDailyWorkflow db={db} branch={branch} date={date} lots={lots} closed={closed} open={open} />
              <MaterialReceiptConfirmation db={db} branch={branch} date={date} closed={closed} />
              <DailyMaterialsTable
                key={`${branch}-${date}`}
                db={db}
                branch={branch}
                date={date}
                disabled={closed || role !== "branch"}
              />
              <DailyTaskTable
                title={branch === "ศาลาแดง" ? "ข้าวเหนียวดิบ · ซื้อที่สาขาศาลาแดง" : "ข้าวเหนียวสุก · ซื้อที่สาขามีนบุรี"}
                kinds={[
                  "ricePurchase",
                  ...(branch === "ศาลาแดง" ? ["riceIssue"] : []),
                  branch === "มีนบุรี" ? "riceCarry" : "rice",
                ]}
                db={db}
                branch={branch}
                date={date}
                disabled={closed || role !== "branch"}
                hasLots={!!lots.length}
                open={open}
              />
              <ChiliDailySummary db={db} branch={branch} date={date} />
              <DailyTaskTable
                title="ยอดขายและปิดวัน (Sales & day close)"
                kinds={["sale", "closeDay"]}
                db={db}
                branch={branch}
                date={date}
                disabled={closed || role !== "branch"}
                hasLots={!!lots.length}
                open={open}
              />
            </>
          )}
          {tab === "report" && role === "owner" && (
            <>
              <div className="button-row">
                <button className="primary" onClick={() => open("expense", "")}>
                  <Plus size={16} /> ค่าใช้จ่าย Owner
                </button>
                <button
                  className="secondary"
                  onClick={() => open("unlock", "")}
                >
                  ปลดล็อกวัน
                </button>
              </div>
              <OwnerDailyStatus db={db} date={date} />
              <Report db={db} />
            </>
          )}
          {tab === "config" && role === "owner" && <ConfigView db={db} />}
          {tab === "history" && (
            <section className="panel">
              <h2>ประวัติรายการที่บันทึก</h2>
              <p className="muted">
                แสดงตามขอบเขตบัญชีทดลอง · กดรายการเพื่อดูค่าที่กรอก
              </p>
              {visibleEntries(db, role).length ? (
                [...visibleEntries(db, role)]
                  .reverse()
                  .map((e) => (
                    <EntryDetails
                      key={e.id}
                      entry={e}
                      owner={role === "owner"}
                      onChanged={(message) => setToast(message)}
                    />
                  ))
              ) : (
                <Empty text="ยังไม่มีประวัติ" />
              )}
            </section>
          )}
          <footer className="demo-footer">
            ข้อมูลทดลองเก็บในเบราว์เซอร์นี้ ·
            บัญชีทั้งหมดเป็นการจำลองสิทธิ์บนเครื่องเดียว
            ยังไม่ใช่การแยกข้อมูลที่ปลอดภัยสำหรับใช้งานจริง
          </footer>
        </main>
      </div>
      {modal?.kind === "materialTransfer" && (
        <MaterialTransferForm
          key={`material-transfer-${date}`}
          db={db}
          date={date}
          onClose={() => setModal(null)}
          onSaved={() => {
            setToast("บันทึกส่งวัสดุไปสาขาแล้ว");
            setModal(null);
          }}
        />
      )}
      {modal?.kind === "materialReceive" && (
        <MaterialPurchaseForm
          key={`material-purchase-${date}`}
          db={db}
          date={date}
          onClose={() => setModal(null)}
          onSaved={() => {
            setToast("บันทึกการซื้อวัสดุแล้ว");
            setModal(null);
          }}
        />
      )}
      {modal?.kind === "generalPurchase" && (
        <GeneralPurchaseForm
          key={`general-purchase-${date}`}
          date={date}
          onClose={() => setModal(null)}
          onSaved={() => {
            setToast("บันทึกการซื้ออื่น ๆ แล้ว");
            setModal(null);
          }}
        />
      )}
      {modal?.kind === "allocate" && (
        <BagAllocationForm db={db} lotId={modal.lotId} date={date} onClose={() => setModal(null)} onSaved={() => { setToast("จัดสรรถุงเนื้อไปสาขาแล้ว"); setModal(null); }} />
      )}
      {modal?.kind === "chefEdit" && (
        <ChefLotEditForm
          db={db}
          lotId={modal.lotId}
          onClose={() => setModal(null)}
          onSaved={() => {
            setToast("แก้ไขข้อมูล Lot แล้ว · ตรวจสอบก่อนกดยืนยันปิด Lot");
            setModal(null);
          }}
        />
      )}
      {modal?.kind === "smokeOrderPreview" && (
        <SmokeOrderPreviewDialog
          db={db}
          lotId={modal.lotId}
          onClose={() => setModal(null)}
        />
      )}
      {modal && !["materialReceive", "generalPurchase", "materialTransfer", "allocate", "chefEdit", "smokeOrderPreview"].includes(modal.kind) && (
        <EntryForm
          key={`${modal.kind}-${modal.lotId}`}
          db={db}
          role={role}
          date={date}
          modal={modal}
          onClose={() => setModal(null)}
          onSaved={(next) => {
            setChosen(next.lots.at(-1)?.id || chosen);
            if (modal.kind === "purchase") {
              setTab("po");
              setToast("สร้างใบ PO แล้ว · รอ Food Diva ยืนยัน Invoice และน้ำหนักก่อนทำใบขนส่ง");
            } else {
              setToast(`บันทึก${titles[modal.kind]}แล้ว`);
            }
            setModal(null);
          }}
        />
      )}
      {reset && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="เริ่มเดโมใหม่"
            className="reset-panel"
          >
            <h2>เริ่มเดโมใหม่?</h2>
            <p>
              ลบเฉพาะข้อมูลเดโมชุดนี้ในเบราว์เซอร์
              ควรส่งออกก่อนหากต้องการเก็บไว้
            </p>
            <div className="button-row">
              <button className="secondary" onClick={() => setReset(false)}>
                ยกเลิก
              </button>
              <button
                className="secondary"
                onClick={() => {
                  try {
                    saveDatabase(sevenDayRoleplay(date));
                    setChosen("");
                    setReset(false);
                    setTab("owner-dashboard");
                    setToast("โหลดข้อมูลทดสอบครบ 7 วันแล้ว");
                  } catch (error) {
                    setToast(error instanceof Error ? error.message : "สร้างข้อมูลทดสอบไม่สำเร็จ");
                    setReset(false);
                  }
                }}
              >
                โหลดข้อมูลทดสอบ 7 วัน
              </button>
              <button
                className="secondary"
                onClick={() => {
                  try {
                    saveDatabase(thirtyDayRoleplay(date));
                    setChosen("");
                    setReset(false);
                    setTab("owner-dashboard");
                    setToast("โหลดข้อมูลทดสอบครบ 30 วันแล้ว");
                  } catch (error) {
                    setToast(error instanceof Error ? error.message : "สร้างข้อมูลทดสอบไม่สำเร็จ");
                    setReset(false);
                  }
                }}
              >
                โหลดข้อมูลทดสอบ 30 วัน
              </button>
              <button
                className="primary"
                onClick={() => {
                  try {
                    saveDatabase(structuredClone(seed));
                    setChosen("");
                    setReset(false);
                    setToast("เริ่มชุดข้อมูลใหม่แล้ว");
                  } catch {
                    setToast("บันทึกไม่ได้ กรุณาตรวจพื้นที่จัดเก็บเบราว์เซอร์");
                  }
                }}
              >
                ยืนยันเริ่มใหม่
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function BagAllocationForm({ db, lotId, date, onClose, onSaved }: { db: Database; lotId: string; date: string; onClose: () => void; onSaved: () => void }) {
  const bags = availableBags(db, lotId);
  const [destinations, setDestinations] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      let next = latestDatabase();
      let count = 0;
      for (const branchName of branches) {
        const selected = bags.filter((bag) => destinations[bag.id] === branchName);
        if (!selected.length) continue;
        next = mutate(next, "owner", "allocate", { branch: branchName, bagIds: selected.map((bag) => bag.id).join(","), deliveryDate: date }, lotId, date);
        count += selected.length;
      }
      if (!count) throw new Error("เลือกสาขาปลายทางอย่างน้อย 1 ถุง");
      saveDatabase(next);
      onSaved();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "จัดสรรไม่สำเร็จ"); }
  }
  return <div className="modal-backdrop"><section className="form-dialog" role="dialog" aria-modal="true"><header><div><span className="overline">{lotId}</span><h2>จัดสรรถุงเนื้อไปสาขา</h2></div><button type="button" className="icon-button" onClick={onClose}><X /></button></header><form onSubmit={submit}><div className="form-body"><DataTable title="เลือกปลายทางทีละถุง" columns={["ถุง", "น้ำหนัก", "สาขาปลายทาง"]} rows={bags.map((bag, index) => [`ถุงที่ ${index + 1}`, `${fmt(bag.weight)} กก.`, <select key={bag.id} value={destinations[bag.id] || ""} onChange={(event) => setDestinations((current) => ({ ...current, [bag.id]: event.target.value }))}><option value="">ยังไม่จัดสรร</option>{branches.map((name) => <option key={name}>{name}</option>)}</select>])} />{error && <div className="notice warning">{error}</div>}</div><footer><p>เลือกหลายถุงและส่งให้ทั้งสองสาขาได้ในครั้งเดียว</p><button type="button" className="secondary" onClick={onClose}>ยกเลิก</button><button className="primary">บันทึกการจัดสรร</button></footer></form></section></div>;
}
function MaterialTransferForm({
  db,
  date,
  onClose,
  onSaved,
}: {
  db: Database;
  date: string;
  onClose: () => void;
  onSaved: (db: Database) => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Values>({});
  const [receivers, setReceivers] = useState<Values>({});
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const key = (index: number, branch: string) => `${index}-${branch}`;
  const selectedFor = (branch: string) =>
    materials.some((_, index) => checked[key(index, branch)]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      let next = latestDatabase();
      let count = 0;
      for (const [index, material] of materials.entries()) {
        for (const branch of branches) {
          const field = key(index, branch);
          if (!checked[field]) continue;
          const quantity = Number(quantities[field]);
          if (!Number.isInteger(quantity) || quantity <= 0)
            throw new Error(`กรอกจำนวน ${material} ที่ส่งไป${branch}`);
          if (!receivers[branch]?.trim())
            throw new Error(`กรอกชื่อผู้รับของสาขา${branch}`);
          next = mutate(
            next,
            "owner",
            "materialTransfer",
            {
              material,
              branch,
              quantity: String(quantity),
              receiver: receivers[branch],
              reference,
              note,
            },
            "",
            date,
          );
          count++;
        }
      }
      if (!count) throw new Error("ติ๊กเลือกวัสดุและสาขาที่ต้องการส่ง");
      saveDatabase(next);
      onSaved(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <div className="modal-backdrop">
      <section role="dialog" aria-modal="true" aria-labelledby="transfer-title" className="form-dialog material-transfer-dialog">
        <header>
          <div>
            <span className="overline">{date} · Owner</span>
            <h2 id="transfer-title">ส่งวัสดุไปสาขา</h2>
          </div>
          <button type="button" className="icon-button" aria-label="ปิดฟอร์ม" onClick={onClose}>
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="form-body">
            <div className="notice">ติ๊กสาขาที่ต้องการส่ง แล้วกรอกจำนวน สามารถเลือกหลายรายการและบันทึกพร้อมกันได้</div>
            <div className="table-scroll transfer-table">
              <table>
                <thead>
                  <tr>
                    <th>วัสดุ</th>
                    <th>คลัง Owner</th>
                    {branches.map((branch) => <th key={branch}>{branch}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {materials.map((material, index) => (
                    <tr key={material}>
                      <td><strong>{material}</strong></td>
                      <td>{ownerMaterialStock(db, material)} ชิ้น</td>
                      {branches.map((branch) => {
                        const field = key(index, branch);
                        return (
                          <td key={branch}>
                            <div className="transfer-cell">
                              <input
                                type="checkbox"
                                aria-label={`ส่ง ${material} ไป${branch}`}
                                checked={!!checked[field]}
                                onChange={(event) => {
                                  setChecked((current) => ({ ...current, [field]: event.target.checked }));
                                  setError("");
                                }}
                              />
                              <input
                                type="number"
                                min="1"
                                step="1"
                                placeholder="จำนวน"
                                aria-label={`จำนวน ${material} ไป${branch}`}
                                disabled={!checked[field]}
                                value={quantities[field] || ""}
                                onChange={(event) => setQuantities((current) => ({ ...current, [field]: event.target.value }))}
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-grid transfer-meta">
              {branches.map((branch) => (
                <label className="field" key={branch}>
                  ผู้รับของสาขา{branch}
                  <input
                    value={receivers[branch] || ""}
                    disabled={!selectedFor(branch)}
                    required={selectedFor(branch)}
                    onChange={(event) => setReceivers((current) => ({ ...current, [branch]: event.target.value }))}
                  />
                </label>
              ))}
              <label className="field">
                เลขที่ใบส่งของ (ถ้ามี)
                <input value={reference} onChange={(event) => setReference(event.target.value)} />
              </label>
              <label className="field">
                หมายเหตุ (ถ้ามี)
                <input value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
            </div>
            {error && <div role="alert" className="notice danger">{error}</div>}
          </div>
          <footer>
            <p>ทุกรายการจะบันทึกพร้อมกัน</p>
            <button type="button" className="secondary" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="primary">บันทึกส่งวัสดุ</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function MaterialPurchaseForm({
  db,
  date,
  onClose,
  onSaved,
}: {
  db: Database;
  date: string;
  onClose: () => void;
  onSaved: (db: Database) => void;
}) {
  const purchaseLines = [
    ...materials.map((material) => ({
      key: `material-${material}`,
      label: material,
      unit: "ชิ้น",
    })),
  ];
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Values>({});
  const [unitPrices, setUnitPrices] = useState<Values>({});
  const [purchaseDates, setPurchaseDates] = useState<Values>({});
  const [suppliers, setSuppliers] = useState<Values>({});
  const [references, setReferences] = useState<Values>({});
  const [error, setError] = useState("");
  const selected = purchaseLines.filter((line) => checked[line.key]);
  const total = selected.reduce(
    (sum, line) => sum + n(quantities, line.key) * n(unitPrices, line.key),
    0,
  );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (!selected.length) throw new Error("ติ๊กเลือกอย่างน้อย 1 รายการ");
      let next = latestDatabase();
      for (const line of selected) {
        const item = line.label;
        const purchaseDate = purchaseDates[line.key] || date;
        const quantity = Number(quantities[line.key]);
        const unitPrice = Number(unitPrices[line.key]);
        const supplier = suppliers[line.key]?.trim();
        const reference = references[line.key]?.trim() || "";
        if (!purchaseDate) throw new Error(`เลือกวันที่ซื้อ ${item}`);
        if (!supplier) throw new Error(`กรอกผู้จำหน่าย ${item}`);
        if (!Number.isInteger(quantity) || quantity <= 0)
          throw new Error(`กรอกจำนวน ${item} เป็นจำนวนเต็มที่มากกว่า 0`);
        if (!Number.isFinite(unitPrice) || unitPrice < 0)
          throw new Error(`กรอกราคาซื้อ ${item}`);
        next = mutate(
          next,
          "owner",
          "materialReceive",
          { purchaseDate, material: item, quantity: String(quantity), unitPrice: String(unitPrice), supplier, reference },
          "",
          purchaseDate,
        );
      }
      saveDatabase(next);
      onSaved(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกการซื้อวัสดุไม่สำเร็จ");
    }
  }

  return (
    <div className="modal-backdrop">
      <section role="dialog" aria-modal="true" aria-labelledby="material-purchase-title" className="form-dialog material-transfer-dialog material-purchase-dialog">
        <header>
          <div>
            <span className="overline">Owner · สต๊อกวัสดุ</span>
            <h2 id="material-purchase-title">ซื้อวัสดุเข้าคลัง</h2>
          </div>
          <button type="button" className="icon-button" aria-label="ปิดฟอร์ม" onClick={onClose}><X /></button>
        </header>
        <form onSubmit={submit}>
          <div className="form-body">
            <div className="notice">ติ๊กวัสดุที่ซื้อ แล้วกรอกวันที่ซื้อ ผู้จำหน่าย และเลขอ้างอิงของรายการนั้นเอง ระบบจะเพิ่มจำนวนเข้า Owner Stock</div>
            <div className="material-purchase-list">
              {purchaseLines.map((line) => {
                const selectedRow = !!checked[line.key];
                const amount = n(quantities, line.key) * n(unitPrices, line.key);
                return (
                  <article key={line.key} className={`material-purchase-item ${selectedRow ? "selected-row" : ""}`}>
                    <label className="material-purchase-toggle">
                      <input type="checkbox" aria-label={`ซื้อ ${line.label}`} checked={selectedRow} onChange={(event) => { setChecked((current) => ({ ...current, [line.key]: event.target.checked })); setError(""); }} />
                      <span><strong>{line.label}</strong><small>คงคลัง Owner {fmt(ownerMaterialStock(db, line.label))} ชิ้น</small></span>
                      <b>{selectedRow ? `ยอดซื้อ ฿${fmt(amount)}` : "ติ๊กเพื่อกรอก"}</b>
                    </label>
                    {selectedRow && (
                      <div className="material-purchase-fields">
                        <label className="field">วันที่ซื้อ<input type="date" aria-label={`วันที่ซื้อ ${line.label}`} value={purchaseDates[line.key] ?? date} onChange={(event) => setPurchaseDates((current) => ({ ...current, [line.key]: event.target.value }))} /></label>
                        <label className="field">จำนวนที่ซื้อ<input type="number" min="1" step="1" inputMode="numeric" aria-label={`จำนวนซื้อ ${line.label}`} placeholder="จำนวน" value={quantities[line.key] || ""} onChange={(event) => setQuantities((current) => ({ ...current, [line.key]: event.target.value }))} /></label>
                        <label className="field">ราคาซื้อ / หน่วย<input type="number" min="0" step="0.01" inputMode="decimal" aria-label={`ราคาซื้อ ${line.label}`} placeholder="0.00" value={unitPrices[line.key] || ""} onChange={(event) => setUnitPrices((current) => ({ ...current, [line.key]: event.target.value }))} /></label>
                        <label className="field">ผู้จำหน่าย<input type="text" aria-label={`ผู้จำหน่าย ${line.label}`} placeholder="ผู้ขาย" value={suppliers[line.key] || ""} onChange={(event) => setSuppliers((current) => ({ ...current, [line.key]: event.target.value }))} /></label>
                        <label className="field">เลขอ้างอิง / ใบเสร็จ<input type="text" aria-label={`ใบเสร็จ ${line.label}`} placeholder="เลขที่ (ถ้ามี)" value={references[line.key] || ""} onChange={(event) => setReferences((current) => ({ ...current, [line.key]: event.target.value }))} /></label>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            <div className="notice success material-purchase-summary">เลือก {selected.length} รายการ · ยอดซื้อรวม ฿{fmt(total)}</div>
            {error && <div role="alert" className="notice danger">{error}</div>}
          </div>
          <footer>
            <p>บันทึกครั้งเดียวได้หลายวัสดุ</p>
            <button type="button" className="secondary" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="primary">บันทึกการซื้อ {selected.length ? `${selected.length} รายการ` : ""}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

type GeneralPurchaseLine = {
  id: string;
  purchaseDate: string;
  category: string;
  item: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  supplier: string;
  reference: string;
};

function newGeneralPurchaseLine(date: string): GeneralPurchaseLine {
  return {
    id: crypto.randomUUID(),
    purchaseDate: date,
    category: "วัตถุดิบ",
    item: "",
    unit: "ชิ้น",
    quantity: "",
    unitPrice: "",
    supplier: "",
    reference: "",
  };
}

function GeneralPurchaseForm({
  date,
  onClose,
  onSaved,
}: {
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const standardIngredients = ["น้ำพริกหลอด", "น้ำดอง", "ข้าวเหนียวดิบ (ข้าวสาร)"];
  let savedIngredients: string[] = [];
  try {
    const parsed = JSON.parse(latestDatabase().config.customIngredients || "[]");
    if (Array.isArray(parsed)) savedIngredients = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    savedIngredients = [];
  }
  const ingredientOptions = Array.from(new Set([...standardIngredients, ...savedIngredients]));
  const ingredientUnits: Record<string, string> = {
    "น้ำพริกหลอด": "หลอด",
    "น้ำดอง": "มล.",
    "ข้าวเหนียวดิบ (ข้าวสาร)": "กก.",
  };
  const [lines, setLines] = useState<GeneralPurchaseLine[]>(() => [newGeneralPurchaseLine(date)]);
  const [error, setError] = useState("");
  const total = lines.reduce(
    (sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0),
    0,
  );
  const update = (id: string, key: keyof Omit<GeneralPurchaseLine, "id">, value: string) => {
    setLines((current) => current.map((line) => line.id === id ? { ...line, [key]: value } : line));
    setError("");
  };
  const chooseIngredient = (id: string, item: string) => {
    setLines((current) => current.map((line) => line.id === id ? {
      ...line,
      item,
      unit: ingredientUnits[item] || line.unit,
    } : line));
    setError("");
  };
  const addLine = () => setLines((current) => [...current, newGeneralPurchaseLine(date)]);
  const removeLine = (id: string) => setLines((current) => current.length === 1 ? current : current.filter((line) => line.id !== id));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      let next = latestDatabase();
      const addedIngredients = new Set(savedIngredients);
      for (const line of lines) {
        const item = line.item.trim();
        const supplier = line.supplier.trim();
        const quantity = Number(line.quantity);
        const unitPrice = Number(line.unitPrice);
        if (!item || item === "__custom__") throw new Error("กรอกรายการที่ซื้อให้ครบ");
        if (line.category === "วัตถุดิบ" && /เนื้อ/.test(item))
          throw new Error("เนื้อให้สร้างผ่านใบสั่งซื้อ PO และยืนยันรับจาก Food Diva เพื่อเชื่อม Lot และสต๊อกให้ถูกต้อง");
        if (!line.purchaseDate) throw new Error(`เลือกวันที่ซื้อ ${item}`);
        if (!supplier) throw new Error(`กรอกผู้จำหน่าย ${item}`);
        if (!line.unit.trim()) throw new Error(`กรอกหน่วยของ ${item}`);
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`กรอกจำนวน ${item}`);
        if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error(`กรอกราคาซื้อ ${item}`);
        next = mutate(next, "owner", "generalPurchase", {
          purchaseDate: line.purchaseDate,
          purchaseCategory: line.category,
          item,
          unit: line.unit.trim(),
          quantity: String(quantity),
          unitPrice: String(unitPrice),
          supplier,
          reference: line.reference.trim(),
        }, "", line.purchaseDate);
        if (line.category === "วัตถุดิบ" && !standardIngredients.includes(item)) addedIngredients.add(item);
      }
      next = {
        ...next,
        config: { ...next.config, customIngredients: JSON.stringify(Array.from(addedIngredients).sort((a, b) => a.localeCompare(b, "th"))) },
      };
      saveDatabase(next);
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกการซื้ออื่น ๆ ไม่สำเร็จ");
    }
  }

  return (
    <div className="modal-backdrop">
      <section role="dialog" aria-modal="true" aria-labelledby="general-purchase-title" className="form-dialog material-transfer-dialog general-purchase-dialog">
        <header>
          <div>
            <span className="overline">Owner · บัญชี</span>
            <h2 id="general-purchase-title">บันทึกการซื้ออื่น ๆ</h2>
          </div>
          <button type="button" className="icon-button" aria-label="ปิดฟอร์ม" onClick={onClose}><X /></button>
        </header>
        <form onSubmit={submit}>
          <div className="form-body">
            <div className="notice">เลือกกลุ่มการซื้อของแต่ละรายการได้ เช่น วัตถุดิบ (น้ำพริกหลอด น้ำดอง ข้าวเหนียวดิบ) หรือสินทรัพย์ (ตู้เย็น) · เนื้อให้สร้างผ่าน PO และรับจาก Food Diva เพื่อผูก Lot กับสต๊อก</div>
            <div className="general-purchase-list">
              {lines.map((line, index) => {
                const amount = Number(line.quantity || 0) * Number(line.unitPrice || 0);
                const isIngredient = line.category === "วัตถุดิบ";
                const customIngredient = isIngredient && line.item !== "" && !ingredientOptions.includes(line.item);
                const ingredientChoice = customIngredient ? "__custom__" : line.item;
                const fixedUnit = isIngredient ? ingredientUnits[line.item] : undefined;
                return (
                  <article key={line.id} className="general-purchase-item">
                    <div className="general-purchase-item-head"><strong>รายการซื้อ {index + 1}</strong><span>ยอดรวม ฿{fmt(amount)}</span><button type="button" className="line-delete" aria-label={`ลบรายการ ${index + 1}`} disabled={lines.length === 1} onClick={() => removeLine(line.id)}>ลบ</button></div>
                    <div className="general-purchase-fields">
                      <label className="field">กลุ่มการซื้อ<select aria-label={`กลุ่มการซื้อ ${index + 1}`} value={line.category} onChange={(event) => update(line.id, "category", event.target.value)}><option>วัตถุดิบ</option><option>สินทรัพย์</option><option>ค่าใช้จ่ายอื่น</option></select></label>
                      {isIngredient ? (
                        <label className="field">วัตถุดิบ<select aria-label={`เลือกวัตถุดิบ ${index + 1}`} value={ingredientChoice} onChange={(event) => chooseIngredient(line.id, event.target.value)}><option value="">เลือกวัตถุดิบ</option>{ingredientOptions.map((item) => <option key={item} value={item}>{item}</option>)}<option value="__custom__">+ เพิ่มวัตถุดิบใหม่</option></select>{customIngredient && <input aria-label={`ชื่อวัตถุดิบใหม่ ${index + 1}`} placeholder="พิมพ์ชื่อวัตถุดิบใหม่" value={line.item === "__custom__" ? "" : line.item} onChange={(event) => update(line.id, "item", event.target.value)} />}</label>
                      ) : <label className="field">รายการ<input type="text" aria-label={`รายการซื้อ ${index + 1}`} placeholder="เช่น ตู้เย็น" value={line.item} onChange={(event) => update(line.id, "item", event.target.value)} /></label>}
                      <label className="field">วันที่ซื้อ<input type="date" aria-label={`วันที่ซื้อ ${index + 1}`} value={line.purchaseDate} onChange={(event) => update(line.id, "purchaseDate", event.target.value)} /></label>
                      <label className="field">จำนวน<input type="number" min="0.01" step="0.01" inputMode="decimal" aria-label={`จำนวน ${index + 1}`} placeholder="จำนวน" value={line.quantity} onChange={(event) => update(line.id, "quantity", event.target.value)} /></label>
                      <label className="field">หน่วย<input type="text" aria-label={`หน่วย ${index + 1}`} placeholder="เช่น หลอด, มล., เครื่อง" value={fixedUnit || line.unit} disabled={!!fixedUnit} onChange={(event) => update(line.id, "unit", event.target.value)} /></label>
                      <label className="field">ราคาซื้อ / หน่วย<input type="number" min="0" step="0.01" inputMode="decimal" aria-label={`ราคาต่อหน่วย ${index + 1}`} placeholder="0.00" value={line.unitPrice} onChange={(event) => update(line.id, "unitPrice", event.target.value)} /></label>
                      <label className="field">ผู้จำหน่าย<input type="text" aria-label={`ผู้จำหน่าย ${index + 1}`} placeholder="ผู้ขาย" value={line.supplier} onChange={(event) => update(line.id, "supplier", event.target.value)} /></label>
                      <label className="field">เลขอ้างอิง / ใบเสร็จ<input type="text" aria-label={`ใบเสร็จ ${index + 1}`} placeholder="เลขที่ (ถ้ามี)" value={line.reference} onChange={(event) => update(line.id, "reference", event.target.value)} /></label>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="button-row general-purchase-actions"><button type="button" className="secondary" onClick={addLine}><Plus size={16} /> เพิ่มรายการ</button><span className="notice success">{lines.length} รายการ · ยอดซื้อรวม ฿{fmt(total)}</span></div>
            {error && <div role="alert" className="notice danger">{error}</div>}
          </div>
          <footer>
            <p>กดเพิ่มรายการเพื่อบันทึกได้ต่อเนื่อง</p>
            <button type="button" className="secondary" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="primary">บันทึก {lines.length} รายการ</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function EntryForm({
  db,
  role,
  date,
  modal,
  onClose,
  onSaved,
}: {
  db: Database;
  role: Role;
  date: string;
  modal: Modal;
  onClose: () => void;
  onSaved: (db: Database) => void;
}) {
  const kind = modal.kind;
  const [values, setValues] = useState<Values>(() => {
    const base = kind === "config" ? { ...db.config } : defaults(kind, date);
    const modalLot = db.lots.find((item) => item.id === modal.lotId);
    if (kind === "closeDay") base.time = db.config.closeTime || "22:00";
    if (kind === "dispatch" && modalLot) Object.assign(base, {
      dispatchKg: String(readyForChefHouse(db, modalLot.id)),
      origin: "Food Diva · กรุงเทพฯ",
      destination: "Chef_house · เชียงใหม่",
    });
    if (kind === "smokeOrder" && modalLot) Object.assign(base, {
      rawKg: String(readyForChefHouse(db, modalLot.id)),
    });
    if (kind === "return" && modalLot) Object.assign(base, {
      returnKg: String(produced(db, modalLot.id)),
      origin: "Chef_house · เชียงใหม่",
      destination: "Food Diva · กรุงเทพฯ",
    });
    if (kind === "purchase") Object.assign(base, {
      customerName: db.config.companyName || "",
      customerAddress: db.config.companyAddress || "",
      attention: db.config.attention || "",
      phone: db.config.companyPhone || "",
      taxId: db.config.taxId || "",
      productName: "เนื้อวัว",
    });
    return base;
  });
  const [lotId, setLotId] = useState(modal.lotId);
  const [error, setError] = useState("");
  const attachmentFiles = useRef<Record<string, File>>({});
  const lot = db.lots.find((l) => l.id === lotId);
  const useLot = ["receive", "thaw", "sale", "allocate"].includes(kind);
  const choices = db.lots.filter(
    (l) =>
      l.stage >= 8 &&
      (role === "owner" ||
        entries(db, "allocate", l.id, db.config.branch).length),
  );
  const allocations = entries(db, "allocate", lotId, db.config.branch)
    .map((e) => ({
      entry: e,
      outstanding:
        n(e.values, "kg") -
        entries(db, "receive", lotId, db.config.branch)
          .filter((r) => r.values.allocation === e.id)
          .reduce((s, r) => s + n(r.values, "kg"), 0),
    }))
    .filter((a) => a.outstanding > 0.001);
  const formFields = (forms[kind] || []).filter((field) => {
    if (kind === "smoke" && field.key === "packs") return false;
    if (kind === "supplyPurchase" || kind === "ricePurchase")
      return db.config.branch === "มีนบุรี"
        ? !["rawRiceKg", "rawRiceCost"].includes(field.key)
        : !["cookedRiceKg", "cookedRiceCost"].includes(field.key);
    if (kind === "supplyIssue" && db.config.branch === "มีนบุรี")
      return field.key !== "rawRiceIssuedKg";
    return true;
  });
  const set = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setError("");
  };
  const isPurchaseOrder = kind === "purchase" || kind === "smokeOrder";
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const resolvedValues = { ...values };
      for (const key of ["origin", "destination"]) {
        if (resolvedValues[key] === "อื่น ๆ") {
          const custom = resolvedValues[`${key}Custom`]?.trim();
          if (!custom) throw new Error(`กรุณาระบุ${key === "origin" ? "ต้นทาง" : "ปลายทาง"}เอง`);
          resolvedValues[key] = custom;
        }
      }
      for (const [key, file] of Object.entries(attachmentFiles.current)) {
        resolvedValues[`${key}StorageKey`] = await saveAttachment(file);
      }
      const current = await migrateLegacyAttachments(latestDatabase());
      const next = mutate(current, role, kind, resolvedValues, lotId, date);
      saveDatabase(next);
      onSaved(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    }
  }
  return (
    <div
      className="modal-backdrop"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-title"
        className={`form-dialog ${isPurchaseOrder ? "po-preview-dialog" : ""}`}
      >
        <header>
          <div>
            <span className="overline">
              {date} · {roleName[role]}
            </span>
            <h2 id="form-title">
              {kind === "purchase"
                ? "สร้าง PO เนื้อ"
                : kind === "smokeOrder"
                  ? "สร้าง PO โรงรมควัน"
                  : kind === "ricePurchase" && db.config.branch === "ศาลาแดง"
                    ? "ซื้อข้าวเหนียวดิบเข้าสต๊อก · กิโลกรัม"
                  : titles[kind]}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="ปิดฟอร์ม"
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className={isPurchaseOrder ? "po-preview-layout" : "form-content"}>
          <div className={`form-body ${isPurchaseOrder ? "po-preview-form" : ""}`}>
            {isPurchaseOrder && (
              <div className="notice po-preview-notice">
                กรอกข้อมูลด้านซ้าย เอกสาร PO ด้านขวาจะเปลี่ยนตามทันที
              </div>
            )}
            {lot && !useLot && (
              <div className="notice">
                {lot.id} · {stages[lot.stage]}
              </div>
            )}
            {useLot && (
              <label className="field">
                Lot ต้นทาง
                <select
                  autoFocus
                  value={lotId}
                  required
                  onChange={(e) => {
                    setLotId(e.target.value);
                    set("allocation", "");
                  }}
                >
                  <option value="">เลือก Lot</option>
                  {choices.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.id} ·{" "}
                      {kind === "allocate"
                        ? `${fmt(centralStock(db, l.id))} กก. · ${centralBagStock(db, l.id)} ถุงในคลังกลาง`
                        : `${fmt(balance(db, l.id, db.config.branch).frozen)} แช่แข็ง / ${fmt(balance(db, l.id, db.config.branch).ready)} พร้อมขาย`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {kind === "receive" && (
              <label className="field">
                ใบจัดสรรที่รับ
                <select
                  required
                  value={values.allocation || ""}
                  onChange={(e) => set("allocation", e.target.value)}
                >
                  <option value="">เลือกใบจัดสรร</option>
                  {allocations.map((a) => (
                    <option key={a.entry.id} value={a.entry.id}>
                      {a.entry.date} · ค้างรับ {fmt(a.outstanding)} กก. ·{" "}
                      {a.entry.id.slice(0, 6)}
                    </option>
                  ))}
                </select>
                {!allocations.length && (
                  <small>ยังไม่มีใบจัดสรรค้างรับของ Lot นี้</small>
                )}
              </label>
            )}
            {kind === "closeDay" && (
              <DailySummary db={db} branch={db.config.branch} date={date} />
            )}
            {kind === "smoke" && (
              <div className="notice">
                บันทึกครั้งละ 1 รอบสโมค ระบบจะสร้าง Lot สโมครายวันแยกให้ และเก็บวันที่ จำนวนถุง น้ำหนักถุง และ Waste ใน Log
              </div>
            )}
            {kind === "foodDivaConfirm" && (
              <div className="notice">
                แบ่งน้ำหนักตาม Invoice ให้ครบทุกกิโล: พร้อมส่ง Chef_house ที่เชียงใหม่ + เนื้อส่วนที่เหลือรอ Owner รับ (Waste) ต้องรวมเท่ากับน้ำหนักตาม Invoice
              </div>
            )}
            {kind === "unlock" && (
              <div className="notice warning">
                ปลดล็อกให้เพิ่มรายการแก้ไขของสาขาได้ ประวัติเดิมจะยังอยู่ ยอดขาย
                สต๊อก และรายงานจะคำนวณเพิ่มจากรายการใหม่
              </div>
            )}
            {(kind === "supplyPurchase" || kind === "ricePurchase") &&
              db.config.branch === "มีนบุรี" && (
              <div className="notice">
                ข้าวเหนียวสุกคงเหลือ{" "}
                {fmt(cookedRiceStock(db, db.config.branch))} กก. ·
                ควรซื้อเพิ่มอย่างน้อย{" "}
                {fmt(
                  Math.max(
                    0,
                    n(db.config, "cookedRicePar") -
                      cookedRiceStock(db, db.config.branch),
                  ),
                )}{" "}
                กก. เพื่อให้พร้อมขายไม่น้อยกว่า{" "}
                {fmt(n(db.config, "cookedRicePar"))} กก.
                {cookedRiceStock(db, db.config.branch) <= 0.001
                  ? " · วันแรกปกติซื้อประมาณ 31–33 กก."
                  : " · ระบบหักของเหลือที่นำกลับมาอุ่นแล้ว จึงซื้อวันถัดไปน้อยลงได้"}
              </div>
            )}
            <div className="form-grid">
              {formFields.map((f, index) => (
                <label
                  className={`field ${f.type === "textarea" ? "wide" : ""}`}
                  key={f.key}
                >
                  {f.label}
                  {f.optional && <span className="optional"> (ถ้ามี)</span>}
                  {f.type === "select" ? (
                    <select
                      value={values[f.key] || ""}
                      required={!f.optional}
                      onChange={(e) => set(f.key, e.target.value)}
                    >
                      {f.options!.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : f.type === "location" ? (
                    <>
                      <select
                        value={values[f.key] || ""}
                        required
                        onChange={(e) => set(f.key, e.target.value)}
                      >
                        {f.options!.map((o) => <option key={o}>{o}</option>)}
                      </select>
                      {values[f.key] === "อื่น ๆ" && (
                        <input
                          autoFocus
                          placeholder="พิมพ์จังหวัด / จุดส่งเอง"
                          value={values[`${f.key}Custom`] || ""}
                          onChange={(e) => set(`${f.key}Custom`, e.target.value)}
                        />
                      )}
                    </>
                  ) : f.type === "file" ? (
                    <div className="file-upload-control">
                      <input
                        type="file"
                        accept={f.accept}
                        required={!f.optional}
                        onChange={(e) => {
                          const file = e.currentTarget.files?.[0];
                          if (!file) {
                            set(f.key, "");
                            delete attachmentFiles.current[f.key];
                            return;
                          }
                          if (file.size > 2 * 1024 * 1024) {
                            setError("ไฟล์ Invoice ต้องมีขนาดไม่เกิน 2 MB");
                            e.currentTarget.value = "";
                            return;
                          }
                          attachmentFiles.current[f.key] = file;
                          set(f.key, file.name);
                        }}
                      />
                      {values[f.key] && (
                        <span className="file-uploaded">เลือกแล้ว: {values[f.key]}</span>
                      )}
                    </div>
                  ) : f.type === "textarea" ? (
                    <textarea
                      className={f.key === "note" ? "compact-note" : undefined}
                      required={!f.optional}
                      rows={f.key === "packs" ? 5 : f.key === "note" ? 1 : 3}
                      value={values[f.key] || ""}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  ) : (
                    <input
                      autoFocus={index === 0 && !useLot}
                      type={f.type === "time" ? "text" : f.type || "text"}
                      placeholder={f.type === "time" ? "08:00" : undefined}
                      pattern={
                        f.type === "time"
                          ? "([01][0-9]|2[0-3]):[0-5][0-9]"
                          : undefined
                      }
                      inputMode={f.type === "number" ? "decimal" : undefined}
                      min={
                        f.type === "number"
                          ? f.zero
                            ? 0
                            : f.integer
                              ? 1
                              : 0.01
                          : undefined
                      }
                      step={
                        f.type === "number"
                          ? f.integer
                            ? 1
                            : f.key === "packKg"
                              ? 0.001
                              : 0.01
                          : undefined
                      }
                      max={f.key === "tolerance" ? 100 : undefined}
                      required={!f.optional}
                      value={values[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  )}
                  {f.hint && <small>{f.hint}</small>}
                </label>
              ))}
              {kind === "smoke" && (
                <PackWeightFields
                  value={values.packs || ""}
                  onChange={(value) => set("packs", value)}
                />
              )}
            </div>
            {!isPurchaseOrder && kind !== "cmReceive" && <Preview db={db} lot={lot} kind={kind} v={values} />}
            {error && (
              <div role="alert" className="notice danger">
                {error}
              </div>
            )}
          </div>
          {isPurchaseOrder && (
            <PurchaseOrderDocumentPreview
              db={db}
              lot={lot}
              kind={kind}
              values={values}
              date={date}
            />
          )}
          </div>
          <footer>
            <p>{isPurchaseOrder ? "ตรวจ Preview ก่อนบันทึก PO" : kind === "smokingInvoice" ? "ระบบจะคำนวณยอดตาม PO ให้ Owner ตรวจหลัง Submit" : "บันทึกแล้วเก็บในเบราว์เซอร์"}</p>
            <button type="button" className="secondary" onClick={onClose}>
              ยกเลิก
            </button>
            <button className="primary" type="submit">
              {kind === "closeDay"
                ? "ยืนยันปิดวัน"
                : kind === "purchase"
                  ? "บันทึก PO เนื้อ"
                  : kind === "smokeOrder"
                    ? "บันทึก PO โรงรมควัน"
                    : kind === "smokingInvoice"
                      ? "Submit ใบวางบิล"
                    : kind === "dispatch"
                      ? "สร้างใบขนส่งขาไป"
                      : kind === "return"
                        ? "สร้างใบขนส่งขากลับ"
                    : "บันทึกรายการ"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function PackWeightFields({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const weights = value === "" ? [""] : value.split(",");
  const update = (index: number, next: string) => {
    const rows = [...weights];
    rows[index] = next;
    onChange(rows.join(","));
  };
  const validWeights = weights.map(Number).filter((weight) => Number.isFinite(weight) && weight > 0);
  const total = validWeights.reduce((sum, weight) => sum + weight, 0);
  return (
    <div className="field wide pack-weight-editor">
      <span>น้ำหนักถุงใหญ่จาก Chef_house</span>
      <small>กรอกน้ำหนักจริงทีละถุง หากมีหลายถุงให้กด “เพิ่มถุง”</small>
      {weights.map((weight, index) => (
        <div className="pack-weight-row" key={index}>
          <span>ถุงที่ {index + 1}</span>
          <input
            aria-label={`น้ำหนักถุงที่ ${index + 1}`}
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            required
            value={weight}
            onChange={(event) => update(index, event.target.value)}
          />
          <span>กก.</span>
          {weights.length > 1 && (
            <button
              type="button"
              className="text-button"
              onClick={() => onChange(weights.filter((_, row) => row !== index).join(","))}
            >
              ลบ
            </button>
          )}
        </div>
      ))}
      <button type="button" className="secondary add-pack-button" onClick={() => onChange([...weights, ""].join(","))}>
        <Plus size={16} /> เพิ่มถุง
      </button>
      <div className="notice success pack-summary">
        ส่งกลับกรุงเทพฯ {validWeights.length} ถุง · น้ำหนักรวม {fmt(total)} กก.
      </div>
    </div>
  );
}

function PurchaseOrderDocumentPreview({
  db,
  lot,
  kind,
  values,
  date,
}: {
  db: Database;
  lot?: Lot;
  kind: "purchase" | "smokeOrder";
  values: Values;
  date: string;
}) {
  const isSmokeOrder = kind === "smokeOrder";
  const latestFoodDivaInvoice = lot
    ? entries(db, "foodDivaConfirm", lot.id).slice(-1)[0]
    : undefined;
  const quantity = n(values, isSmokeOrder ? "rawKg" : "orderedKg");
  const rate = isSmokeOrder ? smokeServiceRate(quantity) : n(values, "price");
  const total = quantity * rate;
  const buyerName = values.customerName || db.config.companyName || "NerdNuea Stock";
  const buyerAddress = values.customerAddress || db.config.companyAddress || "—";
  const attention = values.attention || db.config.attention || "—";
  const phone = values.phone || db.config.companyPhone || "—";
  const taxId = values.taxId || db.config.taxId || "—";
  const supplier = values[isSmokeOrder ? "smoker" : "supplier"] || (isSmokeOrder ? "Chef_house" : "Food Diva");
  const supplierContact = db.config[isSmokeOrder ? "chefHouseContact" : "foodDivaContact"] || "ยังไม่ได้ตั้งค่า";
  const supplierAddress = db.config[isSmokeOrder ? "chefHouseAddress" : "foodDivaAddress"] || "ยังไม่ได้ตั้งค่า";
  const documentNumber = isSmokeOrder
    ? `SMK-PO-${date.slice(0, 4)}-${String(entries(db, "smokeOrder").length + 1).padStart(4, "0")}`
    : `PO-${date.slice(0, 4)}-${String(db.lots.length + 1).padStart(4, "0")}`;
  const issueDate = isSmokeOrder ? values.requestedSmokeDate || date : date;
  const dueDate = isSmokeOrder ? values.expectedFinishedDate || "—" : "ตามข้อตกลง";
  const itemName = isSmokeOrder
    ? "บริการรมควันเนื้อ"
    : values.productName || "เนื้อวัว";
  const packDetail = isSmokeOrder
    ? lot?.id || "เลือก Lot ที่ได้รับ Invoice จาก Food Diva"
    : values.packSize || "—";
  const dateLabel = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return value || "—";
    return new Intl.DateTimeFormat("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${value}T00:00:00`));
  };

  return (
    <aside className="po-document-preview" aria-label="ตัวอย่างเอกสาร PO">
      <div className="po-preview-toolbar">
        <div>
          <strong>Preview</strong>
          <span>อัปเดตตามที่กรอก</span>
        </div>
        <span className="draft-badge">ฉบับร่าง</span>
      </div>
      <article className="po-paper">
        <div className="po-paper-heading">
          <div className="po-brand-block">
            {db.config.logoData ? (
              // Stored locally as a data URL, so Next image optimization cannot process it.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="po-logo" src={db.config.logoData} alt="โลโก้ NerdNuea" />
            ) : (
              <span className="po-logo-placeholder">พื้นที่โลโก้</span>
            )}
            <div>
              <h3>{isSmokeOrder ? "SMOKING SERVICE PO" : "PURCHASE ORDER"}</h3>
            </div>
          </div>
          <div className="po-number">
            <span>เลขที่เอกสาร</span>
            <strong>{documentNumber}</strong>
          </div>
        </div>

        <div className="po-party-grid">
          <section>
            <span>ผู้ซื้อ / Buyer</span>
            <strong>{buyerName}</strong>
            <p>{buyerAddress}</p>
            <p>Attention: {attention}</p>
            <p>โทร. {phone}</p>
            <p>Tax ID: {taxId}</p>
          </section>
          <section>
            <span>{isSmokeOrder ? "ผู้ให้บริการ / Service provider" : "ผู้ขาย / Supplier"}</span>
            <strong>{supplier}</strong>
            <p>ผู้รับออเดอร์: {supplierContact}</p>
            <p>ที่อยู่: {supplierAddress}</p>
            {isSmokeOrder && (
              <>
                <p>บริการรมควันเนื้อตามคำสั่งซื้อ</p>
                <p>อ้างอิง Invoice Food Diva: {latestFoodDivaInvoice?.values.invoiceNo || latestFoodDivaInvoice?.values.invoiceNumber || "รอระบุ"}</p>
              </>
            )}
          </section>
        </div>

        <div className="po-meta-grid">
          <div><span>วันที่ออก PO</span><strong>{dateLabel(issueDate)}</strong></div>
          <div><span>{isSmokeOrder ? "คาดว่าจะเสร็จ" : "กำหนดชำระ"}</span><strong>{dateLabel(dueDate)}</strong></div>
          <div><span>{isSmokeOrder ? "Lot เนื้อ" : "อ้างอิงผู้ขาย"}</span><strong>{isSmokeOrder ? lot?.id || "—" : values.reference || "—"}</strong></div>
        </div>

        <table className="po-item-table">
          <thead>
            <tr>
              <th>รายการ</th>
              <th>รายละเอียด</th>
              <th>จำนวน</th>
              <th>ราคา / กก.</th>
              <th>รวม</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{itemName}</td>
              <td>{packDetail}</td>
              <td>{fmt(quantity)} กก.</td>
              <td>฿{fmt(rate)}</td>
              <td>฿{fmt(total)}</td>
            </tr>
          </tbody>
        </table>

        {isSmokeOrder && (
          <div className="po-rate-note">
            อัตราอัตโนมัติ: ต่ำกว่า 1,000 กก. ฿220 · 1,000 กก. ฿200 · 1,500 กก. ฿180 ต่อกก.
          </div>
        )}

        <div className="po-total">
          <span>ยอดรวมประมาณการ</span>
          <strong>฿{fmt(total)}</strong>
        </div>
        <div className="po-note">
          <strong>หมายเหตุ</strong>
          <p>{values.instruction || "—"}</p>
        </div>
        <div className="po-paper-footer">
          <span>ผู้จัดทำ: {attention}</span>
          <span>สถานะ: รอการบันทึก</span>
        </div>
      </article>
    </aside>
  );
}

function Preview({
  db,
  lot,
  kind,
  v,
}: {
  db: Database;
  lot?: Lot;
  kind: string;
  v: Values;
}) {
  let rows: [string, string][] = [];
  if (kind === "purchase")
    rows = [
      ["ค่าเนื้อ", `฿${fmt(n(v, "orderedKg") * n(v, "price"))}`],
      ["สถานะ", "รอ Food Diva ออก Invoice ก่อนเรียกรถ"],
    ];
  if (kind === "foodDivaConfirm") {
    const invoiced = n(v, "confirmedKg");
    const ready = n(v, "readyForChiangMaiKg");
    const reserved = n(v, "reservedForOwnerKg");
    rows = [
      ["น้ำหนักตาม Invoice", `${fmt(invoiced)} กก.`],
      ["พร้อมส่ง Chef_house · เชียงใหม่", `${fmt(ready)} กก.`],
      ["เนื้อส่วนที่เหลือรอ Owner รับ (Waste)", `${fmt(reserved)} กก.`],
      ["รวมที่แบ่งแล้ว", `${fmt(ready + reserved)} / ${fmt(invoiced)} กก.`],
    ];
  }
  if (kind === "dispatch" && lot)
    rows = [
      [
        "PO ค้างส่ง",
        `${fmt(n(lot.values, "orderedKg") - db.lots.filter((l) => l.poId === lot.poId).reduce((s, l) => s + n(l.values, "dispatchKg"), 0))} กก.`,
      ],
      [
        "ค่ารถจากการตั้งค่า",
        `฿${fmt(n(lot.config, v.trip === "ไปกลับ" ? "roundFee" : "outboundFee"))}`,
      ],
    ];
  if (kind === "smokeOrder") {
    const rate = smokeServiceRate(n(v, "rawKg"));
    rows = [
      ["อัตราค่ารมอัตโนมัติ", `฿${fmt(rate)} / กก.`],
      ["ค่ารมควันประมาณการ", `฿${fmt(n(v, "rawKg") * rate)}`],
      ["เกณฑ์ราคา", "ต่ำกว่า 1,000 กก. ฿220 · 1,000 กก. ฿200 · 1,500 กก. ฿180"],
    ];
  }
  if (kind === "smokingInvoice") {
    const rate = smokeServiceRate(n(v, "serviceQuantity"));
    rows = [
      ["อัตราค่ารมอัตโนมัติ", `฿${fmt(rate)} / กก.`],
      ["ยอดก่อน VAT อัตโนมัติ", `฿${fmt(n(v, "serviceQuantity") * rate)}`],
    ];
  }
  if (kind === "cmReceive" && lot)
    rows = [
      ["การตรวจรับ", "กรอกน้ำหนักจากตาชั่งของ Chef_house"],
      ["การตรวจสอบ", "Owner จะเปรียบเทียบน้ำหนักกับ Food Diva ภายหลัง"],
    ];
  if (kind === "prepare" && lot)
    rows = [["รับจริง", `${fmt(n(lot.values, "receivedKg"))} กก.`]];
  if (kind === "smoke" && lot) {
    const weights = (v.packs || "")
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    rows = [
      ["ถุงใหญ่จาก Chef_house", `${weights.length} ถุง`],
      [
        "น้ำหนักเนื้อหลังรมควัน",
        `${fmt(weights.reduce((s, w) => s + (Number.isFinite(w) ? w : 0), 0))} กก.`,
      ],
      ["น้ำหนัก Waste", `${fmt(n(v, "wasteKg"))} กก.`],
      [
        "รอผลิตก่อนรอบนี้",
        `${fmt(n(lot.values, "preKg") - processed(db, lot.id))} กก.`,
      ],
    ];
  }
  if (kind === "closeLot" && lot)
    rows = [
      ["น้ำหนักเนื้อหลังรมควัน", `${fmt(produced(db, lot.id))} กก.`],
      ["จำนวนถุงส่งกลับกรุงเทพฯ", `${producedBags(db, lot.id)} ถุง`],
      [
        "น้ำหนักรอผลิต",
        `${fmt(n(lot.values, "preKg") - processed(db, lot.id))} กก.`,
      ],
    ];
  if (kind === "return" && lot)
    rows = [
      ["ของที่ส่งกลับ Food Diva", `${producedBags(db, lot.id)} ถุง · ${fmt(produced(db, lot.id))} กก.`],
      [
        "ค่ารถขากลับ",
        `฿${fmt(lot.values.trip === "ไปกลับ" ? 0 : n(lot.config, "returnFee"))}`,
      ],
      ["รูปแบบขาไป", lot.values.trip],
    ];
  if (kind === "central" && lot)
    rows = [
      ["Food Diva รับเข้าตู้แล้ว", `${fmt(n(entries(db, "foodDivaReturnReceive", lot.id).at(-1)?.values || {}, "receivedKg"))} กก.`],
      ["จำนวนถุงที่ควรได้รับ", `${producedBags(db, lot.id)} ถุง`],
      ["ส่วนต่าง", `${fmt(n(v, "centralKg") - produced(db, lot.id))} กก.`],
    ];
  if (kind === "sale" && lot) {
    const expected = (n(v, "boxes") + n(v, "addons")) * n(db.config, "packKg");
    rows = [
      [
        "ยอดตามเมนู",
        `฿${fmt(n(v, "boxes") * n(db.config, "boxPrice") + n(v, "addons") * n(db.config, "addonPrice") + n(v, "chiliAddons") * n(db.config, "chiliPrice"))}`,
      ],
      ["น้ำหนักตามจำนวนขาย", `${fmt(expected)} กก.`],
      [
        "พร้อมขายหลังรายการนี้",
        `${fmt(balance(db, lot.id, db.config.branch).ready - n(v, "soldKg") - n(v, "wasteKg"))} กก.`,
      ],
      [
        "ข้าวที่จะหัก",
        `${fmt(n(v, "boxes") * 0.2 + n(v, "riceWasteKg"))} กก.`,
      ],
      ["น้ำพริกก่อนขาย", `${fmt(chiliStock(db, db.config.branch))} หลอดที่ Owner จัดสรร`],
      ["น้ำพริกที่จะหัก", `${n(v, "chiliAddons")} หลอดที่ลูกค้าซื้อ`],
      ["น้ำพริกควรเหลือ", `${fmt(chiliStock(db, db.config.branch) - n(v, "chiliAddons"))} หลอด`],
    ];
  }
  return rows.length ? (
    <div className="preview">
      <h3>ตรวจสอบก่อนบันทึก</h3>
      {rows.map(([k, value]) => (
        <Read key={k} label={k} value={value} />
      ))}
    </div>
  ) : null;
}

function LotDetails({ db, lot, role }: { db: Database; lot: Lot; role: Role }) {
  const output = produced(db, lot.id),
    c = lotCost(db, lot),
    dispatched = n(lot.values, "dispatchKg");
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>{lot.id}</h2>
        <span className="badge">{stages[lot.stage]}</span>
      </div>
      <div className="progress-summary">
        <div>
          <span>
            ขั้นตอน {lot.stage + 1} จาก {stages.length}
          </span>
          <strong>{stages[lot.stage]}</strong>
        </div>
        <div className="progress-track">
          <i style={{ width: `${((lot.stage + 1) / stages.length) * 100}%` }} />
        </div>
      </div>
      <div className="stats-grid">
        {role === "branch" ? (
          <>
            <Stat
              label="รับเข้าสาขา"
              value={`${fmt(balance(db, lot.id, db.config.branch).received)} กก.`}
            />
            <Stat
              label="พร้อมขาย"
              value={`${fmt(balance(db, lot.id, db.config.branch).ready)} กก.`}
            />
          </>
        ) : (
          <>
            <Stat label="ส่งจากผู้ขาย" value={`${fmt(dispatched)} กก.`} />
            <Stat label="น้ำหนักเนื้อหลังรมควัน" value={`${fmt(output)} กก.`} />
            <Stat
              label="รอผลิต"
              value={`${fmt(n(lot.values, "preKg") - processed(db, lot.id))} กก.`}
            />
          </>
        )}
      </div>
      {role === "owner" && (
        <>
          <Read
            label="ผู้ขาย / PO"
            value={`${lot.values.supplier} · ${lot.poId}`}
          />
          <Read label="ต้นทุน Lot ตามข้อมูลขณะนี้" value={`฿${fmt(c.total)}`} />
          <Read
            label="ต้นทุน / กก. รับกลาง"
            value={c.perKg === null ? "รอรับสต๊อกกลาง" : `฿${fmt(c.perKg)}`}
          />
          <Read
            label="Loss จากน้ำหนัก Foodiva"
            value={
              lot.stage >= 6 && dispatched > 0
                ? `${fmt(((dispatched - output) / dispatched) * 100)}%`
                : "รอปิด Lot"
            }
          />
          {lot.stage >= 6 &&
            dispatched > 0 &&
            (dispatched - output) / dispatched > 0.2 && (
              <div className="notice warning">
                Loss เกิน 20% · ตรวจสอบได้โดยไม่หยุดการส่งต่องาน
              </div>
            )}
        </>
      )}
    </section>
  );
}
function SalesBars({
  data,
  branch,
  colorClass,
  max,
}: {
  data: { date: string; sala: number; minburi: number }[];
  branch: "sala" | "minburi";
  colorClass: string;
  max: number;
}) {
  return (
    <div className="bar-chart-wrap" aria-label="กราฟยอดขายรายวัน">
      <div className="chart-y-axis" aria-hidden="true">
        <span>฿{fmt(max)}</span>
        <span>฿{fmt(max * 0.75)}</span>
        <span>฿{fmt(max * 0.5)}</span>
        <span>฿{fmt(max * 0.25)}</span>
        <span>฿0</span>
      </div>
      <div
        className="bar-chart single-series detailed-chart"
        style={{
          gridTemplateColumns: `repeat(${data.length}, minmax(46px, 1fr))`,
          minWidth: `${Math.max(400, data.length * 58)}px`,
        }}
      >
        {data.map((item) => {
          const value = item[branch];
          return (
            <div className="bar-day" key={item.date}>
              <div className="bar-value">฿{fmt(value)}</div>
              <div className="bar-stack">
                <div className={`bar-segment ${colorClass}`} style={{ height: `${(value / max) * 100}%` }} />
              </div>
              <span>{item.date.slice(8)}/{item.date.slice(5, 7)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CostDonut({
  label,
  total,
  parts,
}: {
  label: string;
  total: number;
  parts: { label: string; value: number; color: string }[];
}) {
  let degree = 0;
  const gradient = parts.map((part) => {
    const start = degree;
    degree += total > 0 ? (part.value / total) * 360 : 0;
    return `${part.color} ${start}deg ${degree}deg`;
  }).join(", ");
  return (
    <div className="cost-unit">
      <h3>{label}</h3>
      <div className="donut" style={{ background: total ? `conic-gradient(${gradient})` : "#e5e7eb" }}>
        <div><strong>฿{fmt(total)}</strong><span>รวมต้นทุน</span></div>
      </div>
      <div className="cost-legend">
        {parts.map((part) => (
          <div key={part.label}><span><i style={{ background: part.color }} />{part.label}</span><strong>{total ? fmt((part.value / total) * 100) : "0.00"}%</strong></div>
        ))}
      </div>
    </div>
  );
}

function OwnerDashboard({
  db,
  date,
  onNavigate,
}: {
  db: Database;
  date: string;
  onNavigate: (tab: Tab) => void;
}) {
  const start = new Date(`${date}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  const defaultFrom = start.toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(date);
  const [showAlerts, setShowAlerts] = useState(false);
  const withinRange = (entry: Entry) =>
    entry.date >= fromDate && entry.date <= toDate;
  const sales = entries(db, "sale").filter(withinRange);
  const income = sales.reduce((total, entry) => total + n(entry.values, "revenue"), 0);
  const meatAndBranchCost = sales.reduce(
    (total, entry) =>
      total +
      n(entry.values, "meatCost") +
      n(entry.values, "wasteCost") +
      n(entry.values, "expense"),
    0,
  );
  const supplyCost = [
    ...entries(db, "supplyPurchase"),
    ...entries(db, "ricePurchase"),
    ...entries(db, "chiliPurchase"),
  ].filter(withinRange).reduce((total, entry) => total + n(entry.values, "totalCost"), 0);
  const ownerCost = entries(db, "expense").filter(withinRange)
    .reduce((total, entry) => total + n(entry.values, "amount"), 0);
  const materialCost = entries(db, "materialReceive").filter(withinRange)
    .reduce((total, entry) => total + n(entry.values, "totalCost"), 0);
  const ownerStockPurchaseCost = entries(db, "generalPurchase").filter(withinRange)
    .reduce((total, entry) => total + n(entry.values, "totalCost"), 0);
  const totalCost = meatAndBranchCost + supplyCost + materialCost + ownerStockPurchaseCost + ownerCost;
  const margin = income - totalCost;
  const required = (branchName: string) =>
    branchName === "มีนบุรี"
      ? ["ricePurchase", "riceCarry", "materials", "sale", "closeDay"]
      : ["riceIssue", "rice", "materials", "sale", "closeDay"];
  const requiredLabels: Record<string, string> = {
    ricePurchase: "ซื้อข้าวเข้า",
    riceCarry: "บันทึกข้าวคงเหลือ",
    riceIssue: "เบิกข้าวไปใช้",
    rice: "บันทึกข้าวคงเหลือ",
    materials: "เช็กวัสดุ 7 รายการ",
    sale: "ยอดขายสิ้นวัน",
    closeDay: "ปิดวัน",
  };
  const branchRows = branches.map((branchName) => {
    const rows = sales.filter((entry) => entry.branch === branchName);
    const missing = required(branchName).filter(
      (kind) => !entries(db, kind, undefined, branchName, date).length,
    );
    const lowMaterials = materials.filter(
      (_, index) =>
        materialPar(db, branchName, index) > 0 &&
        branchMaterialStock(db, branchName, index) <
          materialPar(db, branchName, index) * 0.2,
    ).length;
    return [
      <strong key={branchName}>{branchName}</strong>,
      fmt(rows.reduce((total, entry) => total + n(entry.values, "revenue"), 0)),
      String(rows.reduce((total, entry) => total + n(entry.values, "boxes"), 0)),
      missing.length ? `ค้าง ${missing.length} รายการ` : "ครบแล้ว",
      lowMaterials ? `ใกล้หมด ${lowMaterials} รายการ` : "ปกติ",
      isClosed(db, branchName, date) ? "ปิดวันแล้ว" : "ยังไม่ปิดวัน",
    ];
  });
  const activeLots = db.lots.filter((lot) => lot.stage < 8).length;
  const foodDivaInvoicesForOwner = db.lots.filter(
    (lot) => entries(db, "foodDivaConfirm", lot.id).length > 0 && !entries(db, "smokeOrder", lot.id).length,
  );
  const alertDetails: { title: string; detail: string; kind: "branch" | "lot" | "invoice"; tab?: Tab }[] = [
    ...foodDivaInvoicesForOwner.map((lot) => {
      const invoice = entries(db, "foodDivaConfirm", lot.id).at(-1)!;
      return {
        title: `Food Diva ออก Invoice แล้ว · ${lot.id}`,
        detail: `Invoice ${invoice.values.invoiceNo} · พร้อมส่งเชียงใหม่ ${fmt(readyForChefHouse(db, lot.id))} กก. · เนื้อส่วนที่เหลือรอ Owner รับ (Waste) ${fmt(reservedForOwnerContent(db, lot.id))} กก.`,
        kind: "invoice" as const,
        tab: "invoices" as const,
      };
    }),
    ...branches.flatMap((branchName) => {
      const pending = required(branchName).filter(
        (kind) => !entries(db, kind, undefined, branchName, date).length,
      );
      const lowMaterialNames = materials.filter(
        (_, index) =>
          materialPar(db, branchName, index) > 0 &&
          branchMaterialStock(db, branchName, index) <
            materialPar(db, branchName, index) * 0.2,
      );
      if (!pending.length && !lowMaterialNames.length) return [];
      return [{
        title: branchName,
        detail: [
          pending.length ? `ค้าง: ${pending.map((kind) => requiredLabels[kind] || kind).join(", ")}` : "",
          lowMaterialNames.length ? `วัสดุใกล้หมด: ${lowMaterialNames.join(", ")}` : "",
        ].filter(Boolean).join(" · "),
        kind: "branch" as const,
      }];
    }),
    ...db.lots.filter((lot) => lot.stage < 8).map((lot) => ({
      title: `Lot ${lot.id}`,
      detail: `อยู่ขั้นตอน “${stages[lot.stage]}” · รอการทำงานต่อ`,
      kind: "lot" as const,
    })),
  ];
  const alertCount = alertDetails.length;
  const marginPercent = income > 0 ? (margin / income) * 100 : 0;
  const rangeDays = Math.max(
    1,
    Math.floor(
      (Date.parse(`${toDate}T00:00:00Z`) -
        Date.parse(`${fromDate}T00:00:00Z`)) /
        86400000,
    ) + 1,
  );
  const rangeDates = Array.from({ length: rangeDays }, (_, index) => {
    const value = new Date(`${fromDate}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + index);
    return value.toISOString().slice(0, 10);
  });
  const dailySales = rangeDates.map((workDate) => ({
    date: workDate,
    sala: sales
      .filter((entry) => entry.date === workDate && entry.branch === "ศาลาแดง")
      .reduce((total, entry) => total + n(entry.values, "revenue"), 0),
    minburi: sales
      .filter((entry) => entry.date === workDate && entry.branch === "มีนบุรี")
      .reduce((total, entry) => total + n(entry.values, "revenue"), 0),
  }));
  const maxDaily = Math.max(1, ...dailySales.flatMap((item) => [item.sala, item.minburi]));
  const costParts = [
    { label: "เนื้อและสาขา", value: meatAndBranchCost, color: "#f97316" },
    { label: "ข้าวและน้ำพริก", value: supplyCost, color: "#fbbf24" },
    { label: "วัสดุ", value: materialCost, color: "#2563eb" },
    { label: "ซื้อเข้าสต๊อก Owner", value: ownerStockPurchaseCost, color: "#0f766e" },
    { label: "Owner", value: ownerCost, color: "#204b49" },
  ];
  const branchCostCharts = branches.map((branchName) => {
    const branchSales = sales.filter((entry) => entry.branch === branchName);
    const meat = branchSales.reduce(
      (total, entry) =>
        total +
        n(entry.values, "meatCost") +
        n(entry.values, "wasteCost") +
        n(entry.values, "expense"),
      0,
    );
    const supplies = [
      ...entries(db, "supplyPurchase", undefined, branchName),
      ...entries(db, "ricePurchase", undefined, branchName),
      ...entries(db, "chiliPurchase", undefined, branchName),
    ].filter(withinRange).reduce((total, entry) => total + n(entry.values, "totalCost"), 0);
    return {
      label: branchName,
      parts: [
        { label: "เนื้อและค่าใช้จ่าย", value: meat, color: "#f97316" },
        { label: "ข้าวและน้ำพริก", value: supplies, color: "#fbbf24" },
      ],
      total: meat + supplies,
    };
  });

  return (
    <div className="owner-dashboard dashboard-refresh">
      <section className="dashboard-topbar">
        <div className="dashboard-welcome">
          <span className="overline">OWNER DASHBOARD</span>
          <h2>สวัสดีครับ, เจ้าของร้าน</h2>
          <p>ภาพรวมร้านเนื้อรมควัน · อัปเดตจากข้อมูลที่ทุกบทบาทบันทึก</p>
        </div>
        <button
          type="button"
          className={alertCount ? "dashboard-health warning" : "dashboard-health"}
          onClick={() => setShowAlerts((value) => !value)}
          aria-expanded={showAlerts}
          aria-controls="owner-alert-details"
        >
          <CircleAlert size={17} />
          {alertCount ? `ต้องดูแล ${alertCount} จุด` : "การทำงานปกติ"}
          <span className="dashboard-health-action">{showAlerts ? "ซ่อน" : "ดูรายละเอียด"}</span>
        </button>
      </section>
      {showAlerts && (
        <section className="dashboard-alert-details" id="owner-alert-details">
          <div className="dashboard-alert-heading">
            <div><span className="overline">ACTION REQUIRED</span><h3>รายการที่ต้องดูแล</h3></div>
            <button className="text-button" type="button" onClick={() => setShowAlerts(false)}>ปิด</button>
          </div>
          {alertDetails.length ? (
            <div className="dashboard-alert-list">
              {alertDetails.map((item) => (
                <div className="dashboard-alert-item" key={`${item.kind}-${item.title}`}>
                  <span className="dashboard-alert-dot"><CircleAlert size={15} /></span>
                  <div>
                    <strong>{item.title}</strong><span>{item.detail}</span>
                    {item.tab && <button className="text-button dashboard-alert-link" type="button" onClick={() => onNavigate(item.tab!)}>เปิดใบ Invoice</button>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-alert-empty">ยังไม่มีรายการที่ต้องดำเนินการ</p>
          )}
        </section>
      )}
      <section className="dashboard-range">
        <div><strong>ช่วงข้อมูล</strong><span>{fromDate} ถึง {toDate}</span></div>
        <div className="table-filters">
          <label className="table-filter">ตั้งแต่<input type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label className="table-filter">ถึง<input type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} /></label>
          <button className="secondary" onClick={() => { setFromDate(defaultFrom); setToDate(date); }}>7 วันล่าสุด</button>
        </div>
      </section>
      <section className="dashboard-kpis">
        <article className="kpi-card sales"><div className="kpi-title"><span className="kpi-icon"><TrendingUp size={17} /></span><span>ยอดขายช่วงที่เลือก</span></div><strong>฿{fmt(income)}</strong><small><i className="trend-up">↗</i> ยอดขายทั้งสองสาขา</small></article>
        <article className="kpi-card cost"><div className="kpi-title"><span className="kpi-icon"><BarChart3 size={17} /></span><span>ต้นทุนที่บันทึก</span></div><strong>฿{fmt(totalCost)}</strong><small>รวมเนื้อ ข้าว วัสดุ และสต๊อกที่ซื้อเข้า</small></article>
        <article className={`kpi-card ${margin >= 0 ? "positive" : "negative"}`}><div className="kpi-title"><span className="kpi-icon"><TrendingUp size={17} /></span><span>ส่วนต่างหลังต้นทุน</span></div><strong>฿{fmt(margin)}</strong><small className={margin >= 0 ? "gain" : "loss"}>{margin >= 0 ? "↗" : "↘"} {fmt(marginPercent)}% ของยอดขาย</small></article>
        <article className="kpi-card boxes"><div className="kpi-title"><span className="kpi-icon"><Package size={17} /></span><span>กล่องที่ขาย</span></div><strong>{sales.reduce((total, entry) => total + n(entry.values, "boxes"), 0)}</strong><small>รวมรายการขายที่บันทึกแล้ว</small></article>
      </section>
      <DataTable
        title="Document & raw beef summary"
        columns={["Open PO", "Supplier Invoice ค้าง", "Smoking Invoice ค้าง", "Raw Meat ที่ Food Diva", "Raw Meat ที่โรงรม", "Steak allocation", "Finished smoked meat", "Loss รวม", "Average yield"]}
        rows={[[
          String(db.lots.filter((lot) => lot.stage < 8).length),
          String(entries(db, "supplierInvoice").filter((entry) => entry.values.paymentStatus !== "Paid").length),
          String(entries(db, "smokingInvoice").filter((entry) => smokingInvoiceStatus(db, entry) !== "ชำระแล้ว").length),
          `${fmt(db.lots.reduce((sum, lot) => sum + rawAtFoodDiva(db, lot), 0))} กก.`,
          `${fmt(db.lots.reduce((sum, lot) => sum + rawAtSmoker(db, lot), 0))} กก.`,
          `${fmt(steakRawStock(db))} กก.`,
          `${fmt(db.lots.reduce((sum, lot) => sum + produced(db, lot.id), 0))} กก.`,
          `${fmt(db.lots.reduce((sum, lot) => sum + processLoss(db, lot.id), 0))} กก.`,
          `${fmt(averageYield(db))}%`,
        ]]}
      />
      <section className="sales-charts">
        <div className="chart-panel">
          <div className="chart-heading"><div><span className="overline">DAILY SALES · SALA DAENG</span><h2>ยอดขายสาขาศาลาแดง</h2></div><span className="chart-total">฿{fmt(dailySales.reduce((sum, item) => sum + item.sala, 0))}</span></div>
          <div className="chart-overflow"><SalesBars data={dailySales} branch="sala" colorClass="sala" max={maxDaily} /></div>
        </div>
        <div className="chart-panel">
          <div className="chart-heading"><div><span className="overline">DAILY SALES · MIN BURI</span><h2>ยอดขายสาขามีนบุรี</h2></div><span className="chart-total blue">฿{fmt(dailySales.reduce((sum, item) => sum + item.minburi, 0))}</span></div>
          <div className="chart-overflow"><SalesBars data={dailySales} branch="minburi" colorClass="minburi" max={maxDaily} /></div>
        </div>
      </section>
      <section className="chart-panel">
        <div className="chart-heading"><div><span className="overline">COST MIX</span><h2>สัดส่วนต้นทุนแยกสาขาและรวมทั้งร้าน</h2></div></div>
        <div className="cost-comparison">
          {branchCostCharts.map((chart) => <CostDonut key={chart.label} {...chart} />)}
          <CostDonut label="รวมทั้งร้าน" total={totalCost} parts={costParts} />
        </div>
      </section>
      <div className="dashboard-grid">
        <DataTable
          title="สถานะสาขาวันนี้"
          columns={["สาขา", "ยอดขายช่วงที่เลือก", "กล่อง", "งานวันนี้", "วัสดุ", "ปิดวัน"]}
          rows={branchRows}
        />
        <section className="dashboard-side">
          <div className="dashboard-side-title"><Warehouse size={18} /><h2>สต๊อกสำคัญ</h2></div>
          {branches.map((branchName) => (
            <div className="stock-line" key={branchName}>
              <strong>{branchName}</strong>
              <span>เนื้อแช่แข็ง {fmt(db.lots.reduce((total, lot) => total + balance(db, lot.id, branchName).frozen, 0))} กก.</span>
              <span>{branchName === "มีนบุรี" ? "ข้าวสุก" : "ข้าวดิบ"} {fmt(branchName === "มีนบุรี" ? cookedRiceStock(db, branchName) : rawRiceStock(db, branchName))} กก.</span>
              <span>น้ำพริก {fmt(chiliStock(db, branchName))} หลอด</span>
            </div>
          ))}
          <div className="stock-line central">
            <strong>คลังกลาง</strong>
            <span>เนื้อพร้อมจัดสรร {fmt(db.lots.reduce((total, lot) => total + Math.max(0, centralStock(db, lot.id)), 0))} กก.</span>
            <span>Lot ที่กำลังดำเนินการ {activeLots}</span>
          </div>
        </section>
      </div>
      <DataTable
        title="สถานะ Lot และการผลิต"
        columns={["Lot", "ขั้นตอน", "ผลผลิต", "คลังกลาง", "ศาลาแดง", "มีนบุรี"]}
        rows={db.lots.map((lot) => [
          lot.id,
          stages[lot.stage],
          `${fmt(produced(db, lot.id))} กก.`,
          `${fmt(centralStock(db, lot.id))} กก.`,
          `${fmt(balance(db, lot.id, "ศาลาแดง").frozen)} กก.`,
          `${fmt(balance(db, lot.id, "มีนบุรี").frozen)} กก.`,
        ])}
      />
      <p className="dashboard-note">
        ส่วนต่างนี้อิงเฉพาะข้อมูลที่บันทึกในระบบ ยังไม่รวมภาษี แรงงาน และค่าเสื่อม
      </p>
    </div>
  );
}

function DailySummary({
  db,
  branch,
  date,
}: {
  db: Database;
  branch: string;
  date: string;
}) {
  const sales = entries(db, "sale", undefined, branch, date);
  return (
    <DataTable
      title={`สรุปรายวัน · ${date} · ${branch}`}
      columns={["รายการ", "ยอดวันนี้", "หน่วย / สถานะ"]}
      rows={[
        [
          "ยอดขาย LINE MAN",
          fmt(sales.reduce((s, e) => s + n(e.values, "revenue"), 0)),
          "บาท",
        ],
        [
          "เนื้อพร้อมขายทั้งหมด",
          fmt(db.lots.reduce((s, l) => s + balance(db, l.id, branch).ready, 0)),
          "กก.",
        ],
        ...(branch === "ศาลาแดง"
          ? [
              ["ข้าวเหนียวดิบคงเหลือ", fmt(rawRiceStock(db, branch)), "กก."],
              [
                "ข้าวเหนียวดิบที่เบิกแล้วยังไม่หุง",
                fmt(issuedRawRiceStock(db, branch)),
                "กก.",
              ],
            ]
          : []),
        ["ข้าวเหนียวสุกคงเหลือ", fmt(cookedRiceStock(db, branch)), "กก."],
        ...(branch === "มีนบุรี"
          ? [
              [
                "ข้าวเหนียวสุกที่ควรซื้อเพิ่ม",
                fmt(
                  Math.max(
                    0,
                    n(db.config, "cookedRicePar") - cookedRiceStock(db, branch),
                  ),
                ),
                "กก.",
              ],
            ]
          : []),
        ["น้ำพริกที่ Owner จัดสรร", String(chiliAllocated(db, branch)), "หลอด"],
        ["น้ำพริกคงเหลือหลังหักยอดขาย", String(chiliStock(db, branch)), "หลอด"],
        [
          "ตรวจนับวัสดุ",
          String(entries(db, "materials", undefined, branch, date).length),
          entries(db, "materials", undefined, branch, date).length
            ? "บันทึกแล้ว"
            : "ยังไม่บันทึก",
        ],
      ]}
    />
  );
}
function ChiliDailySummary({ db, branch, date }: { db: Database; branch: string; date: string }) {
  const allocatedToDate = chiliAllocated(db, branch, date);
  const soldBeforeToday = entries(db, "sale", undefined, branch)
    .filter((entry) => entry.date < date)
    .reduce((total, entry) => total + n(entry.values, "chiliSold"), 0);
  const salesToday = entries(db, "sale", undefined, branch, date);
  const soldToday = salesToday.reduce((total, entry) => total + n(entry.values, "chiliSold"), 0);
  const opening = allocatedToDate - soldBeforeToday;
  const expected = opening - soldToday;
  const latestCount = [...salesToday].reverse().find(
    (entry) => entry.values.chiliCount !== "" && entry.values.chiliCount !== undefined,
  );
  const actual = latestCount ? n(latestCount.values, "chiliCount") : null;
  const mismatch = actual !== null && actual !== expected;
  return (
    <DataTable
      title="น้ำพริกหลอด · Owner จัดสรร / สาขาตรวจสอบยอด"
      columns={["รายการ", "จำนวน", "หน่วย / สถานะ"]}
      rows={[
        ["ยอดตั้งต้นจาก Owner", fmt(opening), "หลอด · สาขาไม่ต้องซื้อหรือเบิกเอง"],
        ["ขายแยกวันนี้", fmt(soldToday), "หลอด · ระบบหักจากยอดขายอัตโนมัติ"],
        ["ควรเหลือหลังยอดขาย", fmt(expected), "หลอด"],
        ["ตรวจนับจริงปลายวัน", actual === null ? "ยังไม่ได้ตรวจนับ" : fmt(actual), mismatch ? <span className="badge danger">ยอดไม่ตรง</span> : actual === null ? "กรอกได้ในฟอร์มยอดขาย" : <span className="badge">ตรงกัน</span>],
        ["หมายเหตุส่วนต่าง", mismatch ? (latestCount?.values.chiliRemark || "—") : "—", mismatch ? "ต้องระบุเมื่อยอดไม่ตรง" : ""],
      ]}
    />
  );
}
function ChefReceiveTable({ db, open }: { db: Database; open: (kind: string, lotId?: string) => void }) {
  const waiting = db.lots.filter((lot) => lot.stage === 2);
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>ยืนยันรับเนื้อที่ Chef_house</h2>
          <p className="muted">เลือกรายการที่รถมาถึง แล้วบันทึกเวลาและน้ำหนักรับจริง</p>
        </div>
      </div>
      <DataTable
        title="Lot ที่รอยืนยันรับ"
        columns={["Lot", "วันที่รถรับ", "น้ำหนักที่ส่ง", "รถ / ผู้ขนส่ง", "การทำงาน"]}
        rows={waiting.map((lot) => [
          lot.id,
          lot.values.pickupDate || "-",
          `${fmt(n(lot.values, "dispatchKg"))} กก.`,
          lot.values.vehicle || "-",
          <button className="table-action" key={lot.id} onClick={() => open("cmReceive", lot.id)}>
            ยืนยันรับเนื้อ
          </button>,
        ])}
      />
      {!waiting.length && <div className="notice success">ไม่มี Lot รอยืนยันรับในขณะนี้</div>}
    </>
  );
}
function ChefLotTable({
  db,
  lots,
  open,
}: {
  db: Database;
  lots: Lot[];
  open: (kind: string, lotId?: string) => void;
}) {
  const smokeLogs = lots.flatMap((lot) =>
    entries(db, "smoke", lot.id).map((entry) => {
      const batchesBeforeOrAtThisEntry = entries(db, "smoke", lot.id).slice(
        0,
        entries(db, "smoke", lot.id).findIndex((batch) => batch.id === entry.id) + 1,
      );
      const weights = (entry.values.packs || "")
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number)
        .filter((weight) => Number.isFinite(weight) && weight > 0);
      const weightGroups = Array.from(
        weights.reduce((groups, weight) => {
          const key = fmt(weight);
          groups.set(key, (groups.get(key) || 0) + 1);
          return groups;
        }, new Map<string, number>()),
      );
      const bagDetail = weightGroups.length
        ? weightGroups.map(([weight, count]) => `${weight} × ${count}`).join(" + ")
        : "—";
      return {
        lot,
        entry,
        weights,
        bagDetail,
        remainingKg: Math.max(
          0,
          n(lot.values, "preKg") -
            batchesBeforeOrAtThisEntry.reduce(
              (total, batch) => total + n(batch.values, "inputKg"),
              0,
            ),
        ),
      };
    }),
  );
  const action = (lot: Lot) => {
    const smokeOrder = entries(db, "smokeOrder", lot.id).at(-1);
    const accepted = entries(db, "smokeOrderAccept", lot.id).at(-1);
    const latestInvoice = entries(db, "smokingInvoice", lot.id).at(-1);
    const invoiceStatus = latestInvoice ? smokingInvoiceStatus(db, latestInvoice) : "";
    if (!smokeOrder) return "รอ Owner ออก PO รมควัน";
    if (!accepted) return <button className="table-action" onClick={() => open("smokeOrderAccept", lot.id)}>ยืนยันรับ PO รมควัน</button>;
    if (!latestInvoice || invoiceStatus === "ส่งกลับแก้ไข") return <button className="table-action" onClick={() => open("smokingInvoice", lot.id)}>{latestInvoice ? "แก้ไขและ Submit ใบวางบิล" : "สร้าง / Submit ใบวางบิล"}</button>;
    if (lot.stage < 2) return <span className="badge">{invoiceStatus} · รอ Owner เรียกรถ</span>;
    const kind = lot.stage === 3 ? "prepare" : lot.stage === 4 ? "smoke" : lot.stage === 5 ? "closeLot" : "";
    if (lot.stage === 5)
      return (
        <div className="button-row compact-actions">
          <button className="secondary table-action" onClick={() => open("chefEdit", lot.id)}>
            Edit ข้อมูลก่อนปิด Lot
          </button>
          <button className="table-action" onClick={() => open("closeLot", lot.id)}>
            ยืนยันปิด Lot
          </button>
        </div>
      );
    if (lot.stage >= 6) return <span className="badge">{invoiceStatus}</span>;
    return kind ? (
      <button className="table-action" onClick={() => open(kind, lot.id)}>{titles[kind]}</button>
    ) : lot.stage === 2 ? "ไปเมนูยืนยันรับเนื้อ" : "ส่งต่องานแล้ว";
  };
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Lot งานผลิต Chef_house</h2>
          <p className="muted">ดูสถานะและทำงานต่อจากตาราง โดยไม่ต้องเปิดทีละการ์ด</p>
        </div>
      </div>
      <DataTable
        title="รายการ Lot ทั้งหมด"
        columns={["Lot", "PO รมควัน", "เอกสาร PO", "รับจริง", "สถานะ", "น้ำหนักหลังรมควัน", "จำนวนถุง", "การทำงาน"]}
        rows={lots.map((lot) => [
          lot.id,
          entries(db, "smokeOrder", lot.id).at(-1)?.values.orderNumber || "รอ Owner ออก PO",
          entries(db, "smokeOrder", lot.id).length ? (
            <button key={`${lot.id}-po`} type="button" className="table-action" onClick={() => open("smokeOrderPreview", lot.id)}>
              ดู PO รมควัน
            </button>
          ) : "—",
          n(lot.values, "receivedKg") ? `${fmt(n(lot.values, "receivedKg"))} กก.` : "รอยืนยันรับ",
          stages[lot.stage],
          produced(db, lot.id) ? `${fmt(produced(db, lot.id))} กก.` : "-",
          producedBags(db, lot.id) ? `${producedBags(db, lot.id)} ถุง` : "-",
          action(lot),
        ])}
      />
      <DataTable
        title={`Log Lot สโมครายวัน ${smokeLogs.length} รอบ`}
        columns={["วันที่สโมค", "Lot หลัก", "Lot สโมค", "น้ำหนักเข้าเตา", "ถุงที่ได้", "น้ำหนักหลังรม", "น้ำหนัก Waste", "คงเหลือรอผลิต"]}
        rows={smokeLogs.map(({ lot, entry, weights, bagDetail, remainingKg }) => [
          entry.values.smokeDate || entry.date,
          lot.id,
          entry.values.subLot || "—",
          `${fmt(n(entry.values, "inputKg"))} กก.`,
          weights.length ? `${weights.length} ถุง · ${bagDetail} กก.` : "—",
          `${fmt(n(entry.values, "outputKg"))} กก.`,
          `${fmt(n(entry.values, "wasteKg"))} กก.`,
          `${fmt(remainingKg)} กก.`,
        ])}
      />
    </>
  );
}
function SmokeOrderPreviewDialog({
  db,
  lotId,
  onClose,
}: {
  db: Database;
  lotId: string;
  onClose: () => void;
}) {
  const lot = db.lots.find((item) => item.id === lotId);
  const order = entries(db, "smokeOrder", lotId).at(-1);
  return (
    <div className="modal-backdrop" onKeyDown={(event) => event.key === "Escape" && onClose()}>
      <section className="form-dialog po-document-dialog" role="dialog" aria-modal="true" aria-labelledby="smoke-po-preview-title">
        <header>
          <div>
            <span className="overline">อ่านอย่างเดียว · Chef_house</span>
            <h2 id="smoke-po-preview-title">ใบสั่ง PO โรงรมควัน</h2>
          </div>
          <button type="button" className="icon-button" aria-label="ปิดเอกสาร PO" onClick={onClose}><X /></button>
        </header>
        {lot && order ? (
          <PurchaseOrderDocumentPreview
            db={db}
            lot={lot}
            kind="smokeOrder"
            values={order.values}
            date={order.date}
          />
        ) : (
          <div className="form-body"><div className="notice warning">ไม่พบเอกสาร PO รายการนี้</div></div>
        )}
        <footer>
          <p>ตรวจคำสั่งและยอดก่อนกดยืนยันรับ PO</p>
          <button type="button" className="secondary" onClick={onClose}>ปิด</button>
        </footer>
      </section>
    </div>
  );
}
function ChefLotEditForm({
  db,
  lotId,
  onClose,
  onSaved,
}: {
  db: Database;
  lotId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const lot = db.lots.find((item) => item.id === lotId);
  const received = entries(db, "cmReceive", lotId).at(-1);
  const prepared = entries(db, "prepare", lotId).at(-1);
  const smokeEntries = entries(db, "smoke", lotId);
  const [values, setValues] = useState<Values>(() => ({
    receivedKg: received?.values.receivedKg || "",
    arrival: received?.values.arrival || "",
    preKg: prepared?.values.preKg || "",
  }));
  const [smokeDrafts, setSmokeDrafts] = useState(() =>
    smokeEntries.map((entry) => ({
      id: entry.id,
      smokeDate: entry.values.smokeDate || entry.date,
      inputKg: entry.values.inputKg || "",
      wasteKg: entry.values.wasteKg || "0",
      packs: (entry.values.packs || "").split(/[\s,]+/).filter(Boolean).join("\n"),
    })),
  );
  const [error, setError] = useState("");
  if (!lot || !received || !prepared || !smokeEntries.length)
    return null;
  const receivedRecord = received;
  const preparedRecord = prepared;
  const set = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setError("");
  };
  const setSmoke = (
    id: string,
    key: "smokeDate" | "inputKg" | "wasteKg" | "packs",
    value: string,
  ) => {
    setSmokeDrafts((current) =>
      current.map((draft) =>
        draft.id === id ? { ...draft, [key]: value } : draft,
      ),
    );
    setError("");
  };
  function save() {
    try {
      const next = latestDatabase();
      const nextLot = next.lots.find((item) => item.id === lotId);
      const receiveEntry = next.entries.find((entry) => entry.id === receivedRecord.id);
      const prepareEntry = next.entries.find((entry) => entry.id === preparedRecord.id);
      const smokeRecords = smokeDrafts.map((draft) =>
        next.entries.find((entry) => entry.id === draft.id),
      );
      if (!nextLot || !receiveEntry || !prepareEntry || smokeRecords.some((entry) => !entry))
        throw new Error("ไม่พบข้อมูล Lot ล่าสุด");
      const receivedKg = Number(values.receivedKg);
      const preKg = Number(values.preKg);
      if (![receivedKg, preKg].every(Number.isFinite) || receivedKg <= 0 || preKg <= 0)
        throw new Error("กรอกน้ำหนักให้ถูกต้อง");
      if (!values.arrival || !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.arrival))
        throw new Error("กรอกเวลารับเป็น HH:mm");
      if (receivedKg > n(nextLot.values, "dispatchKg") + 0.001)
        throw new Error("น้ำหนักรับจริงมากกว่าน้ำหนักที่ส่ง");
      if (preKg > receivedKg + 0.001)
        throw new Error("น้ำหนักก่อนสโมคมากกว่าน้ำหนักรับจริง");
      const revisedBatches = smokeDrafts.map((draft) => {
        const inputKg = Number(draft.inputKg);
        const wasteKg = Number(draft.wasteKg);
        const weights = draft.packs.split(/[\s,]+/).filter(Boolean).map(Number);
        if (!draft.smokeDate || !Number.isFinite(inputKg) || !Number.isFinite(wasteKg) || inputKg <= 0 || wasteKg < 0)
          throw new Error("กรอกวันที่ น้ำหนักเข้าเตา และ Waste ให้ครบทุกรอบ");
        if (!weights.length || weights.some((weight) => !Number.isFinite(weight) || weight <= 0))
          throw new Error("กรอกน้ำหนักถุงใหญ่ให้ครบและมากกว่า 0 ทุกรอบ");
        const outputKg = weights.reduce((sum, weight) => sum + weight, 0);
        if (Math.abs(outputKg + wasteKg - inputKg) > 0.001)
          throw new Error("น้ำหนักถุงรวมและ Waste ต้องเท่ากับน้ำหนักเข้าเตา");
        return { ...draft, inputKg, wasteKg, weights, outputKg };
      });
      const totalInputKg = revisedBatches.reduce((total, batch) => total + batch.inputKg, 0);
      if (Math.abs(totalInputKg - preKg) > 0.001)
        throw new Error("ก่อนปิด Lot น้ำหนักเข้าเตารวมจาก Log ต้องเท่ากับน้ำหนักก่อนสโมค");
      receiveEntry.values = { ...receiveEntry.values, receivedKg: String(receivedKg), arrival: values.arrival };
      prepareEntry.values = { ...prepareEntry.values, preKg: String(preKg) };
      revisedBatches.forEach((batch, index) => {
        const smokeEntry = smokeRecords[index]!;
        smokeEntry.values = {
          ...smokeEntry.values,
          smokeDate: batch.smokeDate,
          inputKg: String(batch.inputKg),
          wasteKg: String(batch.wasteKg),
          packs: batch.weights.join("\n"),
          outputKg: batch.outputKg.toFixed(2),
          packCount: String(batch.weights.length),
        };
      });
      const latestBatch = revisedBatches.at(-1)!;
      nextLot.values = {
        ...nextLot.values,
        receivedKg: String(receivedKg),
        arrival: values.arrival,
        preKg: String(preKg),
        inputKg: String(latestBatch.inputKg),
        wasteKg: String(latestBatch.wasteKg),
        packs: latestBatch.weights.join("\n"),
        outputKg: latestBatch.outputKg.toFixed(2),
        packCount: String(latestBatch.weights.length),
      };
      saveDatabase(next);
      onSaved();
    } catch (value) {
      setError(value instanceof Error ? value.message : "แก้ไขไม่สำเร็จ");
    }
  }
  const smokeTotal = smokeDrafts.reduce(
    (total, draft) => total + (Number(draft.inputKg) || 0),
    0,
  );
  return (
    <div className="modal-backdrop">
      <section className="form-dialog" role="dialog" aria-modal="true" aria-labelledby="chef-edit-title">
        <header>
          <div><span className="overline">Chef_house · {lot.id}</span><h2 id="chef-edit-title">Edit ข้อมูลก่อนปิด Lot</h2></div>
          <button type="button" className="icon-button" aria-label="ปิดฟอร์ม" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="form-body">
          <div className="notice">แก้ไขได้เฉพาะก่อนยืนยันปิด Lot เมื่อปิดแล้วข้อมูลจะเป็นอ่านอย่างเดียว</div>
          <div className="form-grid">
            <label className="field">น้ำหนักรับจริง (กก.)<input type="number" min="0.001" step="0.001" value={values.receivedKg} onChange={(event) => set("receivedKg", event.target.value)} /></label>
            <label className="field">เวลารับ (HH:mm)<input type="time" value={values.arrival} onChange={(event) => set("arrival", event.target.value)} /></label>
            <label className="field">น้ำหนักก่อนสโมค (กก.)<input type="number" min="0.001" step="0.001" value={values.preKg} onChange={(event) => set("preKg", event.target.value)} /></label>
          </div>
          <DataTable
            title="ตรวจสอบและแก้ไข Log Lot สโมครายวัน"
            columns={["วันที่", "Lot สโมค", "น้ำหนักเข้าเตา", "น้ำหนัก Waste", "น้ำหนักถุงใหญ่จาก Chef_house (กก. / 1 บรรทัดต่อถุง)"]}
            rows={smokeDrafts.map((draft, index) => [
              <input key={`${draft.id}-date`} type="date" value={draft.smokeDate} onChange={(event) => setSmoke(draft.id, "smokeDate", event.target.value)} />,
              smokeEntries[index]?.values.subLot || "—",
              <input key={`${draft.id}-input`} type="number" min="0.001" step="0.001" value={draft.inputKg} onChange={(event) => setSmoke(draft.id, "inputKg", event.target.value)} />,
              <input key={`${draft.id}-waste`} type="number" min="0" step="0.001" value={draft.wasteKg} onChange={(event) => setSmoke(draft.id, "wasteKg", event.target.value)} />,
              <textarea key={`${draft.id}-packs`} rows={3} value={draft.packs} onChange={(event) => setSmoke(draft.id, "packs", event.target.value)} />,
            ])}
          />
          <div className={Math.abs(smokeTotal - (Number(values.preKg) || 0)) < 0.001 ? "notice success" : "notice warning"}>
            น้ำหนักเข้าเตารวมจาก Log {fmt(smokeTotal)} กก. · น้ำหนักก่อนสโมค {fmt(Number(values.preKg) || 0)} กก. · {Math.abs(smokeTotal - (Number(values.preKg) || 0)) < 0.001 ? "ยอดตรงกัน พร้อมปิด Lot" : "ยอดยังไม่ตรง ต้องปรับ Log หรือ น้ำหนักก่อนสโมคก่อนปิด Lot"}
          </div>
          {error && <div role="alert" className="notice danger">{error}</div>}
        </div>
        <footer><button type="button" className="secondary" onClick={onClose}>ยกเลิก</button><button type="button" className="primary" onClick={save}>บันทึกการแก้ไข</button></footer>
      </section>
    </div>
  );
}
function SmokingPurchaseOrderView({ db, open }: { db: Database; open: (kind: string, lotId?: string) => void }) {
  const eligibleLots = db.lots.filter((lot) => entries(db, "foodDivaConfirm", lot.id).length > 0);
  return <div className="settings-stack">
    <section className="panel config-heading">
      <div><span className="overline">CHEF_HOUSE SERVICE PO</span><h2>ใบสั่ง PO โรงรมควัน</h2><p className="muted">Owner ออก PO รมควันหลัง Food Diva ออก Invoice แล้ว Chef_house ต้องกดยืนยันรับ PO และ Submit ใบวางบิลก่อน Owner เรียกรถไปรับเนื้อ</p></div>
      <Stat label="PO รอยืนยันจาก Chef_house" value={`${eligibleLots.filter((lot) => entries(db, "smokeOrder", lot.id).length && !entries(db, "smokeOrderAccept", lot.id).length).length} ใบ`} />
    </section>
    <DataTable
      title="รายการ PO โรงรมควัน"
      columns={["PO เนื้อ / Lot", "Invoice Food Diva", "น้ำหนักสั่งรม", "อัตราค่ารม", "Chef_house รับ PO", "ใบวางบิล", "การทำงาน"]}
      rows={eligibleLots.map((lot) => {
        const supplierInvoice = entries(db, "foodDivaConfirm", lot.id).at(-1);
        const order = entries(db, "smokeOrder", lot.id).at(-1);
        const accepted = entries(db, "smokeOrderAccept", lot.id).at(-1);
        const invoice = entries(db, "smokingInvoice", lot.id).at(-1);
        const invoiceStatus = invoice ? smokingInvoiceStatus(db, invoice) : "รอ Chef_house Submit";
        return [
          <span key="lot"><strong>{lot.poId}</strong><br />{lot.id}</span>,
          `${supplierInvoice?.values.invoiceNo || "-"} · พร้อมส่งเชียงใหม่ ${fmt(readyForChefHouse(db, lot.id))} กก.`,
          order ? `${fmt(n(order.values, "rawKg"))} กก.` : "ยังไม่ออก PO",
          order ? `฿${fmt(n(order.values, "serviceRate"))} / กก.` : "—",
          accepted ? `${accepted.values.acceptedBy} · รับแล้ว` : order ? <span className="badge danger" key="accept">รอยืนยัน</span> : "—",
          invoice ? `${invoice.values.invoiceNumber} · ${invoiceStatus}` : "รอ Chef_house",
          <div className="button-row" key="actions">
            {!order ? <button className="table-action" onClick={() => open("smokeOrder", lot.id)}>ออก PO รมควันเนื้อ</button> : <DocumentPrintButton title="Smoke Service Purchase Order" number={order.values.orderNumber} rows={[
              ["ลูกค้า", db.config.companyName || "บริษัท เนิร์ดเนื้อ จำกัด"],
              ["ที่อยู่", db.config.companyAddress || "—"],
              ["Attention", db.config.attention || "—"],
              ["โทร.", db.config.companyPhone || "—"],
              ["Tax ID", db.config.taxId || "—"],
              ["Supplier", order.values.smoker || "Chef_house"],
              ["ผู้รับออเดอร์", db.config.chefHouseContact || "—"],
              ["ที่อยู่ผู้ให้บริการ", db.config.chefHouseAddress || "—"],
              ["วันที่ PO", order.values.requestedSmokeDate || order.date],
              ["กำหนดเสร็จ", order.values.expectedFinishedDate || "—"],
              ["Lot เนื้อ", lot.id],
              ["Food Diva Invoice", supplierInvoice?.values.invoiceNo || "—"],
              ["สินค้า", "บริการรมควันเนื้อ"],
              ["ขนาดบรรจุ", `Lot ${lot.id}`],
              ["จำนวน", `${fmt(n(order.values, "rawKg"))} กก.`],
              ["ราคา / กก.", `฿${fmt(n(order.values, "serviceRate"))}`],
              ["ยอดรวมก่อน VAT", `฿${fmt(n(order.values, "estimatedCost"))}`],
              ["หมายเหตุ", order.values.instruction || "—"],
            ]} />}
          </div>,
        ];
      })}
    />
    {!eligibleLots.length && <div className="notice">ยังไม่มี PO เนื้อที่ Food Diva ออก Invoice แล้ว</div>}
  </div>;
}

function FoodDivaView({ db, open }: { db: Database; open: (kind: string, lotId?: string) => void }) {
  const holding = db.lots.reduce((sum, lot) => sum + rawAtFoodDiva(db, lot), 0);
  const reservedForContent = db.lots.reduce((sum, lot) => sum + reservedForOwnerContent(db, lot.id), 0);
  const returnWaiting = db.lots.filter((lot) => lot.stage === 7 && !entries(db, "foodDivaReturnReceive", lot.id).length);
  return <div className="settings-stack">
    <section className="panel config-heading"><div><h2>งาน Food Diva</h2><p className="muted">รับ PO ออก Invoice แล้วระบุน้ำหนักพร้อมส่งเชียงใหม่ และเนื้อส่วนที่เหลือรอ Owner รับ (Waste)</p></div><div className="button-row"><Stat label="เนื้อดิบคงเหลือ Food Diva" value={`${fmt(holding)} กก.`} /><Stat label="เนื้อส่วนที่เหลือรอ Owner รับ (Waste)" value={`${fmt(reservedForContent)} กก.`} /></div></section>
    <DataTable
      title="PO เนื้อที่ต้องออก Invoice"
      columns={["เลข PO", "Lot", "ยอดสั่ง", "Invoice เนื้อ", "พร้อมส่งเชียงใหม่", "รอ Owner รับ (Waste)", "คงเหลือ Food Diva", "สถานะ", "การทำงาน"]}
      rows={db.lots.map((lot) => {
        const confirm = entries(db, "foodDivaConfirm", lot.id).at(-1);
        return [
          <strong key={lot.poId}>{lot.poId}</strong>, lot.id, `${fmt(n(lot.values, "orderedKg"))} กก.`,
          confirm ? `${confirm.values.invoiceNo} · ${fmt(n(confirm.values, "confirmedKg"))} กก.` : <span className="badge danger" key="pending">รอออก Invoice</span>,
          confirm ? `${fmt(readyForChefHouse(db, lot.id))} กก.` : "—",
          confirm ? `${fmt(reservedForOwnerContent(db, lot.id))} กก.` : "—",
          `${fmt(rawAtFoodDiva(db, lot))} กก.`,
          !confirm ? "ต้องออก Invoice" : lot.stage === 1 ? "รอ Owner เรียกรถ" : lot.stage < 7 ? "ส่งให้ Chef_house แล้ว" : "รอรับเนื้อรมควัน",
          !confirm ? (
            <div className="button-row" key="confirm-actions">
              <DocumentPrintButton title="Purchase Order" number={lot.poId} rows={purchaseOrderRows(lot, db)} label="ดู PO / PDF" preview />
              <button className="table-action" onClick={() => open("foodDivaConfirm", lot.id)}>ออกและอัปโหลด Invoice</button>
            </div>
          ) : (
            <div className="button-row" key="confirmed-actions">
              <DocumentPrintButton title="Purchase Order" number={lot.poId} rows={purchaseOrderRows(lot, db)} label="ดู PO / PDF" preview />
              <span className="badge success">แนบ Invoice แล้ว</span>
              <button className="table-action" onClick={() => open("foodDivaConfirm", lot.id)}>
                แก้ไข / อัปโหลดใหม่
              </button>
            </div>
          ),
        ];
      })}
    />
    <DataTable title="เนื้อรมควันรอ Food Diva รับเข้าตู้" columns={["PO / Lot", "ใบขนส่ง", "น้ำหนักหลังรม", "รับจริง", "สถานะ", "การทำงาน"]} rows={returnWaiting.map((lot) => {
      const trip = entries(db, "return", lot.id).at(-1);
      return [`${lot.poId} / ${lot.id}`, `${trip?.values.returnDate || "-"} · ${trip?.values.plate || "-"}`, `${fmt(produced(db, lot.id))} กก.`, "รอชั่งรับ", <span className="badge danger" key="status">ต้องรับเข้า</span>, <button key="receive" className="table-action" onClick={() => open("foodDivaReturnReceive", lot.id)}>ยืนยันรับเข้าตู้</button>];
    })} />
  </div>;
}

function purchaseOrderRows(lot: Lot, db: Database): [string, string][] {
  const purchase = entries(db, "purchase", lot.id).at(-1);
  return [
    ["วันที่ PO", purchase?.date || lot.values.purchaseDate || "—"],
    ["Supplier", lot.values.supplier],
    ["ลูกค้า", lot.values.customerName],
    ["ที่อยู่", lot.values.customerAddress],
    ["Attention", lot.values.attention],
    ["โทร.", lot.values.phone],
    ["Tax ID", lot.values.taxId],
    ["สินค้า", lot.values.productName || "เนื้อวัว"],
    ["ขนาดบรรจุ", lot.values.packSize],
    ["จำนวน", `${fmt(n(lot.values, "orderedKg"))} กก.`],
    ["ราคา / กก.", `฿${fmt(n(lot.values, "price"))}`],
    ["ยอดรวมก่อน VAT", `฿${fmt(n(lot.values, "orderedKg") * n(lot.values, "price"))}`],
    ["อ้างอิงผู้ขาย", lot.values.reference || "—"],
    ["หมายเหตุ", lot.values.note || "—"],
  ];
}

function DocumentPrintButton({ title, number, rows, label = "พิมพ์ / PDF", preview = false }: { title: string; number: string; rows: [string, string][]; label?: string; preview?: boolean }) {
  const print = () => {
    const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] || char);
    const field = (label: string) => rows.find(([key]) => key === label)?.[1] || "—";
    const isSmokePurchaseOrder = title === "Smoke Service Purchase Order";
    const isPurchaseOrder = title === "Purchase Order" || isSmokePurchaseOrder;
    const supplierHeading = isSmokePurchaseOrder ? "ผู้ให้บริการ / SERVICE PROVIDER" : "ผู้ขาย / SUPPLIER";
    const dueLabel = isSmokePurchaseOrder ? "กำหนดเสร็จ" : "กำหนดชำระ";
    const dueValue = isSmokePurchaseOrder ? field("กำหนดเสร็จ") : "ตามข้อตกลง";
    const referenceLabel = isSmokePurchaseOrder ? "Lot เนื้อ" : "อ้างอิงผู้ขาย";
    const referenceValue = isSmokePurchaseOrder ? field("Lot เนื้อ") : field("อ้างอิงผู้ขาย");
    const supplierExtra = isSmokePurchaseOrder
      ? `<p>ผู้รับออเดอร์: ${escape(field("ผู้รับออเดอร์"))}</p><p>ที่อยู่: ${escape(field("ที่อยู่ผู้ให้บริการ"))}</p><p>อ้างอิง Invoice Food Diva: ${escape(field("Food Diva Invoice"))}</p>`
      : "";
    const documentContent = isPurchaseOrder
      ? `<section class="party-grid"><div><span>ผู้ซื้อ / BUYER</span><strong>${escape(field("ลูกค้า"))}</strong><p>Reg. Address: ${escape(field("ที่อยู่"))}</p><p>Attention: ${escape(field("Attention"))}</p><p>โทร. ${escape(field("โทร."))}</p><p>Tax ID: ${escape(field("Tax ID"))}</p></div><div><span>${supplierHeading}</span><strong>${escape(field("Supplier"))}</strong>${supplierExtra}</div></section><section class="meta-grid"><div><span>วันที่ออก PO</span><strong>${escape(field("วันที่ PO"))}</strong></div><div><span>${dueLabel}</span><strong>${escape(dueValue)}</strong></div><div><span>${referenceLabel}</span><strong>${escape(referenceValue)}</strong></div></section><table class="items"><thead><tr><th>รายการ</th><th>รายละเอียด</th><th>จำนวน</th><th>ราคา / กก.</th><th>รวม</th></tr></thead><tbody><tr><td>${escape(field("สินค้า"))}</td><td>${escape(field("ขนาดบรรจุ"))}</td><td>${escape(field("จำนวน"))}</td><td>${escape(field("ราคา / กก."))}</td><td>${escape(field("ยอดรวมก่อน VAT"))}</td></tr></tbody></table><div class="total"><span>ยอดรวมประมาณการ</span><strong>${escape(field("ยอดรวมก่อน VAT"))}</strong></div><section class="note"><span>หมายเหตุ</span><p>${escape(field("หมายเหตุ"))}</p></section>`
      : `<table class="details"><tbody>${rows.map(([label, value]) => `<tr><th>${escape(label)}</th><td>${escape(value || "—")}</td></tr>`).join("")}</tbody></table>`;
    const popup = window.open("", "_blank", "width=880,height=720");
    if (!popup) {
      window.alert("เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up สำหรับ localhost:3000 แล้วลองอีกครั้ง");
      return;
    }
    popup.document.open();
    popup.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escape(number)}</title><style>@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#e9eee7;font-family:Arial,'Noto Sans Thai',sans-serif;color:#18342e}.sheet{width:210mm;min-height:297mm;margin:0 auto;padding:23mm 20mm;background:#fff}.head{display:flex;justify-content:space-between;gap:20px;padding-bottom:18mm;border-bottom:2px solid #315f4d}.head h1{margin:0;color:#165846;font-size:30px;letter-spacing:.04em}.number{text-align:right}.number span,.party-grid span,.meta-grid span,.note span{display:block;color:#617b70;font-size:11px;letter-spacing:.04em}.number strong{display:block;margin-top:8px;color:#174d3f;font-size:15px}.party-grid{display:grid;grid-template-columns:1fr 1fr;gap:30px;padding:16mm 0}.party-grid strong{display:block;margin:8px 0 15px;font-size:17px}.party-grid p{margin:5px 0;color:#546b61;font-size:12px;line-height:1.55}.meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:12px 0;border-top:1px solid #d7e0da;border-bottom:1px solid #d7e0da}.meta-grid strong{display:block;margin-top:7px;font-size:12px}.items,.details{width:100%;margin-top:18mm;border-collapse:collapse;font-size:12px}.items th{padding:10px 8px;border-bottom:1px solid #b7c8bd;color:#587066;font-size:11px;text-align:left}.items td{padding:13px 8px;border-bottom:1px solid #dce5df;vertical-align:top}.items th:nth-child(n+3),.items td:nth-child(n+3){text-align:right;white-space:nowrap}.total{display:flex;justify-content:flex-end;align-items:baseline;gap:30px;margin-top:18px;color:#184f40}.total span{font-weight:700}.total strong{font-size:23px}.note{min-height:80px;margin-top:18mm;padding-top:13px;border-top:1px solid #d7e0da}.note p{margin:8px 0;color:#536a60;font-size:12px;line-height:1.6}.details th,.details td{padding:12px;border:1px solid #d6e0da;text-align:left}.details th{width:38%;background:#f1f5ef;color:#365d4b}.footer{display:flex;justify-content:space-between;gap:16px;margin-top:32mm;padding-top:12px;border-top:1px solid #d7e0da;color:#718078;font-size:11px}@media print{body{background:#fff}.sheet{margin:0;width:auto;min-height:auto}}</style></head><body><main class="sheet"><header class="head"><div><h1>${escape(title.toUpperCase())}</h1></div><div class="number"><span>เลขที่เอกสาร</span><strong>${escape(number)}</strong></div></header>${documentContent}<footer class="footer"><span>เอกสารจาก NerdNuea Stock</span><span>สถานะ: บันทึกในระบบ</span></footer></main></body></html>`);
    popup.document.close();
    if (preview) {
      const download = popup.document.createElement("button");
      download.type = "button";
      download.textContent = "ดาวน์โหลด / พิมพ์ PDF";
      Object.assign(download.style, { position: "fixed", top: "14px", right: "14px", zIndex: "10", padding: "10px 14px", border: "0", borderRadius: "8px", background: "#165846", color: "#fff", fontWeight: "700", cursor: "pointer" });
      download.addEventListener("click", () => popup.print());
      popup.document.body.append(download);
    }
    popup.focus();
    if (!preview) popup.setTimeout(() => popup.print(), 150);
  };
  return <button className="table-action" type="button" onClick={print}>{label}</button>;
}

function InvoiceDownloadButton({ name, data, storageKey }: { name: string; data?: string; storageKey?: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const download = async () => {
    if (data || !storageKey) return;
    setLoading(true);
    setMessage("");
    try {
      const file = await getAttachment(storageKey);
      if (!file) throw new Error("ไม่พบไฟล์บนเบราว์เซอร์นี้");
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name || file.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ดาวน์โหลดไฟล์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };
  if (data)
    return <a className="table-action" href={data} download={name || "invoice"}><Download size={14} /> ดาวน์โหลด</a>;
  if (storageKey)
    return <div className="button-row"><button className="table-action" type="button" onClick={download} disabled={loading}><Download size={14} /> {loading ? "กำลังโหลด" : "ดาวน์โหลด"}</button>{message && <small className="error-text">{message}</small>}</div>;
  if (!name) return <span className="muted">ยังไม่มีไฟล์แนบ</span>;
  return (
    <span className="muted">ไฟล์เดิมยังไม่มีให้ดาวน์โหลด</span>
  );
}

type DocumentReferenceType = "po" | "lot";

function lotIssueDate(db: Database, lot: Lot) {
  const purchase = entries(db, "purchase", lot.id).at(-1);
  if (purchase?.date) return purchase.date;
  const match = lot.id.match(/(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "—";
}

function matchesDocumentFilter(
  db: Database,
  lot: Lot | undefined,
  referenceType: DocumentReferenceType,
  query: string,
  fromDate: string,
  toDate: string,
) {
  if (!lot) return false;
  const reference = referenceType === "po" ? lot.poId : lot.id;
  const issueDate = lotIssueDate(db, lot);
  return (
    (!query || reference.toLowerCase().includes(query.trim().toLowerCase())) &&
    (!fromDate || issueDate >= fromDate) &&
    (!toDate || issueDate <= toDate)
  );
}

function DocumentFilterBar({
  referenceType,
  query,
  fromDate,
  toDate,
  onReferenceType,
  onQuery,
  onFromDate,
  onToDate,
}: {
  referenceType: DocumentReferenceType;
  query: string;
  fromDate: string;
  toDate: string;
  onReferenceType: (value: DocumentReferenceType) => void;
  onQuery: (value: string) => void;
  onFromDate: (value: string) => void;
  onToDate: (value: string) => void;
}) {
  const label = referenceType === "po" ? "เลข PO" : "เลข Lot";
  return (
    <section className="panel document-filter-panel">
      <div>
        <span className="overline">FILTER DOCUMENTS</span>
        <p className="muted">กรองจากวันที่ออก PO / วันที่เปิด Lot เป็นหลัก</p>
      </div>
      <div className="table-filters">
        <label className="table-filter">
          กรองตาม
          <select value={referenceType} onChange={(event) => onReferenceType(event.target.value as DocumentReferenceType)}>
            <option value="po">เลข PO</option>
            <option value="lot">เลข Lot</option>
          </select>
        </label>
        <label className="table-filter">
          ค้นหา {label}
          <input value={query} placeholder={`เช่น ${referenceType === "po" ? "PO-2026..." : "NN-2026..."}`} onChange={(event) => onQuery(event.target.value)} />
        </label>
        <label className="table-filter">
          ตั้งแต่วันที่ PO / Lot
          <input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => onFromDate(event.target.value)} />
        </label>
        <label className="table-filter">
          ถึงวันที่ PO / Lot
          <input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => onToDate(event.target.value)} />
        </label>
        <button type="button" className="secondary" onClick={() => { onQuery(""); onFromDate(""); onToDate(""); }}>
          ล้าง Filter
        </button>
      </div>
    </section>
  );
}

function InvoiceView({ db, open }: { db: Database; open: (kind: string, lotId?: string) => void }) {
  const [referenceType, setReferenceType] = useState<DocumentReferenceType>("po");
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const matches = (lot: Lot | undefined) => matchesDocumentFilter(db, lot, referenceType, query, fromDate, toDate);
  const foodDivaInvoices = entries(db, "foodDivaConfirm").filter((entry) => matches(db.lots.find((lot) => lot.id === entry.lotId)));
  const smokingInvoices = entries(db, "smokingInvoice").filter((entry) => matches(db.lots.find((lot) => lot.id === entry.lotId)));
  return (
    <div className="settings-stack">
      <section className="panel config-heading">
        <div>
          <span className="overline">INVOICE CENTER</span>
          <h2>ใบ Invoice</h2>
          <p className="muted">Owner เปิดและดาวน์โหลดไฟล์ Invoice ที่ Food Diva และ Chef_house แนบไว้ได้จากหน้านี้ โดยแยกจากเมนู PO</p>
        </div>
        <Stat label="Invoice รอตรวจยอด" value={`${smokingInvoices.filter((entry) => smokingInvoiceStatus(db, entry) === "รอตรวจยอด").length} ใบ`} />
      </section>
      <DocumentFilterBar
        referenceType={referenceType}
        query={query}
        fromDate={fromDate}
        toDate={toDate}
        onReferenceType={setReferenceType}
        onQuery={setQuery}
        onFromDate={setFromDate}
        onToDate={setToDate}
      />
      <DataTable
        title="Invoice Food Diva"
        columns={["เลข Invoice", "วันที่ Invoice", "PO / Lot", "วันที่ PO / Lot", "น้ำหนัก", "ยอดรวม", "ผู้ยืนยัน", "ไฟล์"]}
        rows={foodDivaInvoices.map((entry) => {
          const lot = db.lots.find((item) => item.id === entry.lotId);
          return [
            entry.values.invoiceNo,
            entry.values.invoiceDate,
            `${lot?.poId || "-"} / ${entry.lotId}`,
            lot ? lotIssueDate(db, lot) : "—",
            `${fmt(n(entry.values, "confirmedKg"))} กก.`,
            `฿${fmt(n(entry.values, "invoiceAmount"))}`,
            entry.values.confirmedBy || "—",
            <InvoiceDownloadButton key={entry.id} name={entry.values.attachment} data={entry.values.attachmentData} storageKey={entry.values.attachmentStorageKey} />,
          ];
        })}
      />
      <DataTable
        title="Invoice Chef_house"
        columns={["เลข Invoice", "วันที่ Invoice", "PO / Lot", "วันที่ PO / Lot", "ยอดตาม PO", "รายละเอียด", "สถานะ", "ไฟล์", "การทำงาน"]}
        rows={smokingInvoices.map((entry) => {
          const lot = db.lots.find((item) => item.id === entry.lotId);
          const status = smokingInvoiceStatus(db, entry);
          return [
            entry.values.invoiceNumber,
            entry.values.invoiceDate,
            `${lot?.poId || "-"} / ${entry.lotId}`,
            lot ? lotIssueDate(db, lot) : "—",
            `฿${fmt(n(entry.values, "netPayable"))}`,
            entry.values.invoiceDetail || "—",
            status,
            <InvoiceDownloadButton key={`file-${entry.id}`} name={entry.values.attachment} data={entry.values.attachmentData} storageKey={entry.values.attachmentStorageKey} />,
            <div className="button-row" key={`action-${entry.id}`}>
              {status === "รอตรวจยอด" && <button className="table-action" onClick={() => open("invoiceReview", entry.lotId)}>ตรวจยอด</button>}
              {status === "รอชำระ" && <button className="table-action" onClick={() => open("invoicePayment", entry.lotId)}>ชำระเงิน</button>}
            </div>,
          ];
        })}
      />
    </div>
  );
}

function SimpleTraceabilityView({ db }: { db: Database }) {
  const [referenceType, setReferenceType] = useState<DocumentReferenceType>("po");
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedLot, setExpandedLot] = useState<string | null>(null);
  const visibleLots = db.lots.filter((lot) =>
    matchesDocumentFilter(db, lot, referenceType, query, fromDate, toDate),
  );
  const preview = (title: string, number: string, rows: [string, string][]) => (
    <DocumentPrintButton title={title} number={number} rows={rows} label="พรีวิว / PDF" preview />
  );
  return (
    <div className="settings-stack document-module">
      <section className="panel config-heading">
        <div>
          <span className="overline">READ-ONLY TRACEABILITY</span>
          <h2>เอกสารและการตรวจสอบย้อนกลับ</h2>
          <p className="muted">
            ตารางสำหรับอ่านเส้นทางของแต่ละ Lot เท่านั้น การตรวจยอด ชำระเงิน และดาวน์โหลด Invoice
            ให้ทำจากเมนูใบ Invoice
          </p>
        </div>
      </section>

      <DocumentFilterBar
        referenceType={referenceType}
        query={query}
        fromDate={fromDate}
        toDate={toDate}
        onReferenceType={setReferenceType}
        onQuery={setQuery}
        onFromDate={setFromDate}
        onToDate={setToDate}
      />

      <section className="table-section traceability-table">
        <div className="table-title">
          <div><h2>ทะเบียนเอกสารตาม Lot</h2><span>{visibleLots.length} รายการ</span></div>
          <span className="muted">กด ดู เพื่อเปิดเส้นทางเอกสาร</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th aria-label="ขยายรายละเอียด" />
                <th>สถานะ</th>
                <th>เลข PO / Lot</th>
                <th>วันที่ออก PO</th>
                <th>เอกสารล่าสุด</th>
                <th>เส้นทางล่าสุด</th>
                <th>ผู้ดำเนินการล่าสุด</th>
                <th>การทำงาน</th>
              </tr>
            </thead>
            <tbody>
              {visibleLots.length ? visibleLots.map((lot) => {
                const foodInvoice = entries(db, "foodDivaConfirm", lot.id).at(-1);
                const smokeOrder = entries(db, "smokeOrder", lot.id).at(-1);
                const chefInvoice = entries(db, "smokingInvoice", lot.id).at(-1);
                const dispatch = entries(db, "dispatch", lot.id).at(-1);
                const chefReceive = entries(db, "cmReceive", lot.id).at(-1);
                const returnTrip = entries(db, "return", lot.id).at(-1);
                const smokeEntries = entries(db, "smoke", lot.id);
                const latest = [returnTrip, chefReceive, dispatch, chefInvoice, smokeOrder, foodInvoice].find(Boolean);
                const latestDocument = returnTrip
                  ? `ใบขนส่งกลับ · ${fmt(n(returnTrip.values, "returnKg"))} กก.`
                  : chefInvoice
                    ? `Invoice Chef_house · ${chefInvoice.values.invoiceNumber}`
                    : smokeOrder
                      ? `PO โรงรมควัน · ${smokeOrder.values.orderNumber}`
                      : foodInvoice
                        ? `Invoice Food Diva · ${foodInvoice.values.invoiceNo}`
                        : "รอ Invoice Food Diva";
                const route = returnTrip
                  ? "Chef_house → Food Diva"
                  : lot.stage >= 2 && lot.stage <= 5
                    ? "Food Diva → Chef_house"
                    : lot.stage >= 6
                      ? "Chef_house → Food Diva"
                      : "Food Diva · รอเริ่มขนส่ง";
                const detailRows: [string, ReactNode, string, string, ReactNode][] = [
                  ["PO เนื้อ", lot.poId, lotIssueDate(db, lot), "ออกแล้ว", preview("Purchase Order", lot.poId, purchaseOrderRows(lot, db))],
                  ["Invoice Food Diva", foodInvoice?.values.invoiceNo || "—", foodInvoice?.values.invoiceDate || "—", foodInvoice ? `ยืนยัน ${fmt(n(foodInvoice.values, "confirmedKg"))} กก.` : "รอ Food Diva", foodInvoice ? preview("Invoice Food Diva", foodInvoice.values.invoiceNo || lot.poId, [["วันที่ Invoice", foodInvoice.values.invoiceDate], ["PO", lot.poId], ["Lot เนื้อ", lot.id], ["น้ำหนักยืนยัน", `${fmt(n(foodInvoice.values, "confirmedKg"))} กก.`], ["ยอด Invoice", `฿${fmt(n(foodInvoice.values, "invoiceAmount"))}`], ["ผู้ยืนยัน", foodInvoice.values.confirmedBy || "—"]]) : "—"],
                  ["PO โรงรมควัน", smokeOrder?.values.orderNumber || "—", smokeOrder?.date || "—", smokeOrder ? `${fmt(n(smokeOrder.values, "rawKg"))} กก.` : "รอ Owner ออก PO", smokeOrder ? preview("Smoke Service Purchase Order", smokeOrder.values.orderNumber || lot.poId, [["วันที่ PO", smokeOrder.date], ["Supplier", smokeOrder.values.smoker || "Chef_house"], ["ลูกค้า", lot.values.customerName], ["ที่อยู่", lot.values.customerAddress], ["Attention", lot.values.attention], ["โทร.", lot.values.phone], ["Tax ID", lot.values.taxId], ["สินค้า", "บริการรมควันเนื้อ"], ["ขนาดบรรจุ", "—"], ["จำนวน", `${fmt(n(smokeOrder.values, "rawKg"))} กก.`], ["ราคา / กก.", `฿${fmt(n(smokeOrder.values, "serviceRate"))}`], ["ยอดรวมก่อน VAT", `฿${fmt(n(smokeOrder.values, "estimatedCost"))}`], ["Lot เนื้อ", lot.id], ["ผู้รับออเดอร์", smokeOrder.values.contactName || "—"], ["ที่อยู่ผู้ให้บริการ", smokeOrder.values.address || "—"], ["Food Diva Invoice", foodInvoice?.values.invoiceNo || "รอระบุ"], ["กำหนดเสร็จ", smokeOrder.values.expectedFinishedDate || "—"], ["หมายเหตุ", smokeOrder.values.instruction || "—"]]) : "—"],
                  ["Invoice Chef_house", chefInvoice?.values.invoiceNumber || "—", chefInvoice?.values.invoiceDate || "—", chefInvoice ? smokingInvoiceStatus(db, chefInvoice) : "รอ Chef_house Submit", chefInvoice ? preview("Invoice Chef_house", chefInvoice.values.invoiceNumber || lot.poId, [["วันที่ Invoice", chefInvoice.values.invoiceDate], ["PO โรงรมควัน", smokeOrder?.values.orderNumber || "—"], ["Lot เนื้อ", lot.id], ["ผู้ให้บริการ", chefInvoice.values.serviceProvider || "Chef_house"], ["น้ำหนักคิดค่าบริการ", `${fmt(n(chefInvoice.values, "serviceQuantity"))} กก.`], ["ยอดสุทธิ", `฿${fmt(n(chefInvoice.values, "netPayable"))}`], ["สถานะ", smokingInvoiceStatus(db, chefInvoice)]]) : "—"],
                  ["ใบขนส่งไป Chef_house", dispatch?.values.transferNumber || "—", dispatch?.values.pickupDate || "—", dispatch ? `${fmt(n(dispatch.values, "dispatchKg"))} กก.` : "รอเรียกรถ", dispatch ? preview("ใบขนส่งเนื้อขาไป", dispatch.values.transferNumber || lot.id, [["วันที่รถรับ", dispatch.values.pickupDate || dispatch.date], ["PO", lot.poId], ["Lot เนื้อ", lot.id], ["ต้นทาง", dispatch.values.origin], ["ปลายทาง", dispatch.values.destination], ["น้ำหนักส่ง", `${fmt(n(dispatch.values, "dispatchKg"))} กก.`], ["ประเภทรถ", dispatch.values.vehicleType || "—"], ["ทะเบียนรถ", dispatch.values.plate || "—"], ["คนขับ", dispatch.values.driverName || "—"], ["เบอร์ติดต่อ", dispatch.values.driverPhone || "—"]]) : "—"],
                  ["รับที่ Chef_house", chefReceive ? `${fmt(n(chefReceive.values, "receivedKg"))} กก.` : "—", chefReceive?.date || "—", chefReceive ? "รับแล้ว" : "รอยืนยันรับ", chefReceive ? preview("ใบยืนยันรับเนื้อ Chef_house", `RCV-${lot.id}`, [["PO", lot.poId], ["Lot เนื้อ", lot.id], ["วันที่รับ", chefReceive.date], ["เวลาถึง", chefReceive.values.arrival], ["น้ำหนักรับจริง", `${fmt(n(chefReceive.values, "receivedKg"))} กก.`], ["หมายเหตุ", chefReceive.values.note || "—"]]) : "—"],
                  ...smokeEntries.map((entry) => [
                    "Lot สโมครายวัน",
                    entry.values.subLot || "—",
                    entry.values.smokeDate || entry.date,
                    `เข้าเตา ${fmt(n(entry.values, "inputKg"))} กก. · หลังรม ${fmt(n(entry.values, "outputKg"))} กก. · Waste ${fmt(n(entry.values, "wasteKg"))} กก. · ${entry.values.packCount || "0"} ถุง`,
                    preview("บันทึก Lot สโมครายวัน", entry.values.subLot || entry.id, [["Lot หลัก", lot.id], ["Lot สโมค", entry.values.subLot || "—"], ["วันที่สโมค", entry.values.smokeDate || entry.date], ["น้ำหนักเข้าเตา", `${fmt(n(entry.values, "inputKg"))} กก.`], ["น้ำหนักหลังรม", `${fmt(n(entry.values, "outputKg"))} กก.`], ["น้ำหนัก Waste", `${fmt(n(entry.values, "wasteKg"))} กก.`], ["จำนวนถุง", `${entry.values.packCount || "0"} ถุง`], ["น้ำหนักถุง", entry.values.packs || "—"]]),
                  ] as [string, ReactNode, string, string, ReactNode]),
                  ["ผลผลิตหลังรม", produced(db, lot.id) ? `${fmt(produced(db, lot.id))} กก. · ${producedBags(db, lot.id)} ถุง` : "—", produced(db, lot.id) ? "บันทึกแล้ว" : "รอผลิต", produced(db, lot.id) ? "ผลิตแล้ว" : "รอ Chef_house", smokeEntries.length ? preview("สรุปผลผลิตหลังรม", `YIELD-${lot.id}`, [["PO", lot.poId], ["Lot เนื้อ", lot.id], ["จำนวน Lot สโมค", `${smokeEntries.length} รอบ`], ["น้ำหนักเข้าเตารวม", `${fmt(processed(db, lot.id))} กก.`], ["น้ำหนักหลังรมรวม", `${fmt(produced(db, lot.id))} กก.`], ["จำนวนถุง", `${producedBags(db, lot.id)} ถุง`], ["Waste รวม", `${fmt(processLoss(db, lot.id))} กก.`]]) : "—"],
                  ["ใบขนส่งกลับ Food Diva", returnTrip?.values.transferNumber || "—", returnTrip?.values.returnDate || "—", returnTrip ? `${fmt(n(returnTrip.values, "returnKg"))} กก.` : "รอเรียกรถกลับ", returnTrip ? preview("ใบขนส่งเนื้อขากลับ", returnTrip.values.transferNumber || lot.id, [["วันที่รถรับ", returnTrip.values.returnDate || returnTrip.date], ["PO", lot.poId], ["Lot เนื้อ", lot.id], ["ต้นทาง", returnTrip.values.origin], ["ปลายทาง", returnTrip.values.destination], ["น้ำหนักส่ง", `${fmt(n(returnTrip.values, "returnKg"))} กก.`], ["ประเภทรถ", returnTrip.values.vehicleType || "—"], ["ทะเบียนรถ", returnTrip.values.plate || "—"], ["คนขับ", returnTrip.values.driverName || "—"], ["เบอร์ติดต่อ", returnTrip.values.driverPhone || "—"]]) : "—"],
                ];
                const isOpen = expandedLot === lot.id;
                return <Fragment key={lot.id}>
                  <tr>
                    <td><button type="button" className="trace-expand" aria-label={`${isOpen ? "ย่อ" : "ขยาย"}รายละเอียด ${lot.id}`} onClick={() => setExpandedLot((current) => current === lot.id ? null : lot.id)}>{isOpen ? "−" : "+"}</button></td>
                    <td><span className={lot.stage >= 8 ? "badge success" : "badge danger"}>{stages[lot.stage]}</span></td>
                    <td><strong>{lot.poId}</strong><br /><span className="muted">{lot.id}</span></td>
                    <td>{lotIssueDate(db, lot)}</td>
                    <td>{latestDocument}</td>
                    <td>{route}</td>
                    <td>{latest ? roleName[latest.role] : "Owner"}</td>
                    <td><button type="button" className="table-action" onClick={() => setExpandedLot((current) => current === lot.id ? null : lot.id)}>{isOpen ? "ซ่อน" : "ดู"}</button></td>
                  </tr>
                  {isOpen && <tr className="trace-detail-row"><td colSpan={8}>
                    <div className="trace-detail-heading"><div><strong>{lot.poId} / {lot.id}</strong><span>ลำดับเอกสารและจุดตรวจสอบย้อนกลับ</span></div>{preview("สรุปเอกสารตาม Lot", `TRACE-${lot.id}`, [["PO", lot.poId], ["Lot", lot.id], ["สถานะล่าสุด", stages[lot.stage]], ["Invoice Food Diva", foodInvoice?.values.invoiceNo || "—"], ["PO โรงรมควัน", smokeOrder?.values.orderNumber || "—"], ["Invoice Chef_house", chefInvoice?.values.invoiceNumber || "—"], ["Lot สโมค", smokeEntries.map((entry) => entry.values.subLot).filter(Boolean).join(", ") || "—"], ["ใบขนส่งขาไป", dispatch?.values.transferNumber || "—"], ["ใบขนส่งขากลับ", returnTrip?.values.transferNumber || "—"]])}</div>
                    <div className="trace-detail-scroll"><table className="trace-detail-table"><thead><tr><th>เอกสาร / ขั้นตอน</th><th>เลขอ้างอิง</th><th>วันที่</th><th>สถานะ / น้ำหนัก</th><th>เอกสาร</th></tr></thead><tbody>{detailRows.map(([type, number, documentDate, status, action], index) => <tr key={`${type}-${index}`}><td>{type}</td><td>{number}</td><td>{documentDate}</td><td>{status}</td><td>{action}</td></tr>)}</tbody></table></div>
                  </td></tr>}
                </Fragment>;
              }) : <tr><td className="no-data" colSpan={8}>ยังไม่มีเอกสารตามเงื่อนไขที่เลือก</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <p className="footnote">
        หน้านี้อ่านอย่างเดียวและไม่เปลี่ยนข้อมูลใด ๆ ทุกขั้นตอนยังทำจากเมนู PO, ใบ Invoice,
        ใบขนส่ง, งานผลิต และสต๊อกตามเดิม
      </p>
    </div>
  );
}

function DocumentModuleView({ db, open }: { db: Database; open: (kind: string, lotId?: string) => void }) {
  const openPo = db.lots.filter((lot) => lot.stage < 8).length;
  const outstandingSupplier = entries(db, "supplierInvoice").filter((entry) => entry.values.paymentStatus !== "Paid");
  const outstandingSmoking = entries(db, "smokingInvoice").filter((entry) => smokingInvoiceStatus(db, entry) !== "ชำระแล้ว");
  const printDocument = () => window.print();
  return <div className="settings-stack document-module">
    <section className="panel config-heading">
      <div><span className="overline">DOCUMENT CONTROL</span><h2>เอกสารและการตรวจสอบย้อนกลับ</h2><p className="muted">เอกสารทุกฉบับอ้างอิง PO และ Beef Lot เดียวกับสต๊อก ไม่มีการลบรายการที่ยืนยันแล้ว ให้ใช้ยกเลิกเพื่อรักษาประวัติ</p></div>
      <button className="secondary" onClick={printDocument}>พิมพ์ / บันทึก PDF</button>
    </section>
    <section className="dashboard-kpis document-kpis">
      <article className="kpi-card"><small>Open PO</small><strong>{openPo}</strong><small>Lot ที่ยังดำเนินการ</small></article>
      <article className="kpi-card"><small>Supplier Invoice ค้างชำระ</small><strong>{outstandingSupplier.length}</strong><small>ใบ</small></article>
      <article className="kpi-card"><small>Smoking Invoice ค้างชำระ</small><strong>{outstandingSmoking.length}</strong><small>ใบ</small></article>
      <article className="kpi-card"><small>Average Yield</small><strong>{fmt(averageYield(db))}%</strong><small>ทุก Smoke Batch</small></article>
    </section>
    <DataTable title="Beef Lot traceability และสถานะสต๊อก" columns={["PO / Beef Lot", "ซื้อจาก", "Food Diva", "ที่โรงรม", "Steak", "หลังรม", "Loss / Yield", "เอกสารต่อไป"]} rows={db.lots.map((lot) => {
      const smokeInput = processed(db, lot.id);
      const yieldPct = smokeInput > 0 ? produced(db, lot.id) / smokeInput * 100 : 0;
      const hasSmokeOrder = entries(db, "smokeOrder", lot.id).length;
      return [
        <span key="lot"><strong>{lot.poId}</strong><br />{lot.id}</span>,
        `${lot.values.supplier || "Food Diva"} · ${fmt(n(lot.values, "orderedKg"))} กก.`,
        `${fmt(rawAtFoodDiva(db, lot))} กก.`, `${fmt(rawAtSmoker(db, lot))} กก.`, `${fmt(steakRawStock(db, lot.id))} กก.`, `${fmt(produced(db, lot.id))} กก.`,
        smokeInput ? `${fmt(processLoss(db, lot.id))} กก. / ${fmt(yieldPct)}%` : "รอผลิต",
        <div className="button-row" key="action">
          <button className="table-action" onClick={() => open("taxDocument", lot.id)}>ภาษี</button>
          {entries(db, "foodDivaConfirm", lot.id).length > 0 && !hasSmokeOrder && <span className="muted">ออก PO จากเมนูใบสั่ง PO โรงรมควัน</span>}
          {rawAtFoodDiva(db, lot) > 0.001 && <button className="table-action" onClick={() => open("steakTransfer", lot.id)}>โอนไป Steak</button>}
          {entries(db, "smokeOrder", lot.id).length > 0 && <span className="muted">Chef_house ออกใบวางบิลจากเมนูงานผลิต</span>}
        </div>,
      ];
    })} />
    <DataTable title="Stock Transfer Document" columns={["เลขโอน", "วันที่", "PO / Lot", "ต้นทาง → ปลายทาง", "ส่งออก", "รับจริง", "สถานะ", "เอกสาร"]} rows={[
      ...entries(db, "dispatch").map((entry) => { const lot = db.lots.find((item) => item.id === entry.lotId); const number = entry.values.transferNumber || entry.id.slice(0, 8); return [number, entry.date, `${lot?.poId || "-"} / ${entry.lotId}`, `${entry.values.origin} → ${entry.values.destination}`, `${fmt(n(entry.values, "dispatchKg"))} กก.`, `${fmt(n(lot?.values || {}, "receivedKg"))} กก.`, lot?.stage && lot.stage >= 2 ? "Received by Chef_house" : "In Transit", <DocumentPrintButton key={entry.id} title="Stock Transfer Document" number={number} rows={[["วันที่", entry.date], ["PO", lot?.poId || "-"], ["Beef Lot", entry.lotId], ["ต้นทาง", entry.values.origin], ["ปลายทาง", entry.values.destination], ["น้ำหนักส่ง", `${fmt(n(entry.values, "dispatchKg"))} กก.`], ["ทะเบียนรถ", entry.values.plate || "-"], ["คนขับ", entry.values.driverName || "-"]]} />]; }),
      ...entries(db, "steakTransfer").map((entry) => { const lot = db.lots.find((item) => item.id === entry.lotId); return [entry.values.transferNumber, entry.values.transferDate, `${lot?.poId || "-"} / ${entry.lotId}`, "Food Diva / Raw Meat Storage → Steak Production", `${fmt(n(entry.values, "quantityKg"))} กก.`, `${fmt(n(entry.values, "quantityKg"))} กก.`, "Received", <DocumentPrintButton key={entry.id} title="Internal Stock Transfer to Steak" number={entry.values.transferNumber} rows={[["วันที่", entry.values.transferDate], ["PO", lot?.poId || "-"], ["Beef Lot", entry.lotId], ["ต้นทาง", entry.values.sourceLocation], ["ปลายทาง", entry.values.destinationLocation], ["จำนวน", `${fmt(n(entry.values, "quantityKg"))} กก.`], ["เหตุผล", entry.values.reason]]} />]; }),
    ]} />
    <DataTable title="Supplier Invoice และ Tax documents" columns={["ประเภท", "เลขที่", "วันที่", "PO / Lot", "ยอดรวม", "VAT", "สถานะ", "เอกสาร"]} rows={[
      ...entries(db, "foodDivaConfirm").map((entry) => { const lot = db.lots.find((item) => item.id === entry.lotId); return ["Food Diva Meat Invoice", entry.values.invoiceNo, entry.values.invoiceDate, `${lot?.poId || "-"} / ${entry.lotId}`, `฿${fmt(n(entry.values, "invoiceAmount"))}`, "—", "Food Diva ยืนยันแล้ว", <DocumentPrintButton key={entry.id} title="Food Diva Meat Invoice" number={entry.values.invoiceNo} rows={[["วันที่ Invoice", entry.values.invoiceDate], ["Food Diva", entry.values.confirmedBy], ["PO", lot?.poId || "-"], ["Beef Lot", entry.lotId], ["จำนวน", `${fmt(n(entry.values, "confirmedKg"))} กก.`], ["ยอดรวม", `฿${fmt(n(entry.values, "invoiceAmount"))}`], ["ไฟล์แนบ", entry.values.attachment]]} />]; }),
      ...entries(db, "supplierInvoice").map((entry) => { const lot = db.lots.find((item) => item.id === entry.lotId); return ["Supplier Invoice", entry.values.invoiceNumber, entry.values.invoiceDate, `${lot?.poId || "-"} / ${entry.lotId}`, `฿${fmt(n(entry.values, "totalAmount"))}`, `฿${fmt(n(entry.values, "vat"))}`, entry.values.paymentStatus, <DocumentPrintButton key={entry.id} title="Supplier Invoice Record" number={entry.values.invoiceNumber} rows={[["วันที่ Invoice", entry.values.invoiceDate], ["Supplier", lot?.values.supplier || "Food Diva"], ["PO", lot?.poId || "-"], ["Beef Lot", entry.lotId], ["จำนวน", `${fmt(n(entry.values, "quantityKg"))} กก.`], ["ยอดก่อน VAT", `฿${fmt(n(entry.values, "amountBeforeVat"))}`], ["VAT", `฿${fmt(n(entry.values, "vat"))}`], ["ยอดรวม", `฿${fmt(n(entry.values, "totalAmount"))}`], ["ครบกำหนด", entry.values.dueDate], ["สถานะชำระ", entry.values.paymentStatus]]} />]; }),
      ...entries(db, "taxDocument").map((entry) => { const lot = db.lots.find((item) => item.id === entry.lotId); return [entry.values.documentType, entry.values.documentNumber, entry.values.documentDate, `${lot?.poId || "-"} / ${entry.lotId}`, `฿${fmt(n(entry.values, "amount"))}`, `฿${fmt(n(entry.values, "vat"))}`, entry.values.attachment ? "แนบไฟล์แล้ว" : "รอแนบไฟล์", <DocumentPrintButton key={entry.id} title={entry.values.documentType} number={entry.values.documentNumber} rows={[["วันที่เอกสาร", entry.values.documentDate], ["Supplier", lot?.values.supplier || "Food Diva"], ["PO", lot?.poId || "-"], ["ยอด", `฿${fmt(n(entry.values, "amount"))}`], ["VAT", `฿${fmt(n(entry.values, "vat"))}`], ["ไฟล์แนบ", entry.values.attachment || "—"]]} />]; }),
      ...entries(db, "smokingInvoice").map((entry) => { const lot = db.lots.find((item) => item.id === entry.lotId); const status = smokingInvoiceStatus(db, entry); return ["Smoking Service Invoice", entry.values.invoiceNumber, entry.values.invoiceDate, `${lot?.poId || "-"} / ${entry.lotId}`, `฿${fmt(n(entry.values, "netPayable"))}`, `฿${fmt(n(entry.values, "vat"))}`, status, <div className="button-row" key={entry.id}><DocumentPrintButton title="Smoking Service Invoice" number={entry.values.invoiceNumber} rows={[["วันที่ Invoice", entry.values.invoiceDate], ["ผู้ให้บริการ", entry.values.serviceProvider], ["PO", lot?.poId || "-"], ["Beef Lot", entry.lotId], ["จำนวนคิดค่าบริการ", `${fmt(n(entry.values, "serviceQuantity"))} กก.`], ["ยอดก่อน VAT", `฿${fmt(n(entry.values, "amountBeforeVat"))}`], ["VAT", `฿${fmt(n(entry.values, "vat"))}`], ["หัก ณ ที่จ่าย", `฿${fmt(n(entry.values, "withholdingTax"))}`], ["ยอดสุทธิ", `฿${fmt(n(entry.values, "netPayable"))}`], ["ไฟล์แนบ", entry.values.attachment]]} />{status === "รอตรวจยอด" && <button className="table-action" onClick={() => open("invoiceReview", entry.lotId)}>ตรวจยอด</button>}{status === "รอชำระ" && <button className="table-action" onClick={() => open("invoicePayment", entry.lotId)}>ชำระเงิน</button>}</div>]; }),
    ]} />
    <DataTable title="PO รมควัน และผลผลิต" columns={["Smoke Order", "Lot", "น้ำหนักดิบ", "Chef_house รับ PO", "วันที่ขอรม", "Smoke Batch", "น้ำหนักหลังรม", "Loss", "Yield", "เอกสาร"]} rows={entries(db, "smokeOrder").map((order) => {
      const smokeEntries = entries(db, "smoke", order.lotId);
      const accepted = entries(db, "smokeOrderAccept", order.lotId).at(-1);
      const input = smokeEntries.reduce((sum, entry) => sum + n(entry.values, "inputKg"), 0);
      const output = smokeEntries.reduce((sum, entry) => sum + n(entry.values, "outputKg"), 0);
      return [order.values.orderNumber, order.lotId, `${fmt(n(order.values, "rawKg"))} กก.`, accepted ? `${accepted.values.acceptedBy} · รับแล้ว` : "รอยืนยันรับ", order.values.requestedSmokeDate, smokeEntries.map((entry) => entry.values.subLot).filter(Boolean).join(", ") || "รอผล", `${fmt(output)} กก.`, `${fmt(Math.max(0, input - output))} กก.`, input ? `${fmt(output / input * 100)}%` : "—", <DocumentPrintButton key={order.id} title="Smoke Service Order" number={order.values.orderNumber} rows={[["วันที่สั่งงาน", order.date], ["โรงรม", order.values.smoker], ["Beef Lot", order.lotId], ["น้ำหนักเนื้อดิบ", `${fmt(n(order.values, "rawKg"))} กก.`], ["Chef_house รับ PO", accepted?.values.acceptedBy || "รอยืนยันรับ"], ["วันที่ขอรม", order.values.requestedSmokeDate], ["อัตราค่ารม", `฿${fmt(n(order.values, "serviceRate"))} / กก.`], ["ค่าบริการประมาณการ", `฿${fmt(n(order.values, "estimatedCost"))}`], ["คำสั่งพิเศษ", order.values.instruction || "—"], ["คาดว่าเสร็จ", order.values.expectedFinishedDate]]} />];
    })} />
    <p className="footnote">ข้อมูลบันทึกด้วยบทบาทและเวลาอัตโนมัติใน Log ของระบบ เอกสารที่ยืนยันแล้วใช้การยกเลิก/ปรับปรุงแทนการลบ เพื่อให้ย้อนรอยได้</p>
  </div>;
}

// Kept temporarily so older document-control markup can be reused without affecting the read-only view.
void DocumentModuleView;

function TransportManifestView({
  db,
  open,
}: {
  db: Database;
  open: (kind: string, lotId?: string) => void;
}) {
  const returnEntry = (lotId: string) => entries(db, "return", lotId).at(-1);
  const tripStatus = (lot: Lot) => {
    const invoice = entries(db, "smokingInvoice", lot.id).at(-1);
    const invoiceStatus = invoice ? smokingInvoiceStatus(db, invoice) : "";
    if (lot.stage === 1 && !entries(db, "foodDivaConfirm", lot.id).length)
      return <span className="badge danger">รอ Food Diva ออก Invoice</span>;
    if (lot.stage === 1 && !entries(db, "smokeOrder", lot.id).length)
      return <span className="badge danger">รอ Owner ออก PO รมควัน</span>;
    if (lot.stage === 1 && !entries(db, "smokeOrderAccept", lot.id).length)
      return <span className="badge danger">รอ Chef_house รับ PO</span>;
    if (lot.stage === 1 && !entries(db, "smokingInvoice", lot.id).length)
      return <span className="badge danger">รอ Chef_house Submit Invoice</span>;
    if (lot.stage === 1 && invoiceStatus === "รอตรวจยอด")
      return <button className="table-action" onClick={() => open("invoiceReview", lot.id)}>ตรวจ Invoice เพื่อเรียกรถ</button>;
    if (lot.stage === 1 && invoiceStatus === "รอชำระ")
      return <button className="table-action" onClick={() => open("invoicePayment", lot.id)}>ชำระ Invoice เพื่อเรียกรถ</button>;
    if (lot.stage === 1 && invoiceStatus !== "ชำระแล้ว")
      return <span className="badge danger">รอ Chef_house แก้ Invoice</span>;
    if (lot.stage === 1)
      return <button className="table-action" onClick={() => open("dispatch", lot.id)}>ทำใบขนส่งขาไป</button>;
    if (lot.stage === 6)
      return <button className="table-action" onClick={() => open("return", lot.id)}>เรียกรถขากลับ · {fmt(produced(db, lot.id))} กก.</button>;
    if (lot.stage < 6) return "กำลังดำเนินงานที่ Chef_house";
    if (lot.stage === 7 && !entries(db, "foodDivaReturnReceive", lot.id).length) return "รอ Food Diva รับเข้าตู้";
    return "Food Diva รับเข้าตู้แล้ว";
  };
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>ใบขนส่งเนื้อ</h2>
          <p className="muted">Owner เรียกรถและบันทึกใบขนส่งทั้ง Food Diva → Chef_house และ Chef_house → Food Diva</p>
        </div>
      </div>
      <DataTable
        title="รายการขนส่งตาม Lot"
        columns={["เลข PO", "Lot", "ขาไป · Food Diva → Chef_house", "เทียบน้ำหนัก Owner", "ขากลับ · Chef_house → Food Diva", "การทำงาน"]}
        rows={db.lots.map((lot) => {
          const back = returnEntry(lot.id);
          const outbound = entries(db, "dispatch", lot.id).at(-1);
          const chefReceive = entries(db, "cmReceive", lot.id).at(-1);
          const foodInvoice = entries(db, "foodDivaConfirm", lot.id).at(-1);
          const foodDivaKg = n(foodInvoice?.values || {}, "confirmedKg");
          const chefKg = n(chefReceive?.values || {}, "receivedKg");
          const difference = chefKg - foodDivaKg;
          return [
            lot.poId,
            lot.id,
            outbound
              ? <div className="button-row" key={`${lot.id}-outbound`}><span>{`${fmt(n(outbound.values, "dispatchKg"))} กก. · ${outbound.values.plate || "ยังไม่ระบุรถ"}`}</span><DocumentPrintButton title="ใบขนส่งเนื้อขาไป" number={outbound.values.transferNumber || outbound.id.slice(0, 8)} label="พรีวิว / PDF" preview rows={[["วันที่รถรับ", outbound.values.pickupDate || outbound.date], ["PO", lot.poId], ["Lot เนื้อ", lot.id], ["ต้นทาง", outbound.values.origin], ["ปลายทาง", outbound.values.destination], ["น้ำหนักส่ง", `${fmt(n(outbound.values, "dispatchKg"))} กก.`], ["ประเภทรถ", outbound.values.vehicleType || "—"], ["ทะเบียนรถ", outbound.values.plate || "—"], ["คนขับ", outbound.values.driverName || "—"], ["เบอร์ติดต่อ", outbound.values.driverPhone || "—"]]} /></div>
              : `พร้อมส่งเชียงใหม่ ${fmt(readyForChefHouse(db, lot.id))} กก. · รอทำใบขนส่ง`,
            chefReceive
              ? <span key={`${lot.id}-owner-check`}><strong>Food Diva:</strong> {fmt(foodDivaKg)} กก.<br /><strong>Chef_house:</strong> {fmt(chefKg)} กก.<br /><span className={Math.abs(difference) > 0.001 ? "badge danger" : "badge success"}>ส่วนต่าง {fmt(difference)} กก.</span></span>
              : "รอ Chef_house ชั่งรับ",
            back
              ? <div className="button-row" key={`${lot.id}-return`}><span>{`${back.values.returnDate || "ยังไม่ระบุวัน"} · ${back.values.plate || "ยังไม่ระบุรถ"}`}</span><DocumentPrintButton title="ใบขนส่งเนื้อขากลับ" number={back.values.transferNumber || back.id.slice(0, 8)} label="พรีวิว / PDF" preview rows={[["วันที่รถรับ", back.values.returnDate || back.date], ["PO", lot.poId], ["Lot เนื้อ", lot.id], ["ต้นทาง", back.values.origin], ["ปลายทาง", back.values.destination], ["น้ำหนักส่ง", `${fmt(n(back.values, "returnKg"))} กก.`], ["ประเภทรถ", back.values.vehicleType || "—"], ["ทะเบียนรถ", back.values.plate || "—"], ["คนขับ", back.values.driverName || "—"], ["เบอร์ติดต่อ", back.values.driverPhone || "—"]]} /></div>
              : lot.stage < 6
                ? "รอ Chef_house ปิด Lot"
                : `รอเรียกรถกลับ ${fmt(produced(db, lot.id))} กก.`,
            tripStatus(lot),
          ];
        })}
      />
    </>
  );
}
function CentralReceiveView({
  db,
  open,
}: {
  db: Database;
  open: (kind: string, lotId?: string) => void;
}) {
  const readyToReceive = db.lots.filter((lot) => lot.stage === 7 && entries(db, "foodDivaReturnReceive", lot.id).length);
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Owner รับของจาก Food Diva เข้าสต๊อกกลาง</h2>
          <p className="muted">Food Diva ต้องยืนยันรับเนื้อรมควันเข้าตู้ก่อน Owner จึงรับเข้าสต๊อกกลางและจัดสรรสาขาได้</p>
        </div>
      </div>
      <DataTable
        title="Lot ที่รอรับเข้าคลังกลาง"
        columns={["Lot", "Food Diva รับจริง", "จำนวนถุง", "ใบขนส่งกลับ", "สถานะ", "การทำงาน"]}
        rows={readyToReceive.map((lot) => {
          const back = entries(db, "return", lot.id).at(-1);
          return [
            lot.id,
            `${fmt(n(entries(db, "foodDivaReturnReceive", lot.id).at(-1)?.values || {}, "receivedKg"))} กก.`,
            `${entries(db, "foodDivaReturnReceive", lot.id).at(-1)?.values.receivedBags || producedBags(db, lot.id)} ถุง`,
            back
              ? `${back.values.returnDate || "ยังไม่ระบุวัน"} · ${back.values.plate || "ยังไม่ระบุรถ"}`
              : "ยังไม่มีใบขนส่งขากลับ",
            "รอรับเข้าสต๊อกกลาง",
            <button className="table-action" key={lot.id} onClick={() => open("central", lot.id)}>
              รับเข้าคลังกลาง
            </button>,
          ];
        })}
      />
      {!readyToReceive.length && (
        <div className="notice success">ไม่มี Lot รอรับเข้าสต๊อกกลางในขณะนี้</div>
      )}
    </>
  );
}
function OwnerDailyStatus({ db, date }: { db: Database; date: string }) {
  const [branchFilter, setBranchFilter] = useState("ทั้งหมด");
  const defaultStart = new Date(`${date}T00:00:00Z`);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 6);
  const [startDate, setStartDate] = useState(defaultStart.toISOString().slice(0, 10));
  const required = (name: string) =>
    name === "มีนบุรี"
      ? ["ricePurchase", "riceCarry", "materials", "sale", "closeDay"]
      : ["riceIssue", "rice", "materials", "sale", "closeDay"];
  const dayNumber = (value: string) =>
    Date.UTC(
      Number(value.slice(0, 4)),
      Number(value.slice(5, 7)) - 1,
      Number(value.slice(8, 10)),
    );
  const visibleBranches =
    branchFilter === "ทั้งหมด" ? branches : [branchFilter];
  const dates: string[] = [];
  for (let cursor = dayNumber(startDate); cursor <= dayNumber(date); cursor += 86400000)
    dates.push(new Date(cursor).toISOString().slice(0, 10));
  const rows = visibleBranches.flatMap((name) =>
    dates.flatMap((workDate) => {
      const missing = required(name).filter(
        (kind) => !entries(db, kind, undefined, name, workDate).length,
      );
      if (!missing.length)
        return [[
          workDate,
          <strong key={`${name}-${workDate}`}>{name}</strong>,
          "กรอกครบทุกหัวข้อ",
          "0 วัน",
          <span className="badge" key="complete">ครบแล้ว</span>,
        ]];
      return missing.map((kind) => [
        workDate,
        <strong key={`${name}-${workDate}-${kind}`}>{name}</strong>,
        titles[kind],
        `${Math.max(1, Math.round((dayNumber(date) - dayNumber(workDate)) / 86400000))} วัน`,
        <span className="badge danger" key="pending">ค้างกรอก</span>,
      ]);
    }),
  );
  return (
    <DataTable
      title={`ติดตามงานผู้จัดการสาขา · ${startDate} ถึง ${date}`}
      columns={["วันที่", "สาขา", "รายการ", "ค้างมาแล้ว", "สถานะ"]}
      rows={rows}
      action={
        <div className="table-filters">
        <label className="table-filter">ตั้งแต่
          <input type="date" max={date} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label className="table-filter">สาขา
          <select
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
          >
            <option>ทั้งหมด</option>
            {branches.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label></div>
      }
    />
  );
}
function MaterialReceiptConfirmation({ db, branch, date, closed }: { db: Database; branch: string; date: string; closed: boolean }) {
  const pending = entries(db, "materialTransfer", undefined, branch)
    .filter((transfer) => transfer.values.requiresConfirm &&
      !entries(db, "materialConfirm", undefined, branch).some((entry) => entry.values.transferId === transfer.id));
  const [draft, setDraft] = useState<Values>({});
  const [message, setMessage] = useState("");
  const confirm = (transfer: Entry) => {
    try {
      const receivedQuantity = draft[`quantity-${transfer.id}`] || transfer.values.quantity;
      const next = mutate(latestDatabase(), "branch", "materialConfirm", {
        transferId: transfer.id,
        receivedQuantity,
        receiver: draft.receiver || `ผู้ดูแลสาขา ${branch}`,
        reason: draft[`reason-${transfer.id}`] || "",
      }, "", date);
      saveDatabase(next);
      setMessage(`ยืนยันรับ ${transfer.values.material} แล้ว`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ยืนยันรับไม่สำเร็จ");
    }
  };
  return <>
    <DataTable
      title="รายการวัสดุรอยืนยันรับ (Pending material receipts)"
      columns={["วันที่ส่ง", "วัสดุ", "จำนวนที่ส่ง", "จำนวนที่รับจริง", "เหตุผลส่วนต่าง", "การทำงาน"]}
      rows={pending.map((transfer) => [
        transfer.date,
        transfer.values.material,
        transfer.values.quantity,
        <input key={`q-${transfer.id}`} className="table-edit-control" type="number" min="1" max={transfer.values.quantity} step="1" value={draft[`quantity-${transfer.id}`] ?? transfer.values.quantity} onChange={(event) => setDraft((current) => ({...current, [`quantity-${transfer.id}`]: event.target.value}))} />,
        <input key={`r-${transfer.id}`} className="table-edit-control reason-control" placeholder="กรอกเมื่อรับไม่ครบ" value={draft[`reason-${transfer.id}`] || ""} onChange={(event) => setDraft((current) => ({...current, [`reason-${transfer.id}`]: event.target.value}))} />,
        <button key={`b-${transfer.id}`} className="table-action" disabled={closed} onClick={() => confirm(transfer)}>ยืนยันรับ</button>,
      ])}
      action={<label className="table-filter">ชื่อผู้รับจริง<input value={draft.receiver || ""} placeholder={`ผู้ดูแลสาขา ${branch}`} onChange={(event) => setDraft((current) => ({...current, receiver: event.target.value}))} /></label>}
    />
    {message && <div className="notice">{message}</div>}
  </>;
}
function DailyMaterialsTable({
  db,
  branch,
  date,
  disabled,
}: {
  db: Database;
  branch: string;
  date: string;
  disabled: boolean;
}) {
  const saved = entries(db, "materials", undefined, branch, date).at(-1);
  const [draft, setDraft] = useState<Values>(() =>
    Object.fromEntries(
      materials.flatMap((_, i) => [
        ["used" + i, "0"],
        ["actual" + i, ""],
        ["materialReason" + i, ""],
      ]),
    ),
  );
  const [message, setMessage] = useState("");
  const opening = (i: number) =>
    saved
      ? n(saved.values, "opening" + i)
      : branchMaterialStock(db, branch, i, date);
  const used = (i: number) =>
    saved ? n(saved.values, "used" + i) : n(draft, "used" + i);
  const remaining = (i: number) =>
    saved
      ? n(saved.values, "material" + i)
      : draft["actual" + i] === ""
        ? opening(i) - used(i)
        : n(draft, "actual" + i);

  function saveMaterials() {
    try {
      const values: Values = {};
      materials.forEach((_, i) => {
        values["opening" + i] = String(opening(i));
        values["used" + i] = String(used(i));
        values["material" + i] = String(remaining(i));
        values["materialReason" + i] = draft["materialReason" + i] || "";
      });
      const next = mutate(
        latestDatabase(),
        "branch",
        "materials",
        values,
        "",
        date,
      );
      saveDatabase(next);
      setMessage("บันทึกการใช้วัสดุวันนี้แล้ว");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <>
      <DataTable
        title="วัสดุ 7 รายการ · กรอกการใช้วันนี้"
        columns={["วัสดุ", "ยอดตั้งต้น", "ใช้วันนี้", "ยอดที่ควรเหลือ", "ตรวจนับจริง", "เหตุผลส่วนต่าง", "สถานะ"]}
        action={
          <button
            className="primary"
            disabled={disabled || !!saved}
            onClick={saveMaterials}
          >
            {saved ? "บันทึกแล้ว" : "บันทึกการใช้วัสดุ"}
          </button>
        }
        rows={materials.map((item, i) => [
          <strong key={item}>{item}</strong>,
          String(opening(i)),
          saved ? (
            String(used(i))
          ) : (
            <input
              key={`used-${i}`}
              className="table-edit-control"
              type="number"
              min="0"
              max={opening(i)}
              step="1"
              value={draft["used" + i] || "0"}
              disabled={disabled}
              aria-label={`จำนวนใช้ ${item} วันนี้`}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  ["used" + i]: event.target.value,
                }));
                setMessage("");
              }}
            />
          ),
          String(opening(i) - used(i)),
          saved ? String(remaining(i)) : (
            <input
              key={`actual-${i}`}
              className="table-edit-control"
              type="number"
              min="0"
              step="1"
              placeholder={String(opening(i) - used(i))}
              value={draft["actual" + i] ?? ""}
              disabled={disabled}
              aria-label={`ยอดตรวจนับจริง ${item}`}
              onChange={(event) => setDraft((current) => ({
                ...current,
                ["actual" + i]: event.target.value,
              }))}
            />
          ),
          saved ? (saved.values["materialReason" + i] || "—") : (
            <input
              key={`reason-${i}`}
              className="table-edit-control reason-control"
              type="text"
              placeholder="กรอกเมื่อยอดไม่ตรง"
              value={draft["materialReason" + i] || ""}
              disabled={disabled || remaining(i) === opening(i) - used(i)}
              aria-label={`เหตุผลส่วนต่าง ${item}`}
              onChange={(event) => setDraft((current) => ({
                ...current,
                ["materialReason" + i]: event.target.value,
              }))}
            />
          ),
          saved ? "บันทึกแล้ว" : opening(i) ? "รอบันทึก" : "Owner ยังไม่ตั้งฐาน",
        ])}
      />
      {message && <div className="notice">{message}</div>}
    </>
  );
}
function BranchDailyWorkflow({ db, branch, date, lots, closed, open }: { db: Database; branch: string; date: string; lots: Lot[]; closed: boolean; open: (kind: string, lotId?: string) => void }) {
  const pending = lots.filter((lot) => entries(db, "allocate", lot.id, branch).reduce((sum, entry) => sum + n(entry.values, "kg"), 0) > balance(db, lot.id, branch).received + 0.001);
  const frozen = lots.filter((lot) => balance(db, lot.id, branch).frozen > 0.001);
  const ready = lots.filter((lot) => balance(db, lot.id, branch).ready > 0.001);
  const saleDone = entries(db, "sale", undefined, branch, date).length > 0;
  const tasks: ReactNode[][] = [
    [<strong key="receive">1. รับเนื้อเข้าสาขา</strong>, pending.length ? <span className="task-alert" key="new">งานเข้าใหม่ {pending.length} Lot</span> : "ไม่มีรายการรอรับ", pending.length ? <button className="table-action" disabled={closed} onClick={() => open("receive", pending[0].id)}>รับของ</button> : "-"],
    [<strong key="thaw">2. แบ่งละลายเนื้อ</strong>, frozen.length ? <span className="task-alert" key="need">ต้องเลือกเนื้อที่จะละลาย</span> : "ไม่มีเนื้อแช่แข็ง", frozen.length ? <button className="table-action" disabled={closed} onClick={() => open("thaw", frozen[0].id)}>แบ่งละลาย</button> : "-"],
    [<strong key="sale">3. บันทึกยอดขาย</strong>, ready.length && !saleDone ? <span className="task-alert" key="sales">ต้องกรอกก่อนปิดวัน</span> : saleDone ? "บันทึกแล้ว" : "รอเนื้อพร้อมขาย", ready.length ? <button className="table-action" disabled={closed} onClick={() => open("sale", ready[0].id)}>บันทึกยอดขาย</button> : "-"],
    [<strong key="close">4. ปิดวัน</strong>, closed ? "ปิดวันแล้ว" : saleDone ? "พร้อมตรวจและปิดวัน" : "รอยอดขาย", <button key="close-action" className="table-action" disabled={closed || !saleDone} onClick={() => open("closeDay")}>ปิดวัน</button>],
  ];
  return <DataTable title={`งานหลักประจำวัน · ${branch}`} columns={["ลำดับงาน", "สถานะ", "ทำรายการ"]} rows={tasks} />;
}
function DailyTaskTable({
  title,
  kinds,
  db,
  branch,
  date,
  disabled,
  hasLots,
  open,
}: {
  title: string;
  kinds: string[];
  db: Database;
  branch: string;
  date: string;
  disabled: boolean;
  hasLots: boolean;
  open: (kind: string, lotId?: string) => void;
}) {
  return (
    <DataTable
      title={title}
      columns={["รายการ", "สถานะ", "จำนวนรายการ", "การทำงาน"]}
      rows={kinds.map((kind) => {
        const count = entries(db, kind, undefined, branch, date).length;
        const optional = kind === "ricePurchase" || kind === "chiliPurchase";
        const label = kind === "ricePurchase" && branch === "ศาลาแดง"
          ? "ซื้อข้าวเหนียวดิบเข้าสต๊อก · กก."
          : titles[kind];
        return [
          optional ? `${label} · บันทึกเฉพาะวันที่ซื้อ` : label,
          count ? "บันทึกแล้ว" : optional ? "ไม่บังคับวันนี้" : "รอบันทึก",
          String(count),
          <button
            key={kind}
            className="table-action"
            disabled={disabled || (kind === "sale" && !hasLots)}
            onClick={() => open(kind)}
          >
            {kind === "closeDay" ? "ตรวจและปิดวัน" : "กรอกข้อมูล"}
          </button>,
        ];
      })}
    />
  );
}
function MeatMovementLogView({ db }: { db: Database }) {
  const [lotFilter, setLotFilter] = useState("ทั้งหมด");
  const lots = db.lots.filter((lot) => lotFilter === "ทั้งหมด" || lot.id === lotFilter);
  const locationRows = lots.flatMap((lot) => {
    const returnReceived = n(
      entries(db, "foodDivaReturnReceive", lot.id).at(-1)?.values || {},
      "receivedKg",
    );
    const foodDivaSmoked = Math.max(0, returnReceived - n(lot.values, "centralKg"));
    const chefSmoked = lot.stage === 6 && !entries(db, "return", lot.id).length
      ? produced(db, lot.id)
      : 0;
    return [
      [lot.poId, lot.id, "Food Diva · เนื้อดิบ", `${fmt(rawAtFoodDiva(db, lot))} กก.`, "คงเหลือจาก PO ก่อนส่ง Chef_house"],
      [lot.poId, lot.id, "Food Diva · เนื้อส่วนที่เหลือรอ Owner รับ (Waste)", `${fmt(ownerWasteOutstanding(db, lot.id))} กก.`, `Owner รับแล้ว ${fmt(ownerWasteReceived(db, lot.id))} กก.`],
      [lot.poId, lot.id, "Owner · เนื้อส่วนที่รับแล้ว (Waste)", `${fmt(ownerWasteReceived(db, lot.id))} กก.`, "รับจาก Food Diva สำหรับใช้งาน Owner"],
      [lot.poId, lot.id, "Chef_house · รอเข้ารอบสโมค", `${fmt(rawAtSmoker(db, lot))} กก.`, "น้ำหนักรับจริง หักรอบที่สโมคแล้ว"],
      [lot.poId, lot.id, "Chef_house · เนื้อรมพร้อมเรียกรถ", `${fmt(chefSmoked)} กก.`, chefSmoked > 0 ? `${producedBags(db, lot.id)} ถุง · ปิด Lot แล้ว` : "—"],
      [lot.poId, lot.id, "Food Diva · เนื้อรมควัน", `${fmt(foodDivaSmoked)} กก.`, foodDivaSmoked > 0 ? "รับจาก Chef_house แล้ว รอ Owner รับเข้าคลังกลาง" : "—"],
      [lot.poId, lot.id, "คลังกลาง Owner", `${fmt(centralStock(db, lot.id))} กก.`, `${centralBagStock(db, lot.id)} ถุง พร้อมจัดสรร`],
      ...branches.map((branchName) => {
        const stock = balance(db, lot.id, branchName);
        return [
          lot.poId,
          lot.id,
          branchName,
          `${fmt(stock.frozen + stock.ready)} กก.`,
          `แช่แข็ง ${fmt(stock.frozen)} · พร้อมขาย ${fmt(stock.ready)}`,
        ];
      }),
    ];
  });
  const descriptions: Record<string, (entry: Entry) => [string, string, string]> = {
    foodDivaConfirm: (entry) => ["Food Diva", "ยืนยัน Invoice และแบ่งเนื้อ", `Invoice ${fmt(n(entry.values, "confirmedKg"))} · ส่งเชียงใหม่ ${fmt(n(entry.values, "readyForChiangMaiKg"))} · รอ Owner รับ (Waste) ${fmt(n(entry.values, "reservedForOwnerKg"))} กก.`],
    ownerWasteReceive: (entry) => ["Owner", "รับเนื้อส่วนที่เหลือจาก Food Diva", `${fmt(n(entry.values, "receivedKg"))} กก. · ${entry.values.receiver}`],
    dispatch: (entry) => ["Food Diva → Chef_house", "ส่งเนื้อดิบ", `${fmt(n(entry.values, "dispatchKg"))} กก.`],
    cmReceive: (entry) => ["Chef_house", "ชั่งรับเนื้อจริง", `${fmt(n(entry.values, "receivedKg"))} กก.`],
    smoke: (entry) => ["Chef_house", `สโมครอบ ${entry.values.subLot || "—"}`, `เข้าเตา ${fmt(n(entry.values, "inputKg"))} · หลังรม ${fmt(n(entry.values, "outputKg"))} · Waste ${fmt(n(entry.values, "wasteKg"))} กก.`],
    return: (entry) => ["Chef_house → Food Diva", "เรียกรถขากลับ", `${fmt(n(entry.values, "returnKg"))} กก.`],
    foodDivaReturnReceive: (entry) => ["Food Diva", "รับเนื้อรมควันเข้าตู้", `${fmt(n(entry.values, "receivedKg"))} กก.`],
    central: (entry) => ["คลังกลาง Owner", "รับเข้าสต๊อกกลาง", `${fmt(n(entry.values, "centralKg"))} กก.`],
    allocate: (entry) => ["Owner → สาขา", `จัดสรรไป ${entry.values.branch}`, `${fmt(n(entry.values, "kg"))} กก.`],
    receive: (entry) => [entry.branch || "สาขา", "รับเนื้อเข้าสาขา", `${fmt(n(entry.values, "kg"))} กก.`],
    thaw: (entry) => [entry.branch || "สาขา", "แบ่งละลาย", `${fmt(n(entry.values, "kg"))} กก.`],
    sale: (entry) => [entry.branch || "สาขา", "ตัดสต๊อกจากยอดขาย", `ขาย ${fmt(n(entry.values, "soldKg"))} · Waste ${fmt(n(entry.values, "wasteKg"))} กก.`],
  };
  const movementRows = db.entries
    .filter((entry) => descriptions[entry.kind] && (lotFilter === "ทั้งหมด" || entry.lotId === lotFilter))
    .sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at))
    .map((entry) => {
      const [location, action, amount] = descriptions[entry.kind](entry);
      return [entry.date, entry.at.slice(11, 16), entry.lotId, location, action, amount];
    });
  return (
    <div className="settings-stack">
      <section className="panel config-heading">
        <div>
          <span className="overline">OWNER · BEEF TRACE</span>
          <h2>Log เนื้อคงเหลือ</h2>
          <p className="muted">ดูเนื้อคงเหลือราย Lot ในทุกจุด และลำดับการเคลื่อนไหวตั้งแต่ Food Diva ถึงสาขา</p>
        </div>
      </section>
      <DataTable
        title="เนื้อคงเหลือแยกตามจุด"
        action={<label className="table-filter">Lot<select value={lotFilter} onChange={(event) => setLotFilter(event.target.value)}><option>ทั้งหมด</option>{db.lots.map((lot) => <option key={lot.id}>{lot.id}</option>)}</select></label>}
        columns={["PO", "Lot", "จุดเก็บ", "คงเหลือ", "รายละเอียด"]}
        rows={locationRows}
      />
      <DataTable
        title="ประวัติการเคลื่อนไหวเนื้อ"
        columns={["วันที่", "เวลา", "Lot", "จุดดำเนินการ", "รายการ", "น้ำหนัก / รายละเอียด"]}
        rows={movementRows}
      />
    </div>
  );
}

function OwnerStockView({
  db,
  lots,
  open,
}: {
  db: Database;
  lots: Lot[];
  open: (kind: string, lotId?: string) => void;
}) {
  const [genre, setGenre] = useState("ทั้งหมด");
  const [location, setLocation] = useState("ทั้งหมด");
  const [itemFilter, setItemFilter] = useState("ทั้งหมด");
  const generalPurchases = entries(db, "generalPurchase");
  const purchaseGroup = (value?: string) =>
    value === "วัตถุดิบ / สินค้า" ? "วัตถุดิบ" :
    value === "ETC / สินทรัพย์" ? "สินทรัพย์" :
    value || "วัตถุดิบ";
  const accountingItems = Array.from(new Set([
    "น้ำพริกหลอด",
    "น้ำดอง",
    ...generalPurchases.map((entry) => entry.values.item).filter(Boolean),
  ]));
  const rows: {
    genre: string;
    item: string;
    location: string;
    quantity: string;
    unit: string;
    detail: string;
    meatType?: string;
    action?: ReactNode;
  }[] = [
    ...lots.flatMap((lot) => {
      const invoiceConfirmed = entries(db, "foodDivaConfirm", lot.id).length > 0;
      const central = Math.max(0, centralStock(db, lot.id));
      const dispatched = n(entries(db, "dispatch", lot.id).at(-1)?.values || {}, "dispatchKg");
      const readyAtFoodDiva = Math.max(0, readyForChefHouse(db, lot.id) - dispatched);
      const ownerReserved = reservedForOwnerContent(db, lot.id);
      const ownerWaiting = ownerWasteOutstanding(db, lot.id);
      const ownerReceived = ownerWasteReceived(db, lot.id);
      return [
        {
          genre: "เนื้อ",
          item: `${lot.id} · เนื้อดิบพร้อมส่ง Chef_house`,
          location: "Food Diva",
          quantity: fmt(invoiceConfirmed ? readyAtFoodDiva : 0),
          unit: "กก.",
          detail: invoiceConfirmed ? "จาก Invoice Food Diva · รอ Owner เรียกรถไปเชียงใหม่" : "รอ Food Diva ยืนยัน Invoice",
          meatType: "เนื้อดิบพร้อมส่ง Chef_house",
        },
        ...(invoiceConfirmed ? [{
          genre: "เนื้อ",
          item: `${lot.id} · เนื้อส่วนที่เหลือรอ Owner รับ (Waste)`,
          location: "Food Diva",
          quantity: fmt(ownerWaiting),
          unit: "กก.",
          detail: `จาก Invoice ${fmt(ownerReserved)} กก. · Owner รับแล้ว ${fmt(ownerReceived)} กก.`,
          meatType: "เนื้อส่วนที่เหลือรอ Owner รับ (Waste)",
          action: ownerWaiting > 0.001
            ? <button className="table-action" onClick={() => open("ownerWasteReceive", lot.id)}>บันทึกรับเนื้อ</button>
            : <span className="badge success">Owner รับครบแล้ว</span>,
        }, ...(ownerReceived > 0.001 ? [{
          genre: "เนื้อ",
          item: `${lot.id} · เนื้อส่วนที่ Owner รับแล้ว (Waste)`,
          location: "Owner",
          quantity: fmt(ownerReceived),
          unit: "กก.",
          detail: "รับจาก Food Diva แล้ว · สำหรับใช้งาน Owner",
          meatType: "เนื้อส่วนที่เหลือรอ Owner รับ (Waste)",
        }] : []),] : []),
        {
          genre: "เนื้อ",
          item: `${lot.id} · เนื้อรมควัน`,
          location: "คลังกลาง",
          quantity: fmt(central),
          unit: "กก.",
          detail: `จากรับเข้าสต๊อกกลาง · ${centralBagStock(db, lot.id)} ถุง พร้อมจัดสรร`,
          meatType: "เนื้อรมควัน",
        },
        ...branches.map((branchName) => {
          const stock = balance(db, lot.id, branchName);
          return {
            genre: "เนื้อ",
            item: `${lot.id} · เนื้อรมควัน`,
            location: branchName,
            quantity: fmt(stock.frozen + stock.ready),
            unit: "กก.",
            detail: `จากจัดสรร Owner · แช่แข็ง ${fmt(stock.frozen)} · พร้อมขาย ${fmt(stock.ready)}`,
            meatType: "เนื้อรมควัน",
          };
        }),
      ];
    }),
    ...branches.flatMap((branchName) => [
      {
        genre: "วัตถุดิบ",
        item: "ข้าวเหนียวดิบ (ข้าวสาร)",
        location: branchName,
        quantity: fmt(rawRiceStock(db, branchName)),
        unit: "กก.",
        detail: `เบิกแล้ว ${fmt(issuedRawRiceStock(db, branchName))} กก.`,
      },
      {
        genre: "วัตถุดิบ",
        item: "ข้าวเหนียวสุก",
        location: branchName,
        quantity: fmt(cookedRiceStock(db, branchName)),
        unit: "กก.",
        detail: branchName === "มีนบุรี" ? "เหลือสำหรับอุ่นขายวันถัดไป" : "ข้าวสุกคงเหลือ",
      },
      {
        genre: "วัตถุดิบ",
        item: "น้ำพริกหลอด",
        location: branchName,
        quantity: fmt(chiliStock(db, branchName)),
        unit: "หลอด",
        detail: `Owner จัดสรร ${fmt(chiliAllocated(db, branchName))} หลอด · ขายแล้ว ${fmt(chiliSold(db, branchName))} หลอด`,
      },
    ]),
    ...accountingItems.map((item) => {
      const history = generalPurchases.filter((entry) => entry.values.item === item);
      const latest = history.at(-1);
      const category = purchaseGroup(latest?.values.purchaseCategory);
      const defaultUnit = item === "น้ำดอง" ? "มล." : item === "น้ำพริกหลอด" ? "หลอด" : "รายการ";
      const isChili = item === "น้ำพริกหลอด";
      return {
        genre: category === "สินทรัพย์" ? "สินทรัพย์" : category === "ค่าใช้จ่ายอื่น" ? "ค่าใช้จ่ายอื่น" : "วัตถุดิบ",
        item,
        location: isChili ? "คลัง Owner" : "บัญชี Owner",
        quantity: fmt(isChili ? ownerChiliStock(db) : history.reduce((sum, entry) => sum + n(entry.values, "quantity"), 0)),
        unit: latest?.values.unit || defaultUnit,
        detail: latest
          ? isChili
            ? `ซื้อเข้า ${fmt(history.reduce((sum, entry) => sum + n(entry.values, "quantity"), 0))} หลอด · จัดสรรไปสาขา ${fmt(entries(db, "chiliAllocate").reduce((sum, entry) => sum + n(entry.values, "chiliTubes"), 0))} หลอด`
            : `ซื้อสะสม ${history.length} รายการ · ล่าสุด ${latest.values.purchaseDate || latest.date}`
          : isChili && ownerChiliStock(db) > 0
            ? "ยอดคงเหลือเดิมจากข้อมูลทดลอง · การซื้อครั้งถัดไปให้บันทึกผ่านการซื้ออื่น ๆ"
            : "ยังไม่มีประวัติการซื้อ",
      };
    }),
    ...materials.flatMap((material, index) => {
      const lastPurchase = entries(db, "materialReceive")
        .filter((entry) => entry.values.material === material)
        .at(-1);
      return [
        {
          genre: "วัสดุบรรจุภัณฑ์",
          item: material,
          location: "คลัง Owner",
          quantity: fmt(ownerMaterialStock(db, material)),
          unit: "ชิ้น",
          detail: lastPurchase
            ? `ซื้อล่าสุด ${lastPurchase.values.purchaseDate || lastPurchase.date} · ฿${fmt(n(lastPurchase.values, "unitPrice"))} / ชิ้น`
            : "ยังไม่มีประวัติการซื้อ",
        },
        ...branches.map((branchName) => ({
          genre: "วัสดุบรรจุภัณฑ์",
          item: material,
          location: branchName,
          quantity: fmt(branchMaterialStock(db, branchName, index)),
          unit: "ชิ้น",
          detail: `ฐาน ${fmt(materialPar(db, branchName, index))} · ฿${fmt(materialUnitPrice(db, branchName, index))} / ชิ้น`,
        })),
      ];
    }),
  ];
  const visibleRows = rows.filter(
    (row) =>
      (genre === "ทั้งหมด" || row.genre === genre) &&
      (location === "ทั้งหมด" || row.location === location) &&
      (itemFilter === "ทั้งหมด" ||
        row.meatType === itemFilter || row.item === itemFilter),
  );
  const purchases = [
    ...entries(db, "materialReceive").map((entry) => ({
      date: entry.values.purchaseDate || entry.date,
      at: entry.at,
      category: "วัสดุบรรจุภัณฑ์",
      item: entry.values.material,
      quantity: n(entry.values, "quantity"),
      unit: "ชิ้น",
      unitPrice: n(entry.values, "unitPrice"),
      totalCost: n(entry.values, "totalCost"),
      supplier: entry.values.supplier,
      reference: entry.values.reference || "—",
    })),
    ...entries(db, "generalPurchase").map((entry) => ({
      date: entry.values.purchaseDate || entry.date,
      at: entry.at,
      category: purchaseGroup(entry.values.purchaseCategory),
      item: entry.values.item,
      quantity: n(entry.values, "quantity"),
      unit: entry.values.unit || "—",
      unitPrice: n(entry.values, "unitPrice"),
      totalCost: n(entry.values, "totalCost"),
      supplier: entry.values.supplier,
      reference: entry.values.reference || "—",
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at));
  const visiblePurchases = purchases.filter((purchase) =>
    (genre === "ทั้งหมด" ||
      (genre === "วัสดุบรรจุภัณฑ์" && purchase.category === "วัสดุบรรจุภัณฑ์") ||
      (genre === "วัตถุดิบ" && purchase.category === "วัตถุดิบ") ||
      (genre === "สินทรัพย์" && purchase.category === "สินทรัพย์") ||
      (genre === "ค่าใช้จ่ายอื่น" && purchase.category === "ค่าใช้จ่ายอื่น")) &&
    (itemFilter === "ทั้งหมด" || purchase.item === itemFilter),
  );
  const meatTypeOptions = [
    "เนื้อดิบพร้อมส่ง Chef_house",
    "เนื้อรมควัน",
    "เนื้อส่วนที่เหลือรอ Owner รับ (Waste)",
  ];
  const itemOptions = genre === "เนื้อ"
    ? meatTypeOptions
    : Array.from(new Set([
      ...(genre === "ทั้งหมด" ? meatTypeOptions : []),
      ...rows
        .filter((row) => row.genre !== "เนื้อ" && (genre === "ทั้งหมด" || row.genre === genre))
        .map((row) => row.item),
    ])).sort((a, b) => a.localeCompare(b, "th"));
  return (
    <div className="settings-stack">
      <DataTable
        title="ตารางสต๊อกทั้งหมด (All inventory)"
        action={
          <div className="table-filters">
            <label className="table-filter">กลุ่มสต๊อก<select value={genre} onChange={(event) => { setGenre(event.target.value); setItemFilter("ทั้งหมด"); }}><option>ทั้งหมด</option><option>เนื้อ</option><option>วัตถุดิบ</option><option>วัสดุบรรจุภัณฑ์</option><option>สินทรัพย์</option><option>ค่าใช้จ่ายอื่น</option></select></label>
            <label className="table-filter">{genre === "เนื้อ" ? "ประเภทเนื้อ" : genre === "ทั้งหมด" ? "รายการ / ประเภทเนื้อ" : "รายการ"}<select value={itemFilter} onChange={(event) => setItemFilter(event.target.value)}><option>ทั้งหมด</option>{itemOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="table-filter">สถานที่<select value={location} onChange={(event) => setLocation(event.target.value)}><option>ทั้งหมด</option><option>Food Diva</option><option>Owner</option><option>คลังกลาง</option><option>คลัง Owner</option><option>บัญชี Owner</option>{branches.map((branchName) => <option key={branchName}>{branchName}</option>)}</select></label>
          </div>
        }
        columns={["กลุ่ม", "รายการ / Lot", "สถานที่", "คงเหลือ", "หน่วย", "รายละเอียด", "การทำงาน"]}
        rows={visibleRows.map((row) => [row.genre, row.item, row.location, row.quantity, row.unit, row.detail, row.action || "—"])}
      />
      {visiblePurchases.length > 0 && (
        <DataTable
          title={`ประวัติการซื้อและบัญชี · ต้นทุนซื้อเข้าที่แสดง ฿${fmt(visiblePurchases.reduce((total, purchase) => total + purchase.totalCost, 0))}`}
          columns={["วันที่ซื้อ", "หมวดบัญชี", "รายการ", "จำนวน", "ราคาซื้อ / หน่วย", "ยอดรวม", "ผู้จำหน่าย", "เลขอ้างอิง / ใบเสร็จ"]}
          rows={visiblePurchases.map((purchase) => [
            purchase.date,
            purchase.category,
            purchase.item,
            `${fmt(purchase.quantity)} ${purchase.unit}`,
            `฿${fmt(purchase.unitPrice)}`,
            `฿${fmt(purchase.totalCost)}`,
            purchase.supplier,
            purchase.reference,
          ])}
        />
      )}
    </div>
  );
}

function MeatStockTable({
  db,
  role,
  branch,
  lots,
  open,
}: {
  db: Database;
  role: Role;
  branch: string;
  lots: Lot[];
  open: (kind: string, lotId?: string) => void;
}) {
  if (role === "owner")
    return (
      <DataTable
        title="สต๊อกเนื้อทุกจุด (Meat inventory)"
        columns={["Lot", "ค้างที่ Food Diva", "ส่วนกลาง", "ถุงในคลังกลาง", "ศาลาแดง", "มีนบุรี", "สถานะ", "การทำงาน"]}
        rows={lots.map((lot) => [
          lot.id,
          entries(db, "foodDivaConfirm", lot.id).length
            ? `${fmt(rawAtFoodDiva(db, lot))} กก. (เนื้อดิบ)`
            : "รอ Food Diva ยืนยัน Invoice",
          `${fmt(centralStock(db, lot.id))} กก.`,
          `${centralBagStock(db, lot.id)} ถุง`,
          `${fmt(balance(db, lot.id, "ศาลาแดง").frozen)} แช่แข็ง / ${fmt(balance(db, lot.id, "ศาลาแดง").ready)} พร้อมขาย`,
          `${fmt(balance(db, lot.id, "มีนบุรี").frozen)} แช่แข็ง / ${fmt(balance(db, lot.id, "มีนบุรี").ready)} พร้อมขาย`,
          stages[lot.stage],
          <button
            key={lot.id}
            className="table-action"
            disabled={lot.stage < 8 || centralStock(db, lot.id) <= 0.001}
            onClick={() => open("allocate", lot.id)}
          >
            จัดสรร
          </button>,
        ])}
      />
    );
  if (role === "cm")
    return (
      <DataTable
        title="สต๊อกและงานผลิต Chef_house"
        columns={["Lot", "ก่อนสโมค", "รอผลิต", "น้ำหนักเนื้อหลังรมควัน", "สถานะ"]}
        rows={lots.map((lot) => [
          lot.id,
          `${fmt(n(lot.values, "preKg"))} กก.`,
          `${fmt(n(lot.values, "preKg") - processed(db, lot.id))} กก.`,
          `${fmt(produced(db, lot.id))} กก.`,
          stages[lot.stage],
        ])}
      />
    );
  return (
    <DataTable
      title={`สต๊อกเนื้อ · ${branch}`}
      columns={["Lot", "รอรับจาก Owner", "รับแล้ว", "แช่แข็ง", "พร้อมขาย", "สถานะ"]}
      rows={lots.map((lot) => {
        const stock = balance(db, lot.id, branch);
        const pending =
          entries(db, "allocate", lot.id, branch).reduce(
            (sum, allocation) => sum + n(allocation.values, "kg"),
            0,
          ) - stock.received;
        return [
          lot.id,
          pending > 0.001 ? `${fmt(pending)} กก.` : "-",
          `${fmt(stock.received)} กก.`,
          `${fmt(stock.frozen)} กก.`,
          `${fmt(stock.ready)} กก.`,
          pending > 0.001 ? "รอยืนยันรับของ · ทำต่อที่กรอกรายวัน" : stages[lot.stage],
        ];
      })}
    />
  );
}
function MaterialStockTable({
  db,
  stockBranches,
  ownerView,
}: {
  db: Database;
  stockBranches: string[];
  ownerView: boolean;
}) {
  const [branchFilter, setBranchFilter] = useState("ทั้งหมด");
  if (ownerView) {
    const purchases = [...entries(db, "materialReceive")]
      .sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at));
    return (
      <div className="settings-stack">
        <DataTable
          title="ตารางสต๊อกวัสดุ (Material inventory)"
          action={<label className="table-filter">ดูสต๊อก<select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}><option>ทั้งหมด</option><option>คลัง Owner</option><option>ศาลาแดง</option><option>มีนบุรี</option></select></label>}
          columns={branchFilter === "ทั้งหมด" ? ["วัสดุ", "รวมทุกจุด", "คลัง Owner", "ศาลาแดง", "มีนบุรี", "จำนวนฐานรวม", "สถานะ"] : ["วัสดุ", "จุดจัดเก็บ", "คงเหลือ", "จำนวนฐาน", "ราคาต่อหน่วย", "มูลค่าคงเหลือ", "สถานะ"]}
          rows={materials.map((item, index) => {
            const owner = ownerMaterialStock(db, item);
            const sala = branchMaterialStock(db, "ศาลาแดง", index);
            const minburi = branchMaterialStock(db, "มีนบุรี", index);
            const salaPar = materialPar(db, "ศาลาแดง", index);
            const minburiPar = materialPar(db, "มีนบุรี", index);
            if (branchFilter === "ทั้งหมด")
              return [
                item,
                `${owner + sala + minburi} ชิ้น`,
                `${owner} ชิ้น`,
                `${sala} ชิ้น`,
                `${minburi} ชิ้น`,
                `${salaPar + minburiPar} ชิ้น`,
                owner + sala + minburi > 0 ? "มีข้อมูล" : "ยังไม่มีสต๊อก",
              ];
            const isOwner = branchFilter === "คลัง Owner";
            const quantity = isOwner ? owner : branchFilter === "ศาลาแดง" ? sala : minburi;
            const par = isOwner ? 0 : branchFilter === "ศาลาแดง" ? salaPar : minburiPar;
            const price = isOwner ? 0 : materialUnitPrice(db, branchFilter, index);
            return [
              item,
              branchFilter,
              `${quantity} ชิ้น`,
              isOwner ? "—" : `${par} ชิ้น`,
              isOwner ? "—" : `฿${fmt(price)} / ชิ้น`,
              isOwner ? "—" : `฿${fmt(quantity * price)}`,
              isOwner ? (quantity > 0 ? "มีข้อมูล" : "ยังไม่มีสต๊อก") : par > 0 && quantity < par * 0.2 ? "ใกล้หมด" : "ปกติ",
            ];
          })}
        />
        <DataTable
          title="ประวัติการซื้อวัสดุ (Material purchase history)"
          columns={["วันที่ซื้อ", "วัสดุ", "จำนวน", "ราคาซื้อ / หน่วย", "ยอดรวม", "ผู้จำหน่าย", "เลขอ้างอิง"]}
          rows={purchases.map((entry) => [
            entry.values.purchaseDate || entry.date,
            entry.values.material,
            `${fmt(n(entry.values, "quantity"))} ชิ้น`,
            `฿${fmt(n(entry.values, "unitPrice"))}`,
            `฿${fmt(n(entry.values, "totalCost"))}`,
            entry.values.supplier,
            entry.values.reference || "—",
          ])}
        />
      </div>
    );
  }
  return (
    <DataTable
      title="สต๊อกวัสดุ 7 รายการ (Material inventory)"
      columns={["สาขา", "วัสดุ", "คงเหลือ", "จำนวนฐาน", "นับล่าสุด", "สถานะ"]}
      rows={stockBranches.flatMap((name) => {
        const latest = entries(db, "materials", undefined, name).at(-1);
        return materials.map((item, index) => {
          const par = materialPar(db, name, index);
          const quantity = branchMaterialStock(db, name, index);
          return [
            name,
            item,
            `${quantity} ชิ้น`,
            `${par} ชิ้น`,
            latest?.date || "ยังไม่เคยนับ",
            !latest
              ? "รอตรวจนับ"
              : par > 0 && quantity < par * 0.2
                ? "ใกล้หมด"
                : "ปกติ",
          ];
        });
      })}
    />
  );
}
function SupplyStock({
  db,
  branches: stockBranches,
}: {
  db: Database;
  branches: string[];
}) {
  return (
    <DataTable
      title="สต๊อกข้าวเหนียวและน้ำพริก (Rice & chili inventory)"
      columns={[
        "สาขา",
        "ข้าวดิบในคลัง",
        "ข้าวดิบที่เบิก",
        "ข้าวสุก",
        "น้ำพริกที่ Owner จัดสรร",
        "น้ำพริกคงเหลือ",
        "ข้าวที่ควรซื้อเพิ่ม",
        "ซื้อเข้าล่าสุด",
      ]}
      rows={stockBranches.map((name) => {
        const latest = [
          ...entries(db, "supplyPurchase", undefined, name),
          ...entries(db, "ricePurchase", undefined, name),
        ].sort((a, b) => a.at.localeCompare(b.at)).at(-1);
        return [
          <strong key={name}>{name}</strong>,
          `${fmt(rawRiceStock(db, name))} กก.`,
          `${fmt(issuedRawRiceStock(db, name))} กก.`,
          `${fmt(cookedRiceStock(db, name))} กก.`,
          `${fmt(chiliAllocated(db, name))} หลอด`,
          `${fmt(chiliStock(db, name))} หลอด`,
          `${fmt(
            Math.max(
              0,
              n(
                db.config,
                name === "มีนบุรี" ? "cookedRicePar" : "rawRicePar",
              ) -
                (name === "มีนบุรี"
                  ? cookedRiceStock(db, name)
                  : rawRiceStock(db, name)),
            ),
          )} กก.`,
          latest ? latest.date : "ยังไม่มีรายการซื้อเข้า",
        ];
      })}
    />
  );
}
function Report({ db }: { db: Database }) {
  const allDates = db.entries.map((e) => e.date).filter(Boolean).sort();
  const [fromDate, setFromDate] = useState(allDates[0] || today());
  const [toDate, setToDate] = useState(allDates.at(-1) || today());
  const [branchFilter, setBranchFilter] = useState("ทั้งหมด");
  const inRange = (entry: Entry) =>
    entry.date >= fromDate && entry.date <= toDate &&
    (branchFilter === "ทั้งหมด" ||
      ["expense", "materialReceive", "generalPurchase"].includes(entry.kind) ||
      entry.branch === branchFilter);
  const sales = entries(db, "sale").filter(inRange),
    supplyPurchases = [
      ...entries(db, "supplyPurchase"),
      ...entries(db, "ricePurchase"),
      ...entries(db, "chiliPurchase"),
    ].filter(inRange).sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at)),
    supplyCost = supplyPurchases.reduce(
      (sum, entry) => sum + n(entry.values, "totalCost"),
      0,
    ),
    ownerExpenseCost = entries(db, "expense").filter(inRange)
      .reduce((sum, entry) => sum + n(entry.values, "amount"), 0),
    materialPurchaseCost = entries(db, "materialReceive").filter(inRange)
      .reduce((sum, entry) => sum + n(entry.values, "totalCost"), 0),
    generalPurchaseCost = entries(db, "generalPurchase").filter(inRange)
      .reduce((sum, entry) => sum + n(entry.values, "totalCost"), 0),
    cost =
      supplyCost +
      ownerExpenseCost + materialPurchaseCost + generalPurchaseCost +
      sales.reduce(
        (s, e) =>
          s +
          n(e.values, "meatCost") +
          n(e.values, "wasteCost") +
          n(e.values, "expense"),
        0,
      );
  const dayRows = Array.from(
    new Set(sales.map((e) => `${e.date}|${e.branch}`)),
  )
    .sort()
    .reverse()
    .map((key) => {
      const [date, branch] = key.split("|"),
        rows = entries(db, "sale", undefined, branch, date).filter(inRange);
      const rev = rows.reduce((s, e) => s + n(e.values, "revenue"), 0),
        boxes = rows.reduce((s, e) => s + n(e.values, "boxes"), 0),
        addons = rows.reduce((s, e) => s + n(e.values, "addons"), 0),
        chiliAddons = rows.reduce((s, e) => s + n(e.values, "chiliAddons"), 0),
        waste = rows.reduce((s, e) => s + n(e.values, "wasteKg"), 0);
      return [
        date,
        branch,
        String(boxes),
        String(addons),
        String(chiliAddons),
        fmt(waste),
        fmt(rev),
        isClosed(db, branch, date) ? "ปิดแล้ว" : "เปิดอยู่",
      ];
    });
  return (
    <div className="report-tables">
      <section className="panel report-filter-panel">
        <div><h2>ตัวกรองรายงาน (Report filters)</h2><p className="muted">เลือกช่วงวันที่และสาขา ทุกตารางด้านล่างจะเปลี่ยนพร้อมกัน</p></div>
        <div className="table-filters">
          <label className="table-filter">ตั้งแต่<input type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label className="table-filter">ถึง<input type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} /></label>
          <label className="table-filter">สาขา<select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}><option>ทั้งหมด</option>{branches.map((name) => <option key={name}>{name}</option>)}</select></label>
        </div>
      </section>
      <DataTable
        title="สรุปผลรวม"
        columns={["รายการ", "จำนวนเงิน", "ขอบเขต"]}
        rows={[
          ["ยอดขาย LINE MAN", fmt(sales.reduce((sum, e) => sum + n(e.values, "revenue"), 0)), "บาท"],
          [
            "ต้นทุนเนื้อ + Waste + ค่าใช้จ่ายสาขา + วัตถุดิบ",
            fmt(cost),
            "บาท",
          ],
          ["ค่าใช้จ่าย Owner", fmt(ownerExpenseCost), "บาท"],
          ["ซื้อวัสดุบรรจุภัณฑ์", fmt(materialPurchaseCost), "บาท"],
          ["ซื้อวัตถุดิบ / ETC", fmt(generalPurchaseCost), "บาท"],
          ["ส่วนต่างหลังต้นทุนที่บันทึก", fmt(sales.reduce((sum, e) => sum + n(e.values, "revenue"), 0) - cost), "บาท"],
        ]}
      />
      <div className="notice">
        ตัวเลขนี้รวมค่าใช้จ่าย Owner การซื้อวัสดุ วัตถุดิบ และ ETC ที่บันทึกแล้ว แต่ยังไม่รวมภาษี
        แรงงาน ค่าเสื่อม และรายการที่ยังไม่ได้กรอก จึงยังไม่ใช่กำไรสุทธิ
      </div>
      <DataTable
        title="รายงานยอดขายรายวัน"
        columns={[
          "วันที่",
          "สาขา",
          "กล่อง",
          "เนื้อ Add-on",
          "น้ำพริกขายแยก",
          "Waste (กก.)",
          "LINE MAN (บาท)",
          "สถานะ",
        ]}
        rows={dayRows}
      />
      <DataTable
        title="ยอดขายสะสมแยกสาขา"
        columns={["สาขา", "กล่อง", "เนื้อ Add-on", "น้ำพริกขายแยก", "Waste (กก.)", "ยอดขาย (บาท)"]}
        rows={branches.map((br) => {
          const rows = entries(db, "sale", undefined, br).filter(inRange);
          return [
            br,
            String(rows.reduce((s, e) => s + n(e.values, "boxes"), 0)),
            String(rows.reduce((s, e) => s + n(e.values, "addons"), 0)),
            String(rows.reduce((s, e) => s + n(e.values, "chiliAddons"), 0)),
            fmt(rows.reduce((s, e) => s + n(e.values, "wasteKg"), 0)),
            fmt(rows.reduce((s, e) => s + n(e.values, "revenue"), 0)),
          ];
        })}
      />
      <DataTable
        title="ต้นทุนแยก Lot"
        columns={[
          "Lot",
          "สถานะ",
          "เนื้อ",
          "รมควัน (Smoking)",
          "รถ",
          "รวม",
          "ต้นทุน / กก.",
        ]}
        rows={db.lots
          .filter((l) => l.stage > 1)
          .map((l) => {
            const c = lotCost(db, l);
            return [
              l.id,
              stages[l.stage],
              fmt(c.meat),
              fmt(c.smoke),
              fmt(c.freight),
              fmt(c.total),
              c.perKg === null ? "รอรับกลาง" : fmt(c.perKg),
            ];
          })}
      />
      <DataTable
        title="ค่าใช้จ่าย Owner"
        columns={["วันที่", "หมวด", "รายละเอียด", "ผู้จ่าย", "จำนวนเงิน"]}
        rows={entries(db, "expense").filter(inRange).map((e) => [
          e.date,
          e.values.category,
          e.values.detail,
          e.values.payer,
          fmt(n(e.values, "amount")),
        ])}
      />
      <DataTable
        title="รายการซื้อข้าวเหนียวและน้ำพริก"
        columns={[
          "วันที่",
          "สาขา",
          "ผู้จำหน่าย",
          "ข้าวดิบ (กก.)",
          "ข้าวสุก (กก.)",
          "น้ำพริก (หลอด)",
          "ยอดซื้อรวม",
        ]}
        rows={supplyPurchases.map((entry) => [
          entry.date,
          entry.branch,
          entry.values.supplier,
          fmt(n(entry.values, "rawRiceKg")),
          fmt(n(entry.values, "cookedRiceKg")),
          fmt(n(entry.values, "chiliTubes")),
          fmt(n(entry.values, "totalCost")),
        ])}
      />
      <DataTable
        title="ข้าวเหนียวสุกคงเหลือปลายวัน"
        columns={[
          "วันที่",
          "สาขา",
          "คงเหลือ (กก.)",
          "การจัดการวันถัดไป",
          "เหตุผลส่วนต่าง",
        ]}
        rows={entries(db, "riceCarry").filter(inRange).map((entry) => [
          entry.date,
          entry.branch,
          fmt(n(entry.values, "leftoverKg")),
          entry.values.reheat,
          entry.values.reason || "—",
        ])}
      />
      <DataTable
        title="รายการเบิกข้าวเหนียวดิบรายวัน"
        columns={["วันที่", "สาขา", "ผู้รับ", "ข้าวเหนียวดิบ (กก.)"]}
        rows={[
          ...entries(db, "supplyIssue"),
          ...entries(db, "riceIssue"),
        ]
          .filter((entry) => inRange(entry) && n(entry.values, "rawRiceIssuedKg") > 0)
          .sort((a, b) => a.at.localeCompare(b.at))
          .map((entry) => [
          entry.date,
          entry.branch,
          entry.values.receiver,
          fmt(n(entry.values, "rawRiceIssuedKg")),
          ])}
      />
      <DataTable
        title="ประวัติจัดสรรน้ำพริกโดย Owner"
        columns={["วันที่", "สาขา", "จัดสรร", "ผู้รับ", "เลขอ้างอิง", "หมายเหตุ"]}
        rows={entries(db, "chiliAllocate")
          .filter(inRange)
          .sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at))
          .map((entry) => [
            entry.date,
            entry.branch,
            `${fmt(n(entry.values, "chiliTubes"))} หลอด`,
            entry.values.receiver || "—",
            entry.values.reference || "—",
            entry.values.note || "—",
          ])}
      />
      <DataTable
        title="ประวัติรับและส่งวัสดุ (Material audit trail)"
        columns={["วันที่", "รายการ", "วัสดุ", "ต้นทาง / ปลายทาง", "จำนวน", "ผู้เกี่ยวข้อง", "อ้างอิง / สถานะ"]}
        rows={[...entries(db, "materialReceive"), ...entries(db, "materialTransfer"), ...entries(db, "materialConfirm")]
          .filter(inRange)
          .sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at))
          .map((entry) => {
            const transfer = entry.kind === "materialConfirm"
              ? db.entries.find((item) => item.id === entry.values.transferId)
              : undefined;
            return [
              entry.date,
              entry.kind === "materialReceive"
                ? "รับเข้าคลัง Owner"
                : entry.kind === "materialTransfer"
                  ? "ส่งไปสาขา"
                  : "สาขายืนยันรับ",
              entry.values.material || transfer?.values.material || "—",
              entry.kind === "materialReceive" ? entry.values.supplier : entry.branch,
              entry.values.quantity || entry.values.receivedQuantity,
              entry.values.receiver || "Owner",
              entry.kind === "materialConfirm"
                ? (entry.values.reason || "รับครบ")
                : (entry.values.reference || (entry.values.requiresConfirm ? "รอสาขายืนยัน" : "ข้อมูลเดิม")),
            ];
          })}
      />
      <DataTable
        title="วัสดุคงเหลือล่าสุด"
        columns={["สาขา", "วัสดุ", "ใช้ล่าสุด", "คงเหลือ", "ฐานเต็ม", "ราคา / หน่วย", "มูลค่าคงเหลือ", "สถานะ"]}
        rows={branches.flatMap((br) => {
          const row = entries(db, "materials", undefined, br).filter(inRange).at(-1);
          return materials.map((m, i) => {
            const base = materialPar(db, br, i),
              price = materialUnitPrice(db, br, i),
              qty = row ? n(row.values, "material" + i) : 0;
            return [
              br,
              m,
              row?.values["used" + i] ?? "—",
              row ? String(qty) : "—",
              base ? String(base) : "—",
              price ? fmt(price) : "—",
              row && price ? fmt(qty * price) : "—",
              !row
                ? "ยังไม่ได้นับ"
                : base === 0
                  ? "ยังไม่ตั้งฐาน"
                  : qty < base * 0.2
                    ? "ต่ำกว่า 20%"
                    : "ปกติ",
            ];
          });
        })}
      />
    </div>
  );
}
function EntryDetails({
  entry: e,
  owner,
  onChanged,
}: {
  entry: Entry;
  owner: boolean;
  onChanged: (message: string) => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const reversible = [
    "allocate", "chiliAllocate", "receive", "thaw", "ricePurchase", "chiliPurchase",
    "riceIssue", "chiliIssue", "rice", "riceCarry", "sale", "materials",
    "materialReceive", "generalPurchase", "materialTransfer", "materialConfirm", "closeDay",
    "expense", "unlock",
  ].includes(e.kind);
  const cancelEntry = () => {
    try {
      const next = mutate(
        latestDatabase(),
        "owner",
        "void",
        { targetId: e.id, reason },
        "",
        today(),
      );
      saveDatabase(next);
      onChanged("ยกเลิกรายการแล้ว ระบบคำนวณยอดใหม่และเก็บเหตุผลไว้ในประวัติ");
    } catch (error) {
      onChanged(error instanceof Error ? error.message : "ยกเลิกรายการไม่สำเร็จ");
    }
  };
  return (
    <details className="entry">
      <summary>
        <span>
          {titles[e.kind] || e.kind}{" "}
          <small>
            {e.date} · {e.lotId || e.branch} · {roleName[e.role]}
          </small>
        </span>
        <span>ดูรายละเอียด</span>
      </summary>
      {Object.entries(e.values)
        .filter(([, v]) => v !== "")
        .map(([k, v]) => (
          <Read
            key={k}
            label={
              forms[e.kind]?.find((f) => f.key === k)?.label ||
              (
                {
                  outputKg: "น้ำหนักผลิตรวม",
                  packCount: "จำนวนถุงใหญ่",
                  outboundCost: "ค่ารถขาไป",
                  returnCost: "ค่ารถขากลับ",
                  revenue: "ยอดขายบันทึก",
                  menuTotal: "ยอดตามเมนู",
                  chiliAddons: "น้ำพริกที่ขายแยก",
                  chiliComplimentary: "น้ำพริกแถม (ยกเลิกแล้ว)",
                  riceServings: "ข้าวเหนียวในกล่อง",
                  chiliSold: "น้ำพริกที่ตัดสต๊อกรวม",
                  allocation: "ใบจัดสรร",
                  meatCost: "ต้นทุนเนื้อขาย",
                  wasteCost: "ต้นทุนเนื้อ Waste",
                } as Record<string, string>
              )[k] ||
              k
            }
            value={v}
          />
        ))}
      <small className="muted">
        บันทึก {new Date(e.at).toLocaleString("th-TH")}
      </small>
      {owner && reversible && (
        <div className="entry-correction">
          {cancelling ? (
            <>
              <input
                className="table-edit-control reason-control"
                value={reason}
                placeholder="เหตุผลที่ยกเลิกรายการ"
                onChange={(event) => setReason(event.target.value)}
              />
              <button className="secondary" onClick={() => setCancelling(false)}>
                กลับ
              </button>
              <button className="danger-button" onClick={cancelEntry}>
                ยืนยันยกเลิก
              </button>
            </>
          ) : (
            <button className="secondary" onClick={() => setCancelling(true)}>
              แก้รายการผิดด้วยการยกเลิก
            </button>
          )}
        </div>
      )}
    </details>
  );
}
function DataTable({
  title,
  columns,
  rows,
  action,
}: {
  title: string;
  columns: string[];
  rows: ReactNode[][];
  action?: ReactNode;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = rows.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );
  return (
    <section className="table-section">
      <div className="table-title">
        <div>
          <h2>{title}</h2>
          <span>{rows.length} แถว</span>
        </div>
        {action}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              visibleRows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="no-data" colSpan={columns.length}>
                  ยังไม่มีข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > pageSize && (
        <div className="table-pagination">
          <span>
            หน้า {currentPage + 1} / {pageCount} · แสดงครั้งละ {pageSize} แถว
          </span>
          <div className="button-row">
            <button
              className="secondary"
              disabled={currentPage === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              ก่อนหน้า
            </button>
            <button
              className="secondary"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
            >
              ถัดไป
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
function ConfigView({ db }: { db: Database }) {
  type ConfigSection =
    "main" | "documents" | "pricing" | "supplies" | "production" | "branch" | "materials";
  const initial = () => {
    const values = { ...seed.config, ...db.config };
    for (let i = 0; i < materials.length; i++) {
      values[`material${i}`] = values[`material${i}`] || values[`material${i}_saladaeng`] || values[`material${i}_minburi`] || "0";
      values[`materialPrice${i}`] = values[`materialPrice${i}`] || values[`materialPrice${i}_saladaeng`] || values[`materialPrice${i}_minburi`] || "0";
    }
    return values;
  };
  const [draft, setDraft] = useState<Values>(initial);
  const [editing, setEditing] = useState<ConfigSection | null>(null);
  const [message, setMessage] = useState("");
  const row = (
    label: string,
    value: ReactNode,
    unit: string,
    detail: string,
  ): ReactNode[] => [<strong key="label">{label}</strong>, value, unit, detail];
  const startEdit = (section: ConfigSection) => {
    const current = latestDatabase().config;
    const values = { ...seed.config, ...current };
    for (let i = 0; i < materials.length; i++) {
      values[`material${i}`] = values[`material${i}`] || values[`material${i}_saladaeng`] || values[`material${i}_minburi`] || "0";
      values[`materialPrice${i}`] = values[`materialPrice${i}`] || values[`materialPrice${i}_saladaeng`] || values[`materialPrice${i}_minburi`] || "0";
    }
    setDraft(values);
    setEditing(section);
    setMessage("");
  };
  const set = (key: string, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage("");
  };
  const save = () => {
    try {
      const next = mutate(
        latestDatabase(),
        "owner",
        "config",
        draft,
        "",
        new Date().toISOString().slice(0, 10),
      );
      saveDatabase(next);
      setEditing(null);
      setMessage("บันทึกแล้ว · กลับสู่โหมดดูข้อมูล");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    }
  };
  const action = (section: ConfigSection) => (
    <div className="inline-table-action">
      {editing === section && message && <span>{message}</span>}
      {editing === section ? (
        <>
          <button
            className="secondary"
            type="button"
            onClick={() => setEditing(null)}
          >
            ยกเลิก (Cancel)
          </button>
          <button className="primary" type="button" onClick={save}>
            บันทึกและล็อก (Save & lock)
          </button>
        </>
      ) : (
        <button
          className="secondary request-edit"
          type="button"
          disabled={editing !== null}
          onClick={() => startEdit(section)}
        >
          {editing ? "กำลังแก้ตารางอื่น" : "ขอแก้ไข (Request edit)"}
        </button>
      )}
    </div>
  );
  const valueCell = (
    section: ConfigSection,
    key: string,
    display: (value: string) => string = (value) => value,
    type: "number" | "time" | "branch" | "text" | "date" | "textarea" | "file" = "number",
  ) => {
    if (editing !== section) {
      if (type === "file" && db.config[key])
        // Stored locally as a data URL, so Next image optimization cannot process it.
        // eslint-disable-next-line @next/next/no-img-element
        return <img className="config-logo-preview" src={db.config[key]} alt="โลโก้ NerdNuea" />;
      return (
        <span className="read-only-value">
          {type === "file"
            ? "ยังไม่ได้อัปโหลด"
            : display(db.config[key] || seed.config[key] || "—")}
        </span>
      );
    }
    if (type === "branch")
      return (
        <select
          className="table-edit-control"
          value={draft[key]}
          onChange={(event) => set(key, event.target.value)}
        >
          {branches.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      );
    if (type === "textarea")
      return (
        <textarea
          className="table-edit-control config-textarea"
          aria-label={key}
          rows={3}
          value={draft[key] ?? ""}
          onChange={(event) => set(key, event.target.value)}
        />
      );
    if (type === "file")
      return (
        <div className="config-logo-upload">
          <input
            aria-label="อัปโหลดโลโก้ NerdNuea"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              if (file.size > 1024 * 1024) {
                setMessage("ไฟล์โลโก้ต้องมีขนาดไม่เกิน 1 MB");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                setDraft((current) => ({ ...current, [key]: String(reader.result), logoName: file.name }));
                setMessage(`เลือกโลโก้ ${file.name} แล้ว · กดบันทึกและล็อกเพื่อใช้กับ PO`);
              };
              reader.readAsDataURL(file);
            }}
          />
          {draft[key] && (
            // Stored locally as a data URL, so Next image optimization cannot process it.
            // eslint-disable-next-line @next/next/no-img-element
            <img className="config-logo-preview" src={draft[key]} alt="ตัวอย่างโลโก้ NerdNuea" />
          )}
          <small>{draft.logoName || "รองรับ PNG, JPG, WebP หรือ SVG ไม่เกิน 1 MB"}</small>
        </div>
      );
    return (
      <input
        className="table-edit-control"
        aria-label={key}
        type={type === "time" ? "time" : type === "date" ? "date" : type === "text" ? "text" : "number"}
        min={type === "number" ? "0" : undefined}
        step={key === "packKg" ? "0.001" : key === "tolerance" ? "1" : "0.01"}
        value={draft[key] ?? ""}
        onChange={(event) => set(key, event.target.value)}
      />
    );
  };
  const materialSettingsSource = editing === "materials" ? draft : db.config;
  const sharedMaterialValue = (index: number, price = false) => {
    const key = `${price ? "materialPrice" : "material"}${index}`;
    return n(materialSettingsSource, key)
      || n(materialSettingsSource, `${key}_saladaeng`)
      || n(materialSettingsSource, `${key}_minburi`);
  };
  const materialSettingsColumns = ["วัสดุ (Material)", "จำนวนฐาน (Par level)", "ราคาต่อหน่วย (Unit price)", "มูลค่าฐาน (Par value)", "ใช้กับสาขา"];
  const materialSettingsRows = materials.map((name, index) => {
    const amount = sharedMaterialValue(index);
    const price = sharedMaterialValue(index, true);
    return [
      <strong key="label">{name}</strong>,
      editing === "materials"
        ? valueCell("materials", `material${index}`, (value) => `${fmt(Number(value))} ชิ้น`)
        : <span className="read-only-value" key="amount">{fmt(amount)} ชิ้น</span>,
      editing === "materials"
        ? valueCell("materials", `materialPrice${index}`, (value) => `฿${fmt(Number(value))} / ชิ้น`)
        : <span className="read-only-value" key="price">฿{fmt(price)} / ชิ้น</span>,
      <span className="read-only-value" key="total">฿{fmt(amount * price)}</span>,
      "ศาลาแดง และ มีนบุรี",
    ];
  });

  return (
    <div className="settings-stack">
      <section className="panel config-heading">
        <div>
          <h2>ตั้งค่าระบบ (Settings)</h2>
          <p className="muted">
            รายการด้านล่างคือค่าที่ Owner ปรับได้ทั้งหมดในเดโม
            ค่าต้นทุนการผลิตและค่ารถจะถูกบันทึกติดกับ PO ตอนสร้างรายการ
          </p>
        </div>
        {message && !editing && (
          <span className="save-confirmation">{message}</span>
        )}
      </section>
      <DataTable
        title="ข้อมูลหลักก่อนเริ่มระบบ (System setup)"
        action={action("main")}
        columns={["รายการ (Setting)", "ค่าปัจจุบัน (Current value)", "หน่วย", "ใช้ในระบบ"]}
        rows={[
          row("ชื่อบริษัท / ลูกค้า", valueCell("main", "companyName", undefined, "text"), "ข้อความ", "เติมใน PO อัตโนมัติ"),
          row("ที่อยู่บริษัท", valueCell("main", "companyAddress", undefined, "text"), "ข้อความ", "เติมใน PO อัตโนมัติ"),
          row("ผู้ติดต่อ (Attention)", valueCell("main", "attention", undefined, "text"), "ข้อความ", "เติมใน PO อัตโนมัติ"),
          row("เบอร์ติดต่อ", valueCell("main", "companyPhone", undefined, "text"), "ข้อความ", "เติมใน PO อัตโนมัติ"),
          row("เลขประจำตัวผู้เสียภาษี", valueCell("main", "taxId", undefined, "text"), "ข้อความ", "เติมใน PO อัตโนมัติ"),
          row("วันเริ่มใช้งานจริง", valueCell("main", "systemStartDate", undefined, "date"), "วันที่", "กำหนดวันเริ่มเก็บข้อมูลจริง"),
          row("สาขาที่เปิดใช้งาน", "ศาลาแดง, มีนบุรี", "2 สาขา", "ใช้กับสต๊อก รายงาน และบัญชีสาขา"),
        ]}
      />
      <DataTable
        title="ข้อมูลบนใบ PO (PO document setup)"
        action={action("documents")}
        columns={["รายการ (Setting)", "ค่าปัจจุบัน (Current value)", "หน่วย", "ใช้ใน PO"]}
        rows={[
          row("โลโก้ NerdNuea", valueCell("documents", "logoData", undefined, "file"), "รูปภาพ", "แสดงหัวเอกสารทั้ง PO Food Diva และ PO Chef_house"),
          row("ผู้รับออเดอร์ Food Diva", valueCell("documents", "foodDivaContact", undefined, "text"), "ข้อความ", "แสดงฝั่งผู้ขายใน PO เนื้อ"),
          row("ที่อยู่บริษัท Food Diva", valueCell("documents", "foodDivaAddress", undefined, "textarea"), "ข้อความ", "แสดงฝั่งผู้ขายใน PO เนื้อ"),
          row("ผู้รับออเดอร์ Chef_house", valueCell("documents", "chefHouseContact", undefined, "text"), "ข้อความ", "แสดงฝั่งผู้ให้บริการใน PO โรงรมควัน"),
          row("ที่อยู่บริษัท Chef_house", valueCell("documents", "chefHouseAddress", undefined, "textarea"), "ข้อความ", "แสดงฝั่งผู้ให้บริการใน PO โรงรมควัน"),
        ]}
      />
      <DataTable
        title="ราคาและการขาย (Pricing & sales)"
        action={action("pricing")}
        columns={[
          "รายการ (Setting)",
          "ค่าปัจจุบัน (Current value)",
          "หน่วย (Unit)",
          "ใช้คำนวณ (Purpose)",
        ]}
        rows={[
          row(
            "ราคากล่องมาตรฐาน (Standard box price)",
            valueCell(
              "pricing",
              "boxPrice",
              (value) => `฿${fmt(Number(value))}`,
            ),
            "บาท / กล่อง",
            "ยอดขายกล่องปกติ",
          ),
          row(
            "ราคาเนื้อซีลเพิ่ม (Add-on pack price)",
            valueCell(
              "pricing",
              "addonPrice",
              (value) => `฿${fmt(Number(value))}`,
            ),
            "บาท / แพ็ก",
            "ยอดขายเนื้อเพิ่ม",
          ),
          row(
            "น้ำหนักเฉลี่ยต่อซีล (Average sealed meat weight)",
            valueCell(
              "pricing",
              "packKg",
              (value) => `${fmt(Number(value) * 1000)} กรัม`,
            ),
            "กรัม / ซีล",
            "ค่ากลาง 101.5 กรัม ระบบยอมรับช่วง 100–103 กรัม",
          ),
          row(
            "ข้าวเหนียวในกล่อง (Included sticky rice)",
            "฿0.00",
            "200 กรัม / กล่อง",
            "รวมอยู่ในราคากล่อง",
          ),
          row(
            "ราคาขายน้ำพริกหลอด (Chili selling price)",
            valueCell(
              "pricing",
              "chiliPrice",
              (value) => `฿${fmt(Number(value))}`,
            ),
            "บาท / หลอด",
            "น้ำพริกจำหน่ายแยกทุกหลอด ไม่รวมอยู่ในกล่องมาตรฐาน",
          ),
        ]}
      />
      <DataTable
        title="วัตถุดิบสาขา (Branch supplies)"
        action={action("supplies")}
        columns={[
          "รายการ (Setting)",
          "ค่าปัจจุบัน (Current value)",
          "หน่วย (Unit)",
          "ใช้ควบคุม (Purpose)",
        ]}
        rows={[
          row(
            "จำนวนฐานข้าวเหนียวดิบ (Raw rice par level)",
            valueCell("supplies", "rawRicePar", (value) => fmt(Number(value))),
            "กก.",
            "ระดับสต๊อกเป้าหมายของแต่ละสาขา",
          ),
          row(
            "ราคาต่อหน่วยข้าวเหนียวดิบ (Raw rice unit price)",
            valueCell(
              "supplies",
              "rawRiceUnitPrice",
              (value) => `฿${fmt(Number(value))}`,
            ),
            "บาท / กก.",
            "ราคามาตรฐานสำหรับประเมินมูลค่าสต๊อก",
          ),
          row(
            "จำนวนฐานน้ำพริก (Chili par level)",
            valueCell("supplies", "chiliPar", (value) => fmt(Number(value))),
            "หลอด",
            "ระดับสต๊อกเป้าหมายของแต่ละสาขา",
          ),
          row(
            "ราคาต่อหน่วยน้ำพริก (Chili unit price)",
            valueCell(
              "supplies",
              "chiliUnitPrice",
              (value) => `฿${fmt(Number(value))}`,
            ),
            "บาท / หลอด",
            "ราคามาตรฐานสำหรับประเมินมูลค่าสต๊อก",
          ),
          row(
            "จำนวนฐานข้าวเหนียวสุกมีนบุรี (Cooked rice par level)",
            valueCell("supplies", "cookedRicePar", (value) =>
              fmt(Number(value)),
            ),
            "กก.",
            "ยอดข้าวพร้อมขายขั้นต่ำหลังซื้อเข้า ปัจจุบันตั้งไว้ 30 กก.",
          ),
          row(
            "ราคาต่อหน่วยข้าวเหนียวสุก (Cooked rice unit price)",
            valueCell(
              "supplies",
              "cookedRiceUnitPrice",
              (value) => `฿${fmt(Number(value))}`,
            ),
            "บาท / กก.",
            "ราคามาตรฐานสำหรับข้าวเหนียวสุกที่มีนบุรีซื้อ",
          ),
        ]}
      />
      <DataTable
        title="การผลิตและขนส่ง (Production & logistics)"
        action={action("production")}
        columns={[
          "รายการ (Setting)",
          "ค่าปัจจุบัน (Current value)",
          "หน่วย (Unit)",
          "ใช้คำนวณ (Purpose)",
        ]}
        rows={[
          row(
            "ค่ารมควันตามน้ำหนัก PO (Smoking fee tiers)",
            "500 กก. ฿220 · 1,000 กก. ฿200 · 1,500 กก. ฿180",
            "บาท / กก.",
            "ระบบเลือกอัตราให้อัตโนมัติจากน้ำหนักในใบ PO รมควัน",
          ),
          row(
            "ค่าขนส่งขาไป (Outbound delivery fee)",
            valueCell(
              "production",
              "outboundFee",
              (value) => `฿${fmt(Number(value))}`,
            ),
            "บาท / เที่ยว",
            "ต้นทุนส่งไป Chef_house เที่ยวเดียว",
          ),
          row(
            "ค่าขนส่งขากลับ (Return delivery fee)",
            valueCell(
              "production",
              "returnFee",
              (value) => `฿${fmt(Number(value))}`,
            ),
            "บาท / เที่ยว",
            "ต้นทุนรับสินค้ากลับเที่ยวเดียว",
          ),
          row(
            "ค่าขนส่งไป-กลับ (Round-trip fee)",
            valueCell(
              "production",
              "roundFee",
              (value) => `฿${fmt(Number(value))}`,
            ),
            "บาท / รอบ",
            "ต้นทุนเมื่อเลือกเที่ยวไปกลับ",
          ),
        ]}
      />
      <DataTable
        title="กติกาสาขา (Branch rules)"
        action={action("branch")}
        columns={[
          "รายการ (Setting)",
          "ค่าปัจจุบัน (Current value)",
          "หน่วย (Unit)",
          "ผลต่อการทำงาน (Effect)",
        ]}
        rows={[
          row(
            "สาขาของบัญชีผู้ดูแล (Assigned branch)",
            valueCell("branch", "branch", undefined, "branch"),
            "สาขา",
            "กำหนดข้อมูลที่บัญชีสาขาเห็นและกรอกได้",
          ),
          row(
            "ค่าคลาดเคลื่อนยอดขาย (Sales tolerance)",
            valueCell("branch", "tolerance", (value) => fmt(Number(value))),
            "%",
            "กำหนดช่วงยอดขายที่ยอมรับได้",
          ),
          row(
            "เวลาเริ่มปิดวัน (Day-closing time)",
            valueCell("branch", "closeTime", undefined, "time"),
            "นาฬิกา",
            "เวลา 22:00 ระบบล็อกข้อมูลเมื่อปิดวัน Owner ปลดล็อกกรณีพิเศษได้",
          ),
        ]}
      />
      <DataTable
        title="จำนวนฐานและราคาวัสดุทั้งร้าน (Material par levels & unit prices)"
        action={action("materials")}
        columns={materialSettingsColumns}
        rows={materialSettingsRows}
      />
      <p className="footnote">
        จำนวนฐานและราคามาตรฐานชุดเดียวใช้กับศาลาแดงและมีนบุรี ส่วนการซื้อวัสดุให้บันทึกจากเมนูสต๊อก
        เพื่อเก็บวันที่ จำนวน และราคาซื้อจริงในแต่ละรอบ
      </p>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
function Read({ label, value }: { label: string; value: string }) {
  return (
    <div className="read-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Package size={34} />
      <p>{text}</p>
    </div>
  );
}

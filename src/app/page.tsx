"use client";

import { useState, type ReactNode } from "react";
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
  Warehouse,
} from "lucide-react";
import {
  balance,
  availableBags,
  brineStockMl,
  branchMaterialStock,
  branches,
  chiliStock,
  centralBagStock,
  centralStock,
  cookedRiceStock,
  entries,
  issuedChiliStock,
  issuedRawRiceStock,
  isClosed,
  lotCost,
  materials,
  materialPar,
  materialSent,
  materialUnitPrice,
  mutate,
  n,
  ownerMaterialStock,
  processed,
  produced,
  producedBags,
  rawRiceStock,
  roleName,
  seed,
  stageAction,
  stageRole,
  stages,
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
  demoInitialDatabase,
  saveDatabase,
  useDatabase,
} from "@/lib/demo-persistence";
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
  | "transport"
  | "central-receive"
  | "branch-status"
  | "branch-summary"
  | "stock"
  | "day"
  | "report"
  | "history"
  | "config";
type Modal = { kind: string; lotId: string };
const tabs: { id: Tab; label: string; ownerLabel?: string; icon: typeof Package }[] = [
  { id: "owner-dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { id: "po", label: "ใบสั่งซื้อ PO", icon: FilePlus2 },
  { id: "transport", label: "ใบขนส่ง", icon: ArrowRight },
  { id: "central-receive", label: "รับเนื้อเข้าสต๊อกกลาง", icon: Warehouse },
  { id: "work", label: "งานและ Lot", ownerLabel: "ใบสั่งซื้อและ Lot ทั้งหมด", icon: ClipboardList },
  { id: "cm-receive", label: "ยืนยันรับเนื้อ", icon: Warehouse },
  { id: "branch-status", label: "ติดตามสาขา", ownerLabel: "จัดสรรเนื้อ และสต๊อกไปสาขา", icon: ListChecks },
  { id: "stock", label: "สต๊อก", ownerLabel: "สต๊อกของทั้งหมด", icon: Package },
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
  const [reset, setReset] = useState(false);
  const [search, setSearch] = useState("");
  const branch = db.config.branch;
  const lots = db.lots.filter(
    (l) =>
      role === "owner" ||
      (role === "cm" && l.stage >= 2) ||
      (role === "branch" && entries(db, "allocate", l.id, branch).length > 0),
  );
  const lot = lots.find((l) => l.id === chosen) || lots[0];
  const open = (kind: string, lotId = lot?.id || "") =>
    setModal({ kind, lotId });
  const closed = isClosed(db, branch, date);
  const missingMaterialSettings = branches.reduce(
    (count, branchName) =>
      count +
      materials.filter(
        (_, index) =>
          materialPar(db, branchName, index) <= 0 ||
          materialUnitPrice(db, branchName, index) <= 0,
      ).length,
    0,
  );
  function changeRole(value: Role, selectedBranch?: string) {
    if (value === "branch" && selectedBranch && selectedBranch !== branch) {
      const current = latestDatabase();
      saveDatabase({
        ...current,
        config: { ...current.config, branch: selectedBranch },
      });
    }
    setRole(value);
    setTab(value === "owner" ? "owner-dashboard" : value === "cm" ? "cm-receive" : "work");
    setSearch("");
    setToast("");
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
          <button className="secondary" onClick={exported}>
            <Download size={16} /> ส่งออก
          </button>
          {role === "owner" && (
            <button className="secondary" onClick={() => setReset(true)}>
              <RotateCcw size={16} /> คืนข้อมูลตัวอย่าง
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
                    ? !["day", "branch-summary", "work"].includes(t.id)
                    : role === "cm"
                      ? ["cm-receive", "work", "stock", "history"].includes(t.id)
                      : ["work", "stock", "branch-summary", "day", "history"].includes(t.id),
              )
              .map((t) => (
                <button
                  key={t.id}
                  className={tab === t.id ? "selected" : ""}
                  onClick={() => setTab(t.id)}
                >
                  <t.icon size={18} />
                  {role === "owner" ? t.ownerLabel || t.label : t.label}
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
                ตั้งค่าวัสดุยังไม่ครบ {missingMaterialSettings} รายการสาขา
                กรุณากำหนดจำนวนฐานและราคาต่อหน่วยก่อนส่งวัสดุครั้งถัดไป
              </span>
              <button className="secondary" onClick={() => setTab("config")}>
                ไปหน้าตั้งค่า
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
            <OwnerDashboard db={db} date={date} />
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
                  <button className="secondary" onClick={() => open("brinePurchase", "")}><Plus size={17} /> สร้าง PO น้ำหมัก</button>
                </div>
              </div>
              <DataTable
                title="รายการใบสั่งซื้อ PO"
                columns={["เลข PO", "Lot", "ผู้จำหน่าย", "น้ำหนักสั่งซื้อ", "ราคา / กก.", "สถานะ", "การทำงาน"]}
                rows={db.lots.map((item) => [
                  item.poId,
                  item.id,
                  item.values.supplier,
                  `${fmt(n(item.values, "orderedKg"))} กก.`,
                  `฿${fmt(n(item.values, "price"))}`,
                  stages[item.stage],
                  item.stage === 1 ? (
                    <button className="table-action" key={item.id} onClick={() => open("dispatch", item.id)}>
                      ทำใบขนส่ง
                    </button>
                  ) : "ส่งต่อแล้ว",
                ])}
              />
              <DataTable
                title={`ใบ PO น้ำหมัก · คงเหลือ ${fmt(brineStockMl(db))} มล.`}
                columns={["เลข PO", "วันที่", "ผู้จำหน่าย", "ปริมาณ", "ราคารวม"]}
                rows={entries(db, "brinePurchase").map((entry) => [entry.values.poNumber, entry.date, entry.values.supplier, `${fmt(n(entry.values, "quantityMl"))} มล.`, `฿${fmt(n(entry.values, "totalCost"))}`])}
              />
            </>
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
              <MeatStockTable db={db} role={role} branch={branch} lots={lots} closed={closed} open={open} />
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
                      รับวัสดุเข้าคลัง
                    </button>
                    <button className="primary" onClick={() => open("materialTransfer", "")}>
                      ส่งวัสดุไปสาขา
                    </button>
                  </div>
                )}
              </div>
              <MeatStockTable
                db={db}
                role={role}
                branch={branch}
                lots={lots}
                closed={closed}
                open={open}
              />
              {role !== "cm" && (
                <SupplyStock
                  db={db}
                  branches={role === "owner" ? branches : [branch]}
                />
              )}
              {role !== "cm" && (
                <MaterialStockTable
                  db={db}
                  stockBranches={role === "owner" ? branches : [branch]}
                  ownerView={role === "owner"}
                />
              )}
              {role === "branch" && (
                <MaterialReceiptConfirmation db={db} branch={branch} date={date} closed={closed} />
              )}
            </>
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
              <DailyMaterialsTable
                key={`${branch}-${date}`}
                db={db}
                branch={branch}
                date={date}
                disabled={closed || role !== "branch"}
              />
              <DailyTaskTable
                title="ข้าวเหนียว (Sticky rice)"
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
              <DailyTaskTable
                title="น้ำพริกหลอด (Chili tubes)"
                kinds={["chiliPurchase", "chiliIssue"]}
                db={db}
                branch={branch}
                date={date}
                disabled={closed || role !== "branch"}
                hasLots={!!lots.length}
                open={open}
              />
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
      {modal?.kind === "allocate" && (
        <BagAllocationForm db={db} lotId={modal.lotId} date={date} onClose={() => setModal(null)} onSaved={() => { setToast("จัดสรรถุงเนื้อไปสาขาแล้ว"); setModal(null); }} />
      )}
      {modal && !["materialTransfer", "allocate"].includes(modal.kind) && (
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
              setTab("transport");
              setToast("สร้างใบ PO แล้ว · กรุณาทำใบขนส่งขาไป");
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
                className="primary"
                onClick={() => {
                  try {
                    saveDatabase(structuredClone(demoInitialDatabase));
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
    if (kind === "closeDay") base.time = "21:00";
    return base;
  });
  const [lotId, setLotId] = useState(modal.lotId);
  const [error, setError] = useState("");
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
  function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const next = mutate(latestDatabase(), role, kind, values, lotId, date);
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
        className="form-dialog"
      >
        <header>
          <div>
            <span className="overline">
              {date} · {roleName[role]}
            </span>
            <h2 id="form-title">{titles[kind]}</h2>
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
          <div className="form-body">
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
                  ) : f.type === "textarea" ? (
                    <textarea
                      required={!f.optional}
                      rows={f.key === "packs" ? 5 : 3}
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
            <Preview db={db} lot={lot} kind={kind} v={values} />
            {error && (
              <div role="alert" className="notice danger">
                {error}
              </div>
            )}
          </div>
          <footer>
            <p>บันทึกแล้วเก็บในเบราว์เซอร์</p>
            <button type="button" className="secondary" onClick={onClose}>
              ยกเลิก
            </button>
            <button className="primary" type="submit">
              {kind === "closeDay" ? "ยืนยันปิดวัน" : "บันทึกรายการ"}
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
      ["น้ำหมัก 10%", `${fmt(n(v, "orderedKg") * 0.1)} กก.`],
      [
        "ค่าหมักตามการตั้งค่า",
        `฿${fmt(n(v, "orderedKg") * 0.1 * n(db.config, "brinePrice"))}`,
      ],
    ];
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
  if (kind === "cmReceive" && lot)
    rows = [
      ["น้ำหนักส่ง", `${fmt(n(lot.values, "dispatchKg"))} กก.`],
      [
        "ส่วนต่าง",
        `${fmt(n(v, "receivedKg") - n(lot.values, "dispatchKg"))} กก. (กรอกเหตุผลเมื่อไม่ตรง)`,
      ],
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
      ["ของที่ส่งกลับกรุงเทพฯ", `${producedBags(db, lot.id)} ถุง · ${fmt(produced(db, lot.id))} กก.`],
      [
        "ค่ารถขากลับ",
        `฿${fmt(lot.values.trip === "ไปกลับ" ? 0 : n(lot.config, "returnFee"))}`,
      ],
      ["รูปแบบขาไป", lot.values.trip],
    ];
  if (kind === "central" && lot)
    rows = [
      ["ผลผลิตส่งจากโรงรม", `${fmt(produced(db, lot.id))} กก.`],
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
      [
        "น้ำพริกที่จะหัก",
        `${n(v, "chiliAddons")} หลอดที่ลูกค้าซื้อ`,
      ],
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
    <div
      className="bar-chart single-series"
      aria-label="กราฟยอดขายรายวัน"
      style={{
        gridTemplateColumns: `repeat(${data.length}, minmax(58px, 1fr))`,
        minWidth: `${Math.max(520, data.length * 76)}px`,
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

function OwnerDashboard({ db, date }: { db: Database; date: string }) {
  const start = new Date(`${date}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  const defaultFrom = start.toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(date);
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
  const totalCost = meatAndBranchCost + supplyCost + ownerCost + materialCost;
  const margin = income - totalCost;
  const required = (branchName: string) =>
    branchName === "มีนบุรี"
      ? ["ricePurchase", "riceCarry", "chiliIssue", "materials", "sale", "closeDay"]
      : ["riceIssue", "rice", "chiliIssue", "materials", "sale", "closeDay"];
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
  const alertCount = branchRows.filter((row) =>
    String(row[3]).startsWith("ค้าง") || String(row[4]).startsWith("ใกล้หมด"),
  ).length + activeLots;
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
    { label: "Owner", value: ownerCost, color: "#7c3aed" },
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
    <div className="owner-dashboard">
      <section className="dashboard-hero">
        <div>
          <span className="overline">OWNER CONTROL ROOM</span>
          <h2>ภาพรวมร้านเนื้อรมควัน</h2>
          <p>{fromDate} ถึง {toDate} · อัปเดตจากรายการที่ทุกบทบาทบันทึก</p>
        </div>
        <div className={alertCount ? "dashboard-health warning" : "dashboard-health"}>
          <CircleAlert size={18} />
          {alertCount ? `ต้องดูแล ${alertCount} จุด` : "การทำงานปกติ"}
        </div>
      </section>
      <section className="dashboard-range">
        <div><strong>ช่วงข้อมูลบนแดชบอร์ด</strong><span>กราฟและตัวเลขทั้งหมดเปลี่ยนตามช่วงนี้</span></div>
        <div className="table-filters">
          <label className="table-filter">ตั้งแต่<input type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label className="table-filter">ถึง<input type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} /></label>
          <button className="secondary" onClick={() => { setFromDate(defaultFrom); setToDate(date); }}>7 วันล่าสุด</button>
        </div>
      </section>
      <section className="dashboard-kpis">
        <div><span>ยอดขายช่วงที่เลือก</span><strong>฿{fmt(income)}</strong><small><TrendingUp size={14} /> จาก LINE MAN</small></div>
        <div><span>ต้นทุนที่บันทึก</span><strong>฿{fmt(totalCost)}</strong><small>รวม Owner และวัสดุ</small></div>
        <div className={margin >= 0 ? "positive" : "negative"}><span>ส่วนต่างหลังต้นทุน</span><strong>฿{fmt(margin)}</strong><small>{fmt(marginPercent)}% ของยอดขาย</small></div>
        <div><span>กล่องที่ขาย</span><strong>{sales.reduce((total, entry) => total + n(entry.values, "boxes"), 0)}</strong><small>ทั้งสองสาขา</small></div>
      </section>
      <section className="sales-charts">
        <div className="chart-panel">
          <div className="chart-heading"><div><span className="overline">SALES TREND · SALA DAENG</span><h2>ยอดขายสาขาศาลาแดง</h2></div><span className="chart-total">฿{fmt(dailySales.reduce((sum, item) => sum + item.sala, 0))}</span></div>
          <div className="chart-overflow"><SalesBars data={dailySales} branch="sala" colorClass="sala" max={maxDaily} /></div>
        </div>
        <div className="chart-panel">
          <div className="chart-heading"><div><span className="overline">SALES TREND · MIN BURI</span><h2>ยอดขายสาขามีนบุรี</h2></div><span className="chart-total blue">฿{fmt(dailySales.reduce((sum, item) => sum + item.minburi, 0))}</span></div>
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
        ["น้ำพริกคงเหลือ", String(chiliStock(db, branch)), "หลอด"],
        [
          "น้ำพริกที่เบิกแล้วยังไม่ขาย",
          String(issuedChiliStock(db, branch)),
          "หลอด",
        ],
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
  const action = (lot: Lot) => {
    const kind = lot.stage === 3 ? "prepare" : lot.stage === 4 ? "smoke" : lot.stage === 5 ? "closeLot" : "";
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
        columns={["Lot", "รับจริง", "สถานะ", "น้ำหนักหลังรมควัน", "จำนวนถุงส่งกรุงเทพฯ", "การทำงาน"]}
        rows={lots.map((lot) => [
          lot.id,
          n(lot.values, "receivedKg") ? `${fmt(n(lot.values, "receivedKg"))} กก.` : "รอยืนยันรับ",
          stages[lot.stage],
          produced(db, lot.id) ? `${fmt(produced(db, lot.id))} กก.` : "-",
          producedBags(db, lot.id) ? `${producedBags(db, lot.id)} ถุง` : "-",
          action(lot),
        ])}
      />
    </>
  );
}
function TransportManifestView({
  db,
  open,
}: {
  db: Database;
  open: (kind: string, lotId?: string) => void;
}) {
  const returnEntry = (lotId: string) => entries(db, "return", lotId).at(-1);
  const tripStatus = (lot: Lot) => {
    if (lot.stage === 1)
      return <button className="table-action" onClick={() => open("dispatch", lot.id)}>ทำใบขนส่งขาไป</button>;
    if (lot.stage === 6)
      return <button className="table-action" onClick={() => open("return", lot.id)}>ทำใบขนส่งขากลับ</button>;
    if (lot.stage < 6) return "กำลังดำเนินงานที่ Chef_house";
    return "ส่งครบแล้ว";
  };
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>ใบขนส่งเนื้อ</h2>
          <p className="muted">ทำใบส่งเนื้อไป Chef_house และนัดรับเนื้อหลังรมควันกลับเข้าสต๊อกกลาง</p>
        </div>
      </div>
      <DataTable
        title="รายการขนส่งตาม Lot"
        columns={["Lot", "ขาไป · ส่งไป Chef_house", "ขากลับ · รับเนื้อหลังรมควัน", "การทำงาน"]}
        rows={db.lots.map((lot) => {
          const back = returnEntry(lot.id);
          return [
            lot.id,
            lot.stage >= 2
              ? `${fmt(n(lot.values, "dispatchKg"))} กก. · ${lot.values.vehicle || "ยังไม่ระบุรถ"}`
              : "รอทำใบขนส่ง",
            back
              ? `${back.values.returnDate || "ยังไม่ระบุวัน"} · ${back.values.returnVehicle || "ยังไม่ระบุรถ"}`
              : lot.stage < 6
                ? "รอ Chef_house ปิด Lot"
                : "รอทำใบขนส่งขากลับ",
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
  const readyToReceive = db.lots.filter((lot) => lot.stage === 7);
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>รับเนื้อเข้าสต๊อกกลาง</h2>
          <p className="muted">รับน้ำหนักเนื้อหลังรมควันจาก Chef_house ก่อนจัดสรรไปยังสาขา</p>
        </div>
      </div>
      <DataTable
        title="Lot ที่รอรับเข้าคลังกลาง"
        columns={["Lot", "น้ำหนักเนื้อหลังรมควัน", "จำนวนถุง", "นัดรับขากลับ", "สถานะ", "การทำงาน"]}
        rows={readyToReceive.map((lot) => {
          const back = entries(db, "return", lot.id).at(-1);
          return [
            lot.id,
            `${fmt(produced(db, lot.id))} กก.`,
            `${producedBags(db, lot.id)} ถุง`,
            back
              ? `${back.values.returnDate || "ยังไม่ระบุวัน"} · ${back.values.returnVehicle || "ยังไม่ระบุรถ"}`
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
      ? ["ricePurchase", "riceCarry", "chiliIssue", "materials", "sale", "closeDay"]
      : ["riceIssue", "rice", "chiliIssue", "materials", "sale", "closeDay"];
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
        return [
          optional ? `${titles[kind]} · บันทึกเฉพาะวันที่ซื้อ` : titles[kind],
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
function MeatStockTable({
  db,
  role,
  branch,
  lots,
  closed,
  open,
}: {
  db: Database;
  role: Role;
  branch: string;
  lots: Lot[];
  closed: boolean;
  open: (kind: string, lotId?: string) => void;
}) {
  if (role === "owner")
    return (
      <DataTable
        title="สต๊อกเนื้อทุกจุด (Meat inventory)"
        columns={["Lot", "ส่วนกลาง", "ถุงในคลังกลาง", "ศาลาแดง", "มีนบุรี", "สถานะ", "การทำงาน"]}
        rows={lots.map((lot) => [
          lot.id,
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
      columns={["Lot", "รอรับจาก Owner", "รับแล้ว", "แช่แข็ง", "พร้อมขาย", "สถานะ", "การทำงาน"]}
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
          pending > 0.001 ? "รอยืนยันรับของ" : stages[lot.stage],
          <div className="button-row" key={lot.id}>
            <button className="table-action" disabled={closed || pending <= 0.001} onClick={() => open("receive", lot.id)}>
              รับของ
            </button>
            <button className="table-action" disabled={closed || stock.frozen <= 0.001} onClick={() => open("thaw", lot.id)}>
              ละลาย
            </button>
          </div>,
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
  if (ownerView)
    return (
      <DataTable
        title="สต๊อกวัสดุ Owner และสาขา (Material distribution)"
        columns={[
          "วัสดุ",
          "คลัง Owner",
          "ส่งศาลาแดง",
          "คงเหลือศาลาแดง",
          "ส่งมีนบุรี",
          "คงเหลือมีนบุรี",
          "ส่งรวม",
        ]}
        rows={materials.map((item, index) => {
          const salaSent = materialSent(db, item, "ศาลาแดง");
          const minburiSent = materialSent(db, item, "มีนบุรี");
          return [
            item,
            `${ownerMaterialStock(db, item)} ชิ้น`,
            `${salaSent} ชิ้น`,
            `${branchMaterialStock(db, "ศาลาแดง", index)} ชิ้น`,
            `${minburiSent} ชิ้น`,
            `${branchMaterialStock(db, "มีนบุรี", index)} ชิ้น`,
            `${salaSent + minburiSent} ชิ้น`,
          ];
        })}
      />
    );
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
        "น้ำพริกในคลัง",
        "น้ำพริกที่เบิก",
        "ข้าวที่ควรซื้อเพิ่ม",
        "ซื้อเข้าล่าสุด",
      ]}
      rows={stockBranches.map((name) => {
        const latest = [
          ...entries(db, "supplyPurchase", undefined, name),
          ...entries(db, "ricePurchase", undefined, name),
          ...entries(db, "chiliPurchase", undefined, name),
        ].sort((a, b) => a.at.localeCompare(b.at)).at(-1);
        return [
          <strong key={name}>{name}</strong>,
          `${fmt(rawRiceStock(db, name))} กก.`,
          `${fmt(issuedRawRiceStock(db, name))} กก.`,
          `${fmt(cookedRiceStock(db, name))} กก.`,
          `${fmt(chiliStock(db, name))} หลอด`,
          `${fmt(issuedChiliStock(db, name))} หลอด`,
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
      ["expense", "materialReceive"].includes(entry.kind) ||
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
    cost =
      supplyCost +
      ownerExpenseCost + materialPurchaseCost +
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
          ["ส่วนต่างหลังต้นทุนที่บันทึก", fmt(sales.reduce((sum, e) => sum + n(e.values, "revenue"), 0) - cost), "บาท"],
        ]}
      />
      <div className="notice">
        ตัวเลขนี้รวมค่าใช้จ่าย Owner และการซื้อวัสดุที่บันทึกแล้ว แต่ยังไม่รวมภาษี
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
          "หมัก (Brining)",
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
              fmt(c.brine),
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
        title="รายการเบิกน้ำพริกรายวัน"
        columns={["วันที่", "สาขา", "ผู้รับ", "น้ำพริก (หลอด)"]}
        rows={[...entries(db, "supplyIssue"), ...entries(db, "chiliIssue")]
          .filter((entry) => inRange(entry) && n(entry.values, "chiliIssuedTubes") > 0)
          .sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at))
          .map((entry) => [entry.date, entry.branch, entry.values.receiver, fmt(n(entry.values, "chiliIssuedTubes"))])}
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
    "allocate", "receive", "thaw", "ricePurchase", "chiliPurchase",
    "riceIssue", "chiliIssue", "rice", "riceCarry", "sale", "materials",
    "materialReceive", "materialTransfer", "materialConfirm", "closeDay",
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
    "pricing" | "supplies" | "production" | "branch" | "materials";
  const initial = () => {
    const values = { ...seed.config, ...db.config };
    for (let i = 0; i < materials.length; i++)
      for (const suffix of ["saladaeng", "minburi"]) {
        values[`material${i}_${suffix}`] ??= values[`material${i}`] || "0";
        values[`materialPrice${i}_${suffix}`] ??= values[`materialPrice${i}`] || "0";
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
    for (let i = 0; i < materials.length; i++)
      for (const suffix of ["saladaeng", "minburi"]) {
        values[`material${i}_${suffix}`] ??= values[`material${i}`] || "0";
        values[`materialPrice${i}_${suffix}`] ??= values[`materialPrice${i}`] || "0";
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
    type: "number" | "time" | "branch" = "number",
  ) => {
    if (editing !== section)
      return (
        <span className="read-only-value">
          {display(db.config[key] || seed.config[key] || "0")}
        </span>
      );
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
    return (
      <input
        className="table-edit-control"
        aria-label={key}
        type={type === "time" ? "time" : "number"}
        min={type === "number" ? "0" : undefined}
        step={key === "packKg" ? "0.001" : key === "tolerance" ? "1" : "0.01"}
        value={draft[key] ?? ""}
        onChange={(event) => set(key, event.target.value)}
      />
    );
  };

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
            "ค่าหมัก (Brining cost)",
            valueCell(
              "production",
              "brinePrice",
              (value) => `฿${fmt(Number(value))}`,
            ),
            "บาท / กก.",
            "ต้นทุนหมัก 10% ของน้ำหนักส่ง",
          ),
          row(
            "ค่ารมควัน (Smoking fee)",
            valueCell(
              "production",
              "smokeRate",
              (value) => `฿${fmt(Number(value))}`,
            ),
            "บาท / กก.",
            "ค่าจ้างรมควัน คำนวณจากน้ำหนักเนื้อที่ส่งให้ Foodiva",
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
            "ก่อนเวลานี้สาขาจะยังปิดวันไม่ได้",
          ),
        ]}
      />
      <DataTable
        title="ฐานและราคาวัสดุแยกสาขา (Material par levels by branch)"
        action={action("materials")}
        columns={[
          "สาขา (Branch)",
          "วัสดุ (Material)",
          "จำนวนฐาน (Par level)",
          "ราคาต่อหน่วย (Unit price)",
          "มูลค่าฐาน (Par value)",
          "สถานะ",
        ]}
        rows={branches.flatMap((branchName) => materials.map((name, index) => {
          const suffix = branchName === "ศาลาแดง" ? "saladaeng" : "minburi";
          const amountKey = `material${index}_${suffix}`;
          const priceKey = `materialPrice${index}_${suffix}`;
          const source = editing === "materials" ? draft : db.config;
          const amount = n(source, amountKey) || n(source, `material${index}`);
          const price = n(source, priceKey) || n(source, `materialPrice${index}`);
          return [
            <strong key="branch">{branchName}</strong>,
            <strong key="label">{name}</strong>,
            valueCell(
              "materials",
              amountKey,
              (value) => `${fmt(Number(value))} ชิ้น`,
            ),
            valueCell(
              "materials",
              priceKey,
              (value) => `฿${fmt(Number(value))} / ชิ้น`,
            ),
            <span className="read-only-value" key="total">
              ฿{fmt(amount * price)}
            </span>,
            amount > 0 && price > 0 ? "ตั้งค่าแล้ว" : "ยังไม่กำหนดครบ",
          ];
        }))}
      />
      <p className="footnote">
        ค่ารมควัน (Smoking fee) ในเดโมเป็นอัตราเดียว
        ยังไม่รองรับราคาแบบขั้นบันได ส่วนภาษี ค่าเสื่อม
        และวันเริ่มใช้งานจริงยังไม่มีช่องตั้งค่า
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

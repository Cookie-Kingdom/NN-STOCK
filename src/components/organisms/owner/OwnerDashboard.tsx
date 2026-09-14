"use client";

import { useState } from "react";
import { BarChart3, CircleAlert, Package, TrendingUp, Warehouse } from "lucide-react";
import { CostDonut } from "@/components/organisms/shared/CostDonut";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { SalesBars } from "@/components/organisms/shared/SalesBars";
import { averageYield, balance, branchMaterialStock, branches, centralStock, chiliStock, cookedRiceStock, entries, isClosed, materialPar, materials, n, processLoss, produced, rawAtFoodiva, rawAtSmoker, rawRiceStock, readyForChefHouse, reservedForOwnerContent, smokingInvoiceStatus, stages, steakRawStock, type Database, type Entry } from "@/lib/store";
import { fmt } from "@/lib/format";
import { type Tab } from "@/lib/nav";

export function OwnerDashboard({
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
  const foodivaInvoicesForOwner = db.lots.filter(
    (lot) => entries(db, "foodDivaConfirm", lot.id).length > 0 && !entries(db, "smokeOrder", lot.id).length,
  );
  const alertDetails: { title: string; detail: string; kind: "branch" | "lot" | "invoice"; tab?: Tab }[] = [
    ...foodivaInvoicesForOwner.map((lot) => {
      const invoice = entries(db, "foodDivaConfirm", lot.id).at(-1)!;
      return {
        title: `Foodiva ออก Invoice แล้ว · ${lot.id}`,
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
        columns={["Open PO", "Supplier Invoice ค้าง", "Smoking Invoice ค้าง", "Raw Meat ที่ Foodiva", "Raw Meat ที่โรงรม", "Steak allocation", "Finished smoked meat", "Loss รวม", "Average yield"]}
        rows={[[
          String(db.lots.filter((lot) => lot.stage < 8).length),
          String(entries(db, "supplierInvoice").filter((entry) => entry.values.paymentStatus !== "Paid").length),
          String(entries(db, "smokingInvoice").filter((entry) => smokingInvoiceStatus(db, entry) !== "ชำระแล้ว").length),
          `${fmt(db.lots.reduce((sum, lot) => sum + rawAtFoodiva(db, lot), 0))} กก.`,
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

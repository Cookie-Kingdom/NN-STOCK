"use client";

import { useState } from "react";
import {
  BarChart3,
  CircleAlert,
  Package,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Overline } from "@/components/atoms/Overline";
import { Panel } from "@/components/atoms/Panel";
import { AlertListItem } from "@/components/molecules/AlertListItem";
import { ChartPanel } from "@/components/molecules/ChartPanel";
import { DateRangeFilter } from "@/components/molecules/DateRangeFilter";
import { EmptyState } from "@/components/molecules/EmptyState";
import { FilterBar } from "@/components/molecules/FilterBar";
import { KpiCard } from "@/components/molecules/KpiCard";
import {
  requiredDailyKinds,
  requiredDailyLabels,
  sevenDayRangeStart,
} from "@/components/organisms/owner/ownerDaily";
import { CostDonut } from "@/components/organisms/shared/CostDonut";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { SalesBars } from "@/components/organisms/shared/SalesBars";
import {
  averageYield,
  balance,
  branchMaterialStock,
  branches,
  centralStock,
  chiliStock,
  cookedRiceStock,
  entries,
  isClosed,
  materialPar,
  materials,
  n,
  processLoss,
  produced,
  rawAtFoodiva,
  rawAtSmoker,
  rawRiceStock,
  readyForChefHouse,
  reservedForOwnerContent,
  smokingInvoiceStatus,
  stages,
  type Database,
  type Entry,
} from "@/lib/store";
import { fmt } from "@/lib/format";
import { type Tab } from "@/lib/nav";
import { cn } from "@/lib/utils";

const summaryColumns = [
  "Open PO",
  "Smoking Invoice ค้าง",
  "Raw Meat ที่ Foodiva",
  "Raw Meat ที่โรงรม",
  "Finished smoked meat",
  "Loss รวม",
  "Average yield",
];
const branchColumns = [
  "สาขา",
  "ยอดขายช่วงที่เลือก",
  "กล่อง",
  "งานวันนี้",
  "วัสดุ",
  "ปิดวัน",
];
const lotColumns = [
  "Lot",
  "ขั้นตอน",
  "ผลผลิต",
  "คลังกลาง",
  "ศาลาแดง",
  "มีนบุรี",
];

export function OwnerDashboard({
  db,
  date,
  onNavigate,
}: {
  db: Database;
  date: string;
  onNavigate: (tab: Tab) => void;
}) {
  const defaultFrom = sevenDayRangeStart(date);
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(date);
  const [showAlerts, setShowAlerts] = useState(false);
  const withinRange = (entry: Entry) =>
    entry.date >= fromDate && entry.date <= toDate;
  const sales = entries(db, "sale").filter(withinRange);
  const income = sales.reduce(
    (total, entry) => total + n(entry.values, "revenue"),
    0,
  );
  /** Meat that left the shelf plus the postage paid to send it. */
  const giveawayCost = (rows: Entry[]) =>
    rows.reduce(
      (total, entry) =>
        total + n(entry.values, "meatCost") + n(entry.values, "shippingFee"),
      0,
    );
  const influencerBoxes = entries(db, "influencerBox").filter(withinRange);
  const meatAndBranchCost =
    sales.reduce(
      (total, entry) =>
        total +
        n(entry.values, "meatCost") +
        n(entry.values, "wasteCost") +
        n(entry.values, "expense"),
      0,
    ) + giveawayCost(influencerBoxes);
  const supplyCost = [
    ...entries(db, "supplyPurchase"),
    ...entries(db, "ricePurchase"),
    ...entries(db, "chiliPurchase"),
  ]
    .filter(withinRange)
    .reduce((total, entry) => total + n(entry.values, "totalCost"), 0);
  const ownerCost = entries(db, "expense")
    .filter(withinRange)
    .reduce((total, entry) => total + n(entry.values, "amount"), 0);
  const materialCost = entries(db, "materialReceive")
    .filter(withinRange)
    .reduce((total, entry) => total + n(entry.values, "totalCost"), 0);
  const ownerStockPurchaseCost = entries(db, "generalPurchase")
    .filter(withinRange)
    .reduce((total, entry) => total + n(entry.values, "totalCost"), 0);
  const totalCost =
    meatAndBranchCost +
    supplyCost +
    materialCost +
    ownerStockPurchaseCost +
    ownerCost;
  const margin = income - totalCost;
  const branchRows = branches.map((branchName) => {
    const rows = sales.filter((entry) => entry.branch === branchName);
    const missing = requiredDailyKinds(branchName).filter(
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
      String(
        rows.reduce((total, entry) => total + n(entry.values, "boxes"), 0),
      ),
      missing.length ? `ค้าง ${missing.length} รายการ` : "ครบแล้ว",
      lowMaterials ? `ใกล้หมด ${lowMaterials} รายการ` : "ปกติ",
      isClosed(db, branchName, date) ? "ปิดวันแล้ว" : "ยังไม่ปิดวัน",
    ];
  });
  const activeLots = db.lots.filter((lot) => lot.stage < 8).length;
  const foodivaInvoicesForOwner = db.lots.filter(
    (lot) =>
      entries(db, "foodivaConfirm", lot.id).length > 0 &&
      !entries(db, "smokeOrder", lot.id).length,
  );
  const alertDetails: {
    title: string;
    detail: string;
    kind: "branch" | "lot" | "invoice";
    tab?: Tab;
  }[] = [
    ...foodivaInvoicesForOwner.map((lot) => {
      const invoice = entries(db, "foodivaConfirm", lot.id).at(-1)!;
      return {
        title: `Foodiva ออก Invoice แล้ว · ${lot.id}`,
        detail: `Invoice ${invoice.values.invoiceNo} · พร้อมส่งเชียงใหม่ ${fmt(readyForChefHouse(db, lot.id))} กก. · เนื้อส่วนที่เหลือรอ Owner รับ (Waste) ${fmt(reservedForOwnerContent(db, lot.id))} กก.`,
        kind: "invoice" as const,
        tab: "invoices" as const,
      };
    }),
    ...branches.flatMap((branchName) => {
      const pending = requiredDailyKinds(branchName).filter(
        (kind) => !entries(db, kind, undefined, branchName, date).length,
      );
      const lowMaterialNames = materials.filter(
        (_, index) =>
          materialPar(db, branchName, index) > 0 &&
          branchMaterialStock(db, branchName, index) <
            materialPar(db, branchName, index) * 0.2,
      );
      if (!pending.length && !lowMaterialNames.length) return [];
      return [
        {
          title: branchName,
          detail: [
            pending.length
              ? `ค้าง: ${pending.map((kind) => requiredDailyLabels[kind] || kind).join(", ")}`
              : "",
            lowMaterialNames.length
              ? `วัสดุใกล้หมด: ${lowMaterialNames.join(", ")}`
              : "",
          ]
            .filter(Boolean)
            .join(" · "),
          kind: "branch" as const,
        },
      ];
    }),
    ...db.lots
      .filter((lot) => lot.stage < 8)
      .map((lot) => ({
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
  const maxDaily = Math.max(
    1,
    ...dailySales.flatMap((item) => [item.sala, item.minburi]),
  );
  const costParts = [
    {
      label: "เนื้อและสาขา",
      value: meatAndBranchCost,
      color: "var(--color-chart-1)",
    },
    {
      label: "ข้าวและน้ำพริก",
      value: supplyCost,
      color: "var(--color-chart-2)",
    },
    { label: "วัสดุ", value: materialCost, color: "var(--color-chart-3)" },
    {
      label: "ซื้อเข้าสต๊อก Owner",
      value: ownerStockPurchaseCost,
      color: "var(--color-chart-4)",
    },
    { label: "Owner", value: ownerCost, color: "var(--color-chart-5)" },
  ];
  const branchCostCharts = branches.map((branchName) => {
    const branchSales = sales.filter((entry) => entry.branch === branchName);
    const meat =
      branchSales.reduce(
        (total, entry) =>
          total +
          n(entry.values, "meatCost") +
          n(entry.values, "wasteCost") +
          n(entry.values, "expense"),
        0,
      ) + giveawayCost(influencerBoxes.filter((e) => e.branch === branchName));
    const supplies = [
      ...entries(db, "supplyPurchase", undefined, branchName),
      ...entries(db, "ricePurchase", undefined, branchName),
      ...entries(db, "chiliPurchase", undefined, branchName),
    ]
      .filter(withinRange)
      .reduce((total, entry) => total + n(entry.values, "totalCost"), 0);
    return {
      label: branchName,
      parts: [
        {
          label: "เนื้อและค่าใช้จ่าย",
          value: meat,
          color: "var(--color-chart-1)",
        },
        {
          label: "ข้าวและน้ำพริก",
          value: supplies,
          color: "var(--color-chart-2)",
        },
      ],
      total: meat + supplies,
    };
  });

  return (
    <div className="grid gap-5.5 rounded-lg bg-bg p-2 max-sm:p-1">
      <section className="flex items-center justify-between gap-5 px-5.5 pt-6 pb-1 max-sm:flex-col max-sm:items-start max-sm:px-4 max-sm:pt-4.5 max-sm:pb-0.5">
        <div>
          <Overline tone="accent">OWNER DASHBOARD</Overline>
          <h2 className="mt-1 mb-1 text-h1 tracking-[-0.045em] text-text-primary xl:text-display">
            สวัสดีครับ, เจ้าของร้าน
          </h2>
          <p className="m-0 text-text-secondary">
            ภาพรวมร้านเนื้อรมควัน · อัปเดตจากข้อมูลที่ทุกบทบาทบันทึก
          </p>
        </div>
        <button
          type="button"
          className={cn(
            "flex flex-none items-center gap-2 rounded-full border px-3.5 py-2.5 font-semibold max-sm:w-full max-sm:justify-center",
            alertCount
              ? "border-warning/40 bg-warning-subtle text-warning"
              : "border-success/40 bg-success-subtle text-success",
          )}
          onClick={() => setShowAlerts((value) => !value)}
          aria-expanded={showAlerts}
          aria-controls="owner-alert-details"
        >
          <CircleAlert size={17} />
          {alertCount ? `ต้องดูแล ${alertCount} จุด` : "การทำงานปกติ"}
          <span className="ml-0.5 border-l border-current pl-2.5 text-caption font-semibold opacity-80">
            {showAlerts ? "ซ่อน" : "ดูรายละเอียด"}
          </span>
        </button>
      </section>
      {showAlerts && (
        <section
          className="rounded-lg border border-warning/40 bg-warning-subtle px-5 py-4.5"
          id="owner-alert-details"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <Overline tone="accent">ACTION REQUIRED</Overline>
              <h3 className="mt-1 mb-0 text-text-primary">รายการที่ต้องดูแล</h3>
            </div>
            <Button variant="text" onClick={() => setShowAlerts(false)}>
              ปิด
            </Button>
          </div>
          {alertDetails.length ? (
            <div className="mt-3.5 grid grid-cols-3 gap-2.5 max-lg:grid-cols-2 max-sm:grid-cols-1">
              {alertDetails.map((item) => (
                <AlertListItem
                  key={`${item.kind}-${item.title}`}
                  title={item.title}
                  detail={item.detail}
                  action={
                    item.tab && (
                      <Button
                        variant="text"
                        onClick={() => onNavigate(item.tab!)}
                      >
                        เปิดใบ Invoice
                      </Button>
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState compact text="ยังไม่มีรายการที่ต้องดำเนินการ" />
          )}
        </section>
      )}
      <section className="flex items-center justify-between gap-5 rounded-lg border border-border bg-surface/80 px-4.5 py-3.5 max-sm:flex-col max-sm:items-stretch">
        <div className="grid min-w-45 gap-0.75 max-sm:min-w-0">
          <strong className="text-text-primary">ช่วงข้อมูล</strong>
          <span className="text-caption whitespace-nowrap text-text-secondary">
            {fromDate} ถึง {toDate}
          </span>
        </div>
        <FilterBar>
          <DateRangeFilter
            from={fromDate}
            to={toDate}
            onFromChange={setFromDate}
            onToChange={setToDate}
          />
          <Button
            onClick={() => {
              setFromDate(defaultFrom);
              setToDate(date);
            }}
          >
            7 วันล่าสุด
          </Button>
        </FilterBar>
      </section>
      <section className="grid grid-cols-4 gap-4.5 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <KpiCard
          tone="sales"
          icon={<TrendingUp size={17} />}
          label="ยอดขายช่วงที่เลือก"
          value={`฿${fmt(income)}`}
          caption={
            <>
              <i className="font-extrabold text-success not-italic">↗</i>{" "}
              ยอดขายทั้งสองสาขา
            </>
          }
        />
        <KpiCard
          tone="cost"
          icon={<BarChart3 size={17} />}
          label="ต้นทุนที่บันทึก"
          value={`฿${fmt(totalCost)}`}
          caption="รวมเนื้อ ข้าว วัสดุ และสต๊อกที่ซื้อเข้า"
        />
        <KpiCard
          tone={margin >= 0 ? "positive" : "negative"}
          icon={<TrendingUp size={17} />}
          label="ส่วนต่างหลังต้นทุน"
          value={`฿${fmt(Math.abs(margin))}`}
          caption={`${margin >= 0 ? "↗" : "↘"} ${fmt(marginPercent)}% ของยอดขาย`}
          captionTone={margin >= 0 ? "gain" : "loss"}
        />
        <KpiCard
          tone="boxes"
          icon={<Package size={17} />}
          label="กล่องที่ขาย"
          value={sales.reduce(
            (total, entry) => total + n(entry.values, "boxes"),
            0,
          )}
          caption="รวมรายการขายที่บันทึกแล้ว"
        />
      </section>
      <DataTable
        title="Document & raw beef summary"
        columns={summaryColumns}
        rows={[
          [
            String(db.lots.filter((lot) => lot.stage < 8).length),
            String(
              entries(db, "smokingInvoice").filter(
                (entry) => smokingInvoiceStatus(db, entry) !== "ชำระแล้ว",
              ).length,
            ),
            `${fmt(db.lots.reduce((sum, lot) => sum + rawAtFoodiva(db, lot), 0))} กก.`,
            `${fmt(db.lots.reduce((sum, lot) => sum + rawAtSmoker(db, lot), 0))} กก.`,
            `${fmt(db.lots.reduce((sum, lot) => sum + produced(db, lot.id), 0))} กก.`,
            `${fmt(db.lots.reduce((sum, lot) => sum + processLoss(db, lot.id), 0))} กก.`,
            `${fmt(averageYield(db))}%`,
          ],
        ]}
      />
      <section className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
        <ChartPanel
          overline="DAILY SALES · SALA DAENG"
          title="ยอดขายสาขาศาลาแดง"
          total={`฿${fmt(dailySales.reduce((sum, item) => sum + item.sala, 0))}`}
        >
          <div className="overflow-x-auto overflow-y-hidden">
            <SalesBars
              data={dailySales}
              branch="sala"
              colorClass="sala"
              max={maxDaily}
            />
          </div>
        </ChartPanel>
        <ChartPanel
          overline="DAILY SALES · MIN BURI"
          title="ยอดขายสาขามีนบุรี"
          total={`฿${fmt(dailySales.reduce((sum, item) => sum + item.minburi, 0))}`}
          totalTone="accent"
        >
          <div className="overflow-x-auto overflow-y-hidden">
            <SalesBars
              data={dailySales}
              branch="minburi"
              colorClass="minburi"
              max={maxDaily}
            />
          </div>
        </ChartPanel>
      </section>
      <ChartPanel
        overline="COST MIX"
        title="สัดส่วนต้นทุนแยกสาขาและรวมทั้งร้าน"
      >
        <div className="mt-6 grid grid-cols-3 gap-6 max-lg:grid-cols-1">
          {branchCostCharts.map((chart) => (
            <CostDonut key={chart.label} {...chart} />
          ))}
          <CostDonut label="รวมทั้งร้าน" total={totalCost} parts={costParts} />
        </div>
      </ChartPanel>
      <div className="grid grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)] items-stretch gap-6 max-lg:grid-cols-1">
        <DataTable
          title="สถานะสาขาวันนี้"
          className="m-0"
          columns={branchColumns}
          rows={branchRows}
          rowKeys={branches}
        />
        <Panel className="shadow-xs">
          <div className="mb-3.5 flex items-center gap-2">
            <Warehouse size={18} />
            <h2 className="m-0 text-text-primary">สต๊อกสำคัญ</h2>
          </div>
          {branches.map((branchName) => (
            <div
              className="grid gap-1 border-t border-border py-4 text-body-sm text-text-secondary"
              key={branchName}
            >
              <strong className="text-body text-text-primary">
                {branchName}
              </strong>
              <span>
                เนื้อแช่แข็ง{" "}
                {fmt(
                  db.lots.reduce(
                    (total, lot) =>
                      total + balance(db, lot.id, branchName).frozen,
                    0,
                  ),
                )}{" "}
                กก.
              </span>
              <span>
                {branchName === "มีนบุรี" ? "ข้าวสุก" : "ข้าวดิบ"}{" "}
                {fmt(
                  branchName === "มีนบุรี"
                    ? cookedRiceStock(db, branchName)
                    : rawRiceStock(db, branchName),
                )}{" "}
                กก.
              </span>
              <span>น้ำพริก {fmt(chiliStock(db, branchName))} หลอด</span>
            </div>
          ))}
          <div className="mt-1 grid gap-1 rounded-lg bg-bg p-4 text-body-sm text-text-secondary">
            <strong className="text-body text-text-primary">คลังกลาง</strong>
            <span>
              เนื้อพร้อมจัดสรร{" "}
              {fmt(
                db.lots.reduce(
                  (total, lot) => total + Math.max(0, centralStock(db, lot.id)),
                  0,
                ),
              )}{" "}
              กก.
            </span>
            <span>Lot ที่กำลังดำเนินการ {activeLots}</span>
          </div>
        </Panel>
      </div>
      <DataTable
        title="สถานะ Lot และการผลิต"
        columns={lotColumns}
        rowKeys={db.lots.map((lot) => lot.id)}
        rows={db.lots.map((lot) => [
          lot.id,
          stages[lot.stage],
          `${fmt(produced(db, lot.id))} กก.`,
          `${fmt(centralStock(db, lot.id))} กก.`,
          `${fmt(balance(db, lot.id, "ศาลาแดง").frozen)} กก.`,
          `${fmt(balance(db, lot.id, "มีนบุรี").frozen)} กก.`,
        ])}
      />
      <p className="mx-1 -mt-2.5 text-body-sm text-text-secondary">
        ส่วนต่างนี้อิงเฉพาะข้อมูลที่บันทึกในระบบ ยังไม่รวมภาษี แรงงาน
        และค่าเสื่อม
      </p>
    </div>
  );
}

import { Panel } from "@/components/atoms/Panel";
import { Stat } from "@/components/atoms/Stat";
import { lotLabel } from "@/components/organisms/shared/noteText";
import { TodoBox } from "@/components/organisms/workspace/TodoBox";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { baht, fmt, qty } from "@/lib/format";
import { boxCost, giftBoxes, monthPl, n } from "@/lib/store";
import { cn } from "@/lib/utils";
import { cardGrid, figureGrid } from "./FinancePage";
import { monthName, PlTable } from "./PlTable";

const hint = "mt-1 block text-caption font-normal text-text-secondary";

/** The Owner's home: this month's sales and operating profit, what a box costs, the boxes
 *  given away (never part of the P&L, V2-CAL-14), the P&L and everything not jotted yet. */
export function OverviewPage({ ws }: { ws: Workspace }) {
  const { db, account, today } = ws;
  // The Account Manager has no Overview (V2-ACC-01); the workspace never sends it here.
  if (account.hidesSales) return null;
  const month = today.slice(0, 7);
  const pl = monthPl(db, month);
  const cost = boxCost(db);
  const gifts = giftBoxes(db, month);
  return (
    <div className="flex flex-col gap-4">
      <Panel className={figureGrid} aria-label="ตัวเลขของเดือน">
        <Stat
          label={`ยอดขาย ${monthName(month)}`}
          value={<span className="text-success">{baht(pl.sales)}</span>}
        />
        <Stat
          label="กำไรจากการดำเนินงาน"
          value={
            <span className={pl.profit < 0 ? "text-danger" : "text-success"}>
              {baht(pl.profit)}
            </span>
          }
        />
        <Stat
          label="ต้นทุนต่อกล่อง"
          value={
            <>
              {cost ? `฿${fmt(cost.total)}` : "—"}
              <small className={hint}>
                {cost
                  ? `เนื้อ ฿${fmt(cost.meat)} + แพ็กเกจ ${baht(cost.pack)} · ขาย ${baht(n(db.config, "boxPrice"))} · จาก ${lotLabel(db, cost.lotId)}`
                  : "ยังไม่มี Lot ที่จดครบ"}
              </small>
            </>
          }
        />
        <Stat
          label="กล่องแจกเดือนนี้"
          value={
            <>
              {qty(gifts.boxes)} กล่อง
              <small className={hint}>
                {gifts.value !== null &&
                  `มูลค่าต้นทุนประมาณ ${baht(gifts.value)} · `}
                ไม่บวกเข้า P&L
              </small>
            </>
          }
        />
      </Panel>
      {/* A wide screen: the P&L keeps its figures near their labels, the to-do list gets the rest. */}
      <div
        className={cn(cardGrid, "2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]")}
      >
        <PlTable db={db} month={month} full />
        <TodoBox ws={ws} />
      </div>
    </div>
  );
}

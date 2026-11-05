import type { ReactNode } from "react";
import { Stat } from "@/components/atoms/Stat";
import { baht } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Money with its sign and tone: green and "+" in, red and "−" out, a plain zero. */
export const signedBaht = (x: number) =>
  Math.round(x) > 0 ? (
    <span className="text-success">+{baht(x)}</span>
  ) : Math.round(x) < 0 ? (
    <span className="text-danger">{baht(x)}</span>
  ) : (
    baht(0)
  );
/** Money out, red and with its minus; nothing out is a plain zero. */
const outBaht = (x: number) =>
  Math.round(x) ? <span className="text-danger">{baht(-x)}</span> : baht(0);
/** A figure still open: amber while there is any. */
const openBaht = (x: number) => (
  <span className={cn(Math.round(x) > 0 && "text-warning")}>{baht(x)}</span>
);

type Figure = { amount: number; note: ReactNode };

/** The money cards of Accounting and Finance, worded the same on both: what was left before
 *  the period (ยอดยกมา), what came in and went out in it, and what is left of the three
 *  (เงินคงเหลือ = ยอดยกมา + เงินเข้า − เงินออก); then what is still to come in and to pay,
 *  as of today. Each page works out its own figures and notes. The groups are sections,
 *  not divs: a test finds a figure as the div holding its label. */
export function MoneySummary({
  period,
  carried,
  received,
  paid,
  toReceive,
  toPay,
}: {
  /** The period the first four cards count, as a name: "พ.ย. 2569". */
  period: string;
  carried: number;
  received: Figure;
  paid: Figure;
  /** `value` replaces the figure when it is not known (ยังไม่ได้จด). */
  toReceive: Figure & { value?: ReactNode };
  toPay: Figure;
}) {
  const head = "m-0 mb-3 text-label text-text-secondary";
  const left = carried + received.amount - paid.amount;
  return (
    <section className="grid gap-5 xl:grid-cols-[2fr_1fr]">
      <section aria-label="สรุปเงินของช่วงนี้">
        <h3 className={head}>{period}</h3>
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <Stat
            label="ยอดยกมา"
            value={signedBaht(carried)}
            note={`เงินคงเหลือรวมทุกเดือนก่อน ${period}`}
          />
          <Stat
            label="เงินเข้า"
            value={signedBaht(received.amount)}
            note={received.note}
          />
          <Stat label="เงินออก" value={outBaht(paid.amount)} note={paid.note} />
          <Stat
            label="เงินคงเหลือ"
            value={signedBaht(left)}
            note="ยอดยกมา + เงินเข้า − เงินออก"
          />
        </section>
      </section>
      <section aria-label="ยอดที่ยังค้าง">
        <h3 className={head}>ยังค้างอยู่ ณ วันนี้</h3>
        <section className="grid grid-cols-2 gap-3 md:gap-4">
          <Stat
            label="ยังไม่ได้รับ"
            value={toReceive.value ?? openBaht(toReceive.amount)}
            note={toReceive.note}
          />
          <Stat
            label="ยังไม่ได้จ่าย"
            value={openBaht(toPay.amount)}
            note={toPay.note}
          />
        </section>
      </section>
    </section>
  );
}

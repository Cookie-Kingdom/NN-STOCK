export const fmt = (x: number) =>
  new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    // Float residue like -0.0000001 rounds to zero; never print it as "-0.00".
    signDisplay: "negative",
  }).format(x);

/** A quantity as the v2 pages print it: two decimals at most, no trailing zeros ("104", "17.9"). */
export const qty = (x: number) =>
  x.toLocaleString("th-TH", { maximumFractionDigits: 2 });

/** Whole baht: "฿24,000", "−฿150". */
export const baht = (x: number) =>
  `${x < 0 ? "−" : ""}฿${qty(Math.abs(Math.round(x)))}`;

/** `YYYY-MM-DD` as a Thai date in the given shape; day and short month ("2 ต.ค.") by default. */
export const thaiDay = (
  date: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("th-TH", {
    ...options,
    timeZone: "UTC",
  });

export const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

const thaiDate = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** `YYYY-MM-DD` → Thai short date (e.g. "15 ก.ย. 2569"); anything else is returned as-is, empty → "—". */
export function dateLabel(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return value || "—";
  return thaiDate.format(new Date(`${value}T00:00:00`));
}

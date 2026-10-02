export const fmt = (x: number) =>
  new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    // Float residue like -0.0000001 rounds to zero; never print it as "-0.00".
    signDisplay: "negative",
  }).format(x);

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

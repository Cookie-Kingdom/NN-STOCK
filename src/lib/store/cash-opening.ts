import type { Database } from "./model";

type CashOpeningBalance = {
  id: string;
  date: string;
  amount: string;
  purpose: "company" | "project";
  project: string;
  note?: string;
};

/** One opening per company/project; existing cash is never revenue. */
export function cashOpeningBalances(value: string): CashOpeningBalance[] {
  const invalid = (): never => {
    throw new Error("ยอดเงินยกมา: อ่านรายการไม่ได้");
  };
  let rows: unknown;
  try {
    rows = JSON.parse(value);
  } catch {
    return invalid();
  }
  if (!Array.isArray(rows)) return invalid();
  const ids = new Set<string>();
  const scopes = new Set<string>();
  for (const row of rows) {
    if (
      !row ||
      typeof row.id !== "string" ||
      !row.id.trim() ||
      ids.has(row.id) ||
      typeof row.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
      row.date < "2020-01-01" ||
      !Number.isFinite(Date.parse(row.date)) ||
      new Date(`${row.date}T00:00:00Z`).toISOString().slice(0, 10) !==
        row.date ||
      typeof row.amount !== "string" ||
      !/^\d+(?:\.\d{1,2})?$/.test(row.amount) ||
      !Number.isSafeInteger(Math.round(Number(row.amount) * 100)) ||
      !["company", "project"].includes(row.purpose) ||
      typeof row.project !== "string" ||
      (row.purpose === "project" ? !row.project.trim() : row.project !== "") ||
      (row.note !== undefined && typeof row.note !== "string")
    )
      return invalid();
    const scope = JSON.stringify([row.purpose, row.project]);
    if (scopes.has(scope)) return invalid();
    ids.add(row.id);
    scopes.add(scope);
  }
  return rows as CashOpeningBalance[];
}

/** Effective on its date; Accounting reads all scopes, Finance its project alone. */
export function cashOpening(
  db: Pick<Database, "config">,
  through: string,
  project?: string,
) {
  let rows: CashOpeningBalance[];
  try {
    rows = cashOpeningBalances(db.config.cashOpeningBalances ?? "[]");
  } catch {
    return 0;
  }
  return rows
    .filter(
      (row) =>
        row.date <= through &&
        (project === undefined ||
          (row.purpose === "project" && row.project === project)),
    )
    .reduce((total, row) => total + Number(row.amount), 0);
}

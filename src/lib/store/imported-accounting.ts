import type { Values } from "./model";

const keys = [
  "sourceLabel",
  "itemType",
  "sku",
  "purposeLabel",
  "statusLabel",
] as const;
type ImportedAccounting = Partial<Record<(typeof keys)[number], string>>;

/** Display-only source cells; native fields continue to determine cash, status and scope. */
export function importedAccounting(value: string): ImportedAccounting {
  const parsed: unknown = JSON.parse(value);
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    Object.entries(parsed).some(
      ([key, cell]) =>
        !keys.includes(key as (typeof keys)[number]) ||
        typeof cell !== "string" ||
        cell.length > 1000,
    )
  )
    throw new Error("ข้อมูล Accounting ต้นฉบับอ่านไม่ได้");
  return parsed as ImportedAccounting;
}

/** A manual edit replaces only the source display cells affected by that edit. */
export function retainedAccounting(
  input: Values,
  kept: Values,
  saved: Values,
): string | undefined {
  const value = input.importedAccounting ?? kept.importedAccounting;
  if (!value) return undefined;
  const original = importedAccounting(value);
  if (value === kept.importedAccounting) {
    const changed = (...fields: string[]) =>
      fields.some((key) => (saved[key] ?? "") !== (kept[key] ?? ""));
    if (changed("source")) delete original.sourceLabel;
    if (changed("itemType", "incomeType")) delete original.itemType;
    if (changed("item", "sku")) delete original.sku;
    if (changed("purpose", "project")) delete original.purposeLabel;
    if (changed("status")) delete original.statusLabel;
  }
  return Object.keys(original).length ? JSON.stringify(original) : undefined;
}

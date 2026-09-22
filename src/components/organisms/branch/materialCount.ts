import {
  entries,
  materials,
  n,
  type Database,
  type Entry,
  type Values,
} from "@/lib/store";

/** The day's count as it was last saved, or `undefined` when nothing is recorded yet.
 *  Every save appends its own entry, so the newest one is the figures that stand. */
export function savedMaterialCount(
  db: Database,
  branch: string,
  date: string,
): Entry | undefined {
  return entries(db, "materials", undefined, branch, date).at(-1);
}

/**
 * The edit draft for one day's count, seeded from what the server holds. Called again
 * whenever a save returns, so the boxes never keep figures the server has since
 * rebased (a revision conflict rebuilds the save on the reloaded database).
 *
 * `actual` is left empty when nothing is saved: an empty box follows ยอดที่ควรเหลือ as
 * ใช้วันนี้ is typed, and clearing it hands the count back to the system's figure.
 */
export function materialCountDraft(saved?: Entry): Values {
  return {
    correctionReason: "",
    ...Object.fromEntries(
      materials.flatMap((_, i) => [
        ["used" + i, saved ? String(n(saved.values, "used" + i)) : "0"],
        ["actual" + i, saved ? String(n(saved.values, "material" + i)) : ""],
        ["materialReason" + i, saved?.values["materialReason" + i] || ""],
      ]),
    ),
  };
}

/**
 * The row's half of the store's `จำนวนใช้ … เกินยอดตั้งต้น` refusal, so the reason a
 * save is blocked sits on the box being typed in and not only in the summary above
 * the table. Empty while the figure is fine.
 */
export function materialOverStock(opening: number, used: number): string {
  if (used <= opening) return "";
  return `ใช้เกินยอดตั้งต้น · กรอกได้สูงสุด ${Math.max(0, Math.floor(opening))}`;
}

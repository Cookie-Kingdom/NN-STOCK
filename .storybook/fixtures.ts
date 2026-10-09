// Databases for organism stories, built by the real `mutate` so every derived number
// (stock, cost, yield) is what the app would show.
import { accountById } from "@/lib/accounts";
import {
  legacySale,
  materialList,
  mutate,
  seed,
  type Actor,
  type Database,
  type NoteKind,
  type Values,
} from "@/lib/store";
import { sampleData } from "@/lib/store/demo";

/** The day the stories stand on: "today" for every figure that takes one. */
export const day = "2026-09-09";

/** The approved sample: three Lots, two POs, 35 days of both branches. */
export const demoDb: Database = sampleData(day);

/** The sample plus two sales brought in from the shop's old books, both on `on`: one with
 *  no branch, one of ศาลาแดง, their money already after GP (`legacySale`). Nobody jots such a
 *  sale, so `mutate` makes none: the two entries are laid in by hand, as the import does. */
export function legacyDb(on = day): Database {
  const sample = sampleData(on);
  return {
    ...sample,
    entries: [
      ...sample.entries,
      ...["", "ศาลาแดง"].map((branch, i) => ({
        id: `legacy-sale-${i}`,
        at: `${on}T15:0${i}:00.000Z`,
        kind: "sale" as const,
        role: "branch" as const,
        lotId: "",
        branch,
        date: on,
        values: {
          boxes: branch ? "" : "120",
          [legacySale.key]: branch ? "180000" : "46640",
          note: "นำเข้าจากไฟล์เดิม · ยอดหลัง GP แล้ว",
          ...(branch && { missing: "boxes" }),
        },
      })),
    ],
  };
}

/** A new system: the settings, and nothing jotted yet. */
export const emptyDb: Database = structuredClone(seed);

/** Daily sheets on a new system: both branches set the opening of both sheets two days
 *  before `on` and saved the sheets of the day before; nothing is saved on `on` yet.
 *  ศาลาแดง: 10 กก. of meat received on `on` (เข้าเอง), a meat waste and a material waste with
 *  their reasons. มีนบุรี: a chili waste with no reason and no reporter (ยังไม่ได้จด). */
export function sheetsDb(on = day): Database {
  const back = (days: number) =>
    new Date(Date.parse(on) - days * 86400000).toISOString().slice(0, 10);
  const saladaeng = accountById("saladaeng")!;
  const minburi = accountById("minburi")!;
  const [first, second] = materialList(seed);
  const notes: [Actor, NoteKind, Values, string][] = [
    [
      saladaeng,
      "opening",
      { sheet: "meat", "qty.meat": "24", "qty.rice": "30", "qty.chili": "120" },
      back(2),
    ],
    [
      saladaeng,
      "opening",
      {
        sheet: "materials",
        [`qty.${first.id}`]: "500",
        [`qty.${second.id}`]: "300",
      },
      back(2),
    ],
    [
      minburi,
      "opening",
      { sheet: "meat", "qty.meat": "40", "qty.chili": "60" },
      back(2),
    ],
    [
      minburi,
      "opening",
      { sheet: "materials", [`qty.${first.id}`]: "380" },
      back(2),
    ],
    [
      saladaeng,
      "daily",
      {
        sheet: "meat",
        "used.meat": "3.3",
        "waste.meat": "0.3",
        "reason.meat": "เนื้อตกพื้น",
        "used.rice": "2",
        "used.chili": "4",
        reporter: "น้องฝน",
      },
      back(1),
    ],
    [
      saladaeng,
      "daily",
      {
        sheet: "materials",
        [`used.${first.id}`]: "28",
        [`used.${second.id}`]: "32",
        [`waste.${second.id}`]: "4",
        [`reason.${second.id}`]: "ซองชำรุด",
        reporter: "น้องฝน",
      },
      back(1),
    ],
    [
      minburi,
      "daily",
      {
        sheet: "meat",
        "used.meat": "2.4",
        "used.chili": "6",
        "waste.chili": "2",
      },
      back(1),
    ],
    [
      minburi,
      "daily",
      { sheet: "materials", [`used.${first.id}`]: "20", reporter: "พี่เอ" },
      back(1),
    ],
    [saladaeng, "receive", { kg: "10" }, on],
  ];
  return notes.reduce(
    (db, [by, kind, values, date]) => mutate(db, by, kind, values, "", date),
    emptyDb,
  );
}
/** The name the Owner's stock stories still import: rename there, then drop this. */
export const countedDb = sheetsDb;

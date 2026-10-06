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

/** Counts against what the web expected, on a new system: stock came in two days before
 *  `on`, was counted the day before and again on `on` (a variance needs a count before it).
 *  ศาลาแดง: meat −2 กก., chili −2 หลอด, the first material 0, the second −3 ชิ้น, the third
 *  counted once (no variance), the rest never counted. มีนบุรี: meat counted once
 *  (「นับครั้งแรก」), chili 0, no material ever counted. */
export function countedDb(on = day): Database {
  const back = (days: number) =>
    new Date(Date.parse(on) - days * 86400000).toISOString().slice(0, 10);
  const owner = accountById("owner")!;
  const saladaeng = accountById("saladaeng")!;
  const minburi = accountById("minburi")!;
  const [first, second, third] = materialList(seed.config);
  const bought = (
    item: string,
    qty: string,
    branch = "ศาลาแดง",
  ): [Actor, NoteKind, Values, string] => [
    owner,
    "pay",
    {
      category: item === "chili" ? "ingredient" : "packaging",
      amount: "1",
      item,
      qty,
      branch,
    },
    back(2),
  ];
  const notes: [Actor, NoteKind, Values, string][] = [
    [saladaeng, "receive", { kg: "10" }, back(2)],
    [minburi, "receive", { kg: "6" }, back(2)],
    bought("chili", "50"),
    bought("chili", "20", "มีนบุรี"),
    bought(first.id, "100"),
    bought(second.id, "50"),
    // The first counts.
    [saladaeng, "meatCount", { kg: "10" }, back(1)],
    [saladaeng, "sale", { boxes: "0", chiliCount: "50" }, back(1)],
    [minburi, "sale", { boxes: "0", chiliCount: "20" }, back(1)],
    [
      saladaeng,
      "materials",
      { [`count.${first.id}`]: "100", [`count.${second.id}`]: "50" },
      back(1),
    ],
    // The second, and the first of มีนบุรี's meat and of the third material.
    [saladaeng, "meatCount", { kg: "8" }, on],
    [minburi, "meatCount", { kg: "6" }, on],
    [saladaeng, "sale", { boxes: "0", chiliAddons: "3", chiliCount: "45" }, on],
    [minburi, "sale", { boxes: "0", chiliCount: "20" }, on],
    [
      saladaeng,
      "materials",
      {
        [`count.${first.id}`]: "100",
        [`count.${second.id}`]: "47",
        [`count.${third.id}`]: "30",
      },
      on,
    ],
  ];
  return notes.reduce(
    (db, [by, kind, values, date]) => mutate(db, by, kind, values, "", date),
    emptyDb,
  );
}

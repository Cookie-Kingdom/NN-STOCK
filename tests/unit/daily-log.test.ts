import { expect, it } from "vitest";
import { scopeDatabase } from "@/lib/role-scope";
import {
  logRows,
  mutate,
  seed,
  type Actor,
  type Database,
  type NoteKind,
  type Values,
} from "@/lib/store";

// The rows of the Daily Log (`logRows`): one per entry, by when it was saved.
const owner: Actor = { role: "owner" };
const saladaeng: Actor = { role: "branch", branch: "ศาลาแดง" };
const minburi: Actor = { role: "branch", branch: "มีนบุรี" };
/** Saves one entry dated `date`, as if at `time` (Bangkok) of 2026-09-09. */
function save(
  db: Database,
  by: Actor,
  kind: NoteKind | "entryEdit" | "void",
  values: Values,
  date: string,
  time: string,
) {
  const next = mutate(db, by, kind, values, "", date);
  next.entries.at(-1)!.at = new Date(
    `2026-09-09T${time}:00+07:00`,
  ).toISOString();
  return next;
}
const pay = { category: "other", amount: "100" };
// A payment jotted for today, then one jotted later for five days ago; a branch's sale;
// then the first payment edited and the second deleted.
let db = save(seed, owner, "pay", pay, "2026-09-09", "08:00");
const today = db.entries.at(-1)!.id;
db = save(db, owner, "pay", { ...pay, amount: "250" }, "2026-09-04", "09:00");
const backdated = db.entries.at(-1)!.id;
db = save(db, saladaeng, "sale", { boxes: "5" }, "2026-09-09", "10:00");
db = save(db, minburi, "sale", { boxes: "7" }, "2026-09-09", "10:30");
db = save(
  db,
  owner,
  "entryEdit",
  { targetId: today, values: JSON.stringify({ amount: "180" }) },
  "2026-09-09",
  "11:00",
);
db = save(db, owner, "void", { targetId: backdated }, "2026-09-09", "12:00");

it("orders by when a row was saved, not by the day its note is about", () => {
  const rows = logRows(db, owner);
  expect(rows.map((row) => row.entry.at)).toEqual(
    rows
      .map((row) => row.entry.at)
      .sort()
      .reverse(),
  );
  // The backdated payment was saved after today's, so it stands above it.
  const jots = rows.filter((row) => row.action === "jot");
  expect(jots.map((row) => row.note.date)).toEqual([
    "2026-09-09",
    "2026-09-09",
    "2026-09-04",
    "2026-09-09",
  ]);
  expect(jots[2].entry.id).toBe(backdated);
  expect(jots[2].day).toBe("2026-09-09");
});

it("gives an edit and a delete each a row about its note", () => {
  const [removal, edit] = logRows(db, owner);
  expect(removal).toMatchObject({ action: "void", label: "ลบ", later: "" });
  expect(removal.note).toMatchObject({ id: backdated, date: "2026-09-04" });
  expect(removal.note.values.amount).toBe("250");
  expect(edit).toMatchObject({ action: "edit", label: "แก้ไข" });
  expect(edit.note.id).toBe(today);
  // The edit's row reads the note after it, the jot's row as it was jotted.
  expect(edit.note.values.amount).toBe("180");
  const jots = logRows(db, owner).filter((row) => row.action === "jot");
  expect(jots.find((row) => row.entry.id === today)).toMatchObject({
    later: "edited",
    note: { values: { amount: "100" } },
  });
  expect(jots.find((row) => row.entry.id === backdated)?.later).toBe("deleted");
});

it("names an undo, and marks the change it undid", () => {
  const undone = save(
    db,
    owner,
    "void",
    { targetId: db.entries.at(-1)!.id },
    "2026-09-09",
    "13:00",
  );
  const [undo, removal] = logRows(undone, owner);
  expect(undo).toMatchObject({ action: "undo", label: "กู้คืนรายการ" });
  expect(undo.note.id).toBe(backdated);
  expect(removal.later).toBe("undone");
});

it("keeps a change in the group of its note", () => {
  expect(logRows(db, owner, "money").map((row) => row.action)).toEqual([
    "void",
    "edit",
    "jot",
    "jot",
  ]);
  expect(logRows(db, owner, "branch").map((row) => row.note.kind)).toEqual([
    "sale",
    "sale",
  ]);
  expect(logRows(db, owner, "lot")).toEqual([]);
});

it("shows a branch its own rows only", () => {
  for (const log of [db, scopeDatabase(db, ["ศาลาแดง"])]) {
    const rows = logRows(log, saladaeng);
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toMatchObject({ kind: "sale", branch: "ศาลาแดง" });
  }
});

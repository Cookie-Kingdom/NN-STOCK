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
  lotId = "",
) {
  const next = mutate(db, by, kind, values, lotId, date);
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

it("files every note under one group: an expense under money, a transfer under the branches", () => {
  let ledger = save(db, owner, "expense", {}, "2026-09-09", "14:00");
  const expense = ledger.entries.at(-1)!.id;
  ledger = save(ledger, owner, "transfer", {}, "2026-09-09", "15:00");
  ledger = save(
    ledger,
    owner,
    "void",
    { targetId: expense },
    "2026-09-09",
    "16:00",
  );
  const kinds = (group: "lot" | "money" | "branch") =>
    logRows(ledger, owner, group).map((row) => row.note.kind);
  // The expense's delete follows it.
  expect(kinds("money").slice(0, 2)).toEqual(["expense", "expense"]);
  expect(kinds("branch")[0]).toBe("transfer");
  expect(kinds("lot")).toEqual([]);
  expect(kinds("money").length + kinds("branch").length).toBe(
    logRows(ledger, owner).length,
  );
});

/** The rows about the note `id`, oldest first. */
const story = (log: Database, id: string) =>
  logRows(log, owner)
    .filter((row) => row.note.id === id)
    .reverse();
/** Deletes the last entry of `log`: a note, or (an undo) a change. */
const voidLast = (log: Database, time: string) =>
  save(
    log,
    owner,
    "void",
    { targetId: log.entries.at(-1)!.id },
    "2026-09-09",
    time,
  );
const editOf = (
  log: Database,
  id: string,
  values: Values,
  time: string,
  move: Values = {},
) =>
  save(
    log,
    owner,
    "entryEdit",
    { targetId: id, values: JSON.stringify(values), ...move },
    "2026-09-09",
    time,
  );

it("reads a note as it was after each of a chain of changes", () => {
  let log = save(seed, owner, "pay", pay, "2026-09-09", "08:00");
  const id = log.entries.at(-1)!.id;
  log = editOf(log, id, { amount: "150" }, "09:00");
  log = editOf(log, id, { amount: "200" }, "10:00");
  log = voidLast(log, "11:00"); // undoes the second edit
  log = save(log, owner, "void", { targetId: id }, "2026-09-09", "12:00");
  log = voidLast(log, "13:00"); // puts the note back
  const rows = story(log, id);
  expect(
    rows.map((row) => [
      row.action,
      row.label,
      row.later,
      row.note.values.amount,
    ]),
  ).toEqual([
    // The first edit still stands.
    ["jot", "จด", "edited", "100"],
    ["edit", "แก้ไข", "", "150"],
    ["edit", "แก้ไข", "undone", "200"],
    ["undo", "ย้อนกลับการแก้ไข", "", "150"],
    ["void", "ลบ", "undone", "150"],
    ["undo", "กู้คืนรายการ", "", "150"],
  ]);
  for (const row of rows)
    expect(row.note).toMatchObject({ kind: "pay", date: "2026-09-09" });
});

it("follows an edit that moves the note's date, and its undo", () => {
  let log = save(seed, owner, "pay", pay, "2026-09-09", "08:00");
  const id = log.entries.at(-1)!.id;
  log = editOf(log, id, { amount: "120" }, "09:00", { toDate: "2026-09-01" });
  log = voidLast(log, "10:00");
  expect(
    story(log, id).map((row) => [
      row.action,
      row.later,
      row.note.date,
      row.note.values.amount,
    ]),
  ).toEqual([
    ["jot", "", "2026-09-09", "100"],
    ["edit", "undone", "2026-09-01", "120"],
    ["undo", "", "2026-09-09", "100"],
  ]);
});

it("follows an edit that moves the note's lot, and its undo", () => {
  let log = save(seed, owner, "smokeOrder", {}, "2026-09-09", "07:00");
  const first = log.entries.at(-1)!.lotId;
  log = save(log, owner, "smokeOrder", {}, "2026-09-09", "07:30");
  const second = log.entries.at(-1)!.lotId;
  expect(second).not.toBe(first);
  log = save(log, owner, "packingList", {}, "2026-09-09", "08:00", first);
  const id = log.entries.at(-1)!.id;
  log = editOf(log, id, {}, "09:00", { toLotId: second });
  log = voidLast(log, "10:00");
  expect(
    story(log, id).map((row) => [row.action, row.later, row.note.lotId]),
  ).toEqual([
    ["jot", "", first],
    ["edit", "undone", second],
    ["undo", "", first],
  ]);
  // A Lot's extra note and its changes are Lot rows.
  expect(
    logRows(log, owner, "lot").filter((row) => row.note.id === id),
  ).toHaveLength(3);
});

it("reads a deleted note as its edits left it", () => {
  let log = save(seed, owner, "pay", pay, "2026-09-09", "08:00");
  const id = log.entries.at(-1)!.id;
  log = editOf(log, id, { amount: "120" }, "09:00", { toDate: "2026-09-01" });
  log = save(log, owner, "void", { targetId: id }, "2026-09-09", "10:00");
  const [jot, edit, removal] = story(log, id);
  expect(jot).toMatchObject({
    action: "jot",
    label: "จด",
    later: "deleted",
    note: { date: "2026-09-09", values: { amount: "100" } },
  });
  expect(edit).toMatchObject({ action: "edit", label: "แก้ไข", later: "" });
  expect(removal).toMatchObject({
    action: "void",
    label: "ลบ",
    later: "",
    note: { date: "2026-09-01", lotId: "", values: { amount: "120" } },
  });
});

it("shows a branch its own rows only", () => {
  for (const log of [db, scopeDatabase(db, ["ศาลาแดง"])]) {
    const rows = logRows(log, saladaeng);
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toMatchObject({ kind: "sale", branch: "ศาลาแดง" });
  }
});

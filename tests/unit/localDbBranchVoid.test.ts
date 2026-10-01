import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { accountById } from "@/lib/accounts";
import {
  appendState,
  openLocalDb,
  readState,
  replaceState,
} from "@/lib/local-db.server";
import { isVoided, seed, type Entry, type Values } from "@/lib/store";
import { retiredKinds } from "@/lib/store/model";

// Migration 20261001000039 (append_entries), JS port: a branch edits, deletes and restores its
// own live entries directly, on a closed day too; nobody else's, and an undo is not undone.
// The state and the cases are the SQL test's, read from its file so the two cannot drift.
test("a branch edits, deletes and restores only its own live entries", () => {
  const sql = readFileSync(
    "supabase/tests/branch_direct_changes_test.sql",
    "utf8",
  );
  const json = (tag: string) =>
    JSON.parse(
      sql.match(new RegExp(`\\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$`))?.[1] ??
        "null",
    );
  const db = openLocalDb(":memory:");
  replaceState(db, { ...seed, ...json("state") });
  const minburi = accountById("minburi");
  const cases: [string, string, Values, string][] = json("cases");
  expect(cases.length).toBeGreaterThan(30);
  for (const [id, kind, values, error] of cases) {
    const append = () =>
      appendState(
        db,
        minburi,
        [
          {
            id,
            kind,
            role: "branch",
            lotId: "",
            branch: "มีนบุรี",
            date: "2026-09-10",
            values,
          },
        ],
        [],
        readState(db).revision,
      );
    const label = `${kind} ${JSON.stringify(values)}`;
    if (error) expect(append, label).toThrow(error);
    else expect(append, label).not.toThrow();
  }
  // r1 by its second delete, not by the restored first one (entry_voided in the SQL test).
  const log = readState(db).payload;
  expect(
    log.entries.filter((e) => isVoided(log, e.id)).map((e) => e.id),
  ).toEqual(["r1", "r0", "m0", "ed2", "lk1", "dl1", "em2"]);
});

// Migration 20260929000036: a material transfer is confirmed once, directly or through a link.
test("a branch cannot confirm a transfer twice", () => {
  const db = openLocalDb(":memory:");
  const e = (id: string, kind: string, values: Record<string, string> = {}) =>
    ({
      id,
      kind,
      role: "branch",
      lotId: "",
      branch: "มีนบุรี",
      date: "2026-09-10",
      values,
    }) as Entry;
  const minburi = accountById("minburi");
  const append = (...entries: Entry[]) =>
    appendState(db, minburi, entries, [], readState(db).revision);
  append(
    e("m1", "materialConfirm", { transferId: "t1" }),
    e("m2", "materialConfirm"),
  );
  expect(() =>
    append(e("m3", "materialConfirm", { transferId: "t1" })),
  ).toThrow("Material transfer is already confirmed");
  expect(() =>
    append(e("l1", "link", { targetId: "m2", transferId: "t1" })),
  ).toThrow("Material transfer is already confirmed");
  append(e("l1", "link", { targetId: "m2", transferId: "t2" }));
  expect(() =>
    append(e("m3", "materialConfirm", { transferId: "t2" })),
  ).toThrow("Material transfer is already confirmed");
  // 0039: the branch deleting its own confirm frees the transfer, in the same save.
  append(
    e("w1", "void", { targetId: "m1" }),
    e("m3", "materialConfirm", { transferId: "t1" }),
  );
});

// Migrations 20260929000036 and 20261001000039 (editRequest): no new entry of a retired kind
// (retiredKinds in store/model.ts).
test("a branch cannot append a retired kind", () => {
  const db = openLocalDb(":memory:");
  const minburi = accountById("minburi");
  for (const kind of retiredKinds)
    expect(() =>
      appendState(
        db,
        minburi,
        [
          {
            id: `x-${kind}`,
            kind,
            role: "branch",
            lotId: "",
            branch: "มีนบุรี",
            date: "2026-09-10",
            values: {},
          } as Entry,
        ],
        [],
        readState(db).revision,
      ),
    ).toThrow("Entry kind is not allowed for this account");
});

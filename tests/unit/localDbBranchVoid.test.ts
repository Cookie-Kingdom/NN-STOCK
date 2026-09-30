import { expect, test } from "vitest";
import { accountById } from "@/lib/accounts";
import {
  appendState,
  openLocalDb,
  readState,
  replaceState,
} from "@/lib/local-db.server";
import { seed, type Entry } from "@/lib/store";
import { retiredKinds } from "@/lib/store/model";

// Migration 20260929000035 (append_entries), JS port: on a closed day a branch still files an
// edit request, withdraws it (a void of its own pending request only) and links; since 0037
// it records anything else on that day too.
test("a closed branch day takes a request, its withdrawal, a link and new entries", () => {
  const db = openLocalDb(":memory:");
  const branch = "มีนบุรี";
  const e = (id: string, kind: string, values: Record<string, string> = {}) =>
    ({
      id,
      kind,
      role: "branch",
      lotId: "",
      branch,
      date: "2026-09-10",
      values,
    }) as Entry;
  replaceState(db, {
    ...seed,
    lots: [
      { id: "S1", poId: "SH-1", kind: "shipment", config: {}, values: {} },
    ],
    entries: [e("r1", "receive", { kg: "3" })],
  } as typeof seed);
  const minburi = accountById("minburi");
  const append = (...entries: Entry[]) =>
    appendState(db, minburi, entries, [], readState(db).revision);
  append(
    e("rq1", "editRequest", { targetId: "r1", "to.kg": "2" }),
    e("cd1", "closeDay", { confirm: "x" }),
  );
  append(e("r2", "receive", { kg: "1" }));
  expect(() => append(e("wd0", "void", { targetId: "r1" }))).toThrow(
    "Void target is not a pending edit request of this branch",
  );
  append(
    e("lk1", "link", { targetId: "r1", lotId: "S1" }),
    e("wd1", "void", { targetId: "rq1" }),
  );
  expect(() => append(e("wd2", "void", { targetId: "rq1" }))).toThrow(
    "Void target is not a pending edit request of this branch",
  );
});

// Migration 20260929000036: the duplicates mutate refuses from a branch.
test("a branch cannot open a second edit request or confirm a transfer twice", () => {
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
    e("r1", "receive", { kg: "3" }),
    e("q1", "editRequest", { targetId: "r1" }),
  );
  expect(() => append(e("q2", "editRequest", { targetId: "r1" }))).toThrow(
    "Entry already has a pending edit request",
  );
  append(
    e("w1", "void", { targetId: "q1" }),
    e("q2", "editRequest", { targetId: "r1" }),
  );
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
});

// Migration 20260929000036: no new entry of a retired kind (retiredKinds in store/model.ts).
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

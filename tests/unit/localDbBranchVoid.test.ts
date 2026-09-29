import { expect, test } from "vitest";
import { accountById } from "@/lib/accounts";
import {
  appendState,
  openLocalDb,
  readState,
  replaceState,
} from "@/lib/local-db.server";
import { seed, type Entry } from "@/lib/store";

// Migration 20260929000035 (append_entries), JS port: on a closed day a branch still files an
// edit request, withdraws it (a void of its own pending request only) and links.
test("a closed branch day takes a request, its withdrawal and a link, nothing else", () => {
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
  expect(() => append(e("r2", "receive", { kg: "1" }))).toThrow(
    "Branch day is closed",
  );
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

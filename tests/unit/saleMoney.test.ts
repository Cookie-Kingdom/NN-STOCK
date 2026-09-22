import { expect, test } from "vitest";
import { accountById } from "@/lib/accounts";
import { openLocalDb, readState, saveState } from "@/lib/local-db.server";
import { restoreSaleMoney, stripSaleMoney } from "@/lib/sale-money";
import { seed, type Database, type Entry } from "@/lib/store";

/* Same scenario as supabase/tests/app_state_sale_money_test.sql, against the local backend. */
const owner = accountById("owner");
const manager = accountById("manager");
const config = {
  ...seed.config,
  boxPrice: "350",
  addonPrice: "320",
  chiliPrice: "30",
};
const entry = (e: Partial<Entry> & Pick<Entry, "id" | "kind" | "role">) =>
  ({
    lotId: "",
    branch: "มีนบุรี",
    date: "2026-09-20",
    at: "",
    values: {},
    ...e,
  }) as Entry;
const sale = entry({
  id: "s1",
  kind: "sale",
  role: "branch",
  values: {
    boxes: "2",
    addons: "0",
    chiliAddons: "0",
    lineMan: "700",
    revenue: "700",
    menuTotal: "700",
    meatCost: "100",
  },
});
const request = entry({
  id: "r1",
  kind: "editRequest",
  role: "branch",
  values: {
    targetId: "s1",
    targetKind: "sale",
    "from.lineMan": "700",
    "to.boxes": "3",
    "to.lineMan": "650",
    "to.revenue": "650",
    "to.menuTotal": "1050",
  },
});
const MONEY = /"(to\.|from\.)?(revenue|lineMan|menuTotal)"/;

function stored() {
  const db = openLocalDb(":memory:");
  const base: Database = { ...seed, config, entries: [sale, request] };
  saveState(db, owner, base, 1);
  return db;
}

test("strips every sale money key, edits included, and keeps costs", () => {
  const stripped = stripSaleMoney({ ...seed, entries: [sale, request] });
  expect(JSON.stringify(stripped)).not.toMatch(MONEY);
  expect(stripped.entries[0].values.meatCost).toBe("100");
  expect(stripped.entries[1].values["to.boxes"]).toBe("3");
});

test("a manager approval from the stripped copy keeps stored money and takes the request's", () => {
  const db = stored();
  const seen = stripSaleMoney(readState(db).payload);
  const approval = entry({
    id: "d1",
    kind: "editDecision",
    role: "owner",
    actor: "manager",
    values: {
      requestId: "r1",
      decision: "อนุมัติ",
      targetId: "s1",
      targetKind: "sale",
      "to.boxes": "3",
      "to.addons": "0",
      "to.chiliAddons": "0",
      "to.lineMan": "1", // made up: dropped
    },
  });
  const sneaky = {
    ...seen.entries[0],
    values: { ...seen.entries[0].values, lineMan: "1" },
  };
  saveState(
    db,
    manager,
    { ...seen, entries: [sneaky, seen.entries[1], approval] },
    2,
  );
  const { entries } = readState(db).payload;
  expect(entries[0]).toEqual(sale);
  expect(entries[1]).toEqual(request);
  expect(entries[2].values).toMatchObject({
    "from.lineMan": "700",
    "to.lineMan": "650",
    "to.revenue": "650",
    "to.menuTotal": "1050",
  });
});

test("a manager direct edit keeps the current money and works out menuTotal again", () => {
  const db = stored();
  const seen = stripSaleMoney(readState(db).payload);
  const edit = entry({
    id: "x1",
    kind: "entryEdit",
    role: "owner",
    actor: "manager",
    values: {
      targetId: "s1",
      targetKind: "sale",
      "to.boxes": "1",
      "to.addons": "1",
      "to.chiliAddons": "0",
    },
  });
  saveState(db, manager, { ...seen, entries: [...seen.entries, edit] }, 2);
  const { entries } = readState(db).payload;
  expect(entries[0]).toEqual(sale);
  expect(entries[2].values).toMatchObject({
    "from.lineMan": "700",
    "to.lineMan": "700",
    "to.menuTotal": "670",
  });
});

test("any other change to stored history is still refused", () => {
  const db = stored();
  const seen = stripSaleMoney(readState(db).payload);
  const changed = {
    ...seen.entries[0],
    values: { ...seen.entries[0].values, boxes: "9" },
  };
  expect(() =>
    saveState(db, manager, { ...seen, entries: [changed, seen.entries[1]] }, 2),
  ).toThrow("Existing history cannot be changed");
  expect(readState(db).payload.entries[0]).toEqual(sale);
});

test("restore leaves a shortened log for the append-only check", () => {
  const old = { ...seed, entries: [sale, request] };
  const shorter = { ...seed, entries: [sale] };
  expect(restoreSaleMoney(old, shorter)).toBe(shorter);
});

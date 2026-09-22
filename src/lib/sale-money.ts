import { isDeepStrictEqual } from "node:util";
import {
  editDecisions,
  n,
  saleMoneyKeys,
  type Database,
  type Entry,
  type Values,
} from "./store";

/* Server side only (local SQLite backend): the Account Manager never receives a sale's money in
 * (C4), and a save from its stripped copy must not erase that money for everyone else.
 * JS port of strip_sale_money / restore_sale_money in
 * supabase/migrations/20260922000021_account_manager_hides_sales.sql.
 * ponytail: duplicated rules, keep in step with that migration when it changes. */

const isMoneyKey = (key: string) =>
  saleMoneyKeys.includes(key.replace(/^(to|from)\./, ""));

export const stripSaleMoneyValues = (values: Values): Values =>
  Object.fromEntries(
    Object.entries(values).filter(([key]) => !isMoneyKey(key)),
  );

const stripEntry = (entry: Entry): Entry =>
  entry?.values && typeof entry.values === "object"
    ? { ...entry, values: stripSaleMoneyValues(entry.values) }
    : entry;

/** The payload the Account Manager's browser receives: every entry without its sale money. */
export const stripSaleMoney = (db: Database): Database => ({
  ...db,
  entries: db.entries.map(stripEntry),
});

/** `targetId`'s sale money as it stands in `log`: its own values with approved edits overlaid,
 *  like entries() in store.ts. */
function currentMoney(log: Entry[], targetId: string): Values {
  const target = log.find((e) => e.id === targetId);
  if (!target) return {};
  const voided = new Set(
    log
      .filter((e) => e.kind === "void" && e.role === "owner")
      .map((e) => e.values?.targetId),
  );
  const money: Values = {};
  for (const key of saleMoneyKeys)
    if (target.values[key] !== undefined) money[key] = target.values[key];
  for (const e of log)
    if (
      e.role === "owner" &&
      !voided.has(e.id) &&
      e.values?.targetId === targetId &&
      (e.kind === "entryEdit" ||
        (e.kind === "editDecision" &&
          e.values.decision === editDecisions.approve))
    )
      for (const key of saleMoneyKeys)
        if (e.values["to." + key] !== undefined)
          money[key] = e.values["to." + key];
  return money;
}

/** Puts back what a save from the Account Manager's stripped copy left out.
 *  - Stored history: an entry that matches the stored one once both are stripped is replaced by
 *    the stored one; any other difference is left for the append-only check to refuse.
 *  - New entries: any sale money the client sent is dropped. A direct edit or an approved
 *    request gets its `from.`/`to.` money from the server's copy (the target's current money,
 *    the request's proposed money), and a sale's `to.menuTotal` is worked out again from its
 *    corrected counts, as mutate() would with the full database. */
export function restoreSaleMoney(old: Database, incoming: Database): Database {
  if (incoming.entries.length < old.entries.length) return incoming;
  const log: Entry[] = [];
  incoming.entries.forEach((entry, index) => {
    if (index < old.entries.length) {
      const stored = old.entries[index];
      log.push(
        isDeepStrictEqual(stripEntry(stored), stripEntry(entry))
          ? stored
          : entry,
      );
      return;
    }
    if (!entry?.values || typeof entry.values !== "object") {
      log.push(entry);
      return;
    }
    const values = stripSaleMoneyValues(entry.values);
    const edit =
      entry.kind === "entryEdit" ||
      (entry.kind === "editDecision" &&
        values.decision === editDecisions.approve);
    if (edit && values.targetId) {
      const current = currentMoney(log, values.targetId);
      const request =
        entry.kind === "editDecision"
          ? log.find(
              (e) => e.id === values.requestId && e.kind === "editRequest",
            )
          : undefined;
      for (const key of saleMoneyKeys) {
        if (current[key] !== undefined) values["from." + key] = current[key];
        const to = request?.values["to." + key] ?? current[key];
        if (to !== undefined) values["to." + key] = to;
      }
      if (values.targetKind === "sale") {
        if (values["to.lineMan"] !== undefined)
          values["to.revenue"] = values["to.lineMan"];
        const config = incoming.config;
        values["to.menuTotal"] = String(
          n(values, "to.boxes") * n(config, "boxPrice") +
            n(values, "to.addons") * n(config, "addonPrice") +
            n(values, "to.chiliAddons") * n(config, "chiliPrice"),
        );
      }
    }
    log.push({ ...entry, values });
  });
  return { ...incoming, entries: log };
}

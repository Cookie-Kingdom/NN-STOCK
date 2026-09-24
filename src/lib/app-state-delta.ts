import type { Database, Entry, Lot } from "./store";

/** What a non-owner save sends to append_entries (migration 20260925000028): the entries
 *  `next` added to `base` (by id) and the lots it changed. A non-owner holds only its
 *  role-scoped copy of the log, so it can never send the whole payload back. */
export type AppendDelta = { entries: Entry[]; lots: Lot[] };

type Base = { entries?: Partial<Entry>[]; lots?: Partial<Lot>[] };

export function appendDelta(base: Base, next: Database): AppendDelta {
  const known = new Set((base.entries ?? []).map((entry) => entry?.id));
  const lots = new Map((base.lots ?? []).map((lot) => [lot?.id, lot]));
  return {
    entries: next.entries.filter((entry) => !known.has(entry.id)),
    lots: next.lots.filter(
      (lot) => JSON.stringify(lot) !== JSON.stringify(lots.get(lot.id)),
    ),
  };
}

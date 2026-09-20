"use client";
import { useSyncExternalStore } from "react";
import { branches, seed, type Database } from "./store";
import { saveLegacyDataUrl } from "./attachment-store";
import { LOCAL_DB, localAccountId } from "./local-db";
import { createClient } from "./supabase/browser";

type StoredDatabase = Partial<Database>;
type AppStateRow = { payload: StoredDatabase; revision: number };
type RowResult = { data: AppStateRow | null; error: { message: string } | null };
/* save_app_state returns the new revision and nothing else: shipping the payload back
 * only to read one number off it was a large slice of every save (migration 0017). */
type SaveResult = { data: { revision: number } | null; error: { message: string } | null };
const supabase = LOCAL_DB ? null : createClient();
const listeners = new Set<() => void>();
let revision: number | null = null;
let writeQueue = Promise.resolve();
let pendingWrites = 0;

function clean(values: Record<string, string>) {
  const next = Object.fromEntries(Object.entries(values).filter(([key]) => !["brinePrice", "brineOpeningMl", "brineMl", "brineKg", "smokeRate"].includes(key)));
  if (next.material === "ถุงซิปเนื้อ") next.material = "ถุงซีลเนื้อ";
  if (next.material === "ถุงซิปข้าว") next.material = "ถุงซีลข้าว";
  // Payloads written before the preKg/outputKg rename (migration 0014 only fixed Supabase rows).
  for (const [old, key] of [["preKg", "preSmokeKg"], ["outputKg", "postSmokeKg"]]) {
    if (old in next) {
      next[key] ??= next[old];
      delete next[old];
    }
  }
  if (next.batches)
    next.batches = next.batches.replace(/"preKg"/g, '"preSmokeKg"').replace(/"outputKg"/g, '"postSmokeKg"');
  return next;
}
function normalize(parsed: StoredDatabase | null, fallback: Database): Database {
  const version = parsed?.version;
  if (!parsed || typeof version !== "number" || ![3, 4, 5, 6, 7].includes(version) || !Array.isArray(parsed.entries) || !Array.isArray(parsed.lots)) return fallback;
  const config = clean(parsed.config || seed.config);
  return {
    version: 7,
    lots: parsed.lots.map((lot) => ({ ...lot, values: clean(lot.values) })),
    entries: parsed.entries.filter((entry) => entry.kind !== "brinePurchase").map((entry) => ({ ...entry, values: clean(entry.values) })),
    config: { ...seed.config, ...config, branch: branches.includes(config.branch || "") ? config.branch : seed.config.branch },
  };
}

const initialDatabase = seed;
export const demoInitialDatabase = initialDatabase;
let cached = initialDatabase;
/* ponytail: server history is append-only; send it back untouched. normalize() rewrites
 * the loaded payload (renamed keys, brine entries dropped), so a save rebuilds the payload
 * from the stored entries/config plus only what was appended locally since the load.
 * `count` is how many normalized entries the stored ones became, `lastId` the last of them. */
let stored: { payload: StoredDatabase; count: number; lastId?: string; config: Database["config"] } | null = null;
function adopt(payload: StoredDatabase, rev: number) {
  cached = normalize(payload, initialDatabase);
  stored = { payload, count: cached.entries.length, lastId: cached.entries.at(-1)?.id, config: cached.config };
  revision = rev;
  loaded = true;
  notify();
}
/* The cache starts on the seed database, so anything derived from it before the
 * first payload lands is demo data wearing the user's colours. */
let loaded = false;
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };

/** Shown by DatabaseErrorToast in every workspace. */
function reportError(message: string) {
  window.dispatchEvent(new CustomEvent("database-error", { detail: message }));
}
/** POST/GET /api/local-db, shaped like a Supabase result. */
async function localRequest(init?: RequestInit): Promise<RowResult> {
  try {
    const response = await fetch("/api/local-db", init);
    const body = await response.json();
    return response.ok ? { data: body, error: null } : { data: null, error: { message: body.message } };
  } catch (error) {
    return { data: null, error: { message: (error as Error).message } };
  }
}
/* supabase-js has no request timeout, and every save waits in writeQueue behind the one
 * before it: a request that never settles (stalled fetch, auth session read that never
 * resolves) would leave every later save unsent with no message until a reload. */
const REQUEST_TIMEOUT_MS = 20_000;
function withTimeout<T extends { data: unknown; error: { message: string } | null }>(request: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve({ data: null, error: { message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ทันเวลา กรุณาลองใหม่" } } as T), REQUEST_TIMEOUT_MS);
  });
  return Promise.race([Promise.resolve(request), timeout]).finally(() => clearTimeout(timer));
}
function readRow(): Promise<RowResult> {
  if (!supabase) return localRequest();
  return withTimeout(supabase.from("app_state").select("payload, revision").eq("singleton", true).maybeSingle<AppStateRow>());
}
function saveRow(payload: Database, expectedRevision: number | null): Promise<SaveResult> {
  if (!supabase) return localRequest({ method: "POST", body: JSON.stringify({ payload, expectedRevision }) });
  return withTimeout(supabase.rpc("save_app_state", { p_payload: payload, p_expected_revision: expectedRevision })
    .then(({ data, error }) => ({ data: (data as { revision: number }[] | null)?.[0] ?? null, error })));
}
/** Resolves to whether the server payload replaced the cache. */
async function loadDatabase(): Promise<boolean> {
  const { data, error } = await readRow();
  if (error) { reportError(`โหลดข้อมูลไม่สำเร็จ · ${error.message}`); return false; }
  if (!data) {
    const created = await saveRow(initialDatabase, null);
    const row = created.data;
    if (created.error) { reportError(`สร้างข้อมูลเริ่มต้นไม่สำเร็จ · ${created.error.message}`); return false; }
    // The save no longer echoes the payload; what the server holds is what we just sent.
    if (row) adopt(initialDatabase, row.revision);
    return Boolean(row);
  }
  adopt(data.payload, data.revision);
  return true;
}

function onAuthEvent(event: string) {
  // Deferred: Supabase warns that calling the client inside onAuthStateChange can deadlock.
  // A save in flight reloads on its own; adopting now would swap its optimistic change out
  // of the cache and its base (revision, stored history) out from under it.
  if (event === "SIGNED_IN") setTimeout(() => { if (!pendingWrites) void loadDatabase(); }, 0);
  if (event === "SIGNED_OUT") { cached = initialDatabase; stored = null; revision = null; loaded = false; notify(); }
}
if (supabase) {
  void supabase.auth.getSession().then(({ data }) => { if (data.session) void loadDatabase(); });
  supabase.auth.onAuthStateChange(onAuthEvent);
} else if (typeof window !== "undefined") {
  // session.ts dispatches these in local mode.
  window.addEventListener("local-auth", (event) => onAuthEvent((event as CustomEvent<string>).detail));
  if (localAccountId()) void loadDatabase();
}

/** False until the server payload has replaced the seed. Anything that tells the
 * user someone is waiting on them should stay quiet until this is true. */
export function useDatabaseLoaded() {
  return useSyncExternalStore(subscribe, databaseLoaded, () => false);
}
export function useDatabase() {
  return useSyncExternalStore(subscribe, () => cached, () => initialDatabase);
}
/** Optimistic: the cache updates at once. Resolves to whether the server took the write. */
export function saveDatabase(db: Database): Promise<boolean> {
  return writeDatabase(db, false).then((result) => result === "saved");
}
/** Like saveDatabase, but when someone else saved first (stale revision) the server copy is
 * reloaded without an error toast and this resolves "conflict", so the caller can rebuild its
 * change on the fresh data and save again. */
export function saveDatabaseOrConflict(db: Database) {
  return writeDatabase(db, true);
}
const isConflict = (message: string) => message.includes("State changed on another device");
function writeDatabase(db: Database, quietConflict: boolean): Promise<"saved" | "conflict" | "failed"> {
  const before = { cached, stored };
  const strip = (entry: Database["entries"][number]) => ({ ...entry, values: Object.fromEntries(Object.entries(entry.values).filter(([key]) => key !== "attachmentData")) });
  cached = { ...db, entries: db.entries.map(strip) };
  // Only splice when `db` continues the loaded history; a wholesale reset goes out as is.
  const continues = stored && db.entries.length >= stored.count && db.entries[stored.count - 1]?.id === stored.lastId;
  const portable: Database = !continues || !stored ? cached : {
    ...db,
    entries: [...(stored.payload.entries ?? []), ...db.entries.slice(stored.count).map(strip)],
    config: JSON.stringify(db.config) === JSON.stringify(stored.config) ? stored.payload.config ?? db.config : db.config,
  };
  stored = { payload: portable, count: db.entries.length, lastId: db.entries.at(-1)?.id, config: db.config };
  const mine = cached;
  notify();
  pendingWrites++;
  const saved = writeQueue.then(async () => {
    const { data: row, error } = await saveRow(portable, revision);
    if (error) {
      if (await loadDatabase()) {
        if (quietConflict && isConflict(error.message)) return "conflict" as const;
        reportError(`บันทึกไม่สำเร็จ โหลดข้อมูลล่าสุดแล้ว · ${error.message}`);
        return "failed" as const;
      }
      // The server copy could not be read (offline): drop the unsaved change so a retry
      // does not send it twice. ponytail: skipped when a later save already built on it.
      if (cached === mine) { ({ cached, stored } = before); notify(); }
      reportError(`บันทึกไม่สำเร็จ ยังไม่ได้บันทึกรายการนี้ · ${error.message}`);
      return "failed" as const;
    }
    if (row) revision = row.revision;
    return "saved" as const;
  }).finally(() => { pendingWrites--; });
  writeQueue = saved.then(() => undefined);
  return saved;
}
export async function migrateLegacyAttachments(db: Database): Promise<Database> {
  let changed = false;
  const entries = await Promise.all(db.entries.map(async (entry) => {
    const data = entry.values.attachmentData;
    if (!data || entry.values.attachmentStorageKey) return entry;
    const storageKey = await saveLegacyDataUrl(data, entry.values.attachment || "attachment");
    const values = { ...entry.values }; delete values.attachmentData; changed = true;
    return { ...entry, values: { ...values, attachmentStorageKey: storageKey } };
  }));
  return changed ? { ...db, entries } : db;
}
export function latestDatabase() { return cached; }
export function databaseLoaded() { return loaded; }

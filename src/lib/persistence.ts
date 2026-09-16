"use client";
import { useSyncExternalStore } from "react";
import { branches, seed, type Database } from "./store";
import { saveLegacyDataUrl } from "./attachment-store";
import { LOCAL_DB, localAccountId } from "./local-db";
import { createClient } from "./supabase/browser";

type StoredDatabase = Partial<Database>;
type AppStateRow = { payload: StoredDatabase; revision: number };
type RowResult = { data: AppStateRow | null; error: { message: string } | null };
const supabase = LOCAL_DB ? null : createClient();
const listeners = new Set<() => void>();
let revision: number | null = null;
let writeQueue = Promise.resolve();

function clean(values: Record<string, string>) {
  const next = Object.fromEntries(Object.entries(values).filter(([key]) => !["brinePrice", "brineOpeningMl", "brineMl", "brineKg", "smokeRate"].includes(key)));
  if (next.material === "ถุงซิปเนื้อ") next.material = "ถุงซีลเนื้อ";
  if (next.material === "ถุงซิปข้าว") next.material = "ถุงซีลข้าว";
  return next;
}
function normalize(parsed: StoredDatabase | null, fallback: Database): Database {
  const version = parsed?.version;
  if (!parsed || typeof version !== "number" || ![3, 4, 5, 6, 7].includes(version) || !Array.isArray(parsed.entries) || !Array.isArray(parsed.lots)) return fallback;
  const config = clean(parsed.config || seed.config);
  return {
    version: 7,
    lots: parsed.lots,
    entries: parsed.entries.filter((entry) => entry.kind !== "brinePurchase").map((entry) => ({ ...entry, values: clean(entry.values) })),
    config: { ...seed.config, ...config, branch: branches.includes(config.branch || "") ? config.branch : seed.config.branch },
  };
}

const initialDatabase = seed;
export const demoInitialDatabase = initialDatabase;
let cached = initialDatabase;
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
function readRow(): PromiseLike<RowResult> {
  if (!supabase) return localRequest();
  return supabase.from("app_state").select("payload, revision").eq("singleton", true).maybeSingle<AppStateRow>();
}
function saveRow(payload: Database, expectedRevision: number | null): PromiseLike<RowResult> {
  if (!supabase) return localRequest({ method: "POST", body: JSON.stringify({ payload, expectedRevision }) });
  return supabase.rpc("save_app_state", { p_payload: payload, p_expected_revision: expectedRevision })
    .then(({ data, error }) => ({ data: (data as AppStateRow[] | null)?.[0] ?? null, error }));
}
async function loadDatabase() {
  const { data, error } = await readRow();
  if (error) return reportError(`โหลดข้อมูลไม่สำเร็จ · ${error.message}`);
  if (!data) {
    const created = await saveRow(initialDatabase, null);
    const row = created.data;
    if (created.error) return reportError(`สร้างข้อมูลเริ่มต้นไม่สำเร็จ · ${created.error.message}`);
    if (row) { cached = normalize(row.payload, initialDatabase); revision = row.revision; loaded = true; notify(); }
    return;
  }
  cached = normalize(data.payload, initialDatabase);
  revision = data.revision;
  loaded = true;
  notify();
}

function onAuthEvent(event: string) {
  if (event === "SIGNED_IN") void loadDatabase();
  if (event === "SIGNED_OUT") { cached = initialDatabase; revision = null; loaded = false; notify(); }
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
  const portable: Database = { ...db, entries: db.entries.map((entry) => ({ ...entry, values: Object.fromEntries(Object.entries(entry.values).filter(([key]) => key !== "attachmentData")) })) };
  cached = portable;
  notify();
  const saved = writeQueue.then(async () => {
    const { data: row, error } = await saveRow(portable, revision);
    if (error) {
      await loadDatabase();
      reportError(`บันทึกไม่สำเร็จ โหลดข้อมูลล่าสุดแล้ว · ${error.message}`);
      return false;
    }
    if (row) revision = row.revision;
    return true;
  });
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

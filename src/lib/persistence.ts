"use client";
import { useSyncExternalStore } from "react";
import { branches, seed, type Database } from "./store";
import { saveLegacyDataUrl } from "./attachment-store";
import { createClient } from "./supabase/browser";

type StoredDatabase = Partial<Database>;
type AppStateRow = { payload: StoredDatabase; revision: number };
const supabase = createClient();
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
const notify = () => listeners.forEach((listener) => listener());

async function loadDatabase() {
  const { data, error } = await supabase.from("app_state").select("payload, revision").eq("singleton", true).maybeSingle<AppStateRow>();
  if (error) return;
  if (!data) {
    const created = await supabase.rpc("save_app_state", { p_payload: initialDatabase, p_expected_revision: null });
    const row = (created.data as AppStateRow[] | null)?.[0];
    if (!created.error && row) { cached = normalize(row.payload, initialDatabase); revision = row.revision; notify(); }
    return;
  }
  cached = normalize(data.payload, initialDatabase);
  revision = data.revision;
  notify();
}

void supabase.auth.getSession().then(({ data }) => { if (data.session) void loadDatabase(); });
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_IN") void loadDatabase();
  if (event === "SIGNED_OUT") { cached = initialDatabase; revision = null; notify(); }
});

export function useDatabase() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => cached,
    () => initialDatabase,
  );
}
export function saveDatabase(db: Database) {
  const portable: Database = { ...db, entries: db.entries.map((entry) => ({ ...entry, values: Object.fromEntries(Object.entries(entry.values).filter(([key]) => key !== "attachmentData")) })) };
  cached = portable;
  notify();
  writeQueue = writeQueue.then(async () => {
    const { data, error } = await supabase.rpc("save_app_state", { p_payload: portable, p_expected_revision: revision });
    if (error) {
      await loadDatabase();
      window.dispatchEvent(new CustomEvent("database-error", { detail: error.message }));
      return;
    }
    const row = (data as AppStateRow[] | null)?.[0];
    if (row) revision = row.revision;
  });
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

"use client";
import { useSyncExternalStore } from "react";
import { branches, seed, type Database } from "./store";
import { saveLegacyDataUrl } from "./attachment-store";
import demoSeed from "./seed.json";
const key = "nerdnuea-forms-v4";
let cachedRaw: string | null = null;
type StoredDatabase = {
  version?: number;
  entries?: Database["entries"];
  lots?: Database["lots"];
  config?: Database["config"];
};
function withoutRetiredMarinadeFields(values: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([key]) => !["brinePrice", "brineOpeningMl", "brineMl", "brineKg", "smokeRate"].includes(key),
    ),
  );
}
function withCurrentMaterialNames(values: Record<string, string>) {
  const renamed = values.material === "ถุงซิปเนื้อ"
    ? "ถุงซีลเนื้อ"
    : values.material === "ถุงซิปข้าว"
      ? "ถุงซีลข้าว"
      : values.material;
  return renamed ? { ...values, material: renamed } : values;
}
function normalize(parsed: StoredDatabase | null, fallback: Database): Database {
  const version = parsed?.version;
  if (
    !parsed ||
    typeof version !== "number" ||
    ![3, 4, 5, 6, 7].includes(version) ||
    !Array.isArray(parsed.entries) ||
    !Array.isArray(parsed.lots)
  )
    return fallback;
  const storedEntries = parsed.entries as Database["entries"];
  const storedConfig = parsed.config || seed.config;
  const safeConfig = withoutRetiredMarinadeFields(storedConfig);
  return {
    ...parsed,
    version: 7,
    lots: parsed.lots,
    entries: (version < 5
        ? storedEntries.map((entry) => {
            if (entry.kind === "smoke") {
              const outputKg = entry.values.outputKg || "0";
              return {
                ...entry,
                values: {
                  ...entry.values,
                  packs: outputKg,
                  packCount: Number(outputKg) > 0 ? "1" : "0",
                },
              };
            }
            if (entry.kind === "sale")
              return {
                ...entry,
                values: {
                  ...entry.values,
                  chiliComplimentary: "0",
                  chiliSold: entry.values.chiliAddons || "0",
                },
              };
            return entry;
          })
        : parsed.entries
            .filter((entry) => entry.kind !== "brinePurchase")
            .map((entry) => ({ ...entry, values: withoutRetiredMarinadeFields(entry.values) })))
      .map((entry) => ({ ...entry, values: withCurrentMaterialNames(entry.values) })),
    config: {
      ...seed.config,
      ...safeConfig,
      ...(version === 3
        ? { packKg: "0.1015", ricePrice: "0", chiliPrice: "30" }
        : {}),
      branch: branches.includes(safeConfig.branch || "")
        ? safeConfig.branch
        : seed.config.branch,
    },
  };
}
const initialDatabase = normalize(demoSeed as unknown as StoredDatabase, seed);
export const demoInitialDatabase = initialDatabase;
let cached: Database = initialDatabase;
function snapshot(): Database {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      const parsed = (raw ? JSON.parse(raw) : initialDatabase) as StoredDatabase;
      cached = normalize(parsed, initialDatabase);
    }
  } catch {
    return cached;
  }
  return cached;
}
function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener("demo-change", notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener("demo-change", notify);
  };
}
export function useDatabase() {
  return useSyncExternalStore(subscribe, snapshot, () => initialDatabase);
}
export function saveDatabase(db: Database) {
  // Binary Invoice files live in IndexedDB. Keeping Base64 file data in localStorage
  // quickly exceeds the browser quota once the demo has a longer history.
  const portable = {
    ...db,
    entries: db.entries.map((entry) => {
      const values = Object.fromEntries(
        Object.entries(entry.values).filter(([valueKey]) => valueKey !== "attachmentData"),
      );
      return { ...entry, values };
    }),
  };
  const serialized = JSON.stringify(portable);
  try {
    localStorage.setItem(key, serialized);
  } catch (error) {
    // Older demo data may still contain large Base64 files. Remove the old
    // version first, then retry the compact representation we just created.
    if (!(error instanceof DOMException) || error.name !== "QuotaExceededError")
      throw error;
    localStorage.removeItem(key);
    try {
      localStorage.setItem(key, serialized);
    } catch (retryError) {
      if (!(retryError instanceof DOMException) || retryError.name !== "QuotaExceededError")
        throw retryError;
      // A logo is the only remaining binary field in the database. It can be
      // uploaded again from Settings; operational records remain intact.
      const withoutLogo = JSON.stringify({
        ...portable,
        config: { ...portable.config, logoData: "" },
      });
      localStorage.setItem(key, withoutLogo);
    }
  }
  window.dispatchEvent(new Event("demo-change"));
}
export async function migrateLegacyAttachments(db: Database): Promise<Database> {
  let changed = false;
  const entries = await Promise.all(
    db.entries.map(async (entry) => {
      const data = entry.values.attachmentData;
      if (!data || entry.values.attachmentStorageKey) return entry;
      const storageKey = await saveLegacyDataUrl(
        data,
        entry.values.attachment || "attachment",
      );
      const values = { ...entry.values };
      delete values.attachmentData;
      changed = true;
      return { ...entry, values: { ...values, attachmentStorageKey: storageKey } };
    }),
  );
  return changed ? { ...db, entries } : db;
}
export function latestDatabase() {
  return snapshot();
}

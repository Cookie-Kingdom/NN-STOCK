"use client";
import { useSyncExternalStore } from "react";
import { branches, seed, type Database } from "./demo-store";
import demoSeed from "./demo-seed.json";
const key = "nerdnuea-forms-v4";
let cachedRaw: string | null = null;
type StoredDatabase = {
  version?: number;
  entries?: Database["entries"];
  lots?: Database["lots"];
  config?: Database["config"];
};
function normalize(parsed: StoredDatabase | null, fallback: Database): Database {
  const version = parsed?.version;
  if (
    !parsed ||
    typeof version !== "number" ||
    ![3, 4, 5, 6].includes(version) ||
    !Array.isArray(parsed.entries) ||
    !Array.isArray(parsed.lots)
  )
    return fallback;
  const storedEntries = parsed.entries as Database["entries"];
  const storedConfig = parsed.config || seed.config;
  return {
    ...parsed,
    version: 6,
    lots: parsed.lots,
    entries:
      version < 5
        ? storedEntries.map((entry) => {
            if (entry.kind === "smoke") {
              const outputKg = entry.values.outputKg || "0";
              return {
                ...entry,
                values: {
                  ...entry.values,
                  brineMl: String(Number(entry.values.brineKg || 0) * 1000),
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
        : parsed.entries,
    config: {
      ...seed.config,
      ...storedConfig,
      brineOpeningMl: version < 6
        ? String(storedEntries.filter((entry) => entry.kind === "smoke").reduce((sum, entry) => sum + Number(entry.values.brineMl || Number(entry.values.brineKg || 0) * 1000), 0))
        : storedConfig.brineOpeningMl || "0",
      ...(version === 3
        ? { packKg: "0.1015", ricePrice: "0", chiliPrice: "30" }
        : {}),
      branch: branches.includes(storedConfig.branch || "")
        ? storedConfig.branch
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
  localStorage.setItem(key, JSON.stringify(db));
  window.dispatchEvent(new Event("demo-change"));
}
export function latestDatabase() {
  return snapshot();
}

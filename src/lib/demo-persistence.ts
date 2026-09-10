"use client";
import { useSyncExternalStore } from "react";
import { branches, seed, type Database } from "./demo-store";
import demoSeed from "./demo-seed.json";
const key = "nerdnuea-forms-v4";
let cachedRaw: string | null = null;
const initialDatabase = demoSeed as unknown as Database;
export const demoInitialDatabase = initialDatabase;
let cached: Database = initialDatabase;
function snapshot(): Database {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      const parsed = raw ? JSON.parse(raw) : initialDatabase;
      cached =
        (parsed.version === 3 || parsed.version === 4) &&
        Array.isArray(parsed.entries) &&
        Array.isArray(parsed.lots)
          ? {
              ...parsed,
              version: 4,
              config: {
                ...seed.config,
                ...parsed.config,
                ...(parsed.version === 3
                  ? {
                      packKg: "0.1015",
                      ricePrice: "0",
                      chiliPrice: "30",
                    }
                  : {}),
                branch: branches.includes(parsed.config?.branch)
                  ? parsed.config.branch
                  : seed.config.branch,
              },
            }
          : initialDatabase;
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

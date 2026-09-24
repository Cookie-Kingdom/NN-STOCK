// Stand-in for src/lib/persistence.ts: same exports, no Supabase. Saves update the
// in-memory database and show up in the Actions panel.
import { useSyncExternalStore } from "react";
import { action } from "storybook/actions";
import { seed, type Database } from "@/lib/store";

let cached: Database = seed;
const listeners = new Set<() => void>();

export const demoInitialDatabase = seed;

/** Called by the preview decorator before each story renders; does not notify. */
export function setMockDatabase(db: Database) {
  cached = db;
}

export function useDatabase() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => cached,
    () => cached,
  );
}

/** Stories render with their database already in place. */
export function useDatabaseLoaded() {
  return true;
}

export function databaseLoaded() {
  return true;
}

function write(db: Database) {
  cached = db;
  listeners.forEach((listener) => listener());
  action("saveDatabase")({
    entries: db.entries.length,
    lastEntry: db.entries.at(-1),
  });
}

export async function saveDatabase(db: Database): Promise<boolean> {
  write(db);
  return true;
}

// ponytail: no conflict path in Storybook — nobody else writes this cache.
export async function saveDatabaseOrConflict(
  db: Database,
): Promise<"saved" | "conflict" | "failed"> {
  write(db);
  return "saved";
}

export function latestDatabase() {
  return cached;
}

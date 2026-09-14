"use client";

import { useState } from "react";
import { saveDatabase } from "@/lib/persistence";
import type { Database } from "@/lib/store";

/**
 * The try → save → catch → setError block every dialog form repeated.
 * `change` reads `latestDatabase()` itself so callers keep their own ordering
 * (EntryForm uploads attachments before reading the database).
 * Resolves to the saved database, or `null` after setting `error`.
 */
export function useSaveMutation(fallbackMessage: string) {
  const [error, setError] = useState("");
  async function run(change: () => Database | Promise<Database>) {
    try {
      const next = await change();
      saveDatabase(next);
      return next;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : fallbackMessage);
      return null;
    }
  }
  return { error, setError, run };
}

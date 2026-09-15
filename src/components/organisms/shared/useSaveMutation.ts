"use client";

import { useRef, useState } from "react";
import { saveDatabase } from "@/lib/persistence";
import type { Database } from "@/lib/store";

/**
 * The try → save → catch → setError block every dialog form repeated.
 * `change` reads `latestDatabase()` itself so callers keep their own ordering
 * (EntryForm uploads attachments before reading the database).
 * Resolves to the saved database, or `null` after setting `error`.
 *
 * A second `run` while one is in flight resolves to `null` without saving, so a
 * double click cannot append the same entry twice. `saving` is for disabling submit.
 */
export function useSaveMutation(fallbackMessage: string) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  async function run(change: () => Database | Promise<Database>) {
    if (inFlight.current) return null;
    inFlight.current = true;
    setSaving(true);
    try {
      const next = await change();
      // Wait for the server so a rejected save keeps the dialog open instead of
      // showing the success toast (the red database-error toast says why).
      if (!(await saveDatabase(next))) {
        setError(fallbackMessage);
        return null;
      }
      return next;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : fallbackMessage);
      return null;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }
  return { error, setError, run, saving };
}

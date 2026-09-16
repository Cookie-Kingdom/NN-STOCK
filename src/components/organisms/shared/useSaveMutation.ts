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
    // The shell's DatabaseErrorToast sits behind the modal (a wide PO dialog hides
    // it completely), so repeat the server's reason inside the form.
    let serverMessage = "";
    const onDatabaseError = (event: Event) => {
      serverMessage = String((event as CustomEvent).detail);
    };
    window.addEventListener("database-error", onDatabaseError);
    try {
      const next = await change();
      // Wait for the server so a rejected save keeps the dialog open instead of
      // showing the success toast.
      if (!(await saveDatabase(next))) {
        setError(serverMessage || fallbackMessage);
        return null;
      }
      return next;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : fallbackMessage);
      return null;
    } finally {
      window.removeEventListener("database-error", onDatabaseError);
      inFlight.current = false;
      setSaving(false);
    }
  }
  return { error, setError, run, saving };
}

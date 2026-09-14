"use client";

import { useSyncExternalStore } from "react";
import { accountById, type Account, type AccountId } from "@/lib/accounts";
import { latestDatabase, saveDatabase } from "@/lib/persistence";

/* Which account this browser is signed in as. Identity only — every permission
 * check still has to move to the server when Supabase auth lands (BR15). */
const KEY = "nerdnuea.account";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** `undefined` means "not read yet" — the value the prerendered HTML assumes. */
const readAccountId = (): string | null => localStorage.getItem(KEY);
const beforeHydration = (): undefined => undefined;

export function signIn(id: AccountId) {
  const account = accountById(id);
  if (!account) return;
  localStorage.setItem(KEY, id);
  if (account.branch) {
    const current = latestDatabase();
    if (current.config.branch !== account.branch) {
      saveDatabase({ ...current, config: { ...current.config, branch: account.branch } });
    }
  }
  listeners.forEach((listener) => listener());
}

export function signOut() {
  localStorage.removeItem(KEY);
  listeners.forEach((listener) => listener());
}

export type SessionState = { ready: boolean; account: Account | null };

/** `ready` is false for the hydration render, so the first paint matches the
 * prerendered HTML instead of flashing a redirect. */
export function useSession(): SessionState {
  const id = useSyncExternalStore(subscribe, readAccountId, beforeHydration);
  return { ready: id !== undefined, account: accountById(id ?? null) };
}

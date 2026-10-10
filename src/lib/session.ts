"use client";

import { useSyncExternalStore } from "react";
import { accountById, type Account, type AccountId } from "@/lib/accounts";
import { LOCAL_ACCOUNT_COOKIE, LOCAL_DB, localAccountId } from "@/lib/local-db";
import { isAuthRetryableFetchError, type Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";
import { resetDatabase, setSaveAppendOnly } from "@/lib/persistence";

type Profile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "display_name" | "role" | "is_active"
>;
export type SessionState = {
  ready: boolean;
  account: Account | null;
  error: string;
};
/** An account that signed in on this device. In Supabase mode it carries that user's tokens,
 * which is what lets `switchAccount` open it again without the password. */
export type SavedAccount = {
  id: AccountId;
  name: string;
  userId?: string;
  access_token?: string;
  refresh_token?: string;
};

const supabase = LOCAL_DB ? null : createClient();
const listeners = new Set<() => void>();
// One object, reused as the server snapshot: useSyncExternalStore loops if that snapshot changes identity.
const initialState: SessionState = { ready: false, account: null, error: "" };
let state = initialState;

function publish(next: SessionState) {
  state = next;
  setSaveAppendOnly(!!next.account && next.account.role !== "owner");
  listeners.forEach((listener) => listener());
}

// shortcut: one saved entry per account id, so two Supabase users of the same account overwrite each other; key by userId when an account has more than one user.
const SAVED_KEY = "saved-accounts";
// One array, reused as the server snapshot, for the same reason as initialState.
const noSaved: SavedAccount[] = [];
function readSaved(): SavedAccount[] {
  if (typeof window === "undefined") return noSaved;
  try {
    const list: unknown = JSON.parse(
      window.localStorage.getItem(SAVED_KEY) ?? "[]",
    );
    return Array.isArray(list)
      ? list.filter((saved) => accountById(saved?.id))
      : noSaved;
  } catch {
    return noSaved;
  }
}
let saved = readSaved();
/** Re-reads before writing: another tab may have rotated another account's tokens since. */
function changeSaved(change: (list: SavedAccount[]) => SavedAccount[]) {
  if (typeof window === "undefined") return;
  saved = change(readSaved());
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  } catch {
    // Storage is blocked or full: the list lasts until the tab closes.
  }
  listeners.forEach((listener) => listener());
}
function remember(account: SavedAccount) {
  changeSaved((list) =>
    list.some((a) => a.id === account.id)
      ? list.map((a) => (a.id === account.id ? account : a))
      : [...list, account],
  );
}
const forget = (id: AccountId) =>
  changeSaved((list) => list.filter((a) => a.id !== id));
// Refresh tokens rotate: a saved one that is not kept current cannot open its account later.
function keepTokens(session: Session) {
  changeSaved((list) =>
    list.map((a) =>
      a.userId === session.user.id
        ? {
            ...a,
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }
        : a,
    ),
  );
}
/** Before the open account is left. The proxy refreshes the auth cookies on the server with
 * no event here, so the saved copy of its tokens can be a rotation behind. */
async function keepOpenTokens() {
  const { data } = await supabase!.auth.getSession();
  if (data.session) keepTokens(data.session);
}
if (typeof window !== "undefined")
  window.addEventListener("storage", (event) => {
    if (event.key !== SAVED_KEY) return;
    saved = readSaved();
    listeners.forEach((listener) => listener());
  });

function accountForProfile(
  profile: Profile,
  locationName?: string,
): Account | null {
  if (!profile.is_active) return null;
  /* Any other role (the retired L1_MANAGER and L3/L4 partner profiles) has no account: generic
   * inactive message.
   * So has a branch admin with no user_locations row: the server gives it no branch and would
   * refuse every save, so it must not open as ศาลาแดง. */
  const id: AccountId | null =
    profile.role === "L1_OWNER"
      ? "owner"
      : profile.role !== "L2_BRANCH_ADMIN" || !locationName
        ? null
        : locationName?.includes("มีนบุรี")
          ? "minburi"
          : "saladaeng";
  const base = accountById(id);
  return base ? { ...base, name: profile.display_name || base.name } : null;
}

/** Local SQLite mode: the account id is the email's local part, any password. */
function setLocalAccount(account: Account | null) {
  document.cookie = account
    ? `${LOCAL_ACCOUNT_COOKIE}=${account.id}; path=/; SameSite=Lax`
    : `${LOCAL_ACCOUNT_COOKIE}=; path=/; max-age=0`;
  if (account) remember({ id: account.id, name: account.name });
  publish({ ready: true, account, error: "" });
  window.dispatchEvent(
    new CustomEvent("local-auth", {
      detail: account ? "SIGNED_IN" : "SIGNED_OUT",
    }),
  );
}
const localAuthError = (message: string) => ({
  data: { user: null, session: null },
  error: { message },
});

async function refreshSession() {
  if (!supabase) {
    if (typeof document !== "undefined")
      publish({
        ready: true,
        account: accountById(localAccountId()),
        error: "",
      });
    return;
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  /* A signed-in workspace re-checks on every auth event (each time the tab becomes visible,
   * or another tab signs in). A network blip there is not a sign-out: publishing no account
   * would unmount the workspace and throw away whatever the user was typing. */
  if (state.account && isAuthRetryableFetchError(userError)) return;
  if (userError || !userData.user)
    return publish({ ready: true, account: null, error: "" });

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, role, is_active")
    .eq("id", userData.user.id)
    .single();
  // PGRST116 is "no row"; any other failure here is the request, not the profile.
  if (state.account && error && error.code !== "PGRST116") return;
  if (error || !profile)
    return publish({
      ready: true,
      account: null,
      error: "บัญชีนี้ยังไม่ได้ตั้งสิทธิ์ใช้งาน กรุณาติดต่อ Owner",
    });

  let locationName: string | undefined;
  if (profile.role === "L2_BRANCH_ADMIN") {
    /* ponytail: one branch per account. With two rows the server (account_branches) scopes
     * to both, but the app opens one: the lowest location_id, so it is at least the same
     * one every time. */
    const { data, error: locationError } = await supabase
      .from("user_locations")
      .select("locations(name_th)")
      .eq("profile_id", userData.user.id)
      .order("location_id")
      .limit(1)
      .maybeSingle();
    // A failed request is not "no branch": keep the open workspace, as for the profile.
    if (state.account && locationError) return;
    locationName = data?.locations?.name_th;
  }
  const account = accountForProfile(profile, locationName);
  publish({
    ready: true,
    account,
    error: account ? "" : "บัญชีนี้ยังไม่เปิดใช้งาน กรุณาติดต่อ Owner",
  });
  if (!account) return;
  // Another tab may have switched since getUser: only the tokens of the user just read are saved.
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id === userData.user.id)
    remember({
      id: account.id,
      name: account.name,
      userId: userData.user.id,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
}

void refreshSession();
supabase?.auth.onAuthStateChange((event, session) => {
  if (session) keepTokens(session);
  // A refreshed token is the same user; nothing to re-read.
  if (event === "TOKEN_REFRESHED" && state.account) return;
  // Deferred: Supabase warns that calling the client inside this callback can deadlock.
  setTimeout(() => void refreshSession(), 0);
});

export async function signIn(email: string, password: string) {
  if (!supabase) {
    const id = email.split("@")[0];
    const account = accountById(id);
    if (!account)
      return localAuthError(
        "โหมด local: ใช้อีเมล owner@local.test, saladaeng@ หรือ minburi@local.test",
      );
    resetDatabase();
    setLocalAccount(account);
    return { data: { user: null, session: null }, error: null };
  }
  /* Signing in over an open account replaces the client's session without revoking the old
   * one on the server: that is "add account". The old account's cached data must go. */
  await keepOpenTokens();
  const result = await supabase.auth.signInWithPassword({ email, password });
  if (!result.error) {
    resetDatabase();
    await refreshSession();
  }
  return result;
}
/** Opens a saved account without its password. Resolves to "" or to why it could not. */
export async function switchAccount(id: AccountId): Promise<string> {
  if (!supabase) {
    resetDatabase();
    setLocalAccount(accountById(id));
    return "";
  }
  await keepOpenTokens();
  const entry = readSaved().find((a) => a.id === id);
  /* Never signOut() on the way: any scope of it revokes the session on the server, and with
   * it the saved refresh token of the account being left. */
  const { error } =
    entry?.access_token && entry.refresh_token
      ? await supabase.auth.setSession({
          access_token: entry.access_token,
          refresh_token: entry.refresh_token,
        })
      : { error: new Error() };
  // A network blip says nothing about the tokens: keep them for the next try.
  if (isAuthRetryableFetchError(error))
    return "เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่";
  if (error) {
    forget(id);
    return "เซสชันของบัญชีนี้หมดอายุ กรุณาเข้าสู่ระบบใหม่";
  }
  resetDatabase();
  await refreshSession();
  return "";
}
export async function signOut() {
  if (state.account) forget(state.account.id);
  if (!supabase) return setLocalAccount(null);
  await supabase.auth.signOut();
  publish({ ready: true, account: null, error: "" });
}
export function useSession(): SessionState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => initialState,
  );
}
export function useSavedAccounts(): SavedAccount[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => saved,
    () => noSaved,
  );
}

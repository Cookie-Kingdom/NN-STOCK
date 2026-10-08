"use client";

import { useSyncExternalStore } from "react";
import { accountById, type Account, type AccountId } from "@/lib/accounts";
import { LOCAL_ACCOUNT_COOKIE, LOCAL_DB, localAccountId } from "@/lib/local-db";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";
import { setSaveAppendOnly } from "@/lib/persistence";

type Profile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "display_name" | "role" | "is_active"
>;
export type SessionState = {
  ready: boolean;
  account: Account | null;
  error: string;
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
}

void refreshSession();
supabase?.auth.onAuthStateChange((event) => {
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
    setLocalAccount(account);
    return { data: { user: null, session: null }, error: null };
  }
  const result = await supabase.auth.signInWithPassword({ email, password });
  if (!result.error) await refreshSession();
  return result;
}
export async function signOut() {
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

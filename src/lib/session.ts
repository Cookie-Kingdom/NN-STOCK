"use client";

import { useSyncExternalStore } from "react";
import { accountById, type Account, type AccountId } from "@/lib/accounts";
import { createClient } from "@/lib/supabase/browser";

type Profile = { display_name: string; role: "L1_OWNER" | "L2_BRANCH_ADMIN" | "L3_CM_OPERATOR" | "L4_SUPPLIER"; is_active: boolean };
export type SessionState = { ready: boolean; account: Account | null; error: string };

const supabase = createClient();
const listeners = new Set<() => void>();
let state: SessionState = { ready: false, account: null, error: "" };

function publish(next: SessionState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function accountForProfile(profile: Profile, locationName?: string): Account | null {
  if (!profile.is_active) return null;
  const id: AccountId = profile.role === "L1_OWNER" ? "owner"
    : profile.role === "L3_CM_OPERATOR" ? "chef"
    : profile.role === "L4_SUPPLIER" ? "fooddiva"
    : locationName?.includes("มีนบุรี") ? "minburi" : "saladaeng";
  const base = accountById(id);
  return base ? { ...base, name: profile.display_name || base.name } : null;
}

async function refreshSession() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return publish({ ready: true, account: null, error: "" });

  const { data: profile, error } = await supabase.from("profiles")
    .select("display_name, role, is_active").eq("id", userData.user.id).single<Profile>();
  if (error || !profile) return publish({ ready: true, account: null, error: "ไม่พบสิทธิ์ผู้ใช้งาน กรุณาติดต่อ Owner" });

  let locationName: string | undefined;
  if (profile.role === "L2_BRANCH_ADMIN") {
    const { data } = await supabase.from("user_locations").select("locations(name_th)")
      .eq("profile_id", userData.user.id).limit(1).maybeSingle();
    locationName = (data?.locations as unknown as { name_th?: string } | null)?.name_th;
  }
  const account = accountForProfile(profile, locationName);
  publish({ ready: true, account, error: account ? "" : "บัญชีนี้ยังไม่เปิดใช้งาน กรุณาติดต่อ Owner" });
}

void refreshSession();
supabase.auth.onAuthStateChange(() => { void refreshSession(); });

export async function signIn(email: string, password: string) {
  const result = await supabase.auth.signInWithPassword({ email, password });
  if (!result.error) await refreshSession();
  return result;
}
export async function signUp(email: string, password: string, displayName: string) {
  const result = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName }, emailRedirectTo: `${window.location.origin}/` },
  });
  if (result.data.session) await refreshSession();
  return result;
}
export async function signOut() {
  await supabase.auth.signOut();
  publish({ ready: true, account: null, error: "" });
}
export function useSession(): SessionState {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => state,
    () => ({ ready: false, account: null, error: "" }),
  );
}

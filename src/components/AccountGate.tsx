"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { LoadingScreen } from "@/components/molecules/LoadingState";
import type { Account, AccountId } from "@/lib/accounts";
import { useSession } from "@/lib/session";

/** Renders a workspace only for the accounts it belongs to; anyone else is
 * sent back to sign-in. Client-side only — the real guard belongs in Supabase
 * RLS once auth lands. */
export function AccountGate({
  allow,
  children,
}: {
  allow: AccountId[];
  children: (account: Account) => ReactNode;
}) {
  const { ready, account } = useSession();
  const router = useRouter();
  const permitted = account && allow.includes(account.id) ? account : null;

  useEffect(() => {
    if (ready && !permitted) router.replace("/");
  }, [ready, permitted, router]);

  // Checking is not the same as refused: only the refusal (which redirects to
  // sign-in) renders nothing.
  if (!ready) return <LoadingScreen message="กำลังตรวจสอบสิทธิ์การใช้งาน…" />;
  if (!permitted) return null;
  return <>{children(permitted)}</>;
}

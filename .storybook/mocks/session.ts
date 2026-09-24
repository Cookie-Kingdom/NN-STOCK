// Stand-in for src/lib/session.ts: signed in as the owner, no Supabase.
import { action } from "storybook/actions";
import { accountById, type Account } from "@/lib/accounts";

export type SessionState = {
  ready: boolean;
  account: Account | null;
  error: string;
};

export async function signIn(email: string, password: string) {
  action("signIn")(email, password.length);
  return "";
}

export async function signOut() {
  action("signOut")();
}

export function useSession(): SessionState {
  return { ready: true, account: accountById("owner"), error: "" };
}

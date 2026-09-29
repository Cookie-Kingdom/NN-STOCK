// Stand-in for src/lib/session.ts: signed in as the owner, no Supabase. A story can
// render another session state (loading, signed out, error) by wrapping itself in
// <MockSession value={...}>; every other story keeps the signed-in default.
import { createContext, useContext } from "react";
import { action } from "storybook/actions";
import { accountById, type Account } from "@/lib/accounts";

export type SessionState = {
  ready: boolean;
  account: Account | null;
  error: string;
};

export const MockSession = createContext<SessionState>({
  ready: true,
  account: accountById("owner"),
  error: "",
});

/** Like local mode: `<account id>@anything` signs in, any other email fails. */
export async function signIn(email: string, password: string) {
  action("signIn")(email, password.length);
  return accountById(email.split("@")[0])
    ? { error: null }
    : { error: { message: "Invalid login credentials" } };
}

export async function signOut() {
  action("signOut")();
}

export function useSession(): SessionState {
  return useContext(MockSession);
}

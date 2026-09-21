/* Test-only backend. NEXT_PUBLIC_LOCAL_DB=1 swaps Supabase for a SQLite file served
 * by src/app/api/local-db (see local-db.server.ts); sign-in is `<account id>@local.test`
 * with any password, and the chosen account rides in a cookie. */
export const LOCAL_DB = process.env.NEXT_PUBLIC_LOCAL_DB === "1";
export const LOCAL_ACCOUNT_COOKIE = "local-account";

export function localAccountId() {
  if (typeof document === "undefined") return undefined;
  return document.cookie.match(
    new RegExp(`(?:^|; )${LOCAL_ACCOUNT_COOKIE}=([^;]*)`),
  )?.[1];
}

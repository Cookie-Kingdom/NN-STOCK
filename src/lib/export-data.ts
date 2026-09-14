import type { Account } from "@/lib/accounts";
import { type Database, visibleEntries } from "@/lib/store";

/** Downloads what this account is allowed to see — never the whole database
 * unless the account is the owner. */
export function exportWorkspaceData(db: Database, account: Account, date: string) {
  const data =
    account.role === "owner"
      ? db
      : { account: account.id, branch: account.branch, entries: visibleEntries(db, account.role) };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `nerdnuea-${account.id}-${date}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

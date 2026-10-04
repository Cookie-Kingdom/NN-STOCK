"use client";

import { Workspace } from "@/components/pages/Workspace";
import { AccountGate } from "@/components/AccountGate";

/* The workspace lives in the layout, not the page, so its state survives
 * switching between /branch/[...path] routes. */
export default function BranchLayout({ children }: LayoutProps<"/branch">) {
  return (
    <AccountGate allow={["saladaeng", "minburi"]}>
      {(account) => (
        <>
          <Workspace key={account.id} account={account} />
          {children}
        </>
      )}
    </AccountGate>
  );
}

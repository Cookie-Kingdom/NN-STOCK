"use client";

import { BranchWorkspace } from "@/components/branch/BranchWorkspace";
import { AccountGate } from "@/components/workspace/AccountGate";

/* The workspace lives in the layout, not the page, so date, modal and toast survive
 * switching between /branch/[tab] routes. */
export default function BranchLayout({ children }: LayoutProps<"/branch">) {
  return (
    <AccountGate allow={["saladaeng", "minburi"]}>
      {(account) => (
        <>
          <BranchWorkspace key={account.id} account={account} />
          {children}
        </>
      )}
    </AccountGate>
  );
}

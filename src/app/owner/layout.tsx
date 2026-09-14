"use client";

import { OwnerWorkspace } from "@/components/owner/OwnerWorkspace";
import { AccountGate } from "@/components/workspace/AccountGate";

/* The workspace lives in the layout, not the page, so date, modal and toast survive
 * switching between /owner/[tab] routes. */
export default function OwnerLayout({ children }: LayoutProps<"/owner">) {
  return (
    <AccountGate allow={["owner"]}>
      {(account) => (
        <>
          <OwnerWorkspace account={account} />
          {children}
        </>
      )}
    </AccountGate>
  );
}

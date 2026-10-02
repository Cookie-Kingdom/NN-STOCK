"use client";

import { Workspace } from "@/components/pages/Workspace";
import { AccountGate } from "@/components/AccountGate";

/* The workspace lives in the layout, not the page, so its state survives
 * switching between /owner/[tab] routes. */
export default function OwnerLayout({ children }: LayoutProps<"/owner">) {
  return (
    <AccountGate allow={["owner", "manager"]}>
      {(account) => (
        <>
          <Workspace account={account} />
          {children}
        </>
      )}
    </AccountGate>
  );
}

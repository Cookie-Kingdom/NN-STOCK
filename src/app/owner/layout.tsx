"use client";

import { Workspace } from "@/components/pages/Workspace";
import { AccountGate } from "@/components/AccountGate";

/* The workspace lives in the layout, not the page, so its state survives
 * switching between /owner/[...path] routes. */
export default function OwnerLayout({ children }: LayoutProps<"/owner">) {
  return (
    <AccountGate allow={["owner"]}>
      {(account) => (
        <>
          <Workspace account={account} />
          {children}
        </>
      )}
    </AccountGate>
  );
}

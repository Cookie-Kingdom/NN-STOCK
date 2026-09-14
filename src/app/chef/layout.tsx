"use client";

import { ChefWorkspace } from "@/components/pages/ChefWorkspace";
import { AccountGate } from "@/components/AccountGate";

/* The workspace lives in the layout, not the page, so date, modal and toast survive
 * switching between /chef/[tab] routes. */
export default function ChefLayout({ children }: LayoutProps<"/chef">) {
  return (
    <AccountGate allow={["chef"]}>
      {(account) => (
        <>
          <ChefWorkspace account={account} />
          {children}
        </>
      )}
    </AccountGate>
  );
}

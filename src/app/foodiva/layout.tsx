"use client";

import { FoodivaWorkspace } from "@/components/foodiva/FoodivaWorkspace";
import { AccountGate } from "@/components/workspace/AccountGate";

/* The workspace lives in the layout, not the page, so date, modal and toast survive
 * switching between /foodiva/[tab] routes. */
export default function FoodivaLayout({ children }: LayoutProps<"/foodiva">) {
  return (
    <AccountGate allow={["foodiva"]}>
      {(account) => (
        <>
          <FoodivaWorkspace account={account} />
          {children}
        </>
      )}
    </AccountGate>
  );
}

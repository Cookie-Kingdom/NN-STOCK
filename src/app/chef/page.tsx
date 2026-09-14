"use client";

import { ChefWorkspace } from "@/components/chef/ChefWorkspace";
import { AccountGate } from "@/components/workspace/AccountGate";

export default function ChefPage() {
  return (
    <AccountGate allow={["chef"]}>
      {(account) => <ChefWorkspace account={account} />}
    </AccountGate>
  );
}

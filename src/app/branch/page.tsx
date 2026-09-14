"use client";

import { BranchWorkspace } from "@/components/branch/BranchWorkspace";
import { AccountGate } from "@/components/workspace/AccountGate";

export default function BranchPage() {
  return (
    <AccountGate allow={["saladaeng", "minburi"]}>
      {(account) => <BranchWorkspace key={account.id} account={account} />}
    </AccountGate>
  );
}

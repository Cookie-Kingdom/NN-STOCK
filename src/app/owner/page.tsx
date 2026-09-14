"use client";

import { OwnerWorkspace } from "@/components/owner/OwnerWorkspace";
import { AccountGate } from "@/components/workspace/AccountGate";

export default function OwnerPage() {
  return (
    <AccountGate allow={["owner"]}>
      {(account) => <OwnerWorkspace account={account} />}
    </AccountGate>
  );
}

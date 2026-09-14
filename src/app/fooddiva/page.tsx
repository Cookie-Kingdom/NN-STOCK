"use client";

import { FoodDivaWorkspace } from "@/components/fooddiva/FoodDivaWorkspace";
import { AccountGate } from "@/components/workspace/AccountGate";

export default function FoodDivaPage() {
  return (
    <AccountGate allow={["fooddiva"]}>
      {(account) => <FoodDivaWorkspace account={account} />}
    </AccountGate>
  );
}

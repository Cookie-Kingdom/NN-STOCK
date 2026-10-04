"use client";

import { AccountingPage } from "@/components/organisms/owner/AccountingPage";
import { BranchStock } from "@/components/organisms/branch/BranchStock";
import { FinancePage } from "@/components/organisms/owner/FinancePage";
import { LotsPage } from "@/components/organisms/owner/LotsPage";
import { OverviewPage } from "@/components/organisms/owner/OverviewPage";
import { OwnerMeatStock } from "@/components/organisms/owner/OwnerMeatStock";
import { OwnerStock } from "@/components/organisms/owner/OwnerStock";
import { SettingsPage } from "@/components/organisms/owner/SettingsPage";
import { DailyLog } from "@/components/organisms/shared/DailyLog";
import { useWorkspace } from "@/components/organisms/workspace/useWorkspace";
import { WorkspaceShell } from "@/components/templates/WorkspaceShell";
import type { Account } from "@/lib/accounts";

/** The one workspace of every account: the shell, and the page of the tab in view. Which
 *  tabs an account has is `navFor` (nav.ts); a branch's Inventory is its own view. */
export function Workspace({ account }: { account: Account }) {
  const ws = useWorkspace(account);
  const Page = {
    overview: OverviewPage,
    log: DailyLog,
    lots: LotsPage,
    meatStock: OwnerMeatStock,
    stock: account.role === "branch" ? BranchStock : OwnerStock,
    finance: FinancePage,
    accounting: AccountingPage,
    settings: SettingsPage,
  }[ws.tab];
  return (
    <WorkspaceShell ws={ws}>
      <Page ws={ws} />
    </WorkspaceShell>
  );
}

"use client";

import { AccountingPage } from "@/components/organisms/owner/AccountingPage";
import { BranchSales } from "@/components/organisms/branch/BranchSales";
import {
  BranchMeatStock,
  BranchStock,
} from "@/components/organisms/branch/BranchStock";
import { FinancePage } from "@/components/organisms/owner/FinancePage";
import { LotsPage } from "@/components/organisms/owner/LotsPage";
import { OverviewPage } from "@/components/organisms/owner/OverviewPage";
import { ProjectOverviewPage } from "@/components/organisms/owner/ProjectOverviewPage";
import { OwnerMeatStock } from "@/components/organisms/owner/OwnerMeatStock";
import { OwnerStock } from "@/components/organisms/owner/OwnerStock";
import {
  ProjectSettingsPage,
  SettingsPage,
} from "@/components/organisms/owner/SettingsPage";
import { DailyLog } from "@/components/organisms/shared/DailyLog";
import { useWorkspace } from "@/components/organisms/workspace/useWorkspace";
import { WorkspaceShell } from "@/components/templates/WorkspaceShell";
import type { Account } from "@/lib/accounts";

/** The one workspace of every account: the shell, and the page of the tab in view. Which
 *  tabs an account has is `navFor` (nav.ts); a branch's Stock and
 *  Inventory are its own views, with the count inputs. */
export function Workspace({ account }: { account: Account }) {
  const ws = useWorkspace(account);
  const branch = account.role === "branch";
  const Page = {
    overview: OverviewPage,
    projectOverview: ProjectOverviewPage,
    log: DailyLog,
    lots: LotsPage,
    meatStock: branch ? BranchMeatStock : OwnerMeatStock,
    stock: branch ? BranchStock : OwnerStock,
    // A branch's only (`navFor`).
    sales: BranchSales,
    finance: FinancePage,
    accounting: AccountingPage,
    projectSettings: ProjectSettingsPage,
    settings: SettingsPage,
  }[ws.tab];
  return (
    <WorkspaceShell ws={ws}>
      <Page ws={ws} />
    </WorkspaceShell>
  );
}

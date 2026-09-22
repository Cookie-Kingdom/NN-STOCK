"use client";

import { useState } from "react";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { ChefLotTable } from "@/components/organisms/chef/ChefLotTable";
import { ChefReceiveTable } from "@/components/organisms/chef/ChefReceiveTable";
import { MeatStockTable } from "@/components/organisms/shared/MeatStockTable";
import { HistoryPanel } from "@/components/organisms/workspace/HistoryPanel";
import {
  noChefAlerts,
  useChefAlerts,
} from "@/components/organisms/chef/useChefAlerts";
import { WorkspaceShell } from "@/components/templates/WorkspaceShell";
import { useWorkspace } from "@/components/organisms/workspace/useWorkspace";
import type { Account } from "@/lib/accounts";
import { chefNav } from "@/lib/nav";

export function ChefWorkspace({ account }: { account: Account }) {
  const ws = useWorkspace(account);
  const { db, tab } = ws;
  const [showNotifications, setShowNotifications] = useState(false);
  // Before the payload lands the screen is still on the seed; no signal is read off it.
  const everyAlert = useChefAlerts(db);
  const alerts = ws.loaded ? everyAlert : noChefAlerts;

  return (
    <WorkspaceShell
      account={account}
      nav={chefNav}
      tab={tab}
      onTab={ws.setTab}
      date={ws.date}
      onDate={ws.setDate}
      badges={alerts.badges}
      notifications={alerts.notifications}
      showNotifications={showNotifications}
      onToggleNotifications={() => setShowNotifications((value) => !value)}
      loading={!ws.loaded}
      toast={ws.toast}
      onCloseToast={() => ws.setToast("")}
      ws={ws}
    >
      {tab === "cm-receive" && <ChefReceiveTable db={db} open={ws.open} />}
      {tab === "work" && <ChefLotTable db={db} lots={ws.lots} open={ws.open} />}
      {tab === "stock" && (
        <>
          <SectionHeading title="ความคืบหน้างานผลิต" />
          <MeatStockTable
            db={db}
            role={ws.role}
            branch={ws.branch}
            lots={ws.lots}
            open={ws.open}
          />
        </>
      )}
      {tab === "history" && (
        <HistoryPanel
          db={db}
          role={ws.role}
          branch={ws.branch}
          onChanged={ws.setToast}
        />
      )}
    </WorkspaceShell>
  );
}

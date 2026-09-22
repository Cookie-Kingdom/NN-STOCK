"use client";

import { useState } from "react";
import { FoodivaView } from "@/components/organisms/foodiva/FoodivaView";
import {
  noFoodivaAlerts,
  useFoodivaAlerts,
} from "@/components/organisms/foodiva/useFoodivaAlerts";
import { HistoryPanel } from "@/components/organisms/workspace/HistoryPanel";
import { WorkspaceShell } from "@/components/templates/WorkspaceShell";
import { useWorkspace } from "@/components/organisms/workspace/useWorkspace";
import type { Account } from "@/lib/accounts";
import { foodivaNav } from "@/lib/nav";

export function FoodivaWorkspace({ account }: { account: Account }) {
  const ws = useWorkspace(account);
  const { db, tab } = ws;
  const [showNotifications, setShowNotifications] = useState(false);

  // Invoices to issue, Requests to truck, Packing Lists to write, smoked meat to
  // take into the freezer. Held back until the server payload replaces the seed.
  const alerts = useFoodivaAlerts(db);
  const { badges, notifications } = ws.loaded ? alerts : noFoodivaAlerts;

  return (
    <WorkspaceShell
      account={account}
      nav={foodivaNav}
      tab={tab}
      onTab={ws.setTab}
      date={ws.date}
      onDate={ws.setDate}
      badges={badges}
      notifications={notifications}
      showNotifications={showNotifications}
      onToggleNotifications={() => setShowNotifications((value) => !value)}
      loading={!ws.loaded}
      toast={ws.toast}
      onCloseToast={() => ws.setToast("")}
      ws={ws}
    >
      {tab === "foodiva" && <FoodivaView db={db} open={ws.open} />}
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

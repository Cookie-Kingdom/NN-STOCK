"use client";

import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { startTransition, useOptimistic, useState } from "react";
import type { Account } from "@/lib/accounts";
import { today } from "@/lib/format";
import type { Modal, Tab } from "@/lib/nav";
import { useDatabase } from "@/lib/persistence";
import { entries, isClosed } from "@/lib/store";

/** State every workspace needs: the database, which day is being worked on,
 * which lots this account may see, and the open dialog. */
export function useWorkspace(account: Account) {
  const db = useDatabase();
  const router = useRouter();
  // The tab is the URL segment under the role's layout: /owner/po → "po".
  const segment = (useSelectedLayoutSegment() as Tab | null) ?? account.homeTab;
  /* The URL stays the source of truth, but the sidebar and the view switch on the
   * click's own frame instead of waiting for the route payload — every view is
   * already loaded, only the navigation was making them look slow. The optimistic
   * value reverts when the transition settles, by which time the segment matches. */
  const [tab, showTab] = useOptimistic(segment);
  const setTab = (next: Tab) =>
    startTransition(() => {
      showTab(next);
      router.push(`${account.path}/${next}`);
    });
  const [date, setDate] = useState(today);
  const [chosen, setChosen] = useState("");
  const [modal, setModal] = useState<Modal | null>(null);
  const [toast, setToast] = useState("");

  const branch = account.branch ?? db.config.branch;
  const role = account.role;
  const lots = db.lots.filter(
    (l) =>
      role === "owner" ||
      role === "foodiva" ||
      (role === "cm" &&
        (l.stage >= 2 || entries(db, "smokeOrder", l.id).length > 0)) ||
      (role === "branch" && entries(db, "allocate", l.id, branch).length > 0),
  );
  const lot = lots.find((l) => l.id === chosen) || lots[0];
  const open = (kind: string, lotId = lot?.id || "") =>
    setModal({ kind, lotId });
  const closed = isClosed(db, branch, date);

  return {
    db,
    role,
    branch,
    tab,
    setTab,
    date,
    setDate,
    chosen,
    setChosen,
    modal,
    setModal,
    toast,
    setToast,
    lots,
    lot,
    open,
    closed,
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;

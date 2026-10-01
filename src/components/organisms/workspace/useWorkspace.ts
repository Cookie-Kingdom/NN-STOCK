"use client";

import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { startTransition, useMemo, useOptimistic, useState } from "react";
import type { Account } from "@/lib/accounts";
import { today } from "@/lib/format";
import type { Modal, ModalKind, Tab } from "@/lib/nav";
import { useDatabase, useDatabaseLoaded } from "@/lib/persistence";
import { isClosed, visibleDatabase, visibleLots } from "@/lib/store";

/** State every workspace needs: the database, which day is being worked on,
 * which lots this account may see, and the open dialog. */
export function useWorkspace(account: Account) {
  const raw = useDatabase();
  const loaded = useDatabaseLoaded();
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
  // A toast stays until closed or until the page changes: a save never moves the user
  // to another page, so it belongs to the page it was made on.
  const [note, setNote] = useState({ message: "", page: segment });
  const setToast = (message: string) => setNote({ message, page: segment });
  const [seenPage, setSeenPage] = useState(segment);
  if (seenPage !== segment) {
    setSeenPage(segment);
    if (note.page !== segment) setNote({ message: "", page: segment });
  }
  const toast = note.page === segment ? note.message : "";

  const branch = account.branch ?? raw.config.branch;
  const role = account.role;
  // The Account Manager's screens read a copy without sales money; saves use latestDatabase().
  const hidesSales = !!account.hidesSales;
  const db = useMemo(() => visibleDatabase(raw, hidesSales), [raw, hidesSales]);
  // BR-07: a branch lists the batches allocated to it or holding its own entries.
  const lots = useMemo(
    () => (role === "branch" ? visibleLots(db, branch) : db.lots),
    [db, role, branch],
  );
  const lot = lots.find((l) => l.id === chosen) || lots[0];
  const open = (kind: ModalKind, lotId = lot?.id || "") =>
    setModal({ kind, lotId });
  const closed = isClosed(db, branch, date);

  return {
    db,
    loaded,
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

"use client";

import { usePathname, useRouter } from "next/navigation";
import { startTransition, useMemo, useOptimistic, useState } from "react";
import type { Account } from "@/lib/accounts";
import { today as bangkokToday } from "@/lib/format";
import { pagePath, tabAt, type Tab } from "@/lib/nav";
import { useDatabase, useDatabaseLoaded } from "@/lib/persistence";
import {
  todos,
  type Entry,
  type NoteKind,
  type Todo,
  type Values,
} from "@/lib/store";

/** What the composer opens on: a `kind` is that kind's form,
 *  started from the lot, date and values given; an `editId` is the edit of that entry. */
export type Draft = {
  kind?: NoteKind;
  lotId?: string;
  date?: string;
  values?: Values;
  editId?: string;
};

type ToastState = {
  /** Counts up with every toast, so the same message twice is shown twice. */
  id: number;
  message: string;
  tone?: "danger";
  undo?: () => void;
};

/** State every page of the workspace shares: the signed-in account, the database, the page
 *  in view, the composer's draft and the toast. */
export function useWorkspace(account: Account) {
  const db = useDatabase();
  const loaded = useDatabaseLoaded();
  const router = useRouter();
  const today = bangkokToday();
  // The page is the one at the URL: /owner/nn-x-lm/lots → "lots". One the account does not
  // have (a branch on Overview) is its home page instead.
  const page = tabAt(account, usePathname()) ?? account.homeTab;
  /* The URL stays the source of truth, but the menu and the page switch on the click's own
   * frame instead of waiting for the route payload. The optimistic value reverts when the
   * transition settles, by which time the segment matches. */
  const [tab, showTab] = useOptimistic(page);
  const [draft, setDraft] = useState<(Draft & { seq: number }) | null>(null);
  const [toast, show] = useState<ToastState>({ id: 0, message: "" });
  const [deleting, setDeleting] = useState<Entry | null>(null);
  // The PO the Lots (or Old Lots) page opens on when another page links to it (`showLot`).
  const [focusLot, setFocusLot] = useState("");
  const say = (next: Omit<ToastState, "id">) =>
    show((last) => ({ ...next, id: last.id + 1 }));
  /** Opens the composer on `preset.kind`'s form (or `preset.editId`'s edit). Each call
   *  is a fresh form (`seq`), so "save and jot another" starts empty. */
  const jot = (preset: Draft) =>
    setDraft((last) => ({ ...preset, seq: (last?.seq ?? 0) + 1 }));
  const setTab = (next: Tab) => {
    // A form and a toast belong to the page they were opened on.
    setDraft(null);
    say({ message: "" });
    setFocusLot("");
    startTransition(() => {
      showTab(next);
      router.push(pagePath(account, next));
    });
  };
  // Not while the seed stands in for the server payload: it would list a week of days.
  const list = useMemo(
    () => (loaded ? todos(db, account, today) : []),
    [db, account, today, loaded],
  );

  return {
    account,
    db,
    loaded,
    /** `YYYY-MM-DD`, Bangkok: what every derived function takes as `today`. */
    today,
    tab,
    setTab,
    focusLot,
    /** Goes to the Lots page (Old Lots, for an old one) with the PO (or Lot) `lotId` picked. */
    showLot: (lotId: string) => {
      setTab(
        db.lots.some((lot) => lot.id === lotId && lot.old) ? "oldLots" : "lots",
      );
      setFocusLot(lotId);
    },
    toast,
    /** The green toast of a save; `undo` adds the 「เลิกทำ」 button. "" closes it. */
    setToast: (message: string, undo?: () => void) => say({ message, undo }),
    /** The red toast of a change that was refused. */
    fail: (message: string) => say({ message, tone: "danger" }),
    draft,
    jot,
    /** Opens the composer on the edit of one entry. */
    edit: (editId: string) => jot({ editId }),
    closeDraft: () => setDraft(null),
    /** The note a 「ลบ」 is asking about: the composer shows its confirm. `null` closes it. */
    deleting,
    setDeleting,
    /** Everything yellow for this account: the todo box and the bell list it. */
    todos: list,
    /** What selecting a todo does: the form it names, the edit of its entry, or the Stock or Inventory page. */
    openTodo: (todo: Todo) => {
      if (todo.page) setTab(todo.page);
      else if (todo.editId) jot({ editId: todo.editId });
      else
        jot({
          kind: todo.kind,
          lotId: todo.lotId,
          date: todo.date,
          values: todo.category
            ? { category: todo.category }
            : todo.dispatchId
              ? { dispatchId: todo.dispatchId }
              : undefined,
        });
    },
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;

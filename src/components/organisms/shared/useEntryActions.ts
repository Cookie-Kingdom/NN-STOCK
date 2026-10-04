"use client";

import { useRef } from "react";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { today } from "@/lib/format";
import {
  latestDatabase,
  saveDatabase,
  saveDatabaseOrConflict,
} from "@/lib/persistence";
import { mutate, titles, type Entry } from "@/lib/store";

/** Delete and undo. 「ลบ」 asks first (the confirm the composer shows), and a delete is still
 *  put back by 「เลิกทำ」 on its toast or by the change log. A refusal by `mutate` is the red toast; one by the
 *  server is said by persistence (`DatabaseErrorToast`). */
export function useEntryActions(
  ws: Pick<Workspace, "account" | "setToast" | "fail" | "setDeleting">,
) {
  // The toast's undo outlives the row that was deleted, so no React state here.
  const busy = useRef(false);
  /** Saves a `void` naming `targetId` and resolves to its id, or "" when nothing was saved.
   *  After a revision conflict it is rebuilt once on the reloaded log. */
  async function saveVoid(targetId: string) {
    if (busy.current) return "";
    busy.current = true;
    try {
      const change = () =>
        mutate(latestDatabase(), ws.account, "void", { targetId }, "", today());
      let next = change();
      let result = await saveDatabaseOrConflict(next);
      if (result === "conflict") {
        next = change();
        result = (await saveDatabase(next)) ? "saved" : "failed";
      }
      return result === "saved" ? next.entries.at(-1)!.id : "";
    } catch (error) {
      ws.fail(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
      return "";
    } finally {
      busy.current = false;
    }
  }
  /** Undoes a change (an edit, or a delete: that puts the entry back), then says `done`. */
  const undo = async (changeId: string, done: string) => {
    if (await saveVoid(changeId)) ws.setToast(done);
  };
  /** Deletes an entry; its toast offers the undo. */
  const confirmRemove = async (entry: Entry) => {
    const title = titles[entry.kind];
    const voidId = await saveVoid(entry.id);
    if (voidId)
      ws.setToast(`ลบแล้ว: ${title}`, () =>
        undo(voidId, `กู้คืนแล้ว: ${title}`),
      );
  };
  /** What a 「ลบ」 button calls: opens the confirm on `entry`. */
  const remove = (entry: Entry) => ws.setDeleting(entry);
  return { remove, confirmRemove, undo };
}

// Story support for everything that takes a `ws`: the sample database as each account
// receives it, and a wrapper that runs the real useWorkspace on the mocked persistence.
import { useEffect, type ReactNode } from "react";
import { accountById, type AccountId } from "@/lib/accounts";
import { today } from "@/lib/format";
import { stripForManager } from "@/lib/manager-scope";
import { scopeDatabase } from "@/lib/role-scope";
import { liveEntries, mutate, type Database } from "@/lib/store";
import { sampleData } from "@/lib/store/demo";
import { useWorkspace, type Draft, type Workspace } from "./useWorkspace";

/** The approved sample, ending today: the Daily Log lists the last days before today. */
export const sampleDb = sampleData(today());

/** `db` as the server hands it to an account: whole for the Owner, without sale money and
 *  payroll for the Account Manager, only its own entries for a branch. */
export function dbFor(id: AccountId, db: Database = sampleDb): Database {
  const account = accountById(id)!;
  return account.role === "branch"
    ? scopeDatabase(db, [account.branch ?? ""])
    : account.hidesSales
      ? stripForManager(db)
      : db;
}

const owner = accountById("owner")!;
/** The sample with an edit, a delete, and a delete that was undone (the change log). */
export const changedDb = (() => {
  const find = (db: Database, kind: string) =>
    liveEntries(db).find((e) => e.kind === kind)!;
  let db = mutate(
    sampleDb,
    owner,
    "entryEdit",
    {
      targetId: find(sampleDb, "smoked").id,
      values: JSON.stringify({ smokedKg: "105", note: "ชั่งใหม่" }),
    },
    "",
    today(),
  );
  for (const kind of ["influencerBox", "meatCount"])
    db = mutate(
      db,
      owner,
      "void",
      { targetId: find(db, kind).id },
      "",
      today(),
    );
  return mutate(
    db,
    owner,
    "void",
    { targetId: db.entries.at(-1)!.id },
    "",
    today(),
  );
})();

/** Renders `children` with the workspace of `account`. `open` starts the composer on a
 *  draft, as a press on a button would. The story's `parameters.db` (or `db` arg) is the
 *  database; use `dbFor(account)`. */
export function WithWorkspace({
  account = "owner",
  open,
  children,
}: {
  account?: AccountId;
  open?: Draft;
  children: (ws: Workspace) => ReactNode;
}) {
  const ws = useWorkspace(accountById(account)!);
  const { jot } = ws;
  useEffect(() => {
    if (open) jot(open);
    // Once, on mount: `open` is the story's fixed starting point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children(ws)}</>;
}

/** Spread into a story to show it at 390px, where the layout changes. */
export const phone = {
  parameters: {
    viewport: {
      options: {
        phone: { name: "390px", styles: { width: "390px", height: "844px" } },
      },
    },
  },
  globals: { viewport: { value: "phone", isRotated: false } },
};

/** Spread into a story to show it at 1920px, where a page lays its parts out side by side. */
export const wide = {
  parameters: {
    viewport: {
      options: {
        wide: { name: "1920px", styles: { width: "1920px", height: "1080px" } },
      },
    },
  },
  globals: { viewport: { value: "wide", isRotated: false } },
};

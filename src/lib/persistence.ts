"use client";
import { useSyncExternalStore } from "react";
import { branches, seed, type Database, type Entry } from "./store";
import { LOCAL_DB, localAccountId } from "./local-db";
import { createClient } from "./supabase/browser";
import { appendDelta, type AppendDelta } from "./app-state-delta";

type StoredDatabase = Partial<Database>;
type AppStateRow = { payload: StoredDatabase; revision: number };
type RowResult = {
  data: AppStateRow | null;
  error: { message: string } | null;
};
/* save_app_state returns the new revision and nothing else: shipping the payload back
 * only to read one number off it was a large slice of every save (migration 0017). */
type SaveResult = {
  data: { revision: number } | null;
  error: { message: string; code?: string } | null;
};
const supabase = LOCAL_DB ? null : createClient();
const listeners = new Set<() => void>();
let revision: number | null = null;
let writeQueue = Promise.resolve();
let pendingWrites = 0;
/* Bumped by every save. A background load that sees it change while its read was in flight
 * drops the result: adopting it would swap the optimistic change out of the cache and the
 * pending save's base (revision, stored history) out from under it (review COR-02). */
let writeCount = 0;

/* One malformed entry (`values: null`, a missing id) would throw in every helper that walks
 * the log, for every role, and the log is append-only. Such entries stay out of the cache
 * and are reported; the payload sent back still carries them untouched (see `stored`). */
const wellFormed = (entry: Entry) =>
  Boolean(entry) &&
  typeof entry.id === "string" &&
  typeof entry.kind === "string" &&
  typeof entry.date === "string" &&
  Boolean(entry.values) &&
  typeof entry.values === "object";

/* v8 (shipment flow) started from an empty log (migration 0019), so there is nothing older to
 * convert: any other version reads as the seed. */
function normalize(
  parsed: StoredDatabase | null,
  fallback: Database,
): Database {
  if (
    !parsed ||
    parsed.version !== 8 ||
    !Array.isArray(parsed.entries) ||
    !Array.isArray(parsed.lots)
  )
    return fallback;
  const config = parsed.config || seed.config;
  const entries = parsed.entries.filter(wellFormed);
  if (entries.length !== parsed.entries.length)
    reportError(
      `พบรายการที่ข้อมูลไม่สมบูรณ์ ${parsed.entries.length - entries.length} รายการ ระบบซ่อนไว้ก่อน กรุณาแจ้งผู้ดูแลระบบ`,
    );
  return {
    version: 8,
    lots: parsed.lots,
    entries,
    config: {
      ...seed.config,
      ...config,
      branch: branches.includes(config.branch || "")
        ? config.branch
        : seed.config.branch,
    },
  };
}

const initialDatabase = seed;
export const demoInitialDatabase = initialDatabase;
let cached = initialDatabase;
/* ponytail: server history is append-only; send it back untouched. normalize() rewrites
 * the loaded config (seed defaults filled in), so a save rebuilds the payload
 * from the stored entries/config plus only what was appended locally since the load.
 * `count` is how many normalized entries the stored ones became, `lastId` the last of them. */
let stored: {
  payload: StoredDatabase;
  count: number;
  lastId?: string;
  config: Database["config"];
} | null = null;
function adopt(payload: StoredDatabase, rev: number) {
  // Client and server out of step (a deploy ahead of its migration): say so instead of
  // quietly showing an empty system that refuses every save.
  if (payload?.version !== 8)
    reportError(
      "ข้อมูลบนเซิร์ฟเวอร์เป็นเวอร์ชันที่แอปนี้ไม่รองรับ ระบบจะแสดงข้อมูลว่างและบันทึกไม่ได้ กรุณาแจ้งผู้ดูแลระบบ",
    );
  cached = normalize(payload, initialDatabase);
  /* A pre-v8 payload reads as empty but is not history to build on: with nothing stored, the
   * next save sends the whole database and the server refuses it until the reset migration runs. */
  stored =
    payload?.version === 8
      ? {
          payload,
          count: cached.entries.length,
          lastId: cached.entries.at(-1)?.id,
          config: cached.config,
        }
      : null;
  revision = rev;
  loaded = true;
  notify();
}
/* The cache starts on the seed database, so anything derived from it before the
 * first payload lands is demo data wearing the user's colours. */
let loaded = false;
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Shown by DatabaseErrorToast in every workspace. */
function reportError(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("database-error", { detail: message }));
}
/** POST/GET /api/local-db, shaped like a Supabase result. */
async function localRequest(init?: RequestInit): Promise<RowResult> {
  try {
    const response = await fetch("/api/local-db", init);
    const body = await response.json();
    return response.ok
      ? { data: body, error: null }
      : { data: null, error: { message: body.message } };
  } catch (error) {
    return { data: null, error: { message: (error as Error).message } };
  }
}
/* supabase-js has no request timeout, and every save waits in writeQueue behind the one
 * before it: a request that never settles (stalled fetch, auth session read that never
 * resolves) would leave every later save unsent with no message until a reload. */
const REQUEST_TIMEOUT_MS = 20_000;
function withTimeout<
  T extends { data: unknown; error: { message: string } | null },
>(request: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(
      () =>
        resolve({
          data: null,
          error: { message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ทันเวลา กรุณาลองใหม่" },
        } as T),
      REQUEST_TIMEOUT_MS,
    );
  });
  return Promise.race([Promise.resolve(request), timeout]).finally(() =>
    clearTimeout(timer),
  );
}
function readRow(): Promise<RowResult> {
  if (!supabase) return localRequest();
  /* load_app_state, not a select on app_state: the server strips sale money from the Account
   * Manager's copy (migration 0021), which has no direct read on the table. */
  return withTimeout(
    supabase.rpc("load_app_state").then(({ data, error }) => ({
      data: (data as AppStateRow[] | null)?.[0] ?? null,
      error,
    })),
  );
}
function saveRow(
  payload: Database,
  expectedRevision: number | null,
): Promise<SaveResult> {
  if (!supabase)
    return localRequest({
      method: "POST",
      body: JSON.stringify({ payload, expectedRevision }),
    });
  return withTimeout(
    supabase
      .rpc("save_app_state", {
        p_payload: payload,
        p_expected_revision: expectedRevision,
      })
      .then(({ data, error }) => ({
        data: (data as { revision: number }[] | null)?.[0] ?? null,
        error,
      })),
  );
}
function appendRow(
  delta: AppendDelta,
  expectedRevision: number | null,
): Promise<SaveResult> {
  if (!supabase)
    return localRequest({
      method: "POST",
      body: JSON.stringify({ delta, expectedRevision }),
    });
  return withTimeout(
    supabase
      .rpc("append_entries", {
        p_expected_revision: expectedRevision,
        p_entries: delta.entries,
        p_lots: delta.lots,
      })
      .then(({ data, error }) => ({
        data: data == null ? null : { revision: Number(data) },
        error,
      })),
  );
}
/** Resolves to whether the server payload replaced the cache. `background` loads (sign-in,
 * poll) give way to any save made while they were reading; a save's own reload does not. */
async function loadDatabase(background = false): Promise<boolean> {
  const writesBefore = writeCount;
  const { data, error } = await readRow();
  if (background && (pendingWrites || writeCount !== writesBefore))
    return false;
  if (error) {
    reportError(`โหลดข้อมูลไม่สำเร็จ · ${error.message}`);
    return false;
  }
  if (!data) {
    const created = await saveRow(initialDatabase, null);
    const row = created.data;
    if (created.error) {
      reportError(`สร้างข้อมูลเริ่มต้นไม่สำเร็จ · ${created.error.message}`);
      return false;
    }
    // The save no longer echoes the payload; what the server holds is what we just sent.
    if (row) adopt(initialDatabase, row.revision);
    return Boolean(row);
  }
  adopt(data.payload, data.revision);
  return true;
}

function onAuthEvent(event: string) {
  // Deferred: Supabase warns that calling the client inside onAuthStateChange can deadlock.
  // A save in flight reloads on its own; adopting now would swap its optimistic change out
  // of the cache and its base (revision, stored history) out from under it.
  if (event === "SIGNED_IN")
    setTimeout(() => {
      if (!pendingWrites) void loadDatabase(true);
    }, 0);
  if (event === "SIGNED_OUT") {
    cached = initialDatabase;
    stored = null;
    revision = null;
    loaded = false;
    notify();
  }
}
if (supabase) {
  void supabase.auth.getSession().then(({ data }) => {
    if (data.session) void loadDatabase(true);
  });
  supabase.auth.onAuthStateChange(onAuthEvent);
} else if (typeof window !== "undefined") {
  // session.ts dispatches these in local mode.
  window.addEventListener("local-auth", (event) =>
    onAuthEvent((event as CustomEvent<string>).detail),
  );
  if (localAccountId()) void loadDatabase(true);
}

/** Reloads when someone else saved since our load. Reads only `revision`, not the payload.
 * ponytail: poll ทุก 15 วิ, เปลี่ยนเป็น realtime ถ้า payload เล็กลง */
export async function checkForUpdates() {
  if (
    !loaded ||
    pendingWrites ||
    (typeof document !== "undefined" && document.hidden)
  )
    return;
  const { data } = supabase
    ? await withTimeout(
        supabase.rpc("app_state_revision").then(({ data, error }) => ({
          data: data == null ? null : { revision: Number(data) },
          error,
        })),
      )
    : await localRequest();
  // A failed poll stays quiet; the next one (or a save) reports a real outage.
  if (data && data.revision !== revision && !pendingWrites)
    await loadDatabase(true);
}
if (typeof window !== "undefined") {
  setInterval(() => void checkForUpdates(), 15_000);
  document.addEventListener("visibilitychange", () => void checkForUpdates());
}

/** False until the server payload has replaced the seed. Anything that tells the
 * user someone is waiting on them should stay quiet until this is true. */
export function useDatabaseLoaded() {
  return useSyncExternalStore(subscribe, databaseLoaded, () => false);
}
export function useDatabase() {
  return useSyncExternalStore(
    subscribe,
    () => cached,
    () => initialDatabase,
  );
}
/** Optimistic: the cache updates at once. Resolves to whether the server took the write. */
export function saveDatabase(db: Database): Promise<boolean> {
  return writeDatabase(db, false).then((result) => result === "saved");
}
/** Like saveDatabase, but when someone else saved first (stale revision) the server copy is
 * reloaded without an error toast and this resolves "conflict", so the caller can rebuild its
 * change on the fresh data and save again. */
export function saveDatabaseOrConflict(db: Database) {
  return writeDatabase(db, true);
}
let actor: Entry["actor"];
/** session.ts sets this from the signed-in account; each entry saved after that carries it. */
export function setSaveActor(next: Entry["actor"]) {
  actor = next;
}
/* Branch, Foodiva and Chef House load only their role-scoped copy (load_app_state, migration
 * 0028), so they cannot send the whole payload back: their saves go to append_entries with just
 * the new entries and changed lots. The Owner and the Account Manager keep save_app_state. */
let appendOnly = false;
/** session.ts sets this from the signed-in account's role (true for every role but "owner"). */
export function setSaveAppendOnly(next: boolean) {
  appendOnly = next;
}
/* save_app_state raises the stale revision as PT409 (HTTP 409), never 40001: PostgREST retries
 * 40001 forever (migration 0022). The local API sends only the message. A save built on a
 * history that a reload has since replaced comes back as "Existing history cannot be
 * changed/removed" (42501): the same situation, so the same quiet reload and rebuild. */
const isConflict = (error: { message: string; code?: string }) =>
  error.code === "PT409" ||
  error.message.includes("State changed on another device") ||
  /Existing history cannot be (changed|removed)/.test(error.message);
function writeDatabase(
  db: Database,
  quietConflict: boolean,
): Promise<"saved" | "conflict" | "failed"> {
  const before = { cached, stored };
  writeCount++;
  // Only splice when `db` continues the loaded history; a wholesale reset goes out as is.
  const continues =
    stored &&
    db.entries.length >= stored.count &&
    db.entries[stored.count - 1]?.id === stored.lastId;
  const added = continues ? db.entries.slice(stored!.count) : [];
  // The bytes are dropped below; a caller that skipped saveAttachment would lose the file.
  if (
    added.some(
      (entry) =>
        entry.values.attachmentData && !entry.values.attachmentStorageKey,
    )
  )
    reportError(
      "ไฟล์แนบยังไม่ได้อัปโหลด ระบบบันทึกรายการโดยไม่มีไฟล์ กรุณาแนบไฟล์ใหม่",
    );
  const strip = (entry: Entry, index: number): Entry => ({
    ...entry,
    // Entries appended since the load are this account's: stamp the Account Manager's.
    ...(actor && continues && index >= stored!.count ? { actor } : {}),
    values: Object.fromEntries(
      Object.entries(entry.values).filter(([key]) => key !== "attachmentData"),
    ),
  });
  cached = { ...db, entries: db.entries.map(strip) };
  const portable: Database =
    !continues || !stored
      ? cached
      : {
          ...db,
          entries: [
            ...(stored.payload.entries ?? []),
            ...cached.entries.slice(stored.count),
          ],
          config:
            JSON.stringify(db.config) === JSON.stringify(stored.config)
              ? (stored.payload.config ?? db.config)
              : db.config,
        };
  const delta = appendOnly
    ? appendDelta(stored?.payload ?? {}, portable)
    : null;
  stored = {
    payload: portable,
    count: db.entries.length,
    lastId: db.entries.at(-1)?.id,
    config: db.config,
  };
  const mine = cached;
  notify();
  pendingWrites++;
  const saved = writeQueue
    .then(async () => {
      const { data: row, error } = delta
        ? await appendRow(delta, revision)
        : await saveRow(portable, revision);
      if (error) {
        if (await loadDatabase()) {
          /* A timeout or dropped connection says nothing about the server: the save may
           * have committed after we stopped waiting. If every entry it added is in the log
           * just reloaded, it did, and reporting a failure would get it entered twice. */
          const landed = new Set(cached.entries.map((entry) => entry.id));
          if (added.length && added.every((entry) => landed.has(entry.id)))
            return "saved" as const;
          if (isConflict(error)) {
            if (quietConflict) return "conflict" as const;
            reportError(
              "มีการบันทึกจากเครื่องอื่นก่อน โหลดข้อมูลล่าสุดแล้ว กรุณาตรวจสอบแล้วบันทึกอีกครั้ง",
            );
            return "failed" as const;
          }
          reportError(
            `บันทึกไม่สำเร็จ โหลดข้อมูลล่าสุดแล้ว · ${error.message}`,
          );
          return "failed" as const;
        }
        // The server copy could not be read (offline): drop the unsaved change so a retry
        // does not send it twice. ponytail: skipped when a later save already built on it.
        if (cached === mine) {
          ({ cached, stored } = before);
          notify();
        }
        reportError(
          `บันทึกไม่สำเร็จ ยังไม่ได้บันทึกรายการนี้ · ${error.message}`,
        );
        return "failed" as const;
      }
      if (row) revision = row.revision;
      return "saved" as const;
    })
    .finally(() => {
      pendingWrites--;
    });
  writeQueue = saved.then(() => undefined);
  return saved;
}
export function latestDatabase() {
  return cached;
}
export function databaseLoaded() {
  return loaded;
}

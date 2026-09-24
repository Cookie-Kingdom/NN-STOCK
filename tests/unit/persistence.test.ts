import { beforeEach, expect, test, vi } from "vitest";
import {
  checkForUpdates,
  databaseLoaded,
  latestDatabase,
  saveDatabase,
  setSaveActor,
  setSaveAppendOnly,
} from "@/lib/persistence";
import { seed, type Database, type Entry, type Values } from "@/lib/store";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
  authEvent: (() => {}) as (event: string) => void,
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    /* Reads go through load_app_state / app_state_revision (the server strips sale money for
     * the Account Manager); `maybeSingle` stands for the one app_state row they read. */
    rpc: async (name: string, args?: unknown) => {
      if (name === "load_app_state") {
        const result = await mocks.maybeSingle();
        return { ...result, data: result?.data ? [result.data] : [] };
      }
      if (name === "app_state_revision") {
        const result = await mocks.maybeSingle();
        return { ...result, data: result?.data?.revision ?? null };
      }
      return mocks.rpc(name, args);
    },
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: (callback: (event: string) => void) => {
        mocks.authEvent = callback;
      },
    },
  }),
}));

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const entry = (values: Values, kind = "sale"): Entry => ({
  id: crypto.randomUUID(),
  kind,
  role: "branch",
  lotId: "",
  branch: "ศาลาแดง",
  date: "2026-09-09",
  at: "",
  values,
});
async function signInWithRow(row: unknown) {
  mocks.maybeSingle.mockResolvedValueOnce({ data: row, error: null });
  mocks.authEvent("SIGNED_IN");
  await settle();
}

beforeEach(() => {
  mocks.maybeSingle.mockReset();
  mocks.rpc.mockReset();
  mocks.authEvent("SIGNED_OUT");
});

test("nothing counts as loaded until a payload has landed", async () => {
  expect(databaseLoaded()).toBe(false);
  await signInWithRow({ revision: 1, payload: seed });
  expect(databaseLoaded()).toBe(true);
  mocks.authEvent("SIGNED_OUT");
  expect(databaseLoaded()).toBe(false);
});

test("loading a v8 payload keeps its history and fills missing settings from the seed", async () => {
  const sale = entry({ boxes: "2" });
  await signInWithRow({
    revision: 3,
    payload: {
      version: 8,
      lots: [
        {
          id: "S1",
          poId: "SH-1",
          kind: "shipment",
          stage: 6,
          values: {},
          config: {},
        },
      ],
      config: { branch: "ปิดสาขาแล้ว", boxPrice: "999" },
      entries: [sale],
    },
  });
  const db = latestDatabase();
  expect(db.version).toBe(8);
  expect(db.entries).toEqual([sale]);
  expect(db.lots[0].kind).toBe("shipment");
  expect(db.config).toEqual({ ...seed.config, boxPrice: "999" });
});

test("a payload from before v8 falls back to the seed", async () => {
  await signInWithRow({
    revision: 1,
    payload: { version: 8, lots: [], entries: [entry({ boxes: "1" })] },
  });
  expect(latestDatabase().entries).toHaveLength(1);
  await signInWithRow({
    revision: 2,
    payload: { version: 7, lots: [], entries: [entry({ boxes: "1" })] },
  });
  expect(latestDatabase()).toBe(seed);
});

test("a save on top of a pre-v8 payload sends the whole database, so the server refuses it", async () => {
  const old = entry({ boxes: "1" });
  await signInWithRow({
    revision: 4,
    payload: { version: 7, lots: [], entries: [old] },
  });
  mocks.rpc.mockResolvedValueOnce({ data: [{ revision: 5 }], error: null });
  const added = entry({ boxes: "2" });
  await saveDatabase({ ...latestDatabase(), entries: [added] });
  // Not spliced onto the v7 history: without `old` the append-only guard rejects it.
  expect(mocks.rpc.mock.lastCall![1].p_payload).toMatchObject({
    version: 8,
    entries: [added],
  });
});

test("the first sign-in creates the row from the seed", async () => {
  mocks.rpc.mockResolvedValueOnce({
    data: [{ payload: seed, revision: 1 }],
    error: null,
  });
  await signInWithRow(null);
  expect(mocks.rpc).toHaveBeenCalledWith("save_app_state", {
    p_payload: seed,
    p_expected_revision: null,
  });
});

test("saving strips attachment bytes, updates the cache first and sends the known revision", async () => {
  await signInWithRow({ revision: 7, payload: seed });
  mocks.rpc.mockResolvedValueOnce({ data: [{ revision: 8 }], error: null });
  mocks.rpc.mockResolvedValueOnce({ data: [{ revision: 9 }], error: null });
  const db: Database = {
    ...seed,
    entries: [
      entry({
        attachment: "inv.pdf",
        attachmentData: "data:application/pdf;base64,AA==",
      }),
    ],
  };
  const saved = saveDatabase(db);
  expect(latestDatabase().entries[0].values).toEqual({ attachment: "inv.pdf" });
  await settle();
  await expect(saved).resolves.toBe(true);
  expect(mocks.rpc).toHaveBeenLastCalledWith("save_app_state", {
    p_payload: latestDatabase(),
    p_expected_revision: 7,
  });
  saveDatabase(db);
  await settle();
  expect(mocks.rpc).toHaveBeenLastCalledWith(
    "save_app_state",
    expect.objectContaining({ p_expected_revision: 8 }),
  );
});

test("saving sends the stored history back untouched and appends only the new entries", async () => {
  const smoke = entry({ inputKg: "5", postSmokeKg: "4" }, "smoke");
  const config = { branch: "ศาลาแดง", boxPrice: "999" };
  const payload = { version: 8, lots: [], entries: [smoke], config };
  await signInWithRow({ revision: 4, payload });
  const db = latestDatabase();
  expect(db.config).toEqual({ ...seed.config, boxPrice: "999" });
  mocks.rpc.mockResolvedValueOnce({ data: [{ revision: 5 }], error: null });
  const added = entry({ boxes: "1", attachmentData: "data:x" });
  await expect(
    saveDatabase({ ...db, entries: [...db.entries, added] }),
  ).resolves.toBe(true);
  expect(latestDatabase().entries.map((item) => item.values)).toEqual([
    smoke.values,
    { boxes: "1" },
  ]);
  // The stored config goes back as it was, not with the seed defaults normalize() filled in.
  expect(mocks.rpc).toHaveBeenLastCalledWith("save_app_state", {
    p_payload: expect.objectContaining({
      entries: [smoke, { ...added, values: { boxes: "1" } }],
      config,
    }),
    p_expected_revision: 4,
  });
});

test("a non-owner save sends only its new entries and changed lots to append_entries", async () => {
  const old = entry({ boxes: "2" });
  const lot = { id: "S1", poId: "SH-1", stage: 2, values: {}, config: {} };
  const other = { ...lot, id: "S2", poId: "SH-2" };
  await signInWithRow({
    revision: 7,
    payload: { version: 8, lots: [lot, other], entries: [old], config: {} },
  });
  mocks.rpc.mockResolvedValueOnce({ data: 8, error: null });
  const added = entry({ boxes: "1", attachmentData: "data:x" });
  const moved = { ...lot, stage: 3, values: { receivedKg: "49" } };
  setSaveAppendOnly(true);
  try {
    await expect(
      saveDatabase({
        ...latestDatabase(),
        lots: [moved, other],
        entries: [...latestDatabase().entries, added],
      }),
    ).resolves.toBe(true);
  } finally {
    setSaveAppendOnly(false);
  }
  expect(mocks.rpc).toHaveBeenLastCalledWith("append_entries", {
    p_expected_revision: 7,
    p_entries: [{ ...added, values: { boxes: "1" } }],
    p_lots: [moved],
  });
  // The next save builds on the revision append_entries returned.
  mocks.rpc.mockResolvedValueOnce({ data: [{ revision: 9 }], error: null });
  await saveDatabase(latestDatabase());
  expect(mocks.rpc).toHaveBeenLastCalledWith(
    "save_app_state",
    expect.objectContaining({ p_expected_revision: 8 }),
  );
});

test("the Account Manager's new entries are stamped with its actor, older ones are not", async () => {
  const old = { ...entry({ boxes: "2" }), role: "owner" as const };
  await signInWithRow({
    revision: 4,
    payload: { version: 8, lots: [], entries: [old], config: seed.config },
  });
  mocks.rpc.mockResolvedValue({ data: [{ revision: 5 }], error: null });
  const added = { ...entry({ boxes: "1" }), role: "owner" as const };
  setSaveActor("manager");
  try {
    await saveDatabase({
      ...latestDatabase(),
      entries: [...latestDatabase().entries, added],
    });
  } finally {
    setSaveActor(undefined);
  }
  expect(latestDatabase().entries.map((e) => e.actor)).toEqual([
    undefined,
    "manager",
  ]);
  expect(mocks.rpc).toHaveBeenLastCalledWith("save_app_state", {
    p_payload: expect.objectContaining({
      entries: [old, { ...added, actor: "manager" }],
    }),
    p_expected_revision: 4,
  });
});

test("a failed save reloads from the server and reports the error", async () => {
  const events = new EventTarget();
  vi.stubGlobal("window", events);
  const detail = new Promise((resolve) =>
    events.addEventListener("database-error", (event) =>
      resolve((event as CustomEvent).detail),
    ),
  );
  mocks.rpc.mockResolvedValueOnce({
    data: null,
    error: { message: "revision conflict" },
  });
  mocks.maybeSingle.mockResolvedValueOnce({
    data: { revision: 5, payload: seed },
    error: null,
  });
  const saved = saveDatabase(seed);
  await expect(detail).resolves.toMatch(/บันทึกไม่สำเร็จ.*revision conflict/);
  await expect(saved).resolves.toBe(false);
  expect(mocks.maybeSingle).toHaveBeenCalledTimes(1);
});

test("a failed save that cannot reload rolls the cache back, so a retry does not duplicate", async () => {
  const events = new EventTarget();
  vi.stubGlobal("window", events);
  const messages: string[] = [];
  events.addEventListener("database-error", (event) =>
    messages.push((event as CustomEvent).detail),
  );
  await signInWithRow({ revision: 1, payload: seed });
  const before = latestDatabase();
  mocks.rpc.mockResolvedValueOnce({
    data: null,
    error: { message: "Failed to fetch" },
  });
  mocks.maybeSingle.mockResolvedValueOnce({
    data: null,
    error: { message: "Failed to fetch" },
  });
  const next = {
    ...before,
    entries: [...before.entries, entry({ boxes: "1" })],
  };
  const saved = saveDatabase(next);
  expect(latestDatabase().entries).toHaveLength(next.entries.length);
  await expect(saved).resolves.toBe(false);
  expect(latestDatabase()).toBe(before);
  expect(messages.at(-1)).toMatch(
    /บันทึกไม่สำเร็จ ยังไม่ได้บันทึก.*Failed to fetch/,
  );
  expect(messages.at(-1)).not.toMatch(/โหลดข้อมูลล่าสุดแล้ว/);

  mocks.rpc.mockResolvedValueOnce({
    data: [{ revision: 2, payload: next }],
    error: null,
  });
  await expect(saveDatabase(next)).resolves.toBe(true);
  expect(mocks.rpc.mock.lastCall![1].p_payload.entries).toHaveLength(
    next.entries.length,
  );
});

test("a failed load reports the error instead of silently showing seed data", async () => {
  const events = new EventTarget();
  vi.stubGlobal("window", events);
  const detail = new Promise((resolve) =>
    events.addEventListener("database-error", (event) =>
      resolve((event as CustomEvent).detail),
    ),
  );
  mocks.maybeSingle.mockResolvedValueOnce({
    data: null,
    error: { message: "permission denied" },
  });
  mocks.authEvent("SIGNED_IN");
  await expect(detail).resolves.toMatch(
    /โหลดข้อมูลไม่สำเร็จ.*permission denied/,
  );
});

test("the revision poll reloads only when someone else saved", async () => {
  await checkForUpdates();
  expect(mocks.maybeSingle).not.toHaveBeenCalled(); // signed out: nothing to poll
  await signInWithRow({ revision: 3, payload: seed });
  mocks.maybeSingle.mockResolvedValueOnce({
    data: { revision: 3 },
    error: null,
  });
  await checkForUpdates();
  expect(mocks.maybeSingle).toHaveBeenCalledTimes(2);
  const packed = { ...seed, entries: [entry({ total: "1" })] };
  mocks.maybeSingle.mockResolvedValueOnce({
    data: { revision: 4 },
    error: null,
  });
  mocks.maybeSingle.mockResolvedValueOnce({
    data: { revision: 4, payload: packed },
    error: null,
  });
  await checkForUpdates();
  expect(latestDatabase().entries).toHaveLength(1);
});

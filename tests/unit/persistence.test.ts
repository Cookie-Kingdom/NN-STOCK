import { beforeEach, expect, test, vi } from "vitest";
import {
  databaseLoaded,
  latestDatabase,
  migrateLegacyAttachments,
  saveDatabase,
} from "@/lib/persistence";
import { seed, type Database, type Entry, type Values } from "@/lib/store";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
  saveLegacyDataUrl: vi.fn(),
  authEvent: (() => {}) as (event: string) => void,
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
    }),
    rpc: mocks.rpc,
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: (callback: (event: string) => void) => {
        mocks.authEvent = callback;
      },
    },
  }),
}));
vi.mock("@/lib/attachment-store", () => ({
  saveLegacyDataUrl: mocks.saveLegacyDataUrl,
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
  mocks.saveLegacyDataUrl.mockReset();
  mocks.authEvent("SIGNED_OUT");
});

test("nothing counts as loaded until a payload has landed", async () => {
  expect(databaseLoaded()).toBe(false);
  await signInWithRow({ revision: 1, payload: seed });
  expect(databaseLoaded()).toBe(true);
  mocks.authEvent("SIGNED_OUT");
  expect(databaseLoaded()).toBe(false);
});

test("loading migrates an older payload into the current shape", async () => {
  await signInWithRow({
    revision: 3,
    payload: {
      version: 5,
      lots: [],
      config: { branch: "ปิดสาขาแล้ว", boxPrice: "999", brinePrice: "3" },
      entries: [
        entry({}, "brinePurchase"),
        entry({ brineMl: "1", material: "ถุงซิปข้าว", boxes: "2" }),
      ],
    },
  });
  const db = latestDatabase();
  expect(db.version).toBe(7);
  expect(db.entries.map((item) => item.values)).toEqual([
    { material: "ถุงซีลข้าว", boxes: "2" },
  ]);
  expect(db.config).toEqual({ ...seed.config, boxPrice: "999" });
});

test("an unsupported payload falls back to the seed", async () => {
  await signInWithRow({
    revision: 1,
    payload: { version: 5, lots: [], entries: [entry({ boxes: "1" })] },
  });
  expect(latestDatabase().entries).toHaveLength(1);
  await signInWithRow({
    revision: 2,
    payload: { version: 2, lots: [], entries: [] },
  });
  expect(latestDatabase()).toBe(seed);
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

test("legacy inline attachments move to the attachment store", async () => {
  mocks.saveLegacyDataUrl.mockResolvedValue("key-1");
  const legacy = entry({
    attachment: "inv.pdf",
    attachmentData: "data:application/pdf;base64,AA==",
  });
  const stored = entry({
    attachmentData: "data:x",
    attachmentStorageKey: "key-0",
  });
  const next = await migrateLegacyAttachments({
    ...seed,
    entries: [legacy, stored],
  });
  expect(mocks.saveLegacyDataUrl).toHaveBeenCalledTimes(1);
  expect(mocks.saveLegacyDataUrl).toHaveBeenCalledWith(
    "data:application/pdf;base64,AA==",
    "inv.pdf",
  );
  expect(next.entries[0].values).toEqual({
    attachment: "inv.pdf",
    attachmentStorageKey: "key-1",
  });
  expect(next.entries[1]).toBe(stored);
  const clean: Database = { ...seed, entries: [entry({ boxes: "1" })] };
  expect(await migrateLegacyAttachments(clean)).toBe(clean);
});

import { beforeEach, expect, test, vi } from "vitest";
import { signIn, switchAccount, type SavedAccount } from "@/lib/session";

/* The Supabase path of the saved accounts. A user's id is its email; its tokens are
 * `access-<id>` / `refresh-<id>`. session.ts reads `window` at import, so the stand-ins for it
 * are made in the hoisted block. */
const mocks = vi.hoisted(() => {
  const storage = new Map<string, string>();
  Object.assign(globalThis, {
    window: {
      addEventListener() {},
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
  });
  return {
    storage,
    user: null as string | null,
    setSession: vi.fn(),
    signOut: vi.fn(),
    authEvent: (() => {}) as (event: string, session: unknown) => void,
  };
});
const sessionOf = (user: string) => ({
  user: { id: user },
  access_token: `access-${user}`,
  refresh_token: `refresh-${user}`,
});

vi.mock("@/lib/persistence", () => ({
  resetDatabase: () => {},
  setSaveAppendOnly: () => {},
}));
vi.mock("@supabase/supabase-js", () => ({
  isAuthRetryableFetchError: () => false,
}));
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      limit: () => query,
      single: async () => ({
        data: {
          display_name: "",
          role: mocks.user === "owner" ? "L1_OWNER" : "L2_BRANCH_ADMIN",
          is_active: true,
        },
        error: null,
      }),
      maybeSingle: async () => ({
        data: { locations: { name_th: "มีนบุรี" } },
        error: null,
      }),
    };
    return {
      from: () => query,
      auth: {
        getUser: async () => ({
          data: { user: mocks.user && { id: mocks.user } },
          error: null,
        }),
        getSession: async () => ({
          data: { session: mocks.user && sessionOf(mocks.user) },
        }),
        signInWithPassword: async ({ email }: { email: string }) => {
          mocks.user = email;
          return { error: null };
        },
        setSession: mocks.setSession,
        signOut: mocks.signOut,
        onAuthStateChange: (callback: typeof mocks.authEvent) => {
          mocks.authEvent = callback;
        },
      },
    };
  },
}));

const saved = (): SavedAccount[] =>
  JSON.parse(mocks.storage.get("saved-accounts") ?? "[]");

beforeEach(async () => {
  mocks.storage.clear();
  mocks.setSession.mockReset();
  mocks.signOut.mockReset();
  await signIn("owner", "");
  await signIn("minburi", "");
});

test("each account that signs in is saved with its own tokens", () => {
  expect(saved()).toEqual([
    {
      id: "owner",
      name: "Owner",
      userId: "owner",
      access_token: "access-owner",
      refresh_token: "refresh-owner",
    },
    {
      id: "minburi",
      name: "สาขามีนบุรี",
      userId: "minburi",
      access_token: "access-minburi",
      refresh_token: "refresh-minburi",
    },
  ]);
});

test("switching opens the saved session of the target and signs nobody out", async () => {
  mocks.setSession.mockImplementation(async () => {
    mocks.user = "owner";
    return { error: null };
  });
  expect(await switchAccount("owner")).toBe("");
  expect(mocks.setSession).toHaveBeenCalledWith({
    access_token: "access-owner",
    refresh_token: "refresh-owner",
  });
  expect(mocks.signOut).not.toHaveBeenCalled();
  expect(saved().map((a) => a.id)).toEqual(["owner", "minburi"]);
});

test("an auth event with a new session rotates that user's saved tokens", () => {
  mocks.authEvent("TOKEN_REFRESHED", {
    user: { id: "owner" },
    access_token: "access-2",
    refresh_token: "refresh-2",
  });
  expect(saved()).toMatchObject([
    { id: "owner", access_token: "access-2", refresh_token: "refresh-2" },
    { id: "minburi", refresh_token: "refresh-minburi" },
  ]);
});

test("a saved session that no longer works is forgotten, with a message", async () => {
  mocks.setSession.mockResolvedValue({ error: new Error("expired") });
  expect(await switchAccount("owner")).toMatch("หมดอายุ");
  expect(saved().map((a) => a.id)).toEqual(["minburi"]);
});

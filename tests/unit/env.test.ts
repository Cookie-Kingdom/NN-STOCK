import { expect, test, vi } from "vitest";

const load = () => {
  vi.resetModules();
  return import("@/lib/supabase/env");
};

test("reads both public Supabase settings", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  const env = await load();
  expect(env.SUPABASE_URL).toBe("https://example.supabase.co");
  expect(env.SUPABASE_PUBLISHABLE_KEY).toBe("sb_publishable_test");
});

test("throws at import when a setting is missing", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  await expect(load()).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
});

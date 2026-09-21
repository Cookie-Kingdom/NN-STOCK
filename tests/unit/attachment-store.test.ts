import { beforeEach, describe, expect, it, vi } from "vitest";

const bucket = { list: vi.fn(), download: vi.fn() };
vi.mock("@/lib/local-db", () => ({ LOCAL_DB: false }));
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({ storage: { from: () => bucket } }),
}));

import { getAttachment } from "@/lib/attachment-store";

// Node has no IndexedDB, which is exactly the "no local copy / broken cache" case.
describe("getAttachment", () => {
  beforeEach(() => {
    bucket.list.mockReset();
    bucket.download.mockReset();
  });

  it("still asks the bucket when IndexedDB is unavailable", async () => {
    const blob = new Blob(["invoice"]);
    bucket.list.mockResolvedValue({ data: [{ name: "INV.pdf" }], error: null });
    bucket.download.mockResolvedValue({ data: blob, error: null });
    await expect(getAttachment("key")).resolves.toMatchObject({
      name: "INV.pdf",
      blob,
    });
    expect(bucket.download).toHaveBeenCalledWith("key/INV.pdf");
  });

  it("returns nothing for a key with no object, so the button reports a missing file", async () => {
    bucket.list.mockResolvedValue({ data: [], error: null });
    await expect(getAttachment("key")).resolves.toBeUndefined();
  });

  it("throws a Thai message when the bucket cannot be read", async () => {
    bucket.list.mockResolvedValue({
      data: null,
      error: { message: "Bucket not found" },
    });
    await expect(getAttachment("key")).rejects.toThrow(
      "เปิดที่เก็บไฟล์ไม่สำเร็จ: Bucket not found",
    );
  });
});

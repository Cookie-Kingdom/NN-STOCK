import { expect, test, vi } from "vitest";
import { accountById, type AccountId } from "@/lib/accounts";
import { exportWorkspaceData } from "@/lib/export-data";
import { seed, type Database, type Entry } from "@/lib/store";

const sale = (branch: string, values: Entry["values"]): Entry => ({
  id: crypto.randomUUID(),
  kind: "sale",
  role: "branch",
  lotId: "",
  branch,
  date: "2026-09-09",
  at: "",
  values,
});
const sala = sale("ศาลาแดง", { boxes: "1", meatCost: "50" });
const db: Database = {
  ...seed,
  entries: [sala, sale("มีนบุรี", { boxes: "2" })],
};

async function exportFor(id: AccountId) {
  const link = { href: "", download: "", click: vi.fn() };
  vi.stubGlobal("document", { createElement: () => link });
  const create = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValue("blob:export");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  exportWorkspaceData(db, accountById(id)!, "2026-09-15");
  expect(link.click).toHaveBeenCalledOnce();
  expect(revoke).toHaveBeenCalledWith("blob:export");
  const blob = create.mock.calls[0][0] as Blob;
  return { file: link.download, data: JSON.parse(await blob.text()) };
}

test("the owner downloads the whole database", async () => {
  const { file, data } = await exportFor("owner");
  expect(file).toBe("nerdnuea-owner-2026-09-15.json");
  expect(data).toEqual(db);
});

test("a branch downloads only its own entries without cost fields", async () => {
  const { file, data } = await exportFor("saladaeng");
  expect(file).toBe("nerdnuea-saladaeng-2026-09-15.json");
  expect(data).toEqual({
    account: "saladaeng",
    branch: "ศาลาแดง",
    entries: [{ ...sala, values: { boxes: "1" } }],
  });
});

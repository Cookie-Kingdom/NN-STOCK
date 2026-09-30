import { expect, test } from "vitest";
import { fmt } from "@/lib/format";
import { centralStock, check } from "@/lib/store";
import { expectWarning, last, legacyAllocate, ready } from "./fixtures";

// Soft quantity limits: an amount over stock is only a warning (real stock drifts, the
// system is a record), and it still says the most the system expected.
test("a thaw over frozen stock warns with the maximum and still saves", () => {
  const s = ready();
  s.run("branch", "receive", { kg: "5" });
  const result = s.check("branch", "thaw", { kg: "6" });
  expect(result).toEqual({
    warnings: ["สต๊อกแช่แข็งไม่พอ · กรอกได้สูงสุด 5.00 กก."],
    error: "",
  });
  s.run("branch", "thaw", { kg: "6" });
  expect(last(s).values.kg).toBe("6");
});

test("a branch receive over central stock names the most left (BR-02)", () => {
  const s = ready();
  expectWarning(
    s.check("branch", "receive", { kg: "99999" }),
    /สต๊อกกลางไม่พอ · กรอกได้สูงสุด [\d,.]+ กก\./,
  );
});

test("a new Owner allocation is refused: the kind is retired (RET-04)", () => {
  const s = ready();
  expect(
    s.check("owner", "allocate", { branch: "ศาลาแดง", kg: "5" }).error,
  ).toBe("รายการชนิดนี้เลิกใช้แล้ว");
});

test("a straight receive filling a fully allocated batch does not warn about central stock (DM-08)", () => {
  const s = ready();
  const lotId = s.db.lots.at(-1)!.id;
  const all = centralStock(s.db, lotId);
  // Old data: an allocation from before they were retired.
  legacyAllocate(s, { branch: "ศาลาแดง", kg: String(all) }, lotId);
  expect(centralStock(s.db, lotId)).toBe(0);
  const warnings = (kg: number) =>
    s.check("branch", "receive", { kg: String(kg) }, lotId).warnings;
  expect(warnings(all).filter((w) => w.includes("สต๊อกกลางไม่พอ"))).toEqual([]);
  expectWarning(
    s.check("branch", "receive", { kg: String(all + 1) }, lotId),
    new RegExp(
      `สต๊อกกลางไม่พอ · กรอกได้สูงสุด ${fmt(all).replace(".", "\\.")} กก\\.`,
    ),
  );
});

test("check returns the refusal, dedupes warnings and leaves no collector behind", () => {
  const s = ready();
  // A hard rule still refuses: a typed negative kg.
  expect(s.check("branch", "receive", { kg: "-1" })).toEqual({
    warnings: [],
    error: "กรอกน้ำหนักรับเป็นตัวเลขมากกว่าศูนย์",
  });
  // The same warning twice (nested checks included) is said once, by the outer check only.
  const over = { kg: "99999" };
  const lotId = s.db.lots.at(-1)!.id;
  let inner: string[] = [];
  const outer = check(() => {
    s.check("branch", "receive", over, lotId);
    inner = s.check("branch", "receive", over, lotId).warnings;
    s.run("branch", "receive", over, lotId);
    s.run("branch", "receive", over, lotId);
  });
  expect(inner).toHaveLength(1);
  expect(outer.error).toBe("");
  expect(outer.warnings).toHaveLength(2);
  // Outside a check a warning is dropped, not thrown.
  expect(() => s.run("branch", "receive", over, lotId)).not.toThrow();
  // A thrown non-Error is still reported.
  expect(
    check(() => {
      throw "boom";
    }),
  ).toEqual({ warnings: [], error: "boom" });
});

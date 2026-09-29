import { expect, test } from "vitest";
import { fmt } from "@/lib/format";
import { centralStock, check } from "@/lib/store";
import { expectWarning, last, ready } from "./fixtures";

// Soft quantity limits: an amount over stock is only a warning (real stock drifts, the
// system is a record), and it still says the most the system expected.
test("a thaw over frozen stock warns with the maximum and still saves", () => {
  const s = ready();
  s.run("owner", "allocate", { branch: "ศาลาแดง", kg: "5" });
  s.run("branch", "receive", { kg: "5", allocation: last(s).id });
  const result = s.check("branch", "thaw", { kg: "6" });
  expect(result).toEqual({
    warnings: ["สต๊อกแช่แข็งไม่พอ · กรอกได้สูงสุด 5.00 กก."],
    error: "",
  });
  s.run("branch", "thaw", { kg: "6" });
  expect(last(s).values.kg).toBe("6");
});

test("an allocation over central stock names the most left", () => {
  const s = ready();
  expectWarning(
    s.check("owner", "allocate", { branch: "ศาลาแดง", kg: "99999" }),
    /สต๊อกกลางไม่พอ · กรอกได้สูงสุด [\d,.]+ กก\./,
  );
});

test("a straight receive filling a fully allocated batch does not warn about central stock (DM-08)", () => {
  const s = ready();
  const lotId = s.db.lots.at(-1)!.id;
  const all = centralStock(s.db, lotId);
  s.run("owner", "allocate", { branch: "ศาลาแดง", kg: String(all) }, lotId);
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
  // A hard rule still refuses: a blank kg is not a number.
  expect(s.check("owner", "allocate", { branch: "ศาลาแดง", kg: "" })).toEqual({
    warnings: [],
    error: "กรอกน้ำหนักจัดสรรเป็นตัวเลขมากกว่าศูนย์",
  });
  // The same warning twice (nested checks included) is said once, by the outer check only.
  const over = { branch: "ศาลาแดง", kg: "99999" };
  const lotId = s.db.lots.at(-1)!.id;
  let inner: string[] = [];
  const outer = check(() => {
    s.check("owner", "allocate", over, lotId);
    inner = s.check("owner", "allocate", over, lotId).warnings;
    s.run("owner", "allocate", over, lotId);
    s.run("owner", "allocate", over, lotId);
  });
  expect(inner).toHaveLength(1);
  expect(outer.error).toBe("");
  expect(outer.warnings).toHaveLength(2);
  // Outside a check a warning is dropped, not thrown.
  expect(() => s.run("owner", "allocate", over, lotId)).not.toThrow();
  // A thrown non-Error is still reported.
  expect(
    check(() => {
      throw "boom";
    }),
  ).toEqual({ warnings: [], error: "boom" });
});

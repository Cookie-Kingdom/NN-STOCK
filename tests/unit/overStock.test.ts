import { expect, test } from "vitest";
import { OverStockError } from "@/lib/store";
import { last, ready } from "./fixtures";

// C1: an amount over stock is its own error (forms show it before the rest is filled)
// and says the most that may be typed.
test("a thaw over frozen stock is an OverStockError that states the maximum", () => {
  const s = ready();
  s.run("owner", "allocate", { branch: "ศาลาแดง", kg: "5" });
  s.run("branch", "receive", { kg: "5", allocation: last(s).id });
  let caught: unknown;
  try {
    // Only the kg: the over-stock check runs before the bag count is asked for.
    s.run("branch", "thaw", { kg: "6" });
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(OverStockError);
  expect((caught as Error).message).toBe(
    "สต๊อกแช่แข็งไม่พอ · กรอกได้สูงสุด 5.00 กก.",
  );
});

test("an allocation over central stock names the most left", () => {
  const s = ready();
  expect(() =>
    s.run("owner", "allocate", { branch: "ศาลาแดง", kg: "99999" }),
  ).toThrow(/สต๊อกกลางไม่พอ · กรอกได้สูงสุด [\d,.]+ กก\./);
});

import { expect, test } from "vitest";
import { fmt } from "@/lib/format";
import { allocationOutstanding, pendingReceiveKg } from "@/lib/store";
import { last, ready } from "./fixtures";

test("allocation kg with extra decimals: the shown 0.01 figure is accepted and clears it", () => {
  const s = ready();
  const id = s.db.lots.at(-1)!.id;
  s.run("owner", "allocate", { branch: "ศาลาแดง", kg: "8.326667" });
  const first = last(s);
  expect(fmt(allocationOutstanding(s.db, first))).toBe("8.33");
  expect(allocationOutstanding(s.db, first)).toBe(8.33);
  s.run("branch", "receive", { kg: "8.33", allocation: first.id });
  expect(allocationOutstanding(s.db, first)).toBe(0);

  s.run("owner", "allocate", { branch: "ศาลาแดง", kg: "5.006667" });
  const second = last(s);
  expect(allocationOutstanding(s.db, second)).toBe(5.01);
  s.run("branch", "receive", {
    kg: "5",
    allocation: second.id,
    reason: "ตาชั่ง",
  });
  // 0.01 short: still pending until the rest arrives.
  expect(pendingReceiveKg(s.db, id, "ศาลาแดง")).toBe(0.01);
  s.run("branch", "receive", { kg: "0.01", allocation: second.id });
  expect(pendingReceiveKg(s.db, id, "ศาลาแดง")).toBe(0);
});

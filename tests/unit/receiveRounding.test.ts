import { expect, test } from "vitest";
import { fmt } from "@/lib/format";
import { allocationOutstanding, pendingReceiveKg } from "@/lib/store";
import { last, ready } from "./fixtures";

test("pro-rated allocation kg: the shown 0.01 figure is accepted and a bag-complete residue is not pending", () => {
  const s = ready();
  const id = s.db.lots[0].id;
  s.run("owner", "allocate", { branch: "ศาลาแดง", kg: "8.326667", bags: "4" });
  const first = last(s);
  expect(fmt(allocationOutstanding(s.db, first).kg)).toBe("8.33");
  expect(allocationOutstanding(s.db, first).kg).toBe(8.33);
  s.run("branch", "receive", { kg: "8.33", bags: "4", allocation: first.id });
  expect(allocationOutstanding(s.db, first)).toEqual({ kg: 0, bags: 0 });

  s.run("owner", "allocate", { branch: "ศาลาแดง", kg: "5.006667", bags: "2" });
  const second = last(s);
  expect(allocationOutstanding(s.db, second).kg).toBe(5.01);
  // 0.01 under the shown figure, all bags in: the lot no longer waits to be received.
  s.run("branch", "receive", {
    kg: "5",
    bags: "2",
    allocation: second.id,
    reason: "ตาชั่ง",
  });
  expect(pendingReceiveKg(s.db, id, "ศาลาแดง")).toBe(0);
});

test("fmt never prints negative zero from float residue", () => {
  expect(fmt(10 - 9.64 - 0.36)).toBe("0.00");
  expect(fmt(-0.004)).toBe("0.00");
});

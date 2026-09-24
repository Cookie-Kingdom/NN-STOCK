import { describe, expect, test } from "vitest";
import {
  balance,
  editDecisions,
  editRequestRows,
  entries,
  entryEdits,
  materials,
  mutate,
  openEditRequest,
  revenue,
  visibleEntries,
} from "@/lib/store";
import { chillDay, day, last } from "./fixtures";

/** ศาลาแดง's `day` (65.5 kg sold of 70 thawed) with the day closed. */
function closedDay() {
  const s = chillDay();
  const sale = last(s);
  s.run(
    "branch",
    "materials",
    Object.fromEntries(materials.map((_, i) => [`material${i}`, "10"])),
  );
  s.run("branch", "riceCarry", {
    leftoverKg: "0",
    reheat: "เก็บไว้อุ่นวันถัดไป",
  });
  s.run("branch", "closeDay", { confirm: "ผู้ดูแล" });
  return { s, sale, lotId: sale.lotId };
}
const fix = { soldKg: "60", lineMan: "190000" };

describe("B5 edit requests", () => {
  test("branch requests an edit to a closed-day sale, owner approves, stock and revenue use it", () => {
    const { s, sale, lotId } = closedDay();
    expect(() => s.run("branch", "sale", { soldKg: "1" })).toThrow(
      "ปิดยอดแล้ว",
    );
    const db = s.run("branch", "editRequest", {
      targetId: sale.id,
      values: JSON.stringify(fix),
      reason: "พิมพ์ยอดผิด",
    });
    const request = last(s);
    expect(openEditRequest(db, sale.id)?.id).toBe(request.id);
    // Nothing changes until approved.
    expect(balance(db, lotId, "ศาลาแดง").ready).toBeCloseTo(4.5);
    expect(() =>
      s.run("branch", "editRequest", {
        targetId: sale.id,
        values: JSON.stringify(fix),
        reason: "อีกครั้ง",
      }),
    ).toThrow("รอพิจารณา");

    const approved = s.run("owner", "editDecision", {
      requestId: request.id,
      decision: editDecisions.approve,
    });
    expect(balance(approved, lotId, "ศาลาแดง").ready).toBeCloseTo(10);
    expect(revenue(approved)).toBe(190000);
    expect(entries(approved, "sale")[0].values.soldKg).toBe("60");
    expect(entryEdits(approved, sale.id)).toHaveLength(1);
    expect(editRequestRows(approved)[0].decision?.values.decision).toBe(
      editDecisions.approve,
    );
    // The branch sees its request and the decision; the owner-only meat cost is stripped.
    const mine = visibleEntries(approved, "branch", "ศาลาแดง");
    const decision = mine.find((e) => e.kind === "editDecision");
    expect(decision).toBeDefined();
    expect(decision!.values["to.meatCost"]).toBeUndefined();
    expect(
      visibleEntries(approved, "branch", "มีนบุรี").some(
        (e) => e.kind === "editDecision",
      ),
    ).toBe(false);
  });

  test("a rejected request leaves the values", () => {
    const { s, sale, lotId } = closedDay();
    s.run("branch", "editRequest", {
      targetId: sale.id,
      values: JSON.stringify(fix),
      reason: "พิมพ์ยอดผิด",
    });
    const requestId = last(s).id;
    expect(() =>
      s.run("owner", "editDecision", {
        requestId,
        decision: editDecisions.reject,
      }),
    ).toThrow("เหตุผล");
    const db = s.run("owner", "editDecision", {
      requestId,
      decision: editDecisions.reject,
      note: "ยอดถูกแล้ว",
    });
    expect(balance(db, lotId, "ศาลาแดง").ready).toBeCloseTo(4.5);
    expect(revenue(db)).toBe(209600);
    expect(openEditRequest(db, sale.id)).toBeUndefined();
  });

  test("a branch cannot request an edit of another branch's entry", () => {
    const { s, sale } = closedDay();
    expect(() =>
      mutate(
        s.db,
        "branch",
        "editRequest",
        { targetId: sale.id, values: JSON.stringify(fix), reason: "x" },
        "",
        day,
        "มีนบุรี",
      ),
    ).toThrow("เฉพาะรายการของบัญชีนี้");
    // Nor edit directly: that is for approvers.
    expect(() =>
      s.run("branch", "entryEdit", {
        targetId: sale.id,
        values: JSON.stringify(fix),
        reason: "x",
      }),
    ).toThrow("ไม่มีสิทธิ์");
  });

  test("owner edits directly, reason required", () => {
    const { s, sale, lotId } = closedDay();
    expect(() =>
      s.run("owner", "entryEdit", {
        targetId: sale.id,
        values: JSON.stringify(fix),
      }),
    ).toThrow("เหตุผล");
    const db = s.run("owner", "entryEdit", {
      targetId: sale.id,
      values: JSON.stringify(fix),
      reason: "แก้ตามใบเสร็จ",
    });
    expect(balance(db, lotId, "ศาลาแดง").ready).toBeCloseTo(10);
    expect(last(s).values["from.soldKg"]).toBe("65.5");
    expect(last(s).values["to.soldKg"]).toBe("60");
  });

  test("a correction that would leave stock negative is refused", () => {
    const { s, lotId } = closedDay();
    const thaw = entries(s.db, "thaw", lotId)[0];
    // 50 kg thawed cannot cover the 65.5 kg already sold.
    expect(() =>
      s.run("owner", "entryEdit", {
        targetId: thaw.id,
        values: JSON.stringify({ kg: "50" }),
        reason: "x",
      }),
    ).toThrow("ติดลบ");
    // The sale's own rule: more than was thawed.
    const sale = entries(s.db, "sale", lotId)[0];
    expect(() =>
      s.run("owner", "entryEdit", {
        targetId: sale.id,
        values: JSON.stringify({ soldKg: "80" }),
        reason: "x",
      }),
    ).toThrow("เกินเนื้อที่ละลายแล้ว");
  });
});

test("a void appended under a non-owner role is ignored", () => {
  const { s, sale } = closedDay();
  const forged = {
    ...sale,
    id: `${sale.id}-forged-void`,
    kind: "void" as const,
    values: { targetId: sale.id, reason: "x" },
  };
  const db = { ...s.db, entries: [...s.db.entries, forged] };
  expect(entries(db, "sale").some((e) => e.id === sale.id)).toBe(true);
});

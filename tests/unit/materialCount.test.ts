import { expect, test } from "vitest";
import {
  materialCountDraft,
  materialOverStock,
  savedMaterialCount,
} from "@/components/organisms/branch/materialCount";
import { branchMaterialStock, materials, seed, type Values } from "@/lib/store";
import { day, setup, type Setup } from "./fixtures";

const branch = "ศาลาแดง";

/** One day's count, built the way the table builds it: `used` of the first material
 *  and `actual` left on the shelf, every other row untouched. */
const count = (s: Setup, used: string, actual: string, reason = ""): Values =>
  Object.fromEntries(
    materials.flatMap((_, i) => {
      const opening = branchMaterialStock(s.db, branch, i, day);
      return [
        ["opening" + i, String(opening)],
        ["used" + i, i === 0 ? used : "0"],
        ["material" + i, i === 0 ? actual : String(opening)],
        ["materialReason" + i, i === 0 ? reason : ""],
      ];
    }),
  );

/** ศาลาแดง with the first material on the shelf and nothing counted yet. */
function stocked(): Setup {
  const s = setup(branch);
  s.run("owner", "materialReceive", {
    purchaseDate: day,
    material: materials[0],
    quantity: "200",
    unitPrice: "3",
    supplier: "ร้านวัสดุ",
  });
  s.run("owner", "materialTransfer", {
    material: materials[0],
    branch,
    quantity: "60",
    receiver: "ผู้ดูแลสาขา",
  });
  // The transfer only reaches the shelf once the branch confirms what arrived.
  s.run("branch", "materialConfirm", {
    transferId: s.db.entries.at(-1)!.id,
    receivedQuantity: "60",
    receiver: "ผู้ดูแลสาขา",
  });
  return s;
}

test("an uncounted day has no saved entry and drafts a blank count", () => {
  expect(
    savedMaterialCount(structuredClone(seed), branch, day),
  ).toBeUndefined();
  const draft = materialCountDraft(undefined);
  expect(draft.used0).toBe("0");
  // Empty, so the box keeps following ยอดที่ควรเหลือ as ใช้วันนี้ is typed.
  expect(draft.actual0).toBe("");
  expect(draft.materialReason0).toBe("");
  expect(draft.correctionReason).toBe("");
});

test("the draft is seeded from the saved entry, not from what was typed", () => {
  const s = stocked();
  s.run("branch", "materials", count(s, "4", "55", "หายไป 1 ชิ้น"));
  const saved = savedMaterialCount(s.db, branch, day);
  expect(saved).toBeDefined();
  const draft = materialCountDraft(saved);
  expect(draft.used0).toBe("4");
  expect(draft.actual0).toBe("55");
  expect(draft.materialReason0).toBe("หายไป 1 ชิ้น");
  // A correction reason is asked again on every re-save, never carried over.
  expect(draft.correctionReason).toBe("");
});

test("the newest entry of the day wins, so a re-save is what the table shows", () => {
  const s = stocked();
  s.run("branch", "materials", count(s, "4", "56"));
  s.run("branch", "materials", {
    ...count(s, "6", "54"),
    correctionReason: "กรอกตัวเลขผิด",
  });
  const draft = materialCountDraft(savedMaterialCount(s.db, branch, day));
  expect(draft.used0).toBe("6");
  expect(draft.actual0).toBe("54");
});

test("over-stock is reported on the row, with the most that can be entered", () => {
  expect(materialOverStock(60, 4)).toBe("");
  expect(materialOverStock(60, 60)).toBe("");
  expect(materialOverStock(60, 61)).toBe(
    "ใช้เกินยอดตั้งต้น · กรอกได้สูงสุด 60",
  );
  // Nothing on the shelf: the row still names a number rather than a negative one.
  expect(materialOverStock(-2, 1)).toBe("ใช้เกินยอดตั้งต้น · กรอกได้สูงสุด 0");
});

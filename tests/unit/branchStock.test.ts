import { expect, test } from "vitest";
import {
  branchStockRows,
  type BranchStockRow,
} from "@/components/organisms/branch/BranchStockView";
import { materials } from "@/lib/store";
import { legacyAllocate, ready } from "./fixtures";

const meatRows = (rows: BranchStockRow[]) =>
  rows.filter((row) => row.genre === "เนื้อ");

test("a Lot with an old allocation still waiting to be received keeps a row at 0 กก.", () => {
  const s = ready();
  // Old data: allocations are retired (BR-01), their pending kg still shows.
  legacyAllocate(s, { branch: "ศาลาแดง", kg: "20" });
  const rows = branchStockRows(s.db, "ศาลาแดง", s.db.lots);
  const meat = meatRows(rows);
  expect(meat).toHaveLength(1);
  expect(meat[0].quantity).toBe("0.00");
  expect(meat[0].detail).toContain("รอรับเข้าสาขา 20.00 กก.");
});

test("once received the row reads the branch's own balance", () => {
  const s = ready();
  s.run("branch", "receive", { kg: "20" });
  const meat = meatRows(branchStockRows(s.db, "ศาลาแดง", s.db.lots));
  expect(meat[0].quantity).toBe("20.00");
  expect(meat[0].detail).toBe("แช่แข็ง 20.00 · ชิล/ละลายแล้ว 0.00");

  s.run("branch", "thaw", { kg: "5" });
  const thawed = meatRows(branchStockRows(s.db, "ศาลาแดง", s.db.lots));
  expect(thawed[0].quantity).toBe("20.00");
  expect(thawed[0].detail).toBe("แช่แข็ง 15.00 · ชิล/ละลายแล้ว 5.00");
});

test("another branch's Lot never shows, and the fixed rows always do", () => {
  const s = ready();
  s.run("branch", "receive", { kg: "20" });
  const rows = branchStockRows(s.db, "มีนบุรี", s.db.lots);
  expect(meatRows(rows)).toEqual([]);
  // Raw rice, cooked rice and chili (Minburi can self-cook too) plus one row per material.
  expect(rows).toHaveLength(3 + materials.length);
  expect(rows.filter((row) => row.genre === "วัสดุบรรจุภัณฑ์")).toHaveLength(
    materials.length,
  );
  expect(new Set(rows.map((row) => row.genre))).toEqual(
    new Set(["วัตถุดิบ", "วัสดุบรรจุภัณฑ์"]),
  );
});

test("chili and material the branch wrote down as received are its stock (STK-43, MAT-01)", () => {
  const s = ready();
  s.run("branch", "chiliReceive", { chiliTubes: "30", receiver: "นิด" }, "");
  s.run(
    "branch",
    "materialConfirm",
    { material: materials[0], receivedQuantity: "50", receiver: "นิด" },
    "",
  );
  const row = (branch: string, item: string) =>
    branchStockRows(s.db, branch, s.db.lots).find((r) => r.item === item)!;
  expect(row("ศาลาแดง", "น้ำพริกหลอด")).toMatchObject({
    quantity: "30.00",
    detail: "รับเข้า 30.00 หลอด · ตัดสต๊อกแล้ว 0.00 หลอด",
  });
  expect(row("ศาลาแดง", materials[0]).quantity).toBe("50.00");
  // One branch's receipt is not the other's stock.
  expect(row("มีนบุรี", "น้ำพริกหลอด").quantity).toBe("0.00");
  expect(row("มีนบุรี", materials[0]).quantity).toBe("0.00");
});

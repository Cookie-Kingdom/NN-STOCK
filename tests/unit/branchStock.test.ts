import { expect, test } from "vitest";
import {
  branchStockRows,
  type BranchStockRow,
} from "@/components/organisms/branch/BranchStockView";
import { materials } from "@/lib/store";
import { day, last, ready } from "./fixtures";

/** 35 kg at central stock, `kg` of it allocated to ศาลาแดง. */
function allocated(kg: string) {
  const s = ready();
  s.run("owner", "allocate", { branch: "ศาลาแดง", kg, deliveryDate: day });
  return s;
}

const meatRows = (rows: BranchStockRow[]) =>
  rows.filter((row) => row.genre === "เนื้อ");

test("a Lot still waiting to be received keeps a row at 0 กก.", () => {
  const s = allocated("20");
  const rows = branchStockRows(s.db, "ศาลาแดง", s.db.lots);
  const meat = meatRows(rows);
  expect(meat).toHaveLength(1);
  expect(meat[0].quantity).toBe("0.00");
  expect(meat[0].detail).toContain("รอรับเข้าสาขา 20.00 กก.");
});

test("once received the row reads the branch's own balance", () => {
  const s = allocated("20");
  s.run("branch", "receive", { kg: "20", allocation: last(s).id });
  const meat = meatRows(branchStockRows(s.db, "ศาลาแดง", s.db.lots));
  expect(meat[0].quantity).toBe("20.00");
  expect(meat[0].detail).toBe("แช่แข็ง 20.00 · ชิล/ละลายแล้ว 0.00");

  s.run("branch", "thaw", { kg: "5" });
  const thawed = meatRows(branchStockRows(s.db, "ศาลาแดง", s.db.lots));
  expect(thawed[0].quantity).toBe("20.00");
  expect(thawed[0].detail).toBe("แช่แข็ง 15.00 · ชิล/ละลายแล้ว 5.00");
});

test("another branch's Lot never shows, and the fixed rows always do", () => {
  const s = allocated("20");
  s.run("branch", "receive", { kg: "20", allocation: last(s).id });
  const rows = branchStockRows(s.db, "มีนบุรี", s.db.lots);
  expect(meatRows(rows)).toEqual([]);
  // 3 วัตถุดิบ rows plus one row per material, and nothing else.
  expect(rows).toHaveLength(3 + materials.length);
  expect(rows.filter((row) => row.genre === "วัสดุบรรจุภัณฑ์")).toHaveLength(
    materials.length,
  );
  expect(new Set(rows.map((row) => row.genre))).toEqual(
    new Set(["วัตถุดิบ", "วัสดุบรรจุภัณฑ์"]),
  );
});

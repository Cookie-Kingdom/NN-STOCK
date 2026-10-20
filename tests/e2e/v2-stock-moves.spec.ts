import { expect, test, type Page } from "@playwright/test";
import {
  fill,
  jot,
  openPage,
  region,
  save,
  sheetCell,
  signInAs,
  start,
  toast,
} from "./helpers";

/* จัดสรรสินค้า (`transfer`) of a material, not meat: from the project's central warehouse to a
 * branch that must confirm it (`transferReceive`); on its way it is in neither place. */

const item = "ถุงหิ้วพลาสติกใส 12x20";
/** The item's cells on the Owner's Inventory: SKU, รายการ, ประเภท, รายละเอียด, คลังกลาง,
 *  สาขาศาลาแดง, สาขามีนบุรี, ระหว่างส่ง, … */
const ownerRow = async (page: Page) => {
  await openPage(page, "Inventory");
  await page.getByRole("main").getByRole("searchbox").fill(item);
  return region(page, "รายการทั้งหมด")
    .getByRole("row", { name: new RegExp(`^SKU-0023 ${item}`) })
    .getByRole("cell");
};

test("V2-CAL-10 the Owner sends a material from the central warehouse to a branch to confirm: it is on its way until the branch confirms it on its Inventory", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Inventory");
  await jot(page, "จัดสรรสินค้า");
  await fill(
    page,
    [/^รายการ/, item],
    [/^คลังปลายทาง/, "สาขาศาลาแดง"],
    [/^จำนวน/, "5"],
    [/^การรับของ/, "รอสาขายืนยันรับ"],
  );
  await save(page);
  let cells = await ownerRow(page);
  // It leaves the central warehouse at once (nothing is refused below zero).
  await expect(cells.nth(4)).toHaveText(/^-5/);
  await expect(cells.nth(5)).toHaveText(/^0 ห่อ/);
  await expect(cells.nth(7)).toHaveText("5");

  await signInAs(page, "saladaeng");
  await openPage(page, "Inventory");
  const waiting = region(page, "รอยืนยันรับสินค้า");
  await expect(waiting).toContainText(item);
  await expect(sheetCell(page, "คงเหลือ", item)).toHaveText(/^0 ห่อ/);
  await waiting.getByRole("button", { name: `ยืนยันรับ ${item}` }).click();
  await expect(toast(page, `ยืนยันรับสินค้า · ${item} 5`)).toBeVisible();
  await expect(waiting).toHaveCount(0);
  await expect(sheetCell(page, "คงเหลือ", item)).toHaveText(/^5 ห่อ/);
  await expect(page.getByRole("main")).toContainText("รับเข้าอัตโนมัติ 5");

  await signInAs(page, "owner");
  cells = await ownerRow(page);
  await expect(cells.nth(4)).toHaveText(/^-5/);
  await expect(cells.nth(5)).toHaveText(/^5 ห่อ/);
  await expect(cells.nth(7)).toHaveText("—");
});

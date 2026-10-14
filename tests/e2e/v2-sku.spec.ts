import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  confirmDelete,
  fill,
  form,
  jot,
  openPage,
  popup,
  region,
  save,
  saveSheet,
  sheetCell,
  signInAs,
  start,
  toast,
} from "./helpers";

/* Spec v2 V2-LED-03 and V2-LED-04: the SKU the web issues (the expense form, the Settings
 * lists), and the ING code of an ingredient bought on Accounting. */

/** The ledger rows of the Accounting page. */
const ledgerRows = (page: Page) =>
  page.getByRole("table", { name: "บัญชีรายรับรายจ่าย" }).locator("tbody tr");
/** Opens the expense form from the Accounting page and types the item's name. */
const typeItem = async (page: Page, name: string) => {
  await jot(page, "บันทึกค่าใช้จ่าย");
  await fill(page, [/^ประเภทสินค้า/, "อื่นๆ"], [/^รายการ/, name]);
};
/** A row of a stock table, by the item it starts with. */
const stockRow = (card: Locator, item: string) =>
  card
    .getByRole("row", { name: new RegExp(`^((SKU|RM|ING)-\\d+ )?${item}`) })
    .getByRole("cell");

test("V2-LED-03 an expense's item gets a SKU: a new name the next number, a known name or a material its own, and a deleted note's number is never given again", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Accounting");

  // The 23 materials hold SKU-0001…0023: a new name is the next.
  await typeItem(page, "หมึกพิมพ์");
  await expect(popup(page).getByText("ใหม่: SKU-0024")).toBeVisible();
  await save(page);
  await expect(ledgerRows(page)).toContainText(["หมึกพิมพ์SKU-0024"]);

  // The same name again, whatever the spaces around it: the same SKU, and not a new one.
  await typeItem(page, "  หมึกพิมพ์ ");
  await expect(popup(page).getByText("SKU-0024").first()).toBeVisible();
  await expect(popup(page)).not.toContainText("ใหม่: ");
  await expect(popup(page)).not.toContainText("SKU-0025");
  await save(page);
  await expect(ledgerRows(page)).toContainText([
    "หมึกพิมพ์SKU-0024",
    "หมึกพิมพ์SKU-0024",
  ]);

  // A material's name: the material's SKU.
  await typeItem(page, "ซองเนื้อ");
  await expect(popup(page).getByText("SKU-0002").first()).toBeVisible();
  await expect(popup(page)).not.toContainText("ใหม่: ");
  await save(page);
  await expect(ledgerRows(page).first()).toContainText("ซองเนื้อSKU-0002");

  // The only note of an item is deleted: its number is not given to the next new name, nor
  // again to the same name.
  await typeItem(page, "เครื่องซีล");
  await expect(popup(page).getByText("ใหม่: SKU-0025")).toBeVisible();
  await save(page);
  const sealer = ledgerRows(page).filter({ hasText: "เครื่องซีล" });
  await expect(sealer).toContainText("SKU-0025");
  await sealer.getByRole("button", { name: "ลบ", exact: true }).click();
  await confirmDelete(page);
  await expect(sealer).toHaveCount(0);
  await typeItem(page, "เครื่องซีล");
  await expect(popup(page).getByText("ใหม่: SKU-0026")).toBeVisible();
  await save(page);
  await expect(ledgerRows(page).first()).toContainText("เครื่องซีลSKU-0026");
});

test("V2-LED-03 V2-LED-04 a ledger item renamed in Settings keeps its SKU, and its old row goes by the new name", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Settings");
  const skus = region(page, "รายการสินค้า (SKU)");
  const list = page.getByRole("dialog", { name: "รายการสินค้า (SKU)" });
  const openList = () =>
    skus.getByRole("button", { name: "เปิดรายการ" }).click();
  // Before any expense: the 23 materials, the popup's first ten rows and the rest behind ดูเพิ่มเติม.
  await expect(skus).toContainText("วัสดุ23 รายการ");
  await openList();
  await expect(list.getByRole("row")).toHaveCount(11);
  await expect(
    list.getByRole("button", { name: /^ดูเพิ่มเติม/ }),
  ).toBeVisible();
  await list.getByRole("button", { name: "ยกเลิก" }).click();

  await openPage(page, "Accounting");
  await typeItem(page, "หมึกพิมพ์");
  await save(page);

  await openPage(page, "Settings");
  await expect(skus).toContainText("รายการจากหน้า Accounting1 รายการ");
  await openList();
  await expect(list.getByRole("row")).toHaveCount(11);
  // The search, by SKU or by name.
  await list.getByRole("searchbox").fill("sku-0024");
  await expect(list.getByRole("row")).toHaveCount(2);
  await list.getByRole("searchbox").fill("");
  const more = list.getByRole("button", { name: /^ดูเพิ่มเติม/ });
  while (await more.count()) await more.click();
  // A material's name is read here and typed in รายชื่อวัสดุ: only the ledger item has a box.
  await expect(list.getByRole("textbox")).toHaveCount(1);
  const name = list.getByRole("textbox", { name: "ชื่อรายการ SKU-0024" });
  const saveList = () =>
    list.getByRole("button", { name: "บันทึก", exact: true }).click();
  // A name another item goes by, a material included, is refused.
  await name.fill("กล่องบรรจุ");
  await saveList();
  await expect(list).toContainText("ซ้ำกัน");
  await name.fill("หมึกพิมพ์ดำ");
  await saveList();
  await expect(toast(page, "บันทึกแล้ว: รายการสินค้า (SKU)")).toBeVisible();
  await expect(list).toHaveCount(0);
  await openList();
  await list.getByRole("searchbox").fill("หมึก");
  await expect(
    list.getByRole("row", { name: /^SKU-0024/ }).getByRole("textbox"),
  ).toHaveValue("หมึกพิมพ์ดำ");
  await list.getByRole("button", { name: "ยกเลิก" }).click();

  // The row jotted under the old name, and the form: the new name, the same SKU.
  await openPage(page, "Accounting");
  await expect(ledgerRows(page)).toContainText(["หมึกพิมพ์ดำSKU-0024"]);
  await typeItem(page, "หมึกพิมพ์ดำ");
  await expect(popup(page).getByText("SKU-0024").first()).toBeVisible();
  await expect(popup(page)).not.toContainText("ใหม่: ");
  // The old name is a new item now.
  await fill(page, [/^รายการ/, "หมึกพิมพ์"]);
  await expect(popup(page).getByText("ใหม่: SKU-0025")).toBeVisible();
});

test("V2-LED-03 a material added in Settings gets the next SKU when the list is saved", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Settings", true);
  // The list is a popup, as 「รายการสินค้า (SKU)」 is: searched, ten rows at a time.
  const materials = region(page, "รายชื่อวัสดุ");
  await expect(materials).toContainText("วัสดุ23 รายการ");
  const list = popup(page);
  const openList = () =>
    materials.getByRole("button", { name: "เปิดรายการ" }).click();
  const named = (sku: string) =>
    list.getByRole("textbox", { name: `ชื่อวัสดุ ${sku}` });
  await openList();
  await expect(list.getByRole("row")).toHaveCount(11);
  await list.getByRole("searchbox").fill("sku-0023");
  await expect(list.getByRole("row")).toHaveCount(2);
  await expect(named("SKU-0023")).toHaveValue("ถุงหิ้วพลาสติกใส 12x20");
  await expect(list.getByLabel("หน่วยนับ ถุงหิ้วพลาสติกใส 12x20")).toHaveValue(
    "ห่อ",
  );
  await list.getByRole("button", { name: "เพิ่มวัสดุ" }).click();
  // No number until the save, and none to type; the new row stays in view of any search.
  await expect(list.getByRole("row").nth(1)).toContainText("รอบันทึก");
  await named("ใหม่").fill("เทปปิดกล่อง");
  // A rename keeps the SKU.
  await list.getByRole("searchbox").fill("sku-0001");
  await named("SKU-0001").fill("กล่องพิมพ์ลายใหม่");
  await list.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(toast(page, "บันทึกแล้ว: รายชื่อวัสดุ")).toBeVisible();
  await expect(list).toHaveCount(0);
  await expect(materials).toContainText("วัสดุ24 รายการ");
  await openList();
  await list.getByRole("searchbox").fill("sku-0024");
  await expect(named("SKU-0024")).toHaveValue("เทปปิดกล่อง");
  await list.getByRole("searchbox").fill("sku-0001");
  await expect(named("SKU-0001")).toHaveValue("กล่องพิมพ์ลายใหม่");
  await list.getByRole("button", { name: "ยกเลิก" }).click();

  // Inventory lists it under its SKU, and an expense naming it takes that SKU.
  await openPage(page, "Inventory");
  const stock = region(page, "รายการทั้งหมด");
  // The table draws its first rows: the search brings these two up.
  const search = page.getByRole("main").getByRole("searchbox");
  await search.fill("เทปปิดกล่อง");
  await expect(
    stock.getByRole("row", { name: /^SKU-0024 เทปปิดกล่อง/ }),
  ).toBeVisible();
  await search.fill("กล่องพิมพ์ลายใหม่");
  await expect(
    stock.getByRole("row", { name: /^SKU-0001 กล่องพิมพ์ลายใหม่/ }),
  ).toBeVisible();
  await openPage(page, "Accounting");
  await typeItem(page, "เทปปิดกล่อง");
  await expect(popup(page).getByText("SKU-0024").first()).toBeVisible();
  await expect(popup(page)).not.toContainText("ใหม่: ");
  await fill(page, [/^รายการ/, "ของใหม่"]);
  await expect(popup(page).getByText("ใหม่: SKU-0025")).toBeVisible();
  await expect(form(page)).toBeVisible();
});

test("V2-LED-03 an expense of type วัตถุดิบ adds the item to 「รายชื่อวัตถุดิบ」 under the next ING code, and it is a row of the branches' Stock sheet", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Accounting");
  await jot(page, "บันทึกค่าใช้จ่าย");
  await fill(page, [/^ประเภทสินค้า/, "วัตถุดิบ"], [/^รายการ/, "ข้าวเหนียวดิบ"]);
  await expect(popup(page).getByText("ใหม่: ING-0001")).toBeVisible();
  await save(page);
  await expect(ledgerRows(page)).toContainText(["ข้าวเหนียวดิบING-0001"]);
  // The SKU sequence is its own: a new item of another type is still the next SKU.
  await typeItem(page, "หมึกพิมพ์");
  await expect(popup(page).getByText("ใหม่: SKU-0024")).toBeVisible();
  await save(page);

  // Settings lists it (unit ชิ้น until the Owner says otherwise), apart from the SKU list.
  await openPage(page, "Settings", true);
  await expect(region(page, "รายชื่อวัตถุดิบ")).toContainText(
    "วัตถุดิบ1 รายการ",
  );

  // A branch's Stock sheet has its row after the meat, and takes some in.
  await signInAs(page, "minburi");
  await openPage(page, "Stock");
  await saveSheet(page, "พี่เอ", ["รับเพิ่ม", "ข้าวเหนียวดิบ", "7.5"]);
  await expect(sheetCell(page, "คงเหลือ", "ข้าวเหนียวดิบ")).toHaveText(
    "7.5 ชิ้น",
  );

  // The Owner's Stock reads it under มีนบุรี.
  await signInAs(page, "owner");
  await openPage(page, "Stock");
  const row = stockRow(region(page, "สต๊อกของสาขา"), "ข้าวเหนียวดิบ");
  await expect(row.nth(0)).toHaveText("ING-0001");
  await expect(row.nth(4)).toContainText("7.5 ชิ้น");
  // Its row is on Stock, not Inventory.
  await openPage(page, "Inventory");
  await expect(page.getByRole("main")).not.toContainText("ข้าวเหนียวดิบ");
});

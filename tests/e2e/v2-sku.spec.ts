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
  setOpening,
  sheetCell,
  sheetView,
  signInAs,
  start,
  toast,
} from "./helpers";

/* Spec v2 V2-LED-03, V2-LED-04 and V2-BR-08: the SKU the web issues (the expense form, the
 * Settings lists), and the Settings choice of the branches that hold raw rice. */

/** The ledger rows of the Accounting page. */
const ledgerRows = (page: Page) =>
  page.getByRole("table", { name: "บัญชีรายรับรายจ่าย" }).locator("tbody tr");
/** Opens the expense form from the Accounting page and types the item's name. */
const typeItem = async (page: Page, name: string) => {
  await jot(page, "บันทึกค่าใช้จ่าย");
  await fill(page, [/^ประเภทสินค้า/, "อื่นๆ"], [/^รายการ/, name]);
};
/** Opens a Settings section, by its title. */
const edit = async (section: Locator) =>
  section.getByRole("button", { name: "แก้ไข", exact: true }).click();
const saveSection = async (section: Locator) =>
  section.getByRole("button", { name: "บันทึก", exact: true }).click();
/** A row of a stock table, by the item it starts with. */
const stockRow = (card: Locator, item: string) =>
  card.getByRole("row", { name: new RegExp(`^${item}`) }).getByRole("cell");

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
  await openPage(page, "Settings");
  const materials = region(page, "รายชื่อวัสดุ");
  await expect(
    materials.getByRole("row", { name: /^SKU-0023/ }).getByRole("cell"),
  ).toHaveText(["SKU-0023", "ถุงหิ้วพลาสติกใส 12x20", "ห่อ"]);
  await materials.getByRole("button", { name: "เพิ่มวัสดุ" }).click();
  // No number until the save, and none to type.
  await expect(materials.getByRole("row").last()).toContainText("รอบันทึก");
  await materials
    .getByRole("textbox", { name: "วัสดุ 24" })
    .fill("เทปปิดกล่อง");
  // A rename keeps the SKU.
  await materials
    .getByRole("textbox", { name: "วัสดุ 1", exact: true })
    .fill("กล่องพิมพ์ลายใหม่");
  await saveSection(materials);
  await expect(toast(page, "บันทึกแล้ว: รายชื่อวัสดุ")).toBeVisible();
  await expect(
    materials.getByRole("row", { name: /^SKU-0024/ }).getByRole("cell"),
  ).toHaveText(["SKU-0024", "เทปปิดกล่อง", /.*/]);
  await expect(materials.getByRole("row", { name: /^SKU-0001/ })).toContainText(
    "กล่องพิมพ์ลายใหม่",
  );

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

test("V2-BR-08 the branches ticked in Settings hold raw rice: the row comes and goes on the branch's Stock sheet, and the Owner's has a dash for the others", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  // The seed: ศาลาแดง steams its own. Now มีนบุรี does, and ศาลาแดง no longer.
  await openPage(page, "Settings");
  const rice = region(page, "สาขาที่ใช้ข้าวเหนียวดิบ");
  await expect(rice.getByLabel("สาขาศาลาแดง")).toBeChecked();
  await expect(rice.getByLabel("สาขามีนบุรี")).not.toBeChecked();
  await expect(rice.getByLabel("สาขามีนบุรี")).toBeDisabled();
  await edit(rice);
  await rice.getByLabel("สาขามีนบุรี").check();
  await rice.getByLabel("สาขาศาลาแดง").uncheck();
  await saveSection(rice);
  await expect(
    toast(page, "บันทึกแล้ว: สาขาที่ใช้ข้าวเหนียวดิบ"),
  ).toBeVisible();
  await expect(rice.getByLabel("สาขามีนบุรี")).toBeChecked();
  await expect(rice.getByLabel("สาขาศาลาแดง")).not.toBeChecked();
  // The Owner's Stock: a dash under ศาลาแดง, and มีนบุรี has no opening stock yet.
  await openPage(page, "Stock");
  const riceRow = stockRow(region(page, "สต๊อกของสาขา"), "ข้าวเหนียวดิบ");
  await expect(riceRow).toHaveText([
    "ข้าวเหนียวดิบ",
    "—",
    "—",
    "ยังไม่มีสต๊อกตั้งต้น",
    "—",
  ]);

  // ศาลาแดง has no row for it, and is told nothing of the other branch.
  await signInAs(page, "saladaeng");
  await openPage(page, "Stock");
  await sheetView(page, "ตั้งสต๊อกเริ่มต้น").click();
  await expect(sheetCell(page, "ของตั้งต้น", "น้ำพริก")).toBeVisible();
  await expect(sheetCell(page, "ของตั้งต้น", "ข้าวเหนียวดิบ")).toHaveCount(0);
  const copy = (await (await page.request.get("/api/local-db")).json()).payload;
  expect(copy.config.rawRiceBranches).toBe("[]");

  // มีนบุรี has it, and sets its opening stock.
  await signInAs(page, "minburi");
  await openPage(page, "Stock");
  await setOpening(page, ["ข้าวเหนียวดิบ", "7.5"]);
  await expect(sheetCell(page, "คงเหลือ", "ข้าวเหนียวดิบ")).toHaveText(
    "7.5 กก.",
  );

  // The Owner's Stock has it under มีนบุรี, and still a dash under ศาลาแดง.
  await signInAs(page, "owner");
  await openPage(page, "Stock");
  await expect(riceRow.nth(1)).toHaveText("—");
  await expect(riceRow.nth(3)).toContainText("7.5 กก.");
  // No branch ticked: no raw rice row at all, on the Owner's Stock or on the branch's.
  await openPage(page, "Settings");
  await edit(rice);
  await rice.getByLabel("สาขามีนบุรี").uncheck();
  await saveSection(rice);
  await expect(
    toast(page, "บันทึกแล้ว: สาขาที่ใช้ข้าวเหนียวดิบ"),
  ).toBeVisible();
  await openPage(page, "Stock");
  await expect(riceRow).toHaveCount(0);
  await expect(
    region(page, "สต๊อกของสาขา").getByRole("row", { name: /^น้ำพริก/ }),
  ).toBeVisible();
  await signInAs(page, "minburi");
  await openPage(page, "Stock");
  await expect(sheetCell(page, "คงเหลือ", "น้ำพริก")).toBeVisible();
  await expect(sheetCell(page, "คงเหลือ", "ข้าวเหนียวดิบ")).toHaveCount(0);
});

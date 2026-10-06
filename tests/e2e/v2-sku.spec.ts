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
  signInAs,
  start,
  toast,
} from "./helpers";

/* Spec v2 V2-LED-03, V2-LED-04 and V2-BR-08: the SKU the web issues (the expense form, the
 * Settings lists), and the Settings choice of the branches that count raw rice. */

/** The ledger rows of the Accounting page. */
const ledgerRows = (page: Page) =>
  page.getByRole("table", { name: "บัญชีรายการซื้อ" }).locator("tbody tr");
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

  // The ten materials hold SKU-0001…0010: a new name is the eleventh.
  await typeItem(page, "หมึกพิมพ์");
  await expect(popup(page).getByText("ใหม่: SKU-0011")).toBeVisible();
  await save(page);
  await expect(ledgerRows(page)).toContainText(["หมึกพิมพ์SKU-0011"]);

  // The same name again, whatever the spaces around it: the same SKU, and not a new one.
  await typeItem(page, "  หมึกพิมพ์ ");
  await expect(popup(page).getByText("SKU-0011").first()).toBeVisible();
  await expect(popup(page)).not.toContainText("ใหม่: ");
  await expect(popup(page)).not.toContainText("SKU-0012");
  await save(page);
  await expect(ledgerRows(page)).toContainText([
    "หมึกพิมพ์SKU-0011",
    "หมึกพิมพ์SKU-0011",
  ]);

  // A material's name: the material's SKU.
  await typeItem(page, "ถุงซีลเนื้อ");
  await expect(popup(page).getByText("SKU-0003").first()).toBeVisible();
  await expect(popup(page)).not.toContainText("ใหม่: ");
  await save(page);
  await expect(ledgerRows(page).first()).toContainText("ถุงซีลเนื้อSKU-0003");

  // The only note of an item is deleted: its number is not given to the next new name, nor
  // again to the same name.
  await typeItem(page, "เครื่องซีล");
  await expect(popup(page).getByText("ใหม่: SKU-0012")).toBeVisible();
  await save(page);
  const sealer = ledgerRows(page).filter({ hasText: "เครื่องซีล" });
  await expect(sealer).toContainText("SKU-0012");
  await sealer.getByRole("button", { name: "ลบ", exact: true }).click();
  await confirmDelete(page);
  await expect(sealer).toHaveCount(0);
  await typeItem(page, "เครื่องซีล");
  await expect(popup(page).getByText("ใหม่: SKU-0013")).toBeVisible();
  await save(page);
  await expect(ledgerRows(page).first()).toContainText("เครื่องซีลSKU-0013");
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
  // Before any expense: the ten materials, all on the popup's first ten rows.
  await expect(skus).toContainText("วัสดุ10 รายการ");
  await openList();
  await expect(list.getByRole("row")).toHaveCount(11);
  await expect(list.getByRole("button", { name: /^ดูเพิ่มเติม/ })).toHaveCount(
    0,
  );
  await list.getByRole("button", { name: "ยกเลิก" }).click();

  await openPage(page, "Accounting");
  await typeItem(page, "หมึกพิมพ์");
  await save(page);

  await openPage(page, "Settings");
  await expect(skus).toContainText("รายการจากหน้า Accounting1 รายการ");
  await openList();
  // Eleven items: ten rows, and the eleventh behind ดูเพิ่มเติม.
  await expect(list.getByRole("row")).toHaveCount(11);
  await list.getByRole("button", { name: "ดูเพิ่มเติม (เหลือ 1)" }).click();
  await expect(list.getByRole("row")).toHaveCount(12);
  // The search, by SKU or by name.
  await list.getByRole("searchbox").fill("sku-0011");
  await expect(list.getByRole("row")).toHaveCount(2);
  await list.getByRole("searchbox").fill("");
  await list.getByRole("button", { name: /^ดูเพิ่มเติม/ }).click();
  // A material's name is read here and typed in รายชื่อวัสดุ: only the ledger item has a box.
  await expect(list.getByRole("textbox")).toHaveCount(1);
  const name = list.getByRole("textbox", { name: "ชื่อรายการ SKU-0011" });
  const saveList = () =>
    list.getByRole("button", { name: "บันทึก", exact: true }).click();
  // A name another item goes by, a material included, is refused.
  await name.fill("กล่องพิมพ์ลาย");
  await saveList();
  await expect(list).toContainText("ซ้ำกัน");
  await name.fill("หมึกพิมพ์ดำ");
  await saveList();
  await expect(toast(page, "บันทึกแล้ว: รายการสินค้า (SKU)")).toBeVisible();
  await expect(list).toHaveCount(0);
  await openList();
  await list.getByRole("searchbox").fill("หมึก");
  await expect(
    list.getByRole("row", { name: /^SKU-0011/ }).getByRole("textbox"),
  ).toHaveValue("หมึกพิมพ์ดำ");
  await list.getByRole("button", { name: "ยกเลิก" }).click();

  // The row jotted under the old name, and the form: the new name, the same SKU.
  await openPage(page, "Accounting");
  await expect(ledgerRows(page)).toContainText(["หมึกพิมพ์ดำSKU-0011"]);
  await typeItem(page, "หมึกพิมพ์ดำ");
  await expect(popup(page).getByText("SKU-0011").first()).toBeVisible();
  await expect(popup(page)).not.toContainText("ใหม่: ");
  // The old name is a new item now.
  await fill(page, [/^รายการ/, "หมึกพิมพ์"]);
  await expect(popup(page).getByText("ใหม่: SKU-0012")).toBeVisible();
});

test("V2-LED-03 a material added in Settings gets the next SKU when the list is saved", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Settings");
  const materials = region(page, "รายชื่อวัสดุ");
  await expect(
    materials.getByRole("row", { name: /^SKU-0010/ }).getByRole("cell"),
  ).toHaveText(["SKU-0010", "สติกเกอร์ข้าวเหนียว", "—"]);
  await materials.getByRole("button", { name: "เพิ่มวัสดุ" }).click();
  // No number until the save, and none to type.
  await expect(materials.getByRole("row").last()).toContainText("รอบันทึก");
  await materials
    .getByRole("textbox", { name: "วัสดุ 11" })
    .fill("เทปปิดกล่อง");
  // A rename keeps the SKU.
  await materials
    .getByRole("textbox", { name: "วัสดุ 1", exact: true })
    .fill("กล่องพิมพ์ลายใหม่");
  await saveSection(materials);
  await expect(toast(page, "บันทึกแล้ว: รายชื่อวัสดุ")).toBeVisible();
  await expect(
    materials.getByRole("row", { name: /^SKU-0011/ }).getByRole("cell"),
  ).toHaveText(["SKU-0011", "เทปปิดกล่อง", "—"]);
  await expect(materials.getByRole("row", { name: /^SKU-0001/ })).toContainText(
    "กล่องพิมพ์ลายใหม่",
  );

  // Inventory lists it under its SKU, and an expense naming it takes that SKU.
  await openPage(page, "Inventory");
  const stock = region(page, "รายการทั้งหมด");
  await expect(
    stock.getByRole("row", { name: /^SKU-0011 เทปปิดกล่อง/ }),
  ).toBeVisible();
  await expect(
    stock.getByRole("row", { name: /^SKU-0001 กล่องพิมพ์ลายใหม่/ }),
  ).toBeVisible();
  await openPage(page, "Accounting");
  await typeItem(page, "เทปปิดกล่อง");
  await expect(popup(page).getByText("SKU-0011").first()).toBeVisible();
  await expect(popup(page)).not.toContainText("ใหม่: ");
  await fill(page, [/^รายการ/, "ของใหม่"]);
  await expect(popup(page).getByText("ใหม่: SKU-0012")).toBeVisible();
  await expect(form(page)).toBeVisible();
});

test("V2-BR-08 the branches ticked in Settings count raw rice: the row comes and goes on the branch's Stock, and the Owner's has a dash for the others", async ({
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
  await openPage(page, "Stock");
  const riceRow = stockRow(
    region(page, "ข้าวเหนียวและน้ำพริก"),
    "ข้าวเหนียวดิบ",
  );
  await expect(riceRow).toHaveText([
    "ข้าวเหนียวดิบ (กก.)",
    "—",
    "0ยังไม่เคยนับ",
    "0",
    "หมด",
  ]);

  // ศาลาแดง has no row to count, and is told nothing of the other branch.
  await signInAs(page, "saladaeng");
  await openPage(page, "Stock");
  await expect(
    region(page, "น้ำพริก").getByRole("row", { name: /^น้ำพริก/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("row", { name: /ข้าวเหนียวดิบ/ }),
  ).toHaveCount(0);
  const copy = (await (await page.request.get("/api/local-db")).json()).payload;
  expect(copy.config.rawRiceBranches).toBe("[]");

  // มีนบุรี has it, and counts it.
  await signInAs(page, "minburi");
  await openPage(page, "Stock");
  const own = region(page, "ข้าวเหนียวและน้ำพริก");
  await expect(stockRow(own, "ข้าวเหนียวดิบ").nth(1)).toHaveText(
    "0ยังไม่เคยนับ",
  );
  await own
    .getByRole("textbox", { name: "นับ ข้าวเหนียวดิบ (กก.)" })
    .fill("7.5");
  await own.getByRole("button", { name: "บันทึกยอดนับ" }).click();
  await expect(toast(page, "จดแล้ว: นับวัสดุคงเหลือ · 1 รายการ")).toBeVisible();
  await expect(stockRow(own, "ข้าวเหนียวดิบ").nth(1)).toHaveText(
    "7.5นับวันนี้",
  );

  // The Owner's Stock has the count under มีนบุรี, and still a dash under ศาลาแดง.
  await signInAs(page, "owner");
  await openPage(page, "Stock");
  await expect(riceRow.nth(1)).toHaveText("—");
  await expect(riceRow.nth(2)).toHaveText("7.5นับวันนี้");
  await expect(riceRow.nth(3)).toHaveText("7.5");
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
    region(page, "ข้าวเหนียวและน้ำพริก").getByRole("row", { name: /^น้ำพริก/ }),
  ).toBeVisible();
  await signInAs(page, "minburi");
  await openPage(page, "Stock");
  await expect(
    region(page, "น้ำพริก").getByRole("row", { name: /^น้ำพริก/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("row", { name: /ข้าวเหนียวดิบ/ }),
  ).toHaveCount(0);
});

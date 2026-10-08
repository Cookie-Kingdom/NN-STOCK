import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  bangkokDate,
  confirmDelete,
  fill,
  form,
  jot,
  jotButtons,
  openPage,
  pageButtons,
  popupTitle,
  region,
  rows,
  save,
  signInAs,
  start,
  toast,
} from "./helpers";

/* Spec v2 section 11, items 8, 10–14 and 20: a branch's day, its stock, and changing notes. */

const today = bangkokDate();
const year = today.slice(0, 4);
/** A day's card in Daily Log. */
const day = (page: Page, offset = 0) =>
  page.locator(`[data-date="${bangkokDate(offset)}"]`);
/** A row of a stock table, by the item it starts with (behind its SKU, in a table with one). */
const stockRow = (card: Locator, item: string) =>
  card
    .getByRole("row", { name: new RegExp(`^(SKU-\\d+ )?${item}`) })
    .getByRole("cell");
/** The lines of the 「ยังไม่ได้จด」 box that start with `text`. */
const todoLines = (page: Page, text: string) =>
  region(page, "ยังไม่ได้จด")
    .locator("strong")
    .filter({ hasText: new RegExp(`^${text}`) });
/** Opens the sale form from the branch's Stock, as a branch does, on the day `offset`
 *  days from today: an earlier day is typed in the form's date. */
const jotSaleOf = async (page: Page, offset = 0) => {
  await openPage(page, "Stock");
  await jot(page, "ยอดขาย");
  if (offset) await fill(page, [/^วันที่$/, bangkokDate(offset)]);
  await expect(form(page).getByLabel(/^วันที่$/)).toHaveValue(
    bangkokDate(offset),
  );
};
/** Opens a note's row and presses one of its buttons; a 「ลบ」 is confirmed. */
const press = async (row: Locator, name: "แก้ไข" | "ลบ") => {
  const head = row.getByRole("button").first();
  if ((await head.getAttribute("aria-expanded")) !== "true") await head.click();
  await row.getByRole("button", { name, exact: true }).click();
  if (name === "ลบ") await confirmDelete(row.page());
};

test("8 · V2-PAY-05 a packaging payment with a quantity is in the branch's stock at once, jotted by the Manager or by the branch", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "manager");
  // Stock: the meat, then the raw sticky rice and the chili; nothing to press.
  await openPage(page, "Stock");
  const meat = region(page, "เนื้อ (กก.)");
  await expect(meat.getByRole("columnheader")).toHaveText([
    "ที่เก็บ",
    "รายการ",
    "คงเหลือ",
    "การนับ",
    "ส่วนต่างตอนนับล่าสุด",
  ]);
  await expect(
    meat.getByRole("row", { name: /^สาขามีนบุรี/ }).getByRole("cell"),
  ).toHaveText([
    "สาขามีนบุรี",
    "เนื้อพร้อมขาย",
    "0",
    "วันนี้ยังไม่ได้นับ",
    "ยังไม่เคยนับ",
  ]);
  const rice = region(page, "ข้าวเหนียวและน้ำพริก");
  await expect(rice.getByRole("columnheader")).toHaveText([
    "สินค้า",
    "สาขาศาลาแดง",
    "สาขามีนบุรี",
    "รวม",
    "สถานะ",
  ]);
  // Raw rice is counted by the branch that steams its own (ศาลาแดง; มีนบุรี has a dash). It
  // and the chili have nothing left, and say under each figure that they were never counted.
  await expect(
    rice.getByRole("row", { name: /^ข้าวเหนียวดิบ/ }).getByRole("cell"),
  ).toHaveText(["ข้าวเหนียวดิบ (กก.)", "0ยังไม่เคยนับ", "—", "0", "หมด"]);
  await expect(
    rice.getByRole("row", { name: /^น้ำพริก/ }).getByRole("cell"),
  ).toHaveText([
    "น้ำพริก (หลอด)",
    "0ยังไม่เคยนับ",
    "0ยังไม่เคยนับ",
    "0",
    "หมด",
  ]);
  await expect(jotButtons(page)).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("textbox")).toHaveCount(0);
  // Inventory: one table, a row per item and a column per place.
  await openPage(page, "Inventory");
  const table = region(page, "รายการทั้งหมด");
  await expect(table.getByRole("columnheader")).toHaveText([
    "SKU",
    "รายการ",
    "ประเภท",
    "รายละเอียด / สเปก",
    "คลังกลาง",
    "สาขาศาลาแดง",
    "สาขามีนบุรี",
    "ระหว่างส่ง",
    "รวม",
    "สถานะ",
    "ผู้ขาย",
    "วันที่ซื้อล่าสุด",
    "จำนวนซื้อ",
    "มูลค่า",
  ]);
  const boxes = table
    .getByRole("row", { name: /^SKU-0001 กล่องพิมพ์ลาย/ })
    .getByRole("cell");
  // Nothing was bought into the central warehouse, and nothing is on its way.
  await expect(boxes.nth(4)).toHaveText("0");
  await expect(boxes.nth(6)).toHaveText("0ยังไม่เคยนับ");
  await expect(boxes.nth(6)).toHaveAttribute("data-tone", "danger");
  await expect(boxes.nth(7)).toHaveText("—");
  await expect(boxes.nth(9)).toHaveText("หมด");
  await expect(boxes.nth(9)).toHaveAttribute("data-tone", "danger");
  await openPage(page, "Finance");
  await jot(page, "จ่ายเงิน");
  await fill(
    page,
    [/^หมวด/, "แพ็กเกจ/วัสดุ"],
    [/^ยอด \(บาท\)/, "500"],
    [/^รายการที่ซื้อ/, "กล่องพิมพ์ลาย"],
    [/^จำนวน/, "50"],
    [/^สาขา/, "มีนบุรี"],
  );
  await save(page);
  await openPage(page, "Inventory");
  await expect(boxes.nth(5)).toHaveText("0ยังไม่เคยนับ");
  // Bought, never counted: yellow, and the cell says why.
  await expect(boxes.nth(6)).toHaveText("50ยังไม่เคยนับ");
  await expect(boxes.nth(6)).toHaveAttribute("data-tone", "warning");
  await expect(boxes.nth(8)).toHaveText("50");
  await expect(boxes.nth(9)).toHaveText(
    "ยังไม่ได้นับ: สาขาศาลาแดง, สาขามีนบุรี",
  );
  await expect(boxes.nth(9)).toHaveAttribute("data-tone", "warning");
  await expect(table.getByRole("row")).toHaveCount(12);
  // The page writes nothing. The search takes the SKU the web issued (a material's own id is never shown).
  await page.getByLabel("ค้นหา").fill("sku-0001");
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table).toContainText("1 จาก 10 รายการ");
  await expect(table.getByRole("button")).toHaveCount(0);
  await expect(table.getByRole("textbox")).toHaveCount(0);

  // The branch has it with nothing to press, and never sees what it cost.
  await signInAs(page, "minburi");
  await expect(rows(page, "pay")).toHaveCount(0);
  // Its Stock: the meat, then the chili. มีนบุรี buys its rice cooked: no raw rice to count,
  // so nothing to type in the table and no button under it.
  await openPage(page, "Stock");
  await expect(region(page, "เนื้อคงเหลือ")).toContainText(
    "เนื้อคงเหลือ 0 กก.",
  );
  const chili = region(page, "น้ำพริก");
  await expect(chili.getByRole("columnheader")).toHaveText([
    "สินค้า",
    "คงเหลือ",
    "สถานะ",
    "นับได้",
  ]);
  await expect(stockRow(chili, "น้ำพริก")).toHaveText([
    "น้ำพริก (หลอด)",
    "0ยังไม่เคยนับ",
    "หมด",
    "นับในฟอร์มยอดขาย",
  ]);
  await expect(
    page.getByRole("main").getByRole("row", { name: /ข้าวเหนียวดิบ/ }),
  ).toHaveCount(0);
  await expect(chili.getByRole("button")).toHaveCount(0);
  // Its Inventory: the materials, in the Owner's columns with one to type the count in.
  await openPage(page, "Inventory");
  const own = region(page, "วัสดุ");
  await expect(own.getByRole("columnheader")).toHaveText([
    "SKU",
    "รายการ",
    "คงเหลือ",
    "สถานะ",
    "นับได้",
  ]);
  await expect(stockRow(own, "กล่องพิมพ์ลาย").nth(0)).toHaveText("SKU-0001");
  await expect(stockRow(own, "กล่องพิมพ์ลาย").nth(2)).toHaveText(
    "50ยังไม่เคยนับ",
  );
  await expect(stockRow(own, "กล่องพิมพ์ลาย").nth(3)).toHaveText(
    "ยังไม่ได้นับ",
  );
  // (The page's own 「รับเนื้อเข้าสาขา」 is for meat.)
  await expect(own.getByRole("button", { name: /รับ/ })).toHaveCount(0);
  const sent = await (await page.request.get("/api/local-db")).json();
  expect(sent.payload.entries.map((e: { values: object }) => e.values)).toEqual(
    [{ category: "packaging", item: "m1", qty: "50", branch: "มีนบุรี" }],
  );
  // Its own payment, jotted from its Inventory, adds to the same shelf.
  await jot(page, "จ่ายเงิน");
  await fill(
    page,
    [/^หมวด/, "แพ็กเกจ/วัสดุ"],
    [/^ยอด \(บาท\)/, "100"],
    [/^รายการที่ซื้อ/, "กล่องพิมพ์ลาย"],
    [/^จำนวน/, "20"],
  );
  await save(page);
  await expect(stockRow(own, "กล่องพิมพ์ลาย").nth(2)).toHaveText(
    "70ยังไม่เคยนับ",
  );

  await signInAs(page, "saladaeng");
  await openPage(page, "Inventory");
  await expect(
    stockRow(region(page, "วัสดุ"), "กล่องพิมพ์ลาย").nth(2),
  ).toHaveText("0ยังไม่เคยนับ");
});

test("10 · V2-PAY-06 a sale's branch expense and a gift box's shipping fee are in Finance once, under อื่น ๆ and การตลาด", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "saladaeng");
  await jotSaleOf(page);
  await expect(form(page).getByLabel(/^ค่าใช้จ่ายสาขา/)).toBeVisible();
  await expect(form(page)).toContainText(
    "นับเป็นรายการจ่ายเงินแล้ว ไม่ต้องจดจ่ายเงินซ้ำ",
  );
  await fill(
    page,
    [/^กล่องมาตรฐาน/, "10"],
    [/^ยอดขาย LINE MAN/, "3500"],
    [/^ค่าใช้จ่ายสาขา/, "150"],
    [/^ผู้จ่าย/, "น้องฝน"],
  );
  await save(page);
  await openPage(page, "Stock");
  await jot(page, "กล่องแจก");
  await fill(
    page,
    [/^ชื่ออินฟลูเอนเซอร์/, "@kinkubnong"],
    [/^กล่องที่แจก/, "2"],
    [/^ค่าส่ง/, "80"],
  );
  await save(page);
  // Neither made a payment note.
  await openPage(page, "Daily Log");
  await expect(rows(page, "sale")).toContainText("ค่าใช้จ่ายสาขา ฿150");
  await expect(rows(page, "pay")).toHaveCount(0);

  await signInAs(page, "owner");
  await openPage(page, "Overview", true);
  const pl = region(page, "P&L รายเดือน");
  const line = (name: RegExp) =>
    pl.getByRole("row", { name }).getByRole("cell").nth(1);
  await expect(line(/^อื่น ๆ/)).toHaveText("−฿150");
  await expect(line(/^การตลาด/)).toHaveText("−฿80");
  for (const name of [/^เนื้อ/, /^แพ็กเกจ/, /^วัตถุดิบ/, /^ขนส่ง/, /^ค่าแรง/])
    await expect(line(name)).toHaveText("—");
  // ฿230 out in all: each counted once. 3,500 − 10% GP − 230.
  await expect(region(page, "ตัวเลขของเดือน")).toContainText("฿2,920");
  await expect(line(/^กำไรจากการดำเนินงาน/)).toHaveText("฿2,920");
  // Finance: ฿230 paid in all, ฿150 of it out of น้องฝน's pocket and still owed to her.
  await openPage(page, "Finance");
  await expect(region(page, "เงินของเดือน")).toContainText("−฿230");
  await expect(
    region(page, "เงินที่พนักงานสำรองจ่าย")
      .getByRole("row", { name: /^น้องฝน/ })
      .getByRole("cell"),
  ).toHaveText(["น้องฝน", "฿150", "฿0", "฿150", "คืนเงิน"]);
  await expect(region(page, "รายการจ่ายเงินล่าสุด")).toContainText(
    "ยังไม่มีรายการจ่ายเงิน",
  );
});

test("11 · V2-PG-01 a day the branch has no sale on is yellow, and green once it is jotted", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "saladaeng");
  const todo = region(page, "ยังไม่ได้จด");
  for (const offset of [0, -1, -6])
    await expect(day(page, offset)).toHaveAttribute("data-tone", "warning");
  await expect(todoLines(page, "ยอดขาย")).toHaveCount(7);
  // Daily Log is for looking: the pill and the box's lines say it, and open nothing.
  await expect(day(page).getByText("ยังไม่ได้จดยอดขาย")).toBeVisible();
  await expect(day(page).getByRole("button", { name: /ยอดขาย/ })).toHaveCount(
    0,
  );
  await expect(todo.getByRole("button")).toHaveCount(0);

  await jotSaleOf(page);
  await fill(page, [/^กล่องมาตรฐาน/, "24"], [/^ยอดขาย LINE MAN/, "8200"]);
  await save(page);
  await openPage(page, "Daily Log");
  await expect(day(page)).toHaveAttribute("data-tone", "ok");
  await expect(day(page)).toContainText("จดยอดขายแล้ว");
  await expect(day(page).locator('[data-kind="sale"]')).toContainText(
    "+฿8,200",
  );
  await expect(day(page, -1)).toHaveAttribute("data-tone", "warning");

  // V2-RUL-04, V2-PG-02: an earlier day is jotted the same way; nothing is closed.
  await jotSaleOf(page, -1);
  await fill(page, [/^กล่องมาตรฐาน/, "20"], [/^ยอดขาย LINE MAN/, "6900"]);
  await save(page);
  await openPage(page, "Daily Log");
  await expect(day(page, -1)).toHaveAttribute("data-tone", "ok");
  await expect(day(page, -2)).toHaveAttribute("data-tone", "warning");
  await expect(todoLines(page, "ยอดขาย")).toHaveCount(5);
});

test("12 · V2-BR-02 meat not counted today is yellow in Stock and does not turn the day yellow in Daily Log", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "saladaeng");
  await jotSaleOf(page);
  await fill(page, [/^กล่องมาตรฐาน/, "24"], [/^ยอดขาย LINE MAN/, "8200"]);
  await save(page);

  // The day is green on its sale alone, while the meat is still to count.
  await openPage(page, "Daily Log");
  await expect(day(page)).toHaveAttribute("data-tone", "ok");
  await expect(todoLines(page, "นับเนื้อวันนี้")).toBeVisible();
  await expect(region(page, "ยังไม่ได้จด").getByRole("button")).toHaveCount(0);
  await openPage(page, "Stock");
  const meat = region(page, "เนื้อคงเหลือ");
  await expect(meat).toHaveAttribute("data-tone", "warning");
  await expect(meat).toContainText("วันนี้ยังไม่ได้นับ");
  await openPage(page, "Daily Log");
  await expect(day(page)).toHaveAttribute("data-tone", "ok");

  await openPage(page, "Stock");
  await meat.getByRole("button", { name: "นับเนื้อคงเหลือ" }).click();
  await fill(page, [/^เนื้อคงเหลือที่นับได้/, "12.5"]);
  await save(page);
  await expect(meat).toHaveAttribute("data-tone", "success");
  await expect(meat).toContainText("นับแล้ววันนี้");
  await expect(meat).toContainText("เนื้อคงเหลือ 12.5 กก.");
  await openPage(page, "Daily Log");
  await expect(todoLines(page, "นับเนื้อวันนี้")).toHaveCount(0);
});

test("13 · V2-BR-03 a material not counted for 8 days is yellow, and counting it clears the yellow", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "saladaeng");
  // The bell has a line per page: the chili and the raw rice open Stock, the materials
  // Inventory.
  const bell = page
    .getByRole("button", { name: /^ยังไม่ได้จด \d+ อย่าง$/ })
    .filter({ visible: true });
  const late = (text: string) =>
    region(page, "การแจ้งเตือน").getByRole("button", { name: text });
  const heading = page.getByRole("heading", { level: 1 });
  await bell.click();
  await late("ข้าวเหนียวและน้ำพริก 2 รายการไม่ได้นับเกิน 7 วัน").click();
  await expect(heading).toHaveText("Stock");
  await bell.click();
  await late("วัสดุ 10 รายการไม่ได้นับเกิน 7 วัน").click();
  await expect(heading).toHaveText("Inventory");
  // One counted 8 days ago, one 7 days ago.
  for (const [offset, item, count] of [
    [-8, /^กล่องพิมพ์ลาย/, "100"],
    [-7, /^กระดาษรอง/, "40"],
  ] as const) {
    await jot(page, "นับวัสดุคงเหลือ");
    await fill(page, [/^วันที่$/, bangkokDate(offset)], [item, count]);
    await save(page);
  }
  const card = region(page, "วัสดุ");
  const stale = stockRow(card, "กล่องพิมพ์ลาย");
  await expect(stale.nth(2)).toHaveText(/^100นับ .+ · เกิน 7 วัน$/);
  await expect(stale.nth(2)).toHaveAttribute("data-tone", "warning");
  await expect(stale.nth(3)).toHaveText("ยังไม่ได้นับ");
  await expect(stale.nth(3)).toHaveAttribute("data-tone", "warning");
  // Seven days is not yet "more than 7".
  const fresh = stockRow(card, "กระดาษรอง");
  await expect(fresh.nth(2)).toHaveText(/^40นับ (?!.*เกิน 7 วัน)/);
  await expect(fresh.nth(2)).not.toHaveAttribute("data-tone");
  await expect(fresh.nth(3)).toHaveText("พร้อมใช้");
  await expect(fresh.nth(3)).toHaveAttribute("data-tone", "success");
  // The other eight were never counted and hold nothing: red in both cells, as on the
  // Owner's Inventory.
  await expect(stockRow(card, "ถ้วยพริก").nth(2)).toHaveText("0ยังไม่เคยนับ");
  await expect(stockRow(card, "ถ้วยพริก").nth(3)).toHaveText("หมด");
  await expect(card.locator('td[data-tone="warning"]')).toHaveCount(2);
  await expect(card.locator('td[data-tone="danger"]')).toHaveCount(16);
  // The search takes a name or a SKU, as the Owner's does.
  await page.getByLabel("ค้นหา").fill("sku-0001");
  await expect(card.getByRole("row")).toHaveCount(2);
  await expect(card).toContainText("1 จาก 10 รายการ");
  await page.getByLabel("ค้นหา").fill("ไม่มีของนี้");
  await expect(card).toContainText("ไม่พบรายการที่ค้นหา");
  await page.getByLabel("ค้นหา").fill("");

  await card.getByRole("textbox", { name: "นับ กล่องพิมพ์ลาย" }).fill("95");
  await card.getByRole("button", { name: "บันทึกยอดนับ" }).click();
  await expect(toast(page, "จดแล้ว: นับวัสดุคงเหลือ · 1 รายการ")).toBeVisible();
  await expect(stale.nth(2)).toHaveText("95นับวันนี้");
  await expect(stale.nth(2)).not.toHaveAttribute("data-tone");
  await expect(stale.nth(3)).toHaveText("พร้อมใช้");
  await expect(stale.nth(3)).toHaveAttribute("data-tone", "success");
  await expect(card.locator('td[data-tone="warning"]')).toHaveCount(0);

  // The raw rice (ศาลาแดง steams its own) and the chili are on Stock, as the Owner's are.
  await expect(
    card.getByRole("row", { name: /ข้าวเหนียวดิบ|น้ำพริก \(หลอด\)/ }),
  ).toHaveCount(0);
  await openPage(page, "Stock");
  const raw = region(page, "ข้าวเหนียวและน้ำพริก");
  const rice = stockRow(raw, "ข้าวเหนียวดิบ");
  await expect(rice.nth(1)).toHaveText("0ยังไม่เคยนับ");
  await expect(rice.nth(1)).toHaveAttribute("data-tone", "danger");
  await expect(stockRow(raw, "น้ำพริก")).toHaveText([
    "น้ำพริก (หลอด)",
    "0ยังไม่เคยนับ",
    "หมด",
    "นับในฟอร์มยอดขาย",
  ]);
  // The raw rice is counted in kg, in the table it stands in.
  await raw
    .getByRole("textbox", { name: "นับ ข้าวเหนียวดิบ (กก.)" })
    .fill("12.5");
  await raw.getByRole("button", { name: "บันทึกยอดนับ" }).click();
  await expect(toast(page, "จดแล้ว: นับวัสดุคงเหลือ · 1 รายการ")).toBeVisible();
  await expect(rice.nth(1)).toHaveText("12.5นับวันนี้");
  await expect(rice.nth(2)).toHaveText("พร้อมใช้");
  await expect(rice.nth(2)).toHaveAttribute("data-tone", "success");
  // What is left to count: the chili alone, and the eight materials never counted.
  await bell.click();
  await expect(
    late("ข้าวเหนียวและน้ำพริก 1 รายการไม่ได้นับเกิน 7 วัน"),
  ).toBeVisible();
  await expect(late("วัสดุ 8 รายการไม่ได้นับเกิน 7 วัน")).toBeVisible();
});

test("14 · V2-CAL-09 a sale with เนื้อที่ใช้ไปจริง left empty saves with no yellow, and the meat drops by boxes × kg per box", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "saladaeng");
  await openPage(page, "Stock");
  await jot(page, "นับเนื้อคงเหลือ");
  await fill(page, [/^เนื้อคงเหลือที่นับได้/, "10"]);
  await save(page);
  const meat = region(page, "เนื้อคงเหลือ");
  await expect(meat).toContainText("10 กก.");

  await jotSaleOf(page);
  await fill(page, [/^กล่องมาตรฐาน/, "10"], [/^ยอดขาย LINE MAN/, "3500"]);
  const used = form(page).getByLabel(/^เนื้อที่ใช้ไปจริง/);
  await expect(used).toHaveValue("");
  // Not a core field: no yellow on it while it is empty.
  await expect(used).not.toHaveClass(/bg-warning-subtle/);
  await save(page);
  await expect(toast(page, "จดแล้ว: ยอดขาย")).toHaveText(
    /^จดแล้ว: ยอดขาย(?!.*ยังไม่ได้จด)/,
  );
  await openPage(page, "Daily Log");
  await expect(rows(page, "sale")).not.toHaveAttribute("data-tone");
  await expect(region(page, "ยังไม่ได้จด")).not.toContainText("ช่อง");
  // 10 − 10 กล่อง × 0.12 กก.
  await expect(meat).toContainText("8.8 กก.");
  await openPage(page, "Stock");
  await expect(region(page, "เนื้อคงเหลือ")).toContainText(
    "เนื้อคงเหลือ 8.8 กก.",
  );

  // Typed, the weight is taken as it is: 10 − 1.5.
  await openPage(page, "Daily Log");
  await press(rows(page, "sale"), "แก้ไข");
  await fill(page, [/^เนื้อที่ใช้ไปจริง/, "1.5"]);
  await save(page);
  await expect(meat).toContainText("8.5 กก.");
});

test("20 · V2-PG-03 a note of an earlier day is edited, deleted and brought back: a sale, a receipt, a Lot's notes, a payment", async ({
  page,
}) => {
  await start(page, "sample");
  await signInAs(page, "saladaeng");
  const changes = region(page, "ประวัติการแก้ไขและลบ");
  // Closed until asked for, and closed again each time the page is opened.
  const openChanges = () =>
    page.getByRole("button", { name: /^ประวัติการแก้ไขและลบ \(/ }).click();
  await openChanges();
  await expect(changes).toContainText("ยังไม่มีการแก้ไขหรือลบ");

  // The sale of three days ago has no money typed: edit it, then take the edit back.
  const sale = day(page, -3).locator('[data-kind="sale"]');
  await expect(sale).toHaveAttribute("data-tone", "warning");
  await expect(sale).toContainText("ยังไม่ได้จด: ยอดขาย LINE MAN");
  await press(sale, "แก้ไข");
  await expect(popupTitle(page)).toHaveText("แก้ไข: ยอดขาย");
  await fill(page, [/^ยอดขาย LINE MAN/, "7000"]);
  await save(page);
  await expect(toast(page, "แก้แล้ว: ยอดขาย")).toBeVisible();
  await expect(sale).not.toHaveAttribute("data-tone");
  await expect(sale).toContainText("+฿7,000");
  const edit = changes.locator("[data-entry]").first();
  await expect(edit).toContainText("แก้ไขรายการ · ยอดขาย");
  await expect(edit).toContainText("– → 7,000 บาท");
  await edit.getByRole("button", { name: "ย้อนกลับ" }).click();
  await expect(toast(page, /^ย้อนกลับการแก้ไขแล้ว: ยอดขาย/)).toBeVisible();
  await expect(sale).toHaveAttribute("data-tone", "warning");
  await expect(changes.locator("[data-entry]")).toHaveCount(2);

  // The receipt of five days ago: delete it, then 「เลิกทำ」 on the toast.
  const receipt = day(page, -5).locator('[data-kind="receive"]');
  await expect(receipt).toContainText("20 กก.");
  const meat = region(page, "เนื้อคงเหลือ");
  await expect(meat).toContainText("17.9 กก.");
  await press(receipt, "ลบ");
  await expect(receipt).toHaveCount(0);
  await toast(page, "ลบแล้ว: รับเนื้อเข้าสาขา")
    .getByRole("button", { name: "เลิกทำ" })
    .click();
  await expect(toast(page, "กู้คืนแล้ว: รับเนื้อเข้าสาขา")).toBeVisible();
  await expect(receipt).toContainText("20 กก.");

  // The Owner: two notes of a PO รมควัน's round, of weeks ago.
  await signInAs(page, "owner");
  await openPage(page, "Lots");
  await page
    .locator("[data-lot]")
    .filter({ hasText: `SO-${year}-0001` })
    .click();
  const lot = region(page, `SO-${year}-0001`);
  const yieldOf = lot
    .locator("dt")
    .filter({ hasText: /^Yield$/ })
    .locator("xpath=following-sibling::dd");
  await expect(yieldOf).toHaveText("52%");
  await press(lot.locator('[data-kind="smoked"]'), "แก้ไข");
  await expect(form(page).getByLabel(/^วันที่$/)).toHaveValue(bangkokDate(-16));
  await fill(page, [/^น้ำหนักหลังรมควัน/, "100"]);
  await save(page);
  await expect(yieldOf).toHaveText("50%");
  const weighed = lot.locator('[data-kind="cmReceive"]');
  await press(weighed, "ลบ");
  await expect(weighed).toHaveCount(0);
  await toast(page, "ลบแล้ว: รับเนื้อที่ Chef House")
    .getByRole("button", { name: "เลิกทำ" })
    .click();
  await expect(weighed).toContainText("199.2 กก.");

  // A payment of 20 days ago: edit it, delete it, and bring it back from the change log.
  await openPage(page, "Finance");
  const foodiva = region(page, "ยอดค้างจ่ายแยกผู้ขาย")
    .getByRole("row", { name: /^Foodiva/ })
    .getByRole("cell");
  await expect(foodiva.nth(2)).toHaveText("฿70,000");
  const deposit = rows(page, "pay").filter({ hasText: "มัดจำค่าเนื้อ" });
  // A table row: its two buttons are at its end, with nothing to open first.
  await deposit.getByRole("button", { name: "แก้ไข", exact: true }).click();
  await fill(page, [/^ยอด \(บาท\)/, "60000"]);
  await save(page);
  await expect(foodiva.nth(2)).toHaveText("฿60,000");
  await deposit.getByRole("button", { name: "ลบ", exact: true }).click();
  await confirmDelete(page);
  await expect(deposit).toHaveCount(0);
  await expect(foodiva.nth(2)).toHaveText("฿0");
  await openPage(page, "Daily Log");
  await openChanges();
  // By its text, not its place: the restore becomes the newest row of the log.
  const removal = changes
    .locator("[data-entry]")
    .filter({ hasText: "ลบรายการ · จ่ายเงิน" });
  await expect(removal).toHaveCount(1);
  await removal.getByRole("button", { name: "ย้อนกลับ" }).click();
  await expect(toast(page, /^กู้คืนแล้ว: จ่ายเงิน/)).toBeVisible();
  await expect(removal).toContainText("ย้อนกลับแล้ว");
  await openPage(page, "Finance");
  await expect(foodiva.nth(2)).toHaveText("฿60,000");
});

test.describe("phone, 390px wide", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("11 · 12 · 13 on a phone: the branch jots its sale, counts its meat and a material, and no page scrolls sideways", async ({
    page,
  }) => {
    await start(page, "seed");
    await signInAs(page, "minburi");
    // In `next dev` the dev-tools badge covers the first bottom tab.
    await page.addStyleTag({ content: "nextjs-portal{display:none}" });
    const fits = async () =>
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      ).toBeLessThanOrEqual(0);
    await expect(pageButtons(page)).toHaveText([
      "Daily Log",
      "Stock",
      "Inventory",
    ]);
    await fits();

    await jotSaleOf(page);
    await fits();
    await fill(page, [/^กล่องมาตรฐาน/, "18"], [/^ยอดขาย LINE MAN/, "6100"]);
    await save(page);
    await openPage(page, "Daily Log");
    await fits();
    await expect(day(page)).toHaveAttribute("data-tone", "ok");
    await expect(day(page).locator('[data-kind="sale"]')).toContainText(
      "+฿6,100",
    );

    await openPage(page, "Stock");
    await fits();
    const meat = region(page, "เนื้อคงเหลือ");
    await expect(meat).toHaveAttribute("data-tone", "warning");
    await meat.getByRole("button", { name: "นับเนื้อคงเหลือ" }).click();
    await fill(page, [/^เนื้อคงเหลือที่นับได้/, "9.4"]);
    await save(page);
    await expect(meat).toHaveAttribute("data-tone", "success");
    await fits();

    await openPage(page, "Inventory");
    await fits();
    const card = region(page, "วัสดุ");
    // A phone keeps the name, the figure and the input: no SKU, no status.
    await expect(card.getByRole("columnheader")).toHaveText([
      "รายการ",
      "คงเหลือ",
      "นับได้",
    ]);
    const boxes = stockRow(card, "กล่องพิมพ์ลาย");
    await expect(boxes.nth(1)).toHaveAttribute("data-tone", "danger");
    await card.getByRole("textbox", { name: "นับ กล่องพิมพ์ลาย" }).fill("380");
    await card.getByRole("button", { name: "บันทึกยอดนับ" }).click();
    await expect(boxes.nth(1)).toHaveText("380นับวันนี้");
    await expect(boxes.nth(1)).not.toHaveAttribute("data-tone");
    await fits();
  });
});

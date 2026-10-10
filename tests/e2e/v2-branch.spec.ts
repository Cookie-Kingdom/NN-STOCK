import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  allRows,
  bangkokDate,
  bell,
  confirmDelete,
  fill,
  form,
  jot,
  jotButtons,
  logRows,
  openBell,
  openPage,
  openRow,
  pageButtons,
  pickDay,
  popup,
  popupTitle,
  region,
  rows,
  save,
  saveSheet,
  setOpening,
  sheetCell,
  sheetView,
  signInAs,
  start,
  theDate,
  toast,
} from "./helpers";

/* Spec v2 section 11, items 8, 10–13 and 20: a branch's day, its daily stock sheets, and changing notes. */

const today = bangkokDate();
const year = today.slice(0, 4);
/** Daily Log: the row of a note as it was jotted, by its kind and the day the note is about
 *  (the cell of วันที่รายการ), `offset` days from today. */
const jotted = (page: Page, kind: string, offset = 0) =>
  rows(page, kind).filter({
    has: page.getByRole("cell", {
      name: new Date(`${bangkokDate(offset)}T00:00:00`).toLocaleDateString(
        "th-TH",
        { day: "numeric", month: "short", year: "numeric" },
      ),
      exact: true,
    }),
  });
/** A row of a stock table, by the item it starts with (behind its SKU, in a table with one). */
const stockRow = (card: Locator, item: string) =>
  card
    .getByRole("row", { name: new RegExp(`^(SKU-\\d+ )?${item}`) })
    .getByRole("cell");
/** The lines of the bell's list (open) that start with `text`. */
const todoLines = (page: Page, text: string) =>
  region(page, "การแจ้งเตือน")
    .locator("strong")
    .filter({ hasText: new RegExp(`^${text}`) });
/** Opens the sale form from the branch's Sales, as a branch does, on the day `offset`
 *  days from today: an earlier day is typed in the form's date. */
const jotSaleOf = async (page: Page, offset = 0) => {
  await openPage(page, "Sales");
  await jot(page, "ยอดขาย");
  if (offset) await fill(page, [theDate, bangkokDate(offset)]);
  await expect(form(page).getByLabel(theDate)).toHaveAttribute(
    "data-value",

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
/** The same on a row of the Daily Log: its buttons are in the row that opens under it. */
const pressLog = async (row: Locator, name: "แก้ไข" | "ลบ") => {
  await (await openRow(row)).getByRole("button", { name, exact: true }).click();
  if (name === "ลบ") await confirmDelete(row.page());
};

test("8 · V2-PAY-05 a packaging payment with a quantity is in the branch's stock at once, jotted by the Owner or by the branch", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  // Stock: the branches' meat, raw rice and chili, as their daily sheets read; nothing to press.
  await openPage(page, "Stock");
  const shelves = region(page, "สต๊อกของสาขา");
  await expect(stockRow(shelves, "เนื้อ")).toHaveText([
    "เนื้อ",
    "ยังไม่มีสต๊อกตั้งต้น",
    "—",
    "ยังไม่มีสต๊อกตั้งต้น",
    "—",
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
    .getByRole("row", { name: /^SKU-0001 กล่องบรรจุ/ })
    .getByRole("cell");
  // Nothing was bought into the central warehouse, and nothing is on its way.
  await expect(boxes.nth(4)).toHaveText("0");
  await expect(boxes.nth(6)).toHaveText("ยังไม่มีสต๊อกตั้งต้น");
  await expect(boxes.nth(7)).toHaveText("—");
  await expect(boxes.nth(8)).toHaveText("0");
  // No branch set it and nothing moved it: not "หมด".
  await expect(boxes.nth(9)).toHaveText("ยังไม่ตั้งยอด");
  await openPage(page, "Finance");
  await jot(page, "จ่ายเงิน");
  await fill(
    page,
    [/^หมวด/, "แพ็กเกจ/วัสดุ"],
    [/^ยอด \(บาท\)/, "500"],
    [/^รายการที่ซื้อ/, "กล่องบรรจุ"],
    [/^จำนวน/, "50"],
    [/^สาขา/, "มีนบุรี"],
  );
  await save(page);
  await openPage(page, "Inventory");
  await expect(boxes.nth(8)).toHaveText("50");
  // The page writes nothing. The search takes the SKU the web issued (a material's own id is never shown).
  await page.getByLabel("ค้นหา").fill("sku-0001");
  await expect(table).toContainText("1 จาก 23 รายการ");
  await expect(table.getByRole("button")).toHaveCount(0);
  await expect(table.getByRole("textbox")).toHaveCount(0);

  // The branch has it at once, and never sees what it cost.
  await signInAs(page, "minburi");
  await expect(rows(page, "pay")).toHaveCount(0);
  const sent = await (await page.request.get("/api/local-db")).json();
  expect(sent.payload.entries.map((e: { values: object }) => e.values)).toEqual(
    [{ category: "packaging", item: "m1", qty: "50", branch: "มีนบุรี" }],
  );
  // Its Stock: the meat and the chili. มีนบุรี buys its rice cooked: no raw rice row.
  await openPage(page, "Stock");
  await sheetView(page, "ตั้งสต๊อกเริ่มต้น").click();
  await expect(sheetCell(page, "ของตั้งต้น", "เนื้อ")).toBeVisible();
  await expect(sheetCell(page, "ของตั้งต้น", "น้ำพริก")).toBeVisible();
  await expect(sheetCell(page, "ของตั้งต้น", "ข้าวเหนียวดิบ")).toHaveCount(0);
  // Its Inventory: the payment is the day's receipt, on top of the opening stock.
  await openPage(page, "Inventory");
  await setOpening(page, ["กล่องบรรจุ", "10"]);
  await expect(sheetCell(page, "คงเหลือ", "กล่องบรรจุ")).toHaveText("60 กล่อง");
  // Its own payment, jotted from its Inventory, adds to the same shelf.
  await jot(page, "จ่ายเงิน");
  await fill(
    page,
    [/^หมวด/, "แพ็กเกจ/วัสดุ"],
    [/^ยอด \(บาท\)/, "100"],
    [/^รายการที่ซื้อ/, "กล่องบรรจุ"],
    [/^จำนวน/, "20"],
  );
  await save(page);
  await expect(sheetCell(page, "คงเหลือ", "กล่องบรรจุ")).toHaveText("80 กล่อง");

  // The other branch has none of it.
  await signInAs(page, "saladaeng");
  await openPage(page, "Inventory");
  await setOpening(page, ["กล่องบรรจุ", "0"]);
  await expect(sheetCell(page, "คงเหลือ", "กล่องบรรจุ")).toHaveText("0 กล่อง");
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
  await openPage(page, "Sales");
  await jot(page, "กล่องแจก");
  await fill(
    page,
    [/^ชื่ออินฟลูเอนเซอร์/, "@kinkubnong"],
    [/^กล่องมาตรฐาน/, "2"],
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
  await expect(region(page, "รายการเงินเข้า–ออกล่าสุด")).toContainText(
    "ยังไม่มีรายการเงินเข้า–ออก",
  );
});

test("11 · V2-PG-01 a day the branch jotted something on with no sale is in the bell, and out of it once the sale is jotted; a day with no note asks for nothing", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "saladaeng");
  const nothingDue = () =>
    expect(bell(page)).toHaveAccessibleName("ยังไม่ได้จด 0 อย่าง");
  await openPage(page, "Daily Log");
  // Nothing jotted (the shop was closed): the log is empty and nothing is to do.
  await nothingDue();
  await expect(page.locator("[data-entry]")).toHaveCount(0);
  // A note of today that is no sale: the branch was open, so today's sale is due.
  await openPage(page, "Sales");
  await jot(page, "กล่องแจก");
  await fill(
    page,
    [/^ชื่ออินฟลูเอนเซอร์/, "@kinkubnong"],
    [/^กล่องมาตรฐาน/, "2"],
  );
  await save(page);
  await openPage(page, "Daily Log");
  // Daily Log is for looking: the note is a row of it, and the reminder is in the bell alone:
  // today's sale, and no earlier day's.
  await expect(rows(page, "influencerBox")).toHaveCount(1);
  await expect(page.getByRole("main")).not.toContainText("ยังไม่ได้จด");
  await openBell(page);
  await expect(todoLines(page, "ยอดขาย")).toHaveText(["ยอดขาย วันนี้"]);
  await page.keyboard.press("Escape");

  await jotSaleOf(page);
  await fill(page, [/^กล่องมาตรฐาน/, "24"], [/^ยอดขาย LINE MAN/, "8200"]);
  await save(page);
  await openPage(page, "Daily Log");
  await expect(jotted(page, "sale")).toContainText("+฿8,200");
  await nothingDue();

  // V2-RUL-04, V2-PG-02: an earlier day is jotted the same way; nothing is closed.
  await jotSaleOf(page, -1);
  await fill(page, [/^กล่องมาตรฐาน/, "20"], [/^ยอดขาย LINE MAN/, "6900"]);
  await save(page);
  await openPage(page, "Daily Log");
  await expect(jotted(page, "sale", -1)).toContainText("+฿6,900");
  await nothingDue();
});

test("11 · V2-PG-01 a sale is due only for a day of the last 7 the branch itself jotted on: an older day, a closed day and a note the Owner jots for the branch raise none, and no daily sheet is asked for", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "saladaeng");
  /** A day as a line of the bell names it, `offset` days from today. */
  const short = (offset: number) =>
    new Date(`${bangkokDate(offset)}T00:00:00Z`).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  const giftBoxOf = async (offset: number) => {
    await openPage(page, "Sales");
    await jot(page, "กล่องแจก");
    await fill(
      page,
      [theDate, bangkokDate(offset)],
      [/^ชื่ออินฟลูเอนเซอร์/, "@kinkubnong"],
      [/^กล่องมาตรฐาน/, "2"],
    );
    await save(page);
  };
  /** The bell's list (open) asks for no daily sheet, whatever is saved. */
  const noSheetAsked = async () => {
    await expect(todoLines(page, "ใบสต๊อกรายวัน")).toHaveCount(0);
    await expect(region(page, "การแจ้งเตือน")).not.toContainText(
      "ยังไม่ได้บันทึก",
    );
  };
  // The branch was open three days ago and eight days ago, and jotted no sale on either.
  await giftBoxOf(-3);
  await giftBoxOf(-8);
  // Three days ago is due. Eight days ago is past the 7 days, and every other day (today
  // too) has no note of the branch: closed, nothing to ask.
  await openBell(page);
  const due = `ยอดขาย ${short(-3)}`;
  await expect(todoLines(page, "ยอดขาย")).toHaveText([due]);
  await noSheetAsked();
  await page.keyboard.press("Escape");

  // The Owner reads the same line, led by the branch's name: a status that opens nothing.
  await signInAs(page, "owner");
  const anySale = "(ศาลาแดง|มีนบุรี): ยอดขาย";
  await openBell(page);
  await expect(todoLines(page, anySale)).toHaveText([`ศาลาแดง: ${due}`]);
  await expect(
    region(page, "การแจ้งเตือน").getByRole("button", { name: /ยอดขาย/ }),
  ).toHaveCount(0);
  await todoLines(page, anySale).click();
  await expect(popup(page)).toHaveCount(0);
  await noSheetAsked();
  await page.keyboard.press("Escape");
  // A payment the Owner jots for the other branch today is not that branch being open.
  await openPage(page, "Finance");
  await jot(page, "จ่ายเงิน");
  await fill(
    page,
    [/^หมวด/, "แพ็กเกจ/วัสดุ"],
    [/^ยอด \(บาท\)/, "500"],
    [/^รายการที่ซื้อ/, "กล่องบรรจุ"],
    [/^จำนวน/, "50"],
    [/^สาขา/, "มีนบุรี"],
  );
  await save(page);
  await openBell(page);
  await expect(todoLines(page, anySale)).toHaveText([`ศาลาแดง: ${due}`]);
  await page.keyboard.press("Escape");
  // Nor to the branch itself: มีนบุรี has nothing to do.
  await signInAs(page, "minburi");
  await expect(bell(page)).toHaveAccessibleName("ยังไม่ได้จด 0 อย่าง");

  // The branch's line opens the sale form on that day; saved, the line is gone.
  await signInAs(page, "saladaeng");
  await openBell(page);
  await region(page, "การแจ้งเตือน").getByRole("button", { name: due }).click();
  await expect(popupTitle(page)).toHaveText("ยอดขาย");
  await expect(form(page).getByLabel(theDate)).toHaveAttribute(
    "data-value",
    bangkokDate(-3),
  );
  await fill(page, [/^กล่องมาตรฐาน/, "20"], [/^ยอดขาย LINE MAN/, "6900"]);
  await save(page);
  await expect(bell(page)).toHaveAccessibleName("ยังไม่ได้จด 0 อย่าง");

  // An opening stock from that day on: today's sheet is there to save, and is not saved.
  await openPage(page, "Inventory");
  const main = page.getByRole("main");
  await sheetView(page, "ตั้งสต๊อกเริ่มต้น").click();
  await pickDay(main.getByLabel(/^เริ่มนับตั้งแต่วันที่/), bangkokDate(-3));
  await sheetCell(page, "ของตั้งต้น", "กล่องบรรจุ").fill("100");
  await main.getByRole("button", { name: "บันทึกของตั้งต้น" }).click();
  await expect(toast(page, /^จดแล้ว: ตั้งสต๊อกเริ่มต้น/)).toBeVisible();
  await expect(main).toContainText("ยังไม่บันทึกวันนี้");
  // The bell asks neither account for the sheet, and for no sale.
  await openBell(page);
  await expect(todoLines(page, "ยอดขาย")).toHaveCount(0);
  await noSheetAsked();
  await page.keyboard.press("Escape");
  await signInAs(page, "owner");
  await openBell(page);
  await expect(todoLines(page, anySale)).toHaveCount(0);
  await noSheetAsked();
});

test("12 · V2-BR-09 a branch sets its opening stock and saves the day's sheet: it locks, a save of the same day again does not deduct twice, and with no component set a sale takes no stock", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "saladaeng");
  await openPage(page, "Stock");
  const main = page.getByRole("main");
  const left = sheetCell(page, "คงเหลือ", "เนื้อ");
  const editSheet = main.getByRole("button", { name: "แก้ไขบันทึก" });
  // No sheet before the opening stock.
  await expect(left).toHaveCount(0);
  await expect(main).toContainText("ตั้งสต๊อกเริ่มต้นของ");
  await setOpening(page, ["เนื้อ", "20"]);
  await expect(left).toHaveText("20 กก.");
  await expect(main).toContainText("ยังไม่บันทึกวันนี้");
  await expect(editSheet).toHaveCount(0);

  // Waste is part of ใช้ไป: 20 − 5, not 20 − 5 − 0.5.
  await saveSheet(
    page,
    "น้องฝน",
    ["ใช้ไป", "เนื้อ", "5"],
    ["Waste / ทิ้ง", "เนื้อ", "0.5"],
    ["สาเหตุ waste", "เนื้อ", "ขอบไหม้"],
  );
  await expect(left).toHaveText("15 กก.");
  // Saved: the figures are text, and 「แก้ไขบันทึก」 opens them again.
  await expect(main).toContainText("บันทึกวันนี้แล้ว");
  await expect(sheetCell(page, "ใช้ไป", "เนื้อ")).toHaveCount(0);
  await expect(main.getByRole("spinbutton")).toHaveCount(0);
  await expect(editSheet).toBeVisible();
  await editSheet.click();
  await expect(sheetCell(page, "ใช้ไป", "เนื้อ")).toHaveValue("5");
  await main.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await expect(sheetCell(page, "ใช้ไป", "เนื้อ")).toHaveCount(0);
  // The same day again is an edit: 20 − 6.
  await saveSheet(page, "น้องฝน", ["ใช้ไป", "เนื้อ", "6"]);
  await expect(left).toHaveText("14 กก.");
  await expect(editSheet).toBeVisible();
  // Locked on the way back in.
  await openPage(page, "Daily Log");
  await expect(rows(page, "daily")).toHaveCount(1);
  await openPage(page, "Stock");
  await expect(editSheet).toBeVisible();
  await expect(left).toHaveText("14 กก.");

  // A sale is jotted from Sales and has no meat to type; the standard box has no
  // component in Settings (the seed), so its boxes take no stock.
  await expect(jotButtons(page)).toHaveText(["รับเนื้อเข้าสาขา", "จ่ายเงิน"]);
  await jotSaleOf(page);
  await expect(form(page).getByLabel(/^เนื้อที่/)).toHaveCount(0);
  await fill(page, [/^กล่องมาตรฐาน/, "10"], [/^ยอดขาย LINE MAN/, "3500"]);
  await save(page);
  await expect(rows(page, "sale")).toContainText("+฿3,500");
  await openPage(page, "Stock");
  await expect(left).toHaveText("14 กก.");

  // The other branch is told nothing of it.
  await signInAs(page, "minburi");
  await openPage(page, "Stock");
  await expect(left).toHaveCount(0);
  const copy = (await (await page.request.get("/api/local-db")).json()).payload;
  expect(copy.entries).toEqual([]);

  // The Owner reads it: what is left, the day's waste and its reason, and the 7 days' waste.
  await signInAs(page, "owner");
  await openPage(page, "Stock");
  const meat = stockRow(region(page, "สต๊อกของสาขา"), "เนื้อ");
  await expect(meat.nth(1)).toHaveText("14 กก.");
  await expect(meat.nth(2)).toHaveText("0.5 กก.ขอบไหม้");
  await expect(meat.nth(3)).toHaveText("ยังไม่มีสต๊อกตั้งต้น");
  await expect(region(page, "Waste ย้อนหลัง 7 วัน")).toContainText("ขอบไหม้");
  await expect(page.getByRole("main").getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("spinbutton")).toHaveCount(0);
});

test("12b · V2-CAL-10 a product the Owner adds in Settings is a count field of the sale form, and a sale takes the branch's stock by each product's components", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Settings", true);
  const list = region(page, "รายการสินค้า");
  /** Adds a component to the product in the popup, with what a piece takes of it. */
  const component = async (item: string, qty: string) => {
    await popup(page)
      .getByRole("combobox", { name: "เพิ่มส่วนประกอบ" })
      .click();
    // The stock items come before the materials named after them.
    await page
      .getByRole("option", { name: new RegExp(`^${item}`) })
      .first()
      .click();
    await popup(page).getByLabel(`จำนวน ${item}`).fill(qty);
  };
  const saveProduct = async () => {
    await popup(page)
      .getByRole("button", { name: "บันทึก", exact: true })
      .click();
    await expect(popup(page)).toHaveCount(0);
  };
  // The standard box is there from the start, with nothing set; it is never removed.
  await expect(list).toContainText("ยังไม่ตั้งส่วนประกอบ");
  await list.getByRole("button", { name: "แก้ไข กล่องมาตรฐาน" }).click();
  await expect(
    popup(page).getByRole("button", { name: "ลบสินค้า" }),
  ).toHaveCount(0);
  await component("เนื้อ", "120");
  await component("น้ำพริก", "1");
  await saveProduct();
  await expect(list).toContainText("เนื้อ 120 กรัม · น้ำพริก 1 หลอด");
  // A second product, of two tubes.
  await list.getByRole("button", { name: "เพิ่มสินค้า" }).click();
  await popup(page).getByLabel("ชื่อสินค้า").fill("น้ำพริกแพ็กคู่");
  await popup(page)
    .getByLabel(/^ราคาขายต่อชิ้น/)
    .fill("55");
  await component("น้ำพริก", "2");
  // A quantity that is no number is refused, in words.
  await popup(page).getByLabel("จำนวน น้ำพริก").fill("สอง");
  await popup(page)
    .getByRole("button", { name: "บันทึก", exact: true })
    .click();
  await expect(popup(page).getByRole("alert")).toHaveText(
    "รายการสินค้า: จำนวนส่วนประกอบของ「น้ำพริกแพ็กคู่」ใส่เป็นตัวเลข 0 ขึ้นไป",
  );
  await popup(page).getByLabel("จำนวน น้ำพริก").fill("2");
  await saveProduct();
  await expect(list.getByRole("row")).toHaveCount(3);
  await expect(list).toContainText("น้ำพริก 2 หลอด");
  await expect(list).toContainText("55 บาท");

  // The branch's sale form asks for both, and the tubes sold apart have no field of their own.
  await signInAs(page, "saladaeng");
  await openPage(page, "Stock");
  await setOpening(page, ["เนื้อ", "20"], ["น้ำพริก", "50"]);
  await jotSaleOf(page);
  await expect(form(page).getByLabel(/^น้ำพริกหลอดที่ขายแยก/)).toHaveCount(0);
  // A row per product: the form opens on the box, and the second row takes the pack.
  await form(page).getByRole("button", { name: "เพิ่มรายการ" }).click();
  await fill(
    page,
    [/^กล่องมาตรฐาน/, "10"],
    [/^น้ำพริกแพ็กคู่/, "3"],
    [/^ยอดขาย LINE MAN/, "3665"],
  );
  await save(page);
  await expect(rows(page, "sale")).toContainText("กล่องมาตรฐาน 10");
  await expect(rows(page, "sale")).toContainText("น้ำพริกแพ็กคู่ 3");
  // 10 boxes of 120 g; a tube a box and two a pack.
  await openPage(page, "Stock");
  const main = page.getByRole("main");
  await expect(main.getByLabel("ตัดจากยอดขาย เนื้อ")).toHaveText(
    "ตัดจากยอดขาย 1.2",
  );
  await expect(main.getByLabel("ตัดจากยอดขาย น้ำพริก")).toHaveText(
    "ตัดจากยอดขาย 16",
  );
  await expect(sheetCell(page, "คงเหลือ", "เนื้อ")).toHaveText("18.8 กก.");
  await expect(sheetCell(page, "คงเหลือ", "น้ำพริก")).toHaveText("34 หลอด");
});

test("13 · V2-CAL-10 V2-BR-11 a day opens on what the day before left, and an item a branch adds is on both branches' sheets", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "saladaeng");
  await openPage(page, "Inventory");
  const main = page.getByRole("main");
  const left = sheetCell(page, "คงเหลือ", "กล่องบรรจุ");
  // The opening stock, from yesterday.
  await sheetView(page, "ตั้งสต๊อกเริ่มต้น").click();
  await pickDay(main.getByLabel(/^เริ่มนับตั้งแต่วันที่/), bangkokDate(-1));
  await sheetCell(page, "ของตั้งต้น", "กล่องบรรจุ").fill("100");
  await main.getByRole("button", { name: "บันทึกของตั้งต้น" }).click();
  await expect(toast(page, /^จดแล้ว: ตั้งสต๊อกเริ่มต้น/)).toBeVisible();
  // Yesterday's sheet: 100 − 30.
  await pickDay(main.getByLabel(/^วันที่บันทึก/), bangkokDate(-1));
  await saveSheet(page, "น้องฝน", ["ใช้ไป", "กล่องบรรจุ", "30"]);
  await expect(left).toHaveText("70 กล่อง");
  // Today opens on it, not yet saved.
  await pickDay(main.getByLabel(/^วันที่บันทึก/), today);
  await expect(main).toContainText("ยังไม่บันทึกวันนี้");
  await expect(left).toHaveText("70 กล่อง");
  await expect(
    main.getByRole("row", { name: /^(SKU-0001 )?กล่องบรรจุ/ }),
  ).toContainText("ยกมา 70");
  // The search takes a name or a SKU, as the Owner's does.
  await page.getByLabel("ค้นหา").fill("sku-0001");
  await expect(left).toBeVisible();
  await expect(sheetCell(page, "คงเหลือ", "ซองเนื้อ")).toHaveCount(0);
  await page.getByLabel("ค้นหา").fill("");

  // A new item, with its own unit.
  await main.getByRole("button", { name: "เพิ่มสินค้า" }).click();
  const dialog = page.getByRole("dialog", { name: "เพิ่มรายการสินค้า" });
  await dialog.getByLabel(/^ชื่อสินค้า/).fill("ช้อนไม้");
  await dialog.getByLabel(/^หน่วยนับ/).fill("แพ็ก");
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(toast(page, "จดแล้ว: รายการสินค้า · ช้อนไม้")).toBeVisible();
  await expect(sheetCell(page, "คงเหลือ", "ช้อนไม้")).toHaveText("0 แพ็ก");
  // A name the list has is refused.
  await main.getByRole("button", { name: "เพิ่มสินค้า" }).click();
  await dialog.getByLabel(/^ชื่อสินค้า/).fill("ช้อนไม้");
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByRole("button", { name: "ยกเลิก" }).click();

  // The other branch has the item, and none of this branch's figures.
  await signInAs(page, "minburi");
  await openPage(page, "Inventory");
  await sheetView(page, "ตั้งสต๊อกเริ่มต้น").click();
  await expect(sheetCell(page, "ของตั้งต้น", "ช้อนไม้")).toBeVisible();
  const copy = (await (await page.request.get("/api/local-db")).json()).payload;
  expect(copy.entries.map((e: { kind: string }) => e.kind)).toEqual([
    "stockItem",
  ]);
  // The Owner's Settings lists it with its unit.
  await signInAs(page, "owner");
  await openPage(page, "Settings", true);
  await expect(
    region(page, "รายชื่อวัสดุ")
      .getByRole("row", { name: /^SKU-0024/ })
      .getByRole("cell"),
  ).toHaveText(["SKU-0024", "ช้อนไม้", "แพ็ก"]);
});

test("20 · V2-PG-03 a note of an earlier day is edited, deleted and put back by 「เลิกทำ」: a sale, a receipt, a Lot's notes, a payment", async ({
  page,
}) => {
  await start(page, "sample");
  await signInAs(page, "saladaeng");
  // A change is a row of the log, beside the notes jotted: none yet.
  const changes = page.locator('tr[data-entry]:not([data-action="jot"])');
  await allRows(page);
  await expect(logRows(page, "jot").first()).toBeVisible();
  await expect(changes).toHaveCount(0);

  // The sale of three days ago has no money typed: edit it. The edit is not taken back from
  // the log: its row has no button.
  const sale = jotted(page, "sale", -3);
  await expect(await openRow(sale)).toContainText(
    /ยอดขาย LINE MAN\s*ยังไม่ได้จด/,
  );
  await pressLog(sale, "แก้ไข");
  await expect(popupTitle(page)).toHaveText("แก้ไข: ยอดขาย");
  await fill(page, [/^ยอดขาย LINE MAN/, "7000"]);
  await save(page);
  await expect(toast(page, "แก้แล้ว: ยอดขาย")).toBeVisible();
  // The edit is a row of its own, with the note as the edit left it; the row of the note
  // keeps what was first jotted.
  const edit = logRows(page, "edit");
  await expect(edit).toContainText("ยอดขาย");
  await expect(edit).toContainText("– → 7,000 บาท");
  await expect(edit).toContainText("+฿7,000");
  await expect(sale).toContainText("แก้ไขภายหลัง");
  await expect(sale).not.toContainText("฿7,000");
  await expect((await openRow(edit)).getByRole("button")).toHaveCount(0);
  await expect(changes).toHaveCount(1);

  // The receipt of five days ago: delete it, then 「เลิกทำ」 on the toast.
  const receipt = jotted(page, "receive", -5);
  await expect(receipt).toContainText("20 กก.");
  await pressLog(receipt, "ลบ");
  // Its row stays, as what was jotted, and says the note is gone.
  await expect(receipt).toContainText("ลบแล้ว");
  await expect(logRows(page, "void")).toContainText("รับเนื้อเข้าสาขา");
  await toast(page, "ลบแล้ว: รับเนื้อเข้าสาขา")
    .getByRole("button", { name: "เลิกทำ" })
    .click();
  await expect(toast(page, "กู้คืนแล้ว: รับเนื้อเข้าสาขา")).toBeVisible();
  await expect(receipt).toContainText("20 กก.");
  await expect(receipt).not.toContainText("ลบแล้ว");
  await expect(logRows(page, "void")).toContainText("ย้อนกลับแล้ว");

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
  await expect(form(page).getByLabel(theDate)).toHaveAttribute(
    "data-value",
    bangkokDate(-16),
  );
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

  // A payment of 20 days ago: edit it and delete it. Its delete is a row of the log, with no
  // button that brings it back.
  await openPage(page, "Finance");
  const foodiva = region(page, "ยอดค้างจ่ายแยกผู้ขาย")
    .getByRole("row", { name: /^Foodiva/ })
    .getByRole("cell");
  await expect(foodiva.nth(2)).toHaveText("฿70,000");
  // The list holds the latest 12: with the money in left out, a payment this old is among them.
  await page.getByRole("radio", { name: "รายจ่าย", exact: true }).click();
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
  // By its text, not its place: the restore becomes the newest row of the log.
  const removal = logRows(page, "void").filter({
    has: page.getByRole("cell", { name: /^จ่ายเงิน/ }),
  });
  await expect(removal).toHaveCount(1);
  await expect((await openRow(removal)).getByRole("button")).toHaveCount(0);
});

test.describe("phone, 390px wide", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("11 · 12 · 13 on a phone: the branch jots its sale, saves its Stock and Inventory sheets, and no page scrolls sideways", async ({
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
      "Stock",
      "Inventory",
      "Sales",
      "Daily Log",
    ]);
    await fits();

    await jotSaleOf(page);
    await fits();
    await fill(page, [/^กล่องมาตรฐาน/, "18"], [/^ยอดขาย LINE MAN/, "6100"]);
    await save(page);
    await fits();
    await openPage(page, "Daily Log");
    await fits();
    await expect(rows(page, "sale")).toContainText("+฿6,100");

    await openPage(page, "Stock");
    await fits();
    await setOpening(page, ["เนื้อ", "9.4"]);
    await fits();
    await saveSheet(page, "Stella", ["ใช้ไป", "เนื้อ", "1"]);
    await expect(sheetCell(page, "คงเหลือ", "เนื้อ")).toHaveText("8.4 กก.");
    await fits();

    await openPage(page, "Inventory");
    await fits();
    await setOpening(page, ["กล่องบรรจุ", "380"]);
    await expect(sheetCell(page, "คงเหลือ", "กล่องบรรจุ")).toHaveText(
      "380 กล่อง",
    );
    await fits();
  });
});

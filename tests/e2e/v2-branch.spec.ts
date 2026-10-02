import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  bangkokDate,
  fill,
  form,
  jot,
  nav,
  openPage,
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
/** A row of a stock table, by the item it starts with. */
const stockRow = (card: Locator, item: string) =>
  card.getByRole("row", { name: new RegExp(`^${item}`) }).getByRole("cell");
/** Opens the sale form from the yellow pill of a day, as a branch does. */
const jotSaleOf = async (page: Page, offset = 0) => {
  await day(page, offset)
    .getByRole("button", { name: "ยังไม่ได้จดยอดขาย" })
    .click();
  await expect(form(page).getByRole("heading")).toHaveText("ยอดขาย");
  await expect(form(page).getByLabel(/^วันที่$/)).toHaveValue(
    bangkokDate(offset),
  );
};
/** Opens a note's row and presses one of its buttons. */
const press = async (row: Locator, name: "แก้ไข" | "ลบ") => {
  const head = row.getByRole("button").first();
  if ((await head.getAttribute("aria-expanded")) !== "true") await head.click();
  await row.getByRole("button", { name, exact: true }).click();
};

test("8 · V2-PAY-05 a packaging payment with a quantity is in the branch's stock at once, jotted by the Manager or by the branch", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "manager");
  await openPage(page, "Stock");
  const minburi = region(page, "วัสดุและน้ำพริก สาขามีนบุรี");
  await expect(stockRow(minburi, "กล่องใหม่").nth(1)).toHaveText("0");
  await jot(page, "จ่ายเงิน");
  await fill(
    page,
    [/^หมวด/, "แพ็กเกจ/วัสดุ"],
    [/^ยอด \(บาท\)/, "500"],
    [/^รายการที่ซื้อ/, "กล่องใหม่"],
    [/^จำนวน/, "50"],
    [/^เข้าสาขาไหน/, "มีนบุรี"],
  );
  await save(page);
  await expect(stockRow(minburi, "กล่องใหม่").nth(1)).toHaveText("50");
  await expect(
    stockRow(region(page, "วัสดุและน้ำพริก สาขาศาลาแดง"), "กล่องใหม่").nth(1),
  ).toHaveText("0");

  // The branch has it with nothing to press, and never sees what it cost.
  await signInAs(page, "minburi");
  await expect(rows(page, "pay")).toHaveCount(0);
  await openPage(page, "Stock");
  const own = region(page, "วัสดุ");
  await expect(stockRow(own, "กล่องใหม่").nth(1)).toHaveText("50");
  await expect(page.getByRole("button", { name: /รับ/ })).toHaveCount(0);
  const sent = await (await page.request.get("/api/local-db")).json();
  expect(sent.payload.entries.map((e: { values: object }) => e.values)).toEqual(
    [{ category: "packaging", item: "m1", qty: "50", branch: "มีนบุรี" }],
  );
  // Its own payment adds to the same shelf.
  await jot(page, "จ่ายเงิน");
  await fill(
    page,
    [/^หมวด/, "แพ็กเกจ/วัสดุ"],
    [/^ยอด \(บาท\)/, "100"],
    [/^รายการที่ซื้อ/, "กล่องใหม่"],
    [/^จำนวน/, "20"],
  );
  await save(page);
  await expect(stockRow(own, "กล่องใหม่").nth(1)).toHaveText("70");

  await signInAs(page, "saladaeng");
  await openPage(page, "Stock");
  await expect(stockRow(region(page, "วัสดุ"), "กล่องใหม่").nth(1)).toHaveText(
    "0",
  );
});

test("10 · V2-PAY-06 a sale's branch expense and a gift box's shipping fee are in Finance once, under อื่น ๆ and การตลาด", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "saladaeng");
  await jotSaleOf(page);
  await expect(form(page).getByLabel(/^ค่าใช้จ่ายสาขา/)).toBeVisible();
  await expect(form(page)).toContainText(
    "เว็บนับเป็นจ่ายเงินให้แล้ว ไม่จด จ่ายเงิน ซ้ำ",
  );
  await fill(
    page,
    [/^กล่องมาตรฐาน/, "10"],
    [/^ยอดขาย LINE MAN/, "3500"],
    [/^ค่าใช้จ่ายสาขา/, "150"],
    [/^ผู้จ่ายเงิน/, "น้องฝน"],
  );
  await save(page);
  await jot(page, "กล่องแจก");
  await fill(
    page,
    [/^ชื่ออินฟลูเอนเซอร์/, "@kinkubnong"],
    [/^กล่องที่แจก/, "2"],
    [/^ค่าส่ง/, "80"],
  );
  await save(page);
  // Neither made a payment note.
  await expect(rows(page, "sale")).toContainText("ค่าใช้จ่ายสาขา ฿150");
  await expect(rows(page, "pay")).toHaveCount(0);

  await signInAs(page, "owner");
  await openPage(page, "Finance");
  const pl = region(page, "P&L รายเดือน");
  const line = (name: RegExp) =>
    pl.getByRole("row", { name }).getByRole("cell").nth(1);
  await expect(line(/^อื่น ๆ/)).toHaveText("−฿150");
  await expect(line(/^การตลาด/)).toHaveText("−฿80");
  for (const name of [/^เนื้อ/, /^แพ็กเกจ/, /^วัตถุดิบ/, /^ขนส่ง/, /^ค่าแรง/])
    await expect(line(name)).toHaveText("—");
  // ฿230 out in all: each counted once. 3,500 − 10% GP − 230.
  await expect(region(page, "ตัวเลขของเดือน")).toContainText("−฿230");
  await expect(line(/^กำไรจากการดำเนินงาน/)).toHaveText("฿2,920");
  await expect(
    region(page, "เงินที่พนักงานสำรองจ่าย").getByRole("row").getByRole("cell"),
  ).toHaveText(["น้องฝน", "฿150"]);
  await expect(region(page, "จ่ายเงินล่าสุด")).toContainText(
    "ยังไม่มีบันทึกจ่ายเงิน",
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
  await expect(todo.getByRole("button", { name: /^ยอดขาย/ })).toHaveCount(7);

  await jotSaleOf(page);
  await fill(page, [/^กล่องมาตรฐาน/, "24"], [/^ยอดขาย LINE MAN/, "8200"]);
  await save(page);
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
  await expect(day(page, -1)).toHaveAttribute("data-tone", "ok");
  await expect(day(page, -2)).toHaveAttribute("data-tone", "warning");
  await expect(todo.getByRole("button", { name: /^ยอดขาย/ })).toHaveCount(5);
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
  await expect(day(page)).toHaveAttribute("data-tone", "ok");
  await expect(
    region(page, "ยังไม่ได้จด").getByRole("button", { name: "นับเนื้อวันนี้" }),
  ).toBeVisible();
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
  await expect(
    region(page, "ยังไม่ได้จด").getByRole("button", { name: "นับเนื้อวันนี้" }),
  ).toHaveCount(0);
});

test("13 · V2-BR-03 a material not counted for 8 days is yellow, and counting it clears the yellow", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "saladaeng");
  // One counted 8 days ago, one 7 days ago.
  for (const [offset, item, count] of [
    [-8, /^กล่องใหม่/, "100"],
    [-7, /^กล่องเก่า/, "40"],
  ] as const) {
    await jot(page, "นับวัสดุคงเหลือ");
    await fill(page, [/^วันที่$/, bangkokDate(offset)], [item, count]);
    await save(page);
  }
  await openPage(page, "Stock");
  const card = region(page, "วัสดุ");
  const stale = stockRow(card, "กล่องใหม่");
  await expect(stale.nth(1)).toHaveText("100");
  await expect(stale.nth(2)).toHaveAttribute("data-tone", "warning");
  await expect(stale.nth(2)).toContainText("เกิน 7 วัน");
  // Seven days is not yet "more than 7".
  await expect(stockRow(card, "กล่องเก่า").nth(2)).toHaveAttribute(
    "data-tone",
    "success",
  );
  await expect(stockRow(card, "ถ้วยพริก").nth(2)).toHaveText("ยังไม่เคยนับ");
  await expect(card.locator('td[data-tone="warning"]')).toHaveCount(6);

  await card.getByRole("textbox", { name: "นับ กล่องใหม่" }).fill("95");
  await card.getByRole("button", { name: "บันทึกยอดนับ" }).click();
  await expect(toast(page, "จดแล้ว: นับวัสดุคงเหลือ · 1 รายการ")).toBeVisible();
  await expect(stale.nth(1)).toHaveText("95");
  await expect(stale.nth(2)).toHaveAttribute("data-tone", "success");
  await expect(stale.nth(2)).toHaveText("วันนี้");
  await expect(card.locator('td[data-tone="warning"]')).toHaveCount(5);
});

test("14 · V2-CAL-09 a sale with เนื้อที่ใช้ไปจริง left empty saves with no yellow, and the meat drops by boxes × kg per box", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "saladaeng");
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
  await expect(changes).toContainText("ยังไม่มีการแก้ไขหรือลบ");

  // The sale of three days ago has no money typed: edit it, then take the edit back.
  const sale = day(page, -3).locator('[data-kind="sale"]');
  await expect(sale).toHaveAttribute("data-tone", "warning");
  await expect(sale).toContainText("ยังไม่ได้จด: ยอดขาย LINE MAN");
  await press(sale, "แก้ไข");
  await expect(form(page).getByRole("heading")).toHaveText("แก้ไข: ยอดขาย");
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

  // The Owner: a Lot's core note and an extra note of weeks ago.
  await signInAs(page, "owner");
  await openPage(page, "Lots");
  await page
    .locator("[data-lot]")
    .filter({ hasText: `SH-${year}-0001` })
    .click();
  const lot = region(page, `SH-${year}-0001`);
  const yieldOf = lot
    .locator("dt")
    .filter({ hasText: /^Yield$/ })
    .locator("xpath=following-sibling::dd");
  await expect(yieldOf).toHaveText("52%");
  await press(lot.locator('[data-kind="central"]'), "แก้ไข");
  await expect(form(page).getByLabel(/^วันที่$/)).toHaveValue(bangkokDate(-15));
  await fill(page, [/^น้ำหนักที่รับ/, "100"]);
  await save(page);
  await expect(yieldOf).toHaveText("50%");
  const weighed = lot.locator('[data-kind="cmReceive"]');
  await press(weighed, "ลบ");
  await expect(weighed).toHaveCount(0);
  await toast(page, "ลบแล้ว: ชั่งรับที่ Chef House")
    .getByRole("button", { name: "เลิกทำ" })
    .click();
  await expect(weighed).toContainText("199.2 กก.");

  // A payment of 20 days ago: edit it, delete it, and bring it back from the change log.
  await openPage(page, "Finance");
  const foodiva = region(page, "ยอดคงเหลือที่ยังไม่ได้จ่าย ต่อผู้ขาย")
    .getByRole("row", { name: /^Foodiva/ })
    .getByRole("cell");
  await expect(foodiva.nth(2)).toHaveText("฿70,000");
  const deposit = rows(page, "pay").filter({ hasText: "มัดจำค่าเนื้อ" });
  await press(deposit, "แก้ไข");
  await fill(page, [/^ยอด \(บาท\)/, "60000"]);
  await save(page);
  await expect(foodiva.nth(2)).toHaveText("฿60,000");
  await press(deposit, "ลบ");
  await expect(deposit).toHaveCount(0);
  await expect(foodiva.nth(2)).toHaveText("฿0");
  await openPage(page, "Daily Log");
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
    await expect(nav(page).getByRole("button")).toHaveText([
      "Daily Log",
      "Stock",
    ]);
    await fits();

    await jotSaleOf(page);
    await fits();
    await fill(page, [/^กล่องมาตรฐาน/, "18"], [/^ยอดขาย LINE MAN/, "6100"]);
    await save(page);
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
    const card = region(page, "วัสดุ");
    const boxes = stockRow(card, "กล่องใหม่");
    await expect(boxes.nth(2)).toHaveAttribute("data-tone", "warning");
    await card.getByRole("textbox", { name: "นับ กล่องใหม่" }).fill("380");
    await card.getByRole("button", { name: "บันทึกยอดนับ" }).click();
    await expect(boxes.nth(2)).toHaveAttribute("data-tone", "success");
    await expect(boxes.nth(1)).toHaveText("380");
    await fits();
  });
});

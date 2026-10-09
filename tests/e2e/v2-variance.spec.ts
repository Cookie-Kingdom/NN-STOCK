import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  bangkokDate,
  confirmDelete,
  fill,
  jot,
  openDays,
  openPage,
  region,
  rows,
  save,
  signInAs,
  start,
  theDate,
  toast,
} from "./helpers";

/* The difference at the latest count (นับได้ − ควรเหลือ) on the Owner's Stock and
 * Inventory: from the second count on, and never on a branch's pages. */

/** A date as a stock cell prints it: "2 ต.ค.". */
const thaiDay = (offset = 0) =>
  new Date(`${bangkokDate(offset)}T00:00:00Z`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
const variances = (page: Page) =>
  page.getByRole("main").locator("[data-variance]");
/** The cells of a row, by what it starts with. */
const cells = (card: Locator, name: RegExp) =>
  card.getByRole("row", { name }).getByRole("cell");
/** A sale jotted from the branch's Sales, on the day `offset` days from today. */
const sale = async (
  page: Page,
  offset: number,
  ...pairs: [RegExp, string][]
) => {
  await openPage(page, "Sales");
  await jot(page, "ยอดขาย");
  await fill(page, [theDate, bangkokDate(offset)], ...pairs);
  await save(page);
};
const countMeat = async (page: Page, offset: number, kg: string) => {
  await openPage(page, "Stock");
  await jot(page, "นับเนื้อคงเหลือ");
  await fill(
    page,
    [theDate, bangkokDate(offset)],
    [/^เนื้อคงเหลือที่นับได้/, kg],
  );
  await save(page);
};
/** No difference is shown to a branch, on either of its stock pages. */
const branchSeesNone = async (page: Page) => {
  for (const name of ["Stock", "Inventory"]) {
    await openPage(page, name);
    await expect(variances(page)).toHaveCount(0);
    await expect(page.getByRole("main")).not.toContainText("ควรเหลือ");
  }
};

test("meat: the second count shows นับได้ − ควรเหลือ to the Owner, a deleted count takes it away, and a count that agrees shows 0", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "saladaeng");
  await countMeat(page, -2, "10");
  await jot(page, "รับเนื้อเข้าสาขา");
  await fill(page, [theDate, bangkokDate(-1)], [/^น้ำหนักรับเข้าสาขา/, "5"]);
  await save(page);
  await sale(page, -1, [/^กล่องมาตรฐาน/, "25"], [/^ยอดขาย LINE MAN/, "8750"]);

  // Counted once: 10 + 5 − 25 กล่อง × 0.12 กก. is left, with nothing true to set it against.
  await signInAs(page, "owner");
  await openPage(page, "Stock");
  const meat = region(page, "เนื้อ (กก.)");
  const own = cells(meat, /^สาขาศาลาแดง/);
  await expect(meat.getByRole("columnheader").last()).toHaveText(
    "ส่วนต่างตอนนับล่าสุด",
  );
  await expect(own).toHaveText([
    "สาขาศาลาแดง",
    "เนื้อพร้อมขาย",
    "12",
    "วันนี้ยังไม่ได้นับ",
    "นับครั้งแรก",
  ]);
  await expect(cells(meat, /^สาขามีนบุรี/).last()).toHaveText("ยังไม่เคยนับ");
  await expect(variances(page)).toHaveCount(0);

  // The second count: 10 counted where 12 should be.
  await signInAs(page, "saladaeng");
  await countMeat(page, 0, "10");
  await branchSeesNone(page);
  const short = [
    "สาขาศาลาแดง",
    "เนื้อพร้อมขาย",
    "10",
    "นับแล้ววันนี้",
    `−2 กก.ควรเหลือ 12 · นับได้ 10 · นับ ${thaiDay()}`,
  ];
  await signInAs(page, "owner");
  await openPage(page, "Stock");
  await expect(own).toHaveText(short);
  await expect(own.last().locator("[data-variance]")).toHaveAttribute(
    "data-variance",
    "−2",
  );
  await expect(cells(meat, /^สาขามีนบุรี/).last()).toHaveText("ยังไม่เคยนับ");
  await expect(variances(page)).toHaveCount(1);

  // That count deleted: the one before it is a first count again.
  await signInAs(page, "saladaeng");
  const counted = page
    .locator(`[data-date="${bangkokDate()}"]`)
    .locator('[data-kind="meatCount"]');
  await counted.getByRole("button").first().click();
  await counted.getByRole("button", { name: "ลบ", exact: true }).click();
  await confirmDelete(page);
  await expect(toast(page, "ลบแล้ว: นับเนื้อคงเหลือ")).toBeVisible();
  await openDays(page);
  await expect(rows(page, "meatCount")).toHaveCount(1);
  await signInAs(page, "owner");
  await openPage(page, "Stock");
  await expect(own.nth(2)).toHaveText("12");
  await expect(own.last()).toHaveText("นับครั้งแรก");
  await expect(variances(page)).toHaveCount(0);

  // Counted again, as the web expected: a plain 0, not a dash; then 3 over.
  for (const [kg, diff] of [
    ["12", "0"],
    ["15", "+3"],
  ]) {
    await signInAs(page, "saladaeng");
    await countMeat(page, 0, kg);
    await signInAs(page, "owner");
    await openPage(page, "Stock");
    await expect(own.last()).toHaveText(
      `${diff} กก.ควรเหลือ 12 · นับได้ ${kg} · นับ ${thaiDay()}`,
    );
    await expect(own.last().locator("[data-variance]")).toHaveAttribute(
      "data-variance",
      diff,
    );
  }
});

test("chili and a material: no difference after one count, and after the second the Owner sees it and the branch does not", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "saladaeng");
  await openPage(page, "Inventory");
  await jot(page, "นับวัสดุคงเหลือ");
  await fill(page, [theDate, bangkokDate(-3)], [/^กล่องพิมพ์ลาย/, "100"]);
  await save(page);
  // The chili is counted at the end of a sale form.
  await sale(
    page,
    -2,
    [/^กล่องมาตรฐาน/, "10"],
    [/^น้ำพริกที่นับได้ปลายวัน/, "50"],
    [/^ยอดขาย LINE MAN/, "3500"],
  );
  await sale(
    page,
    -1,
    [/^กล่องมาตรฐาน/, "20"],
    [/^น้ำพริกหลอดที่ขายแยก/, "3"],
    [/^ยอดขาย LINE MAN/, "7000"],
  );

  // One count each: what is left is worked out (50 − 3 tubes, 100 − 30 boxes), with no
  // difference to show.
  await signInAs(page, "owner");
  await openPage(page, "Stock");
  const raw = region(page, "ข้าวเหนียวและน้ำพริก");
  const chili = cells(raw, /^น้ำพริก/);
  await expect(chili.nth(1)).toHaveText(`47นับ ${thaiDay(-2)}`);
  await expect(variances(page)).toHaveCount(0);
  await openPage(page, "Inventory");
  const boxes = cells(region(page, "รายการทั้งหมด"), /^SKU-0001 กล่องพิมพ์ลาย/);
  await expect(boxes.nth(5)).toHaveText(`70นับ ${thaiDay(-3)}`);
  await expect(variances(page)).toHaveCount(0);

  // The second count of each. The chili: 47 less the 2 tubes of the sale it is counted on.
  // The boxes: 70 less today's 5.
  await signInAs(page, "saladaeng");
  await sale(
    page,
    0,
    [/^กล่องมาตรฐาน/, "5"],
    [/^น้ำพริกหลอดที่ขายแยก/, "2"],
    [/^น้ำพริกที่นับได้ปลายวัน/, "43"],
    [/^ยอดขาย LINE MAN/, "1750"],
  );
  await openPage(page, "Inventory");
  const card = region(page, "วัสดุ");
  await card.getByRole("textbox", { name: "นับ กล่องพิมพ์ลาย" }).fill("62");
  await card.getByRole("button", { name: "บันทึกยอดนับ" }).click();
  await expect(toast(page, "จดแล้ว: นับวัสดุคงเหลือ · 1 รายการ")).toBeVisible();
  await branchSeesNone(page);

  await signInAs(page, "owner");
  await openPage(page, "Stock");
  await expect(chili.nth(1)).toHaveText(
    "43นับวันนี้ส่วนต่าง −2 หลอดควรเหลือ 45 · นับได้ 43",
  );
  await expect(chili.nth(1).locator("[data-variance]")).toHaveAttribute(
    "data-variance",
    "−2",
  );
  // มีนบุรี never counted, the raw rice has no difference, the meat was never counted.
  await expect(chili.nth(2)).toHaveText("0ยังไม่เคยนับ");
  await expect(variances(page)).toHaveCount(1);
  await expect(
    cells(region(page, "เนื้อ (กก.)"), /^สาขาศาลาแดง/).last(),
  ).toHaveText("ยังไม่เคยนับ");
  await openPage(page, "Inventory");
  await expect(boxes.nth(5)).toHaveText(
    "62นับวันนี้ส่วนต่าง −3 ชิ้นควรเหลือ 65 · นับได้ 62",
  );
  await expect(boxes.nth(5).locator("[data-variance]")).toHaveAttribute(
    "data-variance",
    "−3",
  );
  await expect(variances(page)).toHaveCount(1);
});

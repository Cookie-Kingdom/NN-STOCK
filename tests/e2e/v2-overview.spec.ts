import { expect, test, type Page } from "@playwright/test";
import {
  bangkokDate,
  fill,
  jot,
  openPage,
  region,
  save,
  signInAs,
  start,
} from "./helpers";

/* The shop's Overview and the project's own Overview (a page of its own): since 2026-10-14 the
 * revenue is the sales receipts (บันทึกรายรับ · รับเงินค่าขาย), already after the channels' GP;
 * a branch's sale note is not money there, only its share of the branches. */

const today = bangkokDate();
const thai = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("th-TH", {
    ...options,
    timeZone: "UTC",
  });
const monthName = thai(today, { month: "long", year: "numeric" });
const yearName = `ปี ${+today.slice(0, 4) + 543}`;

/** Finance: a sales receipt of LINE MAN, the project's, dated today. */
async function receipt(page: Page, amount: string) {
  await openPage(page, "Finance");
  await jot(page, "บันทึกรายรับ");
  await fill(
    page,
    [/^ประเภทรายรับ/, "รับเงินค่าขาย"],
    [/^ช่องทางขาย/, "LINE MAN"],
    [/^ยอดรับจริง/, amount],
  );
  await save(page);
}

/** A branch jots a sale of 10 boxes, `amount` of it on LINE MAN. */
async function sale(
  page: Page,
  branch: "saladaeng" | "minburi",
  amount: string,
) {
  await signInAs(page, branch);
  await openPage(page, "Sales");
  await jot(page, "ยอดขาย");
  await fill(page, [/^กล่องมาตรฐาน/, "10"], [/^ยอดขาย LINE MAN/, amount]);
  await save(page);
}

test("Overview: the sales receipts are the revenue of the month and of the year, the shop's and the project's, by channel", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  const shop = region(page, "รายได้หลังหัก GP");
  const revenue = region(page, "รายได้รวม");
  await expect(shop.locator("strong")).toHaveText("฿0");
  await expect(shop).toContainText("ยังไม่มีรายได้ในช่วงนี้");
  // Nothing is jotted before this month: there is no month to step back to, nor one ahead.
  for (const name of ["เดือนก่อนหน้า", "เดือนถัดไป"])
    await expect(page.getByRole("button", { name })).toBeDisabled();
  // One project's detail is not on the shop's page: no P&L, no channels, no figure cards.
  const detail = ["P&L รายเดือน", "ยอดขายแยกช่องทางขาย", "ตัวเลขของเดือน"];
  for (const name of detail) await expect(region(page, name)).toHaveCount(0);

  await openPage(page, "Overview", true);
  await expect(revenue.locator("strong")).toHaveText("฿0");
  const figures = region(page, "ตัวเลขของเดือน");
  await expect(figures).toContainText(
    "ยอดขายต่อกล่อง — · ยอดขายเฉลี่ย ฿0 ต่อวัน",
  );
  const pl = region(page, "P&L รายเดือน");
  /** A P&L line's cells after its name: the period, its share of the revenue, the one before. */
  const line = (name: RegExp, table = pl) =>
    table.getByRole("row", { name }).locator("td:not(:first-child)");
  await expect(line(/^ยอดขาย/)).toHaveText(["—", "—", "—"]);
  await expect(line(/^กำไรจากการดำเนินงาน/)).toHaveText(["—", "—", "—"]);

  // A branch's sale is not money: the revenue waits for the channel to pay.
  await sale(page, "saladaeng", "3500");
  await signInAs(page, "owner");
  await expect(shop.locator("strong")).toHaveText("฿0");
  await expect(shop).toContainText("ยังไม่มีรายได้ในช่วงนี้");

  // LINE MAN pays the ฿3,500 less its 10% GP.
  await receipt(page, "3150");
  await openPage(page, "Overview");
  await expect(shop.locator("strong")).toHaveText("฿3,150");
  await expect(shop).not.toContainText("ยังไม่มีรายได้ในช่วงนี้");
  await expect(
    page.getByRole("status").filter({ hasText: monthName }),
  ).toBeVisible();
  // The chart's figures as a table: today's row.
  const todayRow = {
    name: thai(today, { weekday: "long", day: "numeric", month: "long" }),
  };
  await shop.getByText("ดูเป็นตาราง").click();
  await expect(shop.getByRole("row", todayRow)).toContainText("฿3,150");
  // The arrow keys read a bar: the last day reached first.
  await shop.getByRole("group", { name: /^กราฟแท่ง/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(shop.getByRole("status")).toContainText("฿3,150");
  const projects = region(page, "รายได้แต่ละ Project");
  const project = projects.getByRole("row", { name: /^Nerdnuea x LINE MAN/ });
  await expect(project.getByRole("cell").nth(1)).toHaveText("฿3,150");
  await expect(project.getByRole("cell").nth(3)).toHaveText("฿3,150");
  await expect(project.getByRole("cell").nth(4)).toHaveText("100%");
  const fall = region(page, "จากรายได้ถึงกำไร");
  await expect(fall).toContainText("ยอดขายหลังหัก GP");
  await expect(fall.locator("span").last()).toHaveText("฿3,150");
  for (const name of detail) await expect(region(page, name)).toHaveCount(0);
  // The year: the same receipt.
  await page.getByRole("radio", { name: "ปี" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: yearName }),
  ).toBeVisible();
  await expect(shop.locator("strong")).toHaveText("฿3,150");
  await expect(region(page, "P&L รายปี")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ปีถัดไป" })).toBeDisabled();

  // The project's own Overview: the same ฿3,150, under its name. It opens on the month.
  await openPage(page, "Overview", true);
  await expect(page).toHaveURL(/\/owner\/nn-x-lm\/overview$/);
  await expect(revenue.getByRole("heading")).toContainText(
    "Nerdnuea x LINE MAN",
  );
  await expect(revenue.locator("strong")).toHaveText("฿3,150");
  await revenue.getByText("ดูเป็นตาราง").click();
  await expect(revenue.getByRole("row", todayRow)).toContainText("฿3,150");
  await expect(region(page, "รายได้แต่ละ Project")).toHaveCount(0);
  // The receipt is already after GP: no GP is taken off it again, nor printed.
  await expect(figures).toContainText("รายได้หลังหัก GP ช่องทางขาย฿3,150");
  await expect(figures).not.toContainText("GP ฿");
  await expect(figures).toContainText("10 กล่อง");
  // ฿3,150 over its 10 boxes, and over the days of the month gone by.
  const perDay = Math.round(3150 / +today.slice(8)).toLocaleString("en-US");
  await expect(figures).toContainText(
    `ยอดขายต่อกล่อง ฿315.00 · ยอดขายเฉลี่ย ฿${perDay} ต่อวัน`,
  );
  await expect(pl).toContainText(
    "ยอดตามเดือนที่จ่ายเงิน เป็นตัวเลขประมาณสำหรับบริหาร ไม่ใช่งบสำหรับยื่นภาษี",
  );
  await expect(line(/^ยอดขาย/)).toHaveText(["฿3,150", "100%", "—"]);
  await expect(pl.getByRole("row", { name: /^GP / })).toHaveCount(0);
  await expect(line(/^กำไรจากการดำเนินงาน/)).toHaveText([
    "฿3,150",
    "100%",
    "—",
  ]);
  // The channel card sums the receipts by channel.
  const byChannel = region(page, "ยอดขายแยกช่องทางขาย");
  await expect(byChannel).toContainText("ยอดรับเงินค่าขาย ช่องทางหัก GP แล้ว");
  await expect(byChannel).toContainText(/LINE MAN\s*฿3,150 100%/);
  await expect(byChannel).toContainText("หัก GP 10% แล้ว");
  await expect(region(page, "จากรายได้ถึงกำไร")).not.toContainText(
    "หัก GP ช่องทางขาย",
  );

  // The year: the same receipt, and the P&L of the year.
  await page.getByRole("radio", { name: "ปี" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: yearName }),
  ).toBeVisible();
  await expect(revenue.locator("strong")).toHaveText("฿3,150");
  await expect(region(page, "ตัวเลขของปี")).toContainText("฿3,150");
  const yearPl = region(page, "P&L รายปี");
  await expect(yearPl).toContainText(
    "ยอดตามปีที่จ่ายเงิน เป็นตัวเลขประมาณสำหรับบริหาร ไม่ใช่งบสำหรับยื่นภาษี",
  );
  await expect(line(/^กำไรจากการดำเนินงาน/, yearPl)).toHaveText([
    "฿3,150",
    "100%",
    "—",
  ]);
  await expect(page.getByRole("button", { name: "ปีถัดไป" })).toBeDisabled();
});

test("Overview: the branches' share is what they jotted, after GP on the shop's and before it on the project's, and the company's other income is the shop's alone", async ({
  page,
}) => {
  await start(page, "seed");
  // ศาลาแดง sells ฿3,000, มีนบุรี ฿1,000, all on LINE MAN (10% GP).
  await sale(page, "saladaeng", "3000");
  await sale(page, "minburi", "1000");
  // LINE MAN pays ฿3,600; ฿900 paid out: the profit is ฿2,700, three quarters of it.
  await signInAs(page, "owner");
  await receipt(page, "3600");
  await jot(page, "จ่ายเงิน");
  await fill(page, [/^หมวด/, "ขนส่ง"], [/^ยอดค้างชำระ \(บาท\)/, "900"]);
  await save(page);

  const main = page.getByRole("main");
  const shop = region(page, "รายได้หลังหัก GP");
  const revenue = region(page, "รายได้รวม");
  const projects = region(page, "รายได้แต่ละ Project");
  const project = projects
    .getByRole("row", { name: /^Nerdnuea x LINE MAN/ })
    .getByRole("cell");
  const central = projects.getByRole("row", { name: /^ส่วนกลาง/ });
  const byBranch = region(page, "ยอดขายแยกสาขา");
  const shopProfit = region(page, "จากรายได้ถึงกำไร").locator("span").last();
  const figures = region(page, "ตัวเลขของเดือน");
  const line = (name: RegExp) =>
    region(page, "P&L รายเดือน")
      .getByRole("row", { name })
      .locator("td:not(:first-child)");
  /** The shop's page holds nothing of one project's detail, and no box. */
  const shopOnly = async () => {
    for (const name of [
      "ตัวเลขของเดือน",
      "P&L รายเดือน",
      "ยอดขายแยกช่องทางขาย",
    ])
      await expect(region(page, name)).toHaveCount(0);
    await expect(projects.getByRole("columnheader")).toHaveText([
      "Project",
      "รายได้หลังหัก GP",
      "เทียบช่วงก่อน",
      "กำไร",
      "อัตรากำไร",
    ]);
    await expect(main).not.toContainText("กล่อง");
  };

  // The shop's Overview: the receipt is the revenue; the branches are their sales after GP.
  await openPage(page, "Overview");
  await expect(shop.locator("strong")).toHaveText("฿3,600");
  await expect(project.nth(1)).toHaveText("฿3,600");
  await expect(project.nth(3)).toHaveText("฿2,700");
  await expect(project.nth(4)).toHaveText("75%");
  await expect(central).toHaveCount(0);
  await expect(byBranch).toContainText("ตามที่สาขาจด · หลังหัก GP ช่องทางขาย");
  await expect(byBranch).toContainText(/ศาลาแดง\s*฿2,700 75%/);
  await expect(byBranch).toContainText(/มีนบุรี\s*฿900 25%/);
  await expect(shopProfit).toHaveText("฿2,700");
  await shopOnly();

  // The project's own Overview: the same revenue; the branches before the GP.
  await openPage(page, "Overview", true);
  await expect(revenue.locator("strong")).toHaveText("฿3,600");
  await expect(figures.locator("div > small:first-child")).toHaveText([
    "รายได้หลังหัก GP ช่องทางขาย",
    "กำไรจากการดำเนินงาน",
    "กล่องที่ขาย",
    "กล่องแจกเดือนนี้",
  ]);
  await expect(figures).toContainText("20 กล่อง");
  await expect(line(/^กำไรจากการดำเนินงาน/)).toHaveText(["฿2,700", "75%", "—"]);
  await expect(byBranch).toContainText("ตามที่สาขาจด");
  await expect(byBranch).not.toContainText("หลังหัก GP");
  await expect(byBranch).toContainText(/ศาลาแดง\s*฿3,000 75%/);
  await expect(byBranch).toContainText(/มีนบุรี\s*฿1,000 25%/);

  // ฿600 of other income that is the company's, not the project's.
  await openPage(page, "Finance");
  await jot(page, "บันทึกรายรับ");
  await fill(
    page,
    [/^รายการ/, "ดอกเบี้ยเงินฝาก"],
    [/^รายรับของ/, "บริษัทส่วนกลาง"],
    [/^ยอดรับจริง/, "600"],
  );
  await save(page);

  // The shop's Overview: 3,600 + 600. The project's row and ส่วนกลาง add up to it.
  await openPage(page, "Overview");
  await expect(shop.locator("strong")).toHaveText("฿4,200");
  await expect(shop).toContainText("ยอดขายหลังหัก GP ฿3,600 · รายได้อื่น ฿600");
  await expect(project.nth(1)).toHaveText("฿3,600");
  await expect(project.nth(3)).toHaveText("฿2,700");
  await expect(project.nth(4)).toHaveText("75%");
  await expect(central.getByRole("cell").nth(1)).toHaveText("฿600");
  // The branches are the sales alone.
  await expect(byBranch).toContainText(/ศาลาแดง\s*฿2,700 75%/);
  await expect(region(page, "รายได้อื่นแยกรายการ")).toContainText(
    /ดอกเบี้ยเงินฝาก\s*฿600 100%/,
  );
  await expect(shopProfit).toHaveText("฿3,300");
  await shopOnly();

  // The project's has none of it.
  await openPage(page, "Overview", true);
  await expect(revenue.locator("strong")).toHaveText("฿3,600");
  await expect(line(/^กำไรจากการดำเนินงาน/)).toHaveText(["฿2,700", "75%", "—"]);
  await expect(region(page, "รายได้อื่นแยกรายการ")).toHaveCount(0);
});

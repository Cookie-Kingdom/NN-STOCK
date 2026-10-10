import { expect, test } from "@playwright/test";
import {
  bangkokDate,
  fill,
  form,
  jot,
  jotButtons,
  openPage,
  popupTitle,
  region,
  rows,
  save,
  signInAs,
  start,
  toast,
} from "./helpers";

/* The shop's Overview as its revenue after the channels' GP, and the project's own Overview
 * (a page of its own) as the project's whole revenue with its figures and its P&L: the total
 * of the period, by month or by year. Finance as the money that really moved. */

const today = bangkokDate();
const thai = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("th-TH", {
    ...options,
    timeZone: "UTC",
  });
const monthName = thai(today, { month: "long", year: "numeric" });
const yearName = `ปี ${+today.slice(0, 4) + 543}`;

test("Overview: a branch's sale is the revenue of the month and of the year, the shop's and the project's", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  // The shop's Overview: its revenue is after the channels' GP. The project's: all of it.
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
  // No box sold: no figure per box is made up.
  const figures = region(page, "ตัวเลขของเดือน");
  await expect(figures).toContainText(
    "ยอดขายต่อกล่อง — · ยอดขายเฉลี่ย ฿0 ต่อวัน",
  );
  const pl = region(page, "P&L รายเดือน");
  /** A P&L line's cells after its name: the month, its share of the sales, the month before. */
  const line = (name: RegExp, table = pl) =>
    table.getByRole("row", { name }).locator("td:not(:first-child)");
  await expect(line(/^ยอดขาย/)).toHaveText(["—", "—", "—"]);
  await expect(line(/^กำไรจากการดำเนินงาน/)).toHaveText(["—", "—", "—"]);

  await signInAs(page, "saladaeng");
  await openPage(page, "Sales");
  await jot(page, "ยอดขาย");
  await fill(page, [/^กล่องมาตรฐาน/, "10"], [/^ยอดขาย LINE MAN/, "3500"]);
  await save(page);

  // The shop's Overview: the ฿3,500 sold less LINE MAN's 10% GP, on every revenue figure.
  await signInAs(page, "owner");
  await expect(shop.locator("strong")).toHaveText("฿3,150");
  await expect(shop.getByRole("heading")).toContainText("รายได้หลังหัก GP");
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
  // A row per project: its revenue after GP, and its profit as a share of that. No boxes.
  const projects = region(page, "รายได้แต่ละ Project");
  await expect(projects.getByRole("columnheader")).toHaveText([
    "Project",
    "รายได้หลังหัก GP",
    "เทียบช่วงก่อน",
    "กำไร",
    "อัตรากำไร",
  ]);
  const project = projects.getByRole("row", { name: /^Nerdnuea x LINE MAN/ });
  await expect(project.getByRole("cell").nth(1)).toHaveText("฿3,150");
  await expect(project.getByRole("cell").nth(3)).toHaveText("฿3,150");
  await expect(project.getByRole("cell").nth(4)).toHaveText("100%");
  await expect(region(page, "ยอดขายแยกสาขา")).toContainText("฿3,150 100%");
  // From the revenue after GP down to the profit: the GP is not a step of its own.
  const fall = region(page, "จากรายได้ถึงกำไร");
  await expect(fall).toContainText("ยอดขายหลังหัก GP");
  await expect(fall).not.toContainText("หัก GP ช่องทางขาย");
  await expect(fall.locator("span").last()).toHaveText("฿3,150");
  for (const name of detail) await expect(region(page, name)).toHaveCount(0);
  // The year: the same sale, a bar per month.
  await page.getByRole("radio", { name: "ปี" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: yearName }),
  ).toBeVisible();
  await expect(shop.locator("strong")).toHaveText("฿3,150");
  await expect(region(page, "P&L รายปี")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ปีถัดไป" })).toBeDisabled();

  // The project's own Overview, under its heading: a page of its own for the one project,
  // with its name on the total and no table of projects. It opens on the month.
  await openPage(page, "Overview", true);
  await expect(page).toHaveURL(/\/owner\/nn-x-lm\/overview$/);
  await expect(revenue.getByRole("heading")).toContainText(
    "Nerdnuea x LINE MAN",
  );
  await expect(revenue.locator("strong")).toHaveText("฿3,500");
  await expect(revenue).not.toContainText("ยังไม่มีรายได้ในช่วงนี้");
  await revenue.getByText("ดูเป็นตาราง").click();
  await expect(revenue.getByRole("row", todayRow)).toContainText("฿3,500");
  await expect(region(page, "รายได้แต่ละ Project")).toHaveCount(0);

  await expect(figures).toContainText("฿3,150"); // after LINE MAN's 10% GP
  await expect(figures).toContainText("10 กล่อง");
  // ฿3,500 over its 10 boxes, and over the days of the month gone by.
  const perDay = Math.round(3500 / +today.slice(8)).toLocaleString("en-US");
  await expect(figures).toContainText(
    `ยอดขายต่อกล่อง ฿350.00 · ยอดขายเฉลี่ย ฿${perDay} ต่อวัน`,
  );
  // The P&L: each line beside its share of the month's sales, signed as the line is.
  await expect(pl).toContainText(
    "ยอดตามเดือนที่จ่ายเงิน เป็นตัวเลขประมาณสำหรับบริหาร ไม่ใช่งบสำหรับยื่นภาษี",
  );
  await expect(pl.getByRole("columnheader").nth(2)).toHaveText(
    "% ของรายได้รวม",
  );
  await expect(line(/^ยอดขาย/)).toHaveText(["฿3,500", "100%", "—"]);
  await expect(line(/^GP LINE MAN 10%/)).toHaveText(["−฿350", "−10%", "—"]);
  await expect(line(/^ขนส่ง/)).toHaveText(["—", "—", "—"]);
  await expect(line(/^กำไรจากการดำเนินงาน/)).toHaveText(["฿3,150", "90%", "—"]);
  await expect(region(page, "ยอดขายแยกสาขา")).toContainText("฿3,500 100%");
  await expect(region(page, "ยอดขายแยกช่องทางขาย")).toContainText(
    "GP 10% = −฿350 · เหลือ ฿3,150",
  );
  await expect(region(page, "จากรายได้ถึงกำไร")).toContainText(
    "หัก GP ช่องทางขาย",
  );

  // The year: the same sale, a bar per month, and the P&L of the year.
  await page.getByRole("radio", { name: "ปี" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: yearName }),
  ).toBeVisible();
  await expect(revenue.locator("strong")).toHaveText("฿3,500");
  await expect(region(page, "ตัวเลขของปี")).toContainText("฿3,150");
  const yearPl = region(page, "P&L รายปี");
  await expect(yearPl).toContainText(
    "ยอดตามปีที่จ่ายเงิน เป็นตัวเลขประมาณสำหรับบริหาร ไม่ใช่งบสำหรับยื่นภาษี",
  );
  await expect(yearPl.getByRole("columnheader").nth(2)).toHaveText(
    "% ของรายได้รวม",
  );
  await expect(line(/^GP LINE MAN 10%/, yearPl)).toHaveText([
    "−฿350",
    "−10%",
    "—",
  ]);
  await expect(line(/^กำไรจากการดำเนินงาน/, yearPl)).toHaveText([
    "฿3,150",
    "90%",
    "—",
  ]);
  await expect(page.getByRole("button", { name: "ปีถัดไป" })).toBeDisabled();
});

test("Overview: with two channels of different GP, the shop's revenue is after each GP and its rows add up to it, the project's is the whole revenue, and the two profits differ by the company's other income alone", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  // A second channel, Grab at 30% GP, beside LINE MAN's 10%.
  await openPage(page, "Settings");
  const channels = region(page, "ช่องทางขาย");
  await channels.getByRole("button", { name: "เพิ่มช่องทาง" }).click();
  const inputs = channels.getByRole("textbox");
  await expect(inputs).toHaveCount(4);
  await inputs.nth(2).fill("Grab");
  await inputs.nth(3).fill("30");
  await channels.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(toast(page, "บันทึกแล้ว: ช่องทางขาย")).toBeVisible();

  // ศาลาแดง: 3,000 − 10% and 3,000 − 30% = 4,800. มีนบุรี: 1,000 − 10% and 1,000 − 30% = 1,600.
  // Sold ฿8,000 in all, ฿1,600 of it GP: ฿6,400 is the shop's.
  for (const [branch, amount] of [
    ["saladaeng", "3000"],
    ["minburi", "1000"],
  ] as const) {
    await signInAs(page, branch);
    await openPage(page, "Sales");
    await jot(page, "ยอดขาย");
    await fill(
      page,
      [/^กล่องมาตรฐาน/, "10"],
      [/^ยอดขาย LINE MAN/, amount],
      [/^ยอดขาย Grab/, amount],
    );
    await save(page);
  }
  // ฿1,600 paid out: the profit is 6,400 − 1,600 = 4,800, three quarters of the ฿6,400.
  await signInAs(page, "owner");
  await openPage(page, "Finance");
  await jot(page, "จ่ายเงิน");
  await fill(page, [/^หมวด/, "ขนส่ง"], [/^ยอด \(บาท\)/, "1600"]);
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
  const pl = region(page, "P&L รายเดือน");
  const line = (name: RegExp) =>
    pl.getByRole("row", { name }).locator("td:not(:first-child)");
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
    // Not กล่องแจก, not ต้นทุนต่อกล่อง, not a count of boxes.
    await expect(main).not.toContainText("กล่อง");
  };

  // The shop's Overview, with no other income: the project's row is the whole of it.
  await openPage(page, "Overview");
  await expect(shop.locator("strong")).toHaveText("฿6,400");
  await expect(project.nth(1)).toHaveText("฿6,400");
  await expect(project.nth(3)).toHaveText("฿4,800");
  await expect(project.nth(4)).toHaveText("75%");
  await expect(central).toHaveCount(0);
  // Each branch after the GP of what it sold, as a share of the ฿6,400 they add up to.
  await expect(byBranch).toContainText("หลังหัก GP ช่องทางขาย");
  await expect(byBranch).toContainText(/ศาลาแดง\s*฿4,800 75%/);
  await expect(byBranch).toContainText(/มีนบุรี\s*฿1,600 25%/);
  await expect(shopProfit).toHaveText("฿4,800");
  await shopOnly();

  // The project's own Overview: the ฿8,000 sold, the GP a line of its own, the same profit.
  await openPage(page, "Overview", true);
  await expect(revenue.locator("strong")).toHaveText("฿8,000");
  // The four figures of the month, in their order: no cost per box is among them.
  await expect(figures.locator("div > small:first-child")).toHaveText([
    "รายได้หลังหัก GP ช่องทางขาย",
    "กำไรจากการดำเนินงาน",
    "กล่องที่ขาย",
    "กล่องแจกเดือนนี้",
  ]);
  await expect(figures).toContainText("฿6,400");
  await expect(figures).toContainText("GP ฿1,600");
  await expect(figures).toContainText("20 กล่อง");
  await expect(line(/^ยอดขาย/)).toHaveText(["฿8,000", "100%", "—"]);
  await expect(line(/^GP LINE MAN 10%/)).toHaveText(["−฿400", "−5%", "—"]);
  await expect(line(/^GP Grab 30%/)).toHaveText(["−฿1,200", "−15%", "—"]);
  await expect(line(/^กำไรจากการดำเนินงาน/)).toHaveText(["฿4,800", "60%", "—"]);
  // The branches before the GP here: 6,000 and 2,000 of the ฿8,000.
  await expect(byBranch).toContainText(/ศาลาแดง\s*฿6,000 75%/);
  await expect(byBranch).toContainText(/มีนบุรี\s*฿2,000 25%/);
  await expect(region(page, "ยอดขายแยกช่องทางขาย")).toContainText(
    "GP 30% = −฿1,200 · เหลือ ฿2,800",
  );

  // ฿600 of other income that is the company's, not the project's (Finance starts the form
  // on the project).
  await openPage(page, "Finance");
  await jot(page, "บันทึกรายรับ");
  await fill(
    page,
    [/^รายการ/, "ดอกเบี้ยเงินฝาก"],
    [/^รายรับของ/, "บริษัทส่วนกลาง"],
    [/^ยอดรับจริง/, "600"],
  );
  await save(page);

  // The shop's Overview: 8,000 − 1,600 + 600. The project's row and ส่วนกลาง add up to it.
  await openPage(page, "Overview");
  await expect(shop.locator("strong")).toHaveText("฿7,000");
  await expect(shop).toContainText("ยอดขายหลังหัก GP ฿6,400 · รายได้อื่น ฿600");
  await expect(project.nth(1)).toHaveText("฿6,400");
  await expect(central.getByRole("cell").nth(1)).toHaveText("฿600");
  // The project's margin is still its profit over its own ฿6,400.
  await expect(project.nth(3)).toHaveText("฿4,800");
  await expect(project.nth(4)).toHaveText("75%");
  // The branches are the sales alone: still the ฿6,400.
  await expect(byBranch).toContainText(/ศาลาแดง\s*฿4,800 75%/);
  await expect(byBranch).toContainText(/มีนบุรี\s*฿1,600 25%/);
  await expect(region(page, "รายได้อื่นแยกรายการ")).toContainText(
    /ดอกเบี้ยเงินฝาก\s*฿600 100%/,
  );
  // The shop's profit has the ฿600: 4,800 + 600.
  await expect(shopProfit).toHaveText("฿5,400");
  await shopOnly();

  // The project's has none of it: the same revenue and the same profit as before.
  await openPage(page, "Overview", true);
  await expect(revenue.locator("strong")).toHaveText("฿8,000");
  await expect(line(/^กำไรจากการดำเนินงาน/)).toHaveText(["฿4,800", "60%", "—"]);
  await expect(figures).toContainText("60% ของรายได้รวม");
  await expect(region(page, "รายได้อื่นแยกรายการ")).toHaveCount(0);
});

test("Finance: money out of pocket is an expense when it is paid, and money out of the shop when it is paid back", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Finance");
  // No revenue here: that is the project's Overview.
  await expect(region(page, "รายได้รวม")).toHaveCount(0);
  await expect(jotButtons(page)).toHaveText([
    "จ่ายเงิน",
    "คืนเงินพนักงาน",
    "บันทึกรายรับ",
  ]);
  for (const [category, amount, payer] of [
    ["ขนส่ง", "400", "น้องฝน"],
    ["อื่น ๆ", "100", "บริษัท"],
  ]) {
    await jot(page, "จ่ายเงิน");
    await fill(
      page,
      [/^หมวด/, category],
      [/^ยอด \(บาท\)/, amount],
      [/^ผู้จ่าย/, payer],
    );
    await save(page);
  }
  const money = (label: string, span = "เดือน") =>
    region(page, `เงินของ${span}`)
      .locator("div")
      .filter({
        has: page
          .locator("small")
          .filter({ hasText: new RegExp(`^${label}$`) }),
      })
      .locator("strong");
  await expect(money("ยอดจ่ายทั้งหมด")).toHaveText("−฿500");
  await expect(money("บริษัทจ่ายเอง")).toHaveText("−฿100");
  await expect(money("พนักงานสำรองจ่าย")).toHaveText("฿400");
  await expect(money("เงินคืนพนักงาน")).toHaveText("฿0");
  await expect(money("เงินออกจากร้านจริง")).toHaveText("−฿100");
  await expect(money("ยอดค้างจ่ายถึงวันนี้")).toHaveText("฿400");
  await expect(
    region(page, "ยอดจ่ายแยกหมวด").getByRole("row", { name: /^รวมยอดจ่าย/ }),
  ).toContainText("−฿500");

  // Pay her back ฿250 of the ฿400: the form opens on her, with what is owed.
  const owed = region(page, "เงินที่พนักงานสำรองจ่าย")
    .getByRole("row", { name: /^น้องฝน/ })
    .getByRole("cell");
  await expect(owed).toHaveText(["น้องฝน", "฿400", "฿0", "฿400", "คืนเงิน"]);
  await page.getByRole("button", { name: "คืนเงิน น้องฝน" }).click();
  await expect(popupTitle(page)).toHaveText("คืนเงินพนักงาน");
  await expect(form(page).getByLabel(/^ผู้รับเงินคืน/)).toHaveAttribute(
    "data-value",
    "น้องฝน",
  );
  await expect(form(page).getByLabel(/^ยอดที่คืน/)).toHaveValue("400");
  await fill(page, [/^ยอดที่คืน/, "250"]);
  await save(page);
  await expect(owed).toHaveText(["น้องฝน", "฿400", "฿250", "฿150", "คืนเงิน"]);
  await expect(rows(page, "reimburse")).toContainText("น้องฝน");
  await expect(rows(page, "reimburse")).toContainText("−฿250");
  // ฿250 more left the shop; what was paid for things is the same ฿500.
  await expect(money("เงินคืนพนักงาน")).toHaveText("−฿250");
  await expect(money("เงินออกจากร้านจริง")).toHaveText("−฿350");
  await expect(money("ยอดจ่ายทั้งหมด")).toHaveText("−฿500");
  await expect(money("ยอดค้างจ่ายถึงวันนี้")).toHaveText("฿150");
  await page.getByRole("radio", { name: "ปี" }).click();
  await expect(money("เงินออกจากร้านจริง", "ปี")).toHaveText("−฿350");

  // The profit counted the ฿500 when it was paid: paying back takes nothing more off it.
  await openPage(page, "Overview", true);
  await expect(region(page, "ตัวเลขของเดือน")).toContainText("−฿500");
  // The shop's Overview: the last figure of 「จากรายได้ถึงกำไร」.
  await openPage(page, "Overview");
  await expect(
    region(page, "จากรายได้ถึงกำไร").locator("span").last(),
  ).toHaveText("−฿500");
});

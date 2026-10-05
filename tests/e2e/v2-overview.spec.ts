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
} from "./helpers";

/* The Overview as the shop's revenue and the project's own as its: the total of the period,
 * by month or by year. Finance as the money that really moved. */

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
  const revenue = region(page, "รายได้รวม");
  await expect(revenue.locator("strong")).toHaveText("฿0");
  await expect(revenue).toContainText("ยังไม่มีรายได้ในช่วงนี้");
  // Nothing is jotted before this month: there is no month to step back to, nor one ahead.
  for (const name of ["เดือนก่อนหน้า", "เดือนถัดไป"])
    await expect(page.getByRole("button", { name })).toBeDisabled();

  await signInAs(page, "saladaeng");
  await openPage(page, "Stock");
  await jot(page, "ยอดขาย");
  await fill(page, [/^กล่องมาตรฐาน/, "10"], [/^ยอดขาย LINE MAN/, "3500"]);
  await save(page);

  await signInAs(page, "owner");
  await expect(revenue.locator("strong")).toHaveText("฿3,500");
  await expect(revenue).not.toContainText("ยังไม่มีรายได้ในช่วงนี้");
  await expect(
    page.getByRole("status").filter({ hasText: monthName }),
  ).toBeVisible();
  // The chart's figures as a table: today's row.
  await revenue.getByText("ดูเป็นตาราง").click();
  await expect(
    revenue.getByRole("row", {
      name: thai(today, { weekday: "long", day: "numeric", month: "long" }),
    }),
  ).toContainText("฿3,500");
  // The arrow keys read a bar: the last day reached first.
  await revenue.getByRole("group", { name: /^กราฟแท่ง/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(revenue.getByRole("status")).toContainText("฿3,500");

  const figures = region(page, "ตัวเลขของเดือน");
  await expect(figures).toContainText("฿3,150"); // after LINE MAN's 10% GP
  await expect(figures).toContainText("10 กล่อง");
  const project = region(page, "รายได้แต่ละ Project").getByRole("row", {
    name: /^Nerdnuea x LINE MAN/,
  });
  await expect(project).toContainText("฿3,500");
  await expect(project).toContainText("90%");
  await expect(region(page, "รายได้แยกสาขา")).toContainText("฿3,500 100%");
  await expect(region(page, "รายได้แยกช่องทางขาย")).toContainText(
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
  await expect(
    region(page, "P&L รายปี").getByRole("row", {
      name: /^กำไรจากการดำเนินงาน/,
    }),
  ).toContainText("฿3,150");
  await expect(page.getByRole("button", { name: "ปีถัดไป" })).toBeDisabled();

  // The project's own Overview, under its heading: the same view of the one project, with its
  // name on the total and no table of projects. It opens on the month.
  await openPage(page, "Overview", true);
  await expect(page).toHaveURL(/\/owner\/nn-x-lm\/overview$/);
  await expect(revenue.getByRole("heading")).toContainText(
    "Nerdnuea x LINE MAN",
  );
  await expect(revenue.locator("strong")).toHaveText("฿3,500");
  await expect(region(page, "ตัวเลขของเดือน")).toContainText("฿3,150");
  await expect(region(page, "รายได้แต่ละ Project")).toHaveCount(0);
  await expect(region(page, "รายได้แยกสาขา")).toContainText("฿3,500 100%");
  await expect(region(page, "P&L รายเดือน")).toBeVisible();
});

test("Finance: money out of pocket is an expense when it is paid, and money out of the shop when it is paid back", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Finance");
  // No revenue here: that is the project's Overview.
  await expect(region(page, "รายได้รวม")).toHaveCount(0);
  await expect(jotButtons(page)).toHaveText(["จ่ายเงิน", "คืนเงินพนักงาน"]);
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
  await expect(money("จ่ายเงินทั้งหมด")).toHaveText("−฿500");
  await expect(money("บริษัทจ่ายเอง")).toHaveText("−฿100");
  await expect(money("พนักงานสำรองจ่าย")).toHaveText("฿400");
  await expect(money("คืนเงินพนักงาน")).toHaveText("฿0");
  await expect(money("เงินออกจากร้านจริง")).toHaveText("−฿100");
  await expect(money("ค้างจ่าย ณ วันนี้")).toHaveText("฿400");
  await expect(
    region(page, "จ่ายเงินแยกหมวด").getByRole("row", { name: /^รวมที่จ่าย/ }),
  ).toContainText("−฿500");

  // Pay her back ฿250 of the ฿400: the form opens on her, with what is owed.
  const owed = region(page, "เงินที่พนักงานสำรองจ่าย")
    .getByRole("row", { name: /^น้องฝน/ })
    .getByRole("cell");
  await expect(owed).toHaveText(["น้องฝน", "฿400", "฿0", "฿400", "คืนเงิน"]);
  await page.getByRole("button", { name: "คืนเงิน น้องฝน" }).click();
  await expect(popupTitle(page)).toHaveText("คืนเงินพนักงาน");
  await expect(form(page).getByLabel(/^คืนให้ใคร/)).toHaveValue("น้องฝน");
  await expect(form(page).getByLabel(/^ยอดที่คืน/)).toHaveValue("400");
  await fill(page, [/^ยอดที่คืน/, "250"]);
  await save(page);
  await expect(owed).toHaveText(["น้องฝน", "฿400", "฿250", "฿150", "คืนเงิน"]);
  await expect(rows(page, "reimburse")).toContainText("คืนให้ น้องฝน");
  await expect(rows(page, "reimburse")).toContainText("−฿250");
  // ฿250 more left the shop; what was paid for things is the same ฿500.
  await expect(money("คืนเงินพนักงาน")).toHaveText("−฿250");
  await expect(money("เงินออกจากร้านจริง")).toHaveText("−฿350");
  await expect(money("จ่ายเงินทั้งหมด")).toHaveText("−฿500");
  await expect(money("ค้างจ่าย ณ วันนี้")).toHaveText("฿150");
  await page.getByRole("radio", { name: "ปี" }).click();
  await expect(money("เงินออกจากร้านจริง", "ปี")).toHaveText("−฿350");

  // The profit counted the ฿500 when it was paid: paying back takes nothing more off it.
  await openPage(page, "Overview", true);
  await expect(region(page, "ตัวเลขของเดือน")).toContainText("−฿500");
  await openPage(page, "Overview");
  await expect(region(page, "ตัวเลขของเดือน")).toContainText("−฿500");

  // The Account Manager: the payments by category, nothing about who is owed, no paying back.
  await signInAs(page, "manager");
  await openPage(page, "Finance");
  await expect(jotButtons(page)).toHaveText(["จ่ายเงิน"]);
  await expect(region(page, "จ่ายเงินแยกหมวด")).toContainText("−฿500");
  for (const name of ["เงินของเดือน", "เงินที่พนักงานสำรองจ่าย"])
    await expect(region(page, name)).toHaveCount(0);
  await expect(rows(page, "pay")).toHaveCount(2);
  await expect(rows(page, "reimburse")).toHaveCount(0);
  await page.getByRole("radio", { name: "ปี" }).click();
  await expect(region(page, "จ่ายเงินแยกหมวด")).toContainText("−฿500");
  await openPage(page, "Daily Log");
  await expect(page.locator("body")).not.toContainText("คืนให้");
});

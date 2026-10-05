import { expect, test } from "@playwright/test";
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

/* The Overview as the shop's revenue, and Finance as the project's: the total of the period,
 * by month or by year. */

const today = bangkokDate();
const thai = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("th-TH", {
    ...options,
    timeZone: "UTC",
  });
const monthName = thai(today, { month: "long", year: "numeric" });
const yearName = `ปี ${+today.slice(0, 4) + 543}`;

test("Overview and Finance: a branch's sale is the revenue of the month and of the year", async ({
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
  await openPage(page, "Inventory");
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

  // Finance is the same view of the one project: its name on the total, no table of
  // projects, and the page's own cards after the P&L. It opens on the month.
  await openPage(page, "Finance");
  await expect(revenue.getByRole("heading")).toContainText(
    "Nerdnuea x LINE MAN",
  );
  await expect(revenue.locator("strong")).toHaveText("฿3,500");
  await expect(region(page, "ตัวเลขของเดือน")).toContainText("฿3,150");
  await expect(region(page, "รายได้แต่ละ Project")).toHaveCount(0);
  await expect(region(page, "รายได้แยกสาขา")).toContainText("฿3,500 100%");
  for (const name of [
    "P&L รายเดือน",
    "ยอดคงเหลือที่ยังไม่ได้จ่าย ต่อผู้ขาย",
    "เงินที่พนักงานสำรองจ่าย",
    "จ่ายเงินล่าสุด",
  ])
    await expect(region(page, name)).toBeVisible();
  await page.getByRole("radio", { name: "ปี" }).click();
  await expect(region(page, "P&L รายปี")).toBeVisible();

  // The Account Manager's Finance has no revenue: a month of payments, as before.
  await signInAs(page, "manager");
  await openPage(page, "Finance");
  await expect(revenue).toHaveCount(0);
  await expect(page.getByLabel(/^เดือน/)).toBeVisible();
  await expect(region(page, "จ่ายเงินล่าสุด")).toBeVisible();
});

import { expect, test, type Page } from "@playwright/test";
import {
  bangkokDate,
  bell,
  fill,
  form,
  jot,
  jotButtons,
  openBell,
  openPage,
  popup,
  region,
  rows,
  save,
  signInAs,
  start,
  theDate,
  toast,
} from "./helpers";

/* Spec v2 section 11, items 15–18: the P&L, gift boxes, the rent reminder, sales channels. */

const today = bangkokDate();
const [year, month] = today.split("-").map(Number);
/** `offset` months from this one: its last day, and its name as the pages print it. */
const monthAt = (offset: number) => {
  const end = new Date(Date.UTC(year, month + offset, 0));
  return {
    lastDay: end.toISOString().slice(0, 10),
    id: end.toISOString().slice(0, 7),
    name: end.toLocaleDateString("th-TH", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
  };
};
const [thisMonth, lastMonth, monthBefore] = [0, -1, -2].map(monthAt);
/** The cells of a line after its name: the month, then the month before; in the full P&L
 *  (not in 「ยอดจ่ายแยกหมวด」) the month's share of its sales stands between them. */
const line = (page: Page, name: RegExp, table = "P&L รายเดือน") =>
  region(page, table)
    .getByRole("row", { name })
    .locator("td:not(:first-child)");
/** A figure of the month (the project's Overview, Finance), by its label. */
const figure = (page: Page, label: string) =>
  region(page, "ตัวเลขของเดือน")
    .locator("div")
    .filter({
      has: page.locator("small").filter({
        hasText: new RegExp(`^${label.replace(/[()]/g, "\\$&")}$`),
      }),
    })
    .locator("strong");
const pay = async (
  page: Page,
  category: string,
  amount: string,
  date = today,
) => {
  await jot(page, "จ่ายเงิน");
  await fill(
    page,
    [theDate, date],
    [/^หมวด/, category],
    [/^ยอด \(บาท\)/, amount],
  );
  await save(page);
};

test("15 · V2-CAL-02 the P&L counts a payment in the month it is dated, and อุปกรณ์/ลงทุน is on its own line", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Finance");
  // Jotted today, dated last month: it belongs to last month.
  await pay(page, "อื่น ๆ", "1000", lastMonth.lastDay);
  await pay(page, "ขนส่ง", "500");
  await pay(page, "อุปกรณ์/ลงทุน", "12900");

  // The P&L is on the project's Overview; Finance lists what was paid.
  await expect(region(page, "P&L รายเดือน")).toHaveCount(0);
  await expect(line(page, /^รวมยอดจ่าย/, "ยอดจ่ายแยกหมวด")).toHaveText([
    "−฿500",
    "−฿1,000",
  ]);
  await openPage(page, "Overview", true);
  const pl = region(page, "P&L รายเดือน");
  await expect(pl).toContainText(
    "ยอดตามเดือนที่จ่ายเงิน เป็นตัวเลขประมาณสำหรับบริหาร ไม่ใช่งบสำหรับยื่นภาษี",
  );
  await expect(pl.getByRole("columnheader")).toHaveText([
    "รายการ",
    thisMonth.name,
    "% ของรายได้รวม",
    lastMonth.name,
  ]);
  // Nothing sold: a share of no sales is a dash, never 0% or a division by nothing.
  await expect(line(page, /^ยอดขาย/)).toHaveText(["—", "—", "—"]);
  await expect(line(page, /^อื่น ๆ/)).toHaveText(["—", "—", "−฿1,000"]);
  await expect(line(page, /^ขนส่ง/)).toHaveText(["−฿500", "—", "—"]);
  // The stove is in neither month's profit; it is the line under it.
  await expect(line(page, /^กำไรจากการดำเนินงาน/)).toHaveText([
    "−฿500",
    "—",
    "−฿1,000",
  ]);
  await expect(pl.getByRole("row").nth(-2)).toContainText(
    "กำไรจากการดำเนินงาน",
  );
  await expect(pl.getByRole("row").last().getByRole("cell")).toHaveText([
    "อุปกรณ์/ลงทุน (ไม่รวมในยอดข้างบน)",
    "−฿12,900",
    "—",
    "—",
  ]);
  await expect(figure(page, "กำไรจากการดำเนินงาน")).toHaveText("−฿500");

  // Last month, read as its own month.
  await page.getByRole("button", { name: "เดือนก่อนหน้า" }).click();
  await expect(pl.getByRole("columnheader")).toHaveText([
    "รายการ",
    lastMonth.name,
    "% ของรายได้รวม",
    monthBefore.name,
  ]);
  await expect(line(page, /^อื่น ๆ/)).toHaveText(["−฿1,000", "—", "—"]);
  await expect(line(page, /^ขนส่ง/)).toHaveText(["—", "—", "—"]);
  await expect(line(page, /^อุปกรณ์\/ลงทุน/)).toHaveText(["—", "—", "—"]);
  await expect(line(page, /^กำไรจากการดำเนินงาน/)).toHaveText([
    "−฿1,000",
    "—",
    "—",
  ]);
  await expect(figure(page, "กำไรจากการดำเนินงาน")).toHaveText("−฿1,000");
});

test("16 · V2-CAL-14 gift boxes are a figure of their own and do not change the P&L profit", async ({
  page,
}) => {
  await start(page, "sample");
  await signInAs(page, "owner");
  // The shop's Overview has no figure cards and no P&L: its profit is the last figure of
  // 「จากรายได้ถึงกำไร」.
  const shopProfit = region(page, "จากรายได้ถึงกำไร").locator("span").last();
  await expect(shopProfit).toContainText("฿");
  const profitBefore = await shopProfit.innerText();
  expect(profitBefore).toMatch(/฿[\d,]+/);
  // The project's own Overview leaves out the company's other income (the sample's ฿412.35 of
  // interest, five days ago): its profit is that much under the shop's while both are this month's.
  await openPage(page, "Overview", true);
  await expect(page).toHaveURL(/\/owner\/nn-x-lm\/overview$/);
  const gifts = figure(page, "กล่องแจกเดือนนี้");
  const profit = figure(page, "กำไรจากการดำเนินงาน");
  await expect(gifts).toContainText("ไม่นับใน P&L");
  const before = Number((await gifts.innerText()).match(/^([\d,]+) กล่อง/)![1]);
  const ownBefore = await profit.innerText();
  const lineBefore = await line(page, /^กำไรจากการดำเนินงาน/).allInnerTexts();
  const baht = (text: string) => Number(text.replace(/[฿,]/g, ""));
  const interest =
    bangkokDate(-5).slice(0, 7) === today.slice(0, 7) ? 412.35 : 0;
  expect(
    Math.abs(baht(profitBefore) - baht(ownBefore) - interest),
  ).toBeLessThan(1);

  // A gift box is the branch's to jot: the Owner's Inventory has no button for it.
  await openPage(page, "Inventory");
  await expect(jotButtons(page)).toHaveText(["จัดสรรสินค้า"]);
  await signInAs(page, "minburi");
  await openPage(page, "Sales");
  await jot(page, "กล่องแจก");
  await fill(page, [/^ชื่ออินฟลูเอนเซอร์/, "@nerdnuea"], [/^กล่องที่แจก/, "4"]);
  await save(page);
  await expect(toast(page, "จดแล้ว: กล่องแจก")).toBeVisible();
  await signInAs(page, "owner");

  // The shop's Overview: the same profit, and no word of the gift boxes.
  await expect(shopProfit).toHaveText(profitBefore);
  await expect(page.getByRole("main")).not.toContainText("กล่องแจก");
  await openPage(page, "Overview", true);
  // The sample's complete PO รมควัน: (140,000 + 24,000 + 6,000 of its round trip) ÷ 104 กก.
  // × 0.12 + ฿25 a box.
  const value = Math.round((before + 4) * ((170000 / 104) * 0.12 + 25));
  await expect(gifts).toContainText(`${before + 4} กล่อง`);
  await expect(gifts).toContainText(
    `ต้นทุนประมาณ ฿${value.toLocaleString("en-US")}`,
  );
  await expect(profit).toHaveText(ownBefore);
  await expect(line(page, /^กำไรจากการดำเนินงาน/)).toHaveText(lineBefore);
  await expect(region(page, "P&L รายเดือน")).not.toContainText("กล่องแจก");
});

test("17 · V2-PAY-04 a month with no ค่าเช่า/น้ำไฟ jotted is yellow until it is", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  // The Overview shows revenue only: the reminder is in the bell.
  await expect(region(page, "ยังไม่ได้จด")).toHaveCount(0);
  const reminder = region(page, "การแจ้งเตือน").getByRole("button", {
    name: `ค่าเช่า/น้ำไฟ ของ${thisMonth.name}`,
  });
  await bell(page).click();
  await expect(reminder).toBeVisible();
  await page.keyboard.press("Escape");
  // The P&L line is on the project's Overview: the shop's has no P&L.
  await expect(region(page, "P&L รายเดือน")).toHaveCount(0);
  await openPage(page, "Overview", true);
  const rent = line(page, /^ค่าเช่า\/น้ำไฟ/);
  await expect(rent).toHaveText(["ยังไม่ได้จด", "—", "—"]);
  await expect(rent.first()).toHaveAttribute("data-tone", "warning");

  // Nothing is filled in from the month before: last month's rent leaves this month yellow.
  await openPage(page, "Finance");
  await pay(page, "ค่าเช่า/น้ำไฟ", "18000", lastMonth.lastDay);
  await openPage(page, "Overview", true);
  await expect(rent).toHaveText(["ยังไม่ได้จด", "—", "−฿18,000"]);
  await expect(rent.first()).toHaveAttribute("data-tone", "warning");

  // The reminder opens the payment form on that category.
  await bell(page).click();
  await reminder.click();
  await expect(form(page).getByLabel(/^หมวด/)).toHaveAttribute(
    "data-value",
    "rent",
  );
  await fill(page, [/^ยอด \(บาท\)/, "20500"]);
  await save(page);
  await expect(reminder).toHaveCount(0);
  await expect(rent).toHaveText(["−฿20,500", "—", "−฿18,000"]);
  await expect(rent.first()).not.toHaveAttribute("data-tone", "warning");
  await openPage(page, "Finance");
  await expect(line(page, /^ค่าเช่า\/น้ำไฟ/, "ยอดจ่ายแยกหมวด")).toHaveText([
    "−฿20,500",
    "−฿18,000",
  ]);
});

test("18 · Q28 V2-CAL-01 a sales channel added in Settings is a money field of the sale form, with its own GP", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Settings");
  const channels = region(page, "ช่องทางขาย");
  await channels.getByRole("button", { name: "เพิ่มช่องทาง" }).click();
  // The row's inputs are named after what is typed in it: take them by place.
  const inputs = channels.getByRole("textbox");
  await expect(inputs).toHaveCount(4);
  await inputs.nth(2).fill("Grab");
  await inputs.nth(3).fill("30");
  await channels.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(toast(page, "บันทึกแล้ว: ช่องทางขาย")).toBeVisible();
  await expect(channels.getByRole("row", { name: /^Grab/ })).toContainText(
    "30",
  );

  // A note of the branch today with no sale: its sale is due. It is the branch's to jot: to
  // the Owner its line in the bell is a status, not a button.
  await signInAs(page, "saladaeng");
  await openPage(page, "Sales");
  await jot(page, "กล่องแจก");
  await fill(
    page,
    [/^ชื่ออินฟลูเอนเซอร์/, "@kinkubnong"],
    [/^กล่องที่แจก/, "2"],
  );
  await save(page);
  await signInAs(page, "owner");
  const reminders = await openBell(page);
  const due = reminders.getByText("ศาลาแดง: ยอดขาย วันนี้", { exact: true });
  await expect(due).toBeVisible();
  await expect(reminders.getByRole("button", { name: /ยอดขาย/ })).toHaveCount(
    0,
  );
  await due.click();
  await expect(popup(page)).toHaveCount(0);
  await page.keyboard.press("Escape");

  // The branch jots its sale with both channels: its form has the new field.
  await signInAs(page, "saladaeng");
  await openPage(page, "Sales");
  await jot(page, "ยอดขาย");
  await expect(form(page).getByLabel(/^ยอดขาย Grab/)).toBeVisible();
  await fill(
    page,
    [/^กล่องมาตรฐาน/, "12"],
    [/^ยอดขาย LINE MAN/, "3500"],
    [/^ยอดขาย Grab/, "700"],
  );
  await save(page);
  await openPage(page, "Daily Log");
  await expect(rows(page, "sale")).toContainText("+฿4,200");

  await signInAs(page, "owner");
  await openPage(page, "Daily Log");
  await expect(rows(page, "sale")).toContainText("+฿4,200");
  await openPage(page, "Overview", true);
  // Each line beside its share of the month's sales, signed as the line is: 350 and 210 of
  // 4,200; nothing was sold last month.
  await expect(line(page, /^ยอดขาย/)).toHaveText(["฿4,200", "100%", "—"]);
  await expect(line(page, /^GP LINE MAN 10%/)).toHaveText([
    "−฿350",
    "−8.3%",
    "—",
  ]);
  await expect(line(page, /^GP Grab 30%/)).toHaveText(["−฿210", "−5%", "—"]);
  await expect(line(page, /^กำไรจากการดำเนินงาน/)).toHaveText([
    "฿3,640",
    "87%",
    "—",
  ]);
  await expect(region(page, "ตัวเลขของเดือน")).toContainText("GP ฿560");
});

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
  popupTitle,
  region,
  rows,
  save,
  signInAs,
  start,
  theDate,
  toast,
} from "./helpers";

/* Spec v2 section 11, items 15–18: the P&L, gift boxes, the rent reminder, sales channels and
 * what they still owe; then whose pocket the money out left. */

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
/** A figure of Finance's 「เงินของเดือน」 (or 「เงินของปี」), by its label. */
const money = (page: Page, label: string, span = "เดือน") =>
  region(page, `เงินของ${span}`)
    .locator("div")
    .filter({
      has: page.locator("small").filter({ hasText: new RegExp(`^${label}$`) }),
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
    [/^ยอดค้างชำระ \(บาท\)/, amount],
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
  // The project's own Overview leaves out the company's own money: the sample's ฿412.35 of
  // interest (five days ago) and its office paper (฿650 twenty days ago, ฿260 four days ago),
  // each while it is this month's.
  await openPage(page, "Overview", true);
  await expect(page).toHaveURL(/\/owner\/nn-x-lm\/overview$/);
  const gifts = figure(page, "กล่องแจกเดือนนี้");
  const profit = figure(page, "กำไรจากการดำเนินงาน");
  await expect(gifts).toContainText("ไม่นับใน P&L");
  const before = Number((await gifts.innerText()).match(/^([\d,]+) กล่อง/)![1]);
  const ownBefore = await profit.innerText();
  const lineBefore = await line(page, /^กำไรจากการดำเนินงาน/).allInnerTexts();
  const baht = (text: string) => Number(text.replace(/[฿,]/g, ""));
  const company = (
    [
      [5, 412.35],
      [20, -650],
      [4, -260],
    ] as const
  ).reduce(
    (a, [ago, x]) =>
      a + (bangkokDate(-ago).slice(0, 7) === today.slice(0, 7) ? x : 0),
    0,
  );
  expect(Math.abs(baht(profitBefore) - baht(ownBefore) - company)).toBeLessThan(
    1,
  );

  // A gift box is the branch's to jot: the Owner's Inventory has no button for it.
  await openPage(page, "Inventory");
  await expect(jotButtons(page)).toHaveText(["จัดสรรสินค้า"]);
  await signInAs(page, "minburi");
  await openPage(page, "Sales");
  await jot(page, "กล่องแจก");
  await fill(
    page,
    [/^ชื่ออินฟลูเอนเซอร์/, "@nerdnuea"],
    [/^กล่องมาตรฐาน/, "4"],
  );
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
  await fill(page, [/^ยอดค้างชำระ \(บาท\)/, "20500"]);
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

test("18 · Q28 V2-CAL-01 a sales channel added in Settings is a money field of the sale form, with its own GP, and Finance sets its receipts against what it sold", async ({
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
    [/^กล่องมาตรฐาน/, "2"],
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

  // Finance (V2-CAL-25): what each channel sold after its GP, against its receipts. No receipt
  // jotted for a channel yet: what it paid is not known.
  await signInAs(page, "owner");
  await openPage(page, "Daily Log");
  await expect(rows(page, "sale")).toContainText("+฿4,200");
  await openPage(page, "Finance");
  const owes = region(page, "ยอดค้างรับแยกช่องทางขาย");
  const channel = (name: string) =>
    owes.getByRole("row", { name: new RegExp(`^${name}`) }).getByRole("cell");
  await expect(channel("LINE MAN")).toHaveText([
    "LINE MAN",
    "฿3,150",
    "ยังไม่ได้จด",
    "ยังไม่ได้จด",
    "รับเงิน",
  ]);
  await expect(channel("Grab")).toHaveText([
    "Grab",
    "฿490",
    "ยังไม่ได้จด",
    "ยังไม่ได้จด",
    "รับเงิน",
  ]);
  await expect(money(page, "ยอดค้างรับถึงวันนี้")).toHaveText("ยังไม่ได้จด");
  await expect(region(page, "เงินของเดือน")).toContainText(
    "ไม่มีรายรับที่รอรับ",
  );

  // 「รับเงิน」 opens a sales receipt of the channel on what it owes; it paid ฿3,000 of it.
  await page.getByRole("button", { name: "รับเงิน LINE MAN" }).click();
  await expect(form(page).getByLabel(/^ช่องทางขาย/)).toHaveAttribute(
    "data-value",
    "lineMan",
  );
  await expect(form(page).getByLabel(/^ยอดรับจริง/)).toHaveValue("3,150");
  await fill(page, [/^ยอดรับจริง/, "3000"]);
  await save(page);
  await expect(channel("LINE MAN")).toHaveText([
    "LINE MAN",
    "฿3,150",
    "฿3,000",
    "฿150",
    "รับเงิน",
  ]);
  await expect(money(page, "ยอดค้างรับถึงวันนี้")).toHaveText("฿150");
  await expect(money(page, "เงินเข้าจริง")).toHaveText("+฿3,000");

  // Grab's receipt is still awaited (รอรับ): it owes all of it, and it is not money yet.
  await page.getByRole("button", { name: "รับเงิน Grab" }).click();
  await fill(page, [/^สถานะ/, "รอรับ"]);
  await save(page);
  await expect(channel("Grab")).toHaveText([
    "Grab",
    "฿490",
    "฿0",
    "฿490",
    "รับเงิน",
  ]);
  await expect(money(page, "ยอดค้างรับถึงวันนี้")).toHaveText("฿640");
  await expect(region(page, "เงินของเดือน")).toContainText(
    "รอรับอีก 1 รายการ ฿490",
  );
  await expect(money(page, "เงินเข้าจริง")).toHaveText("+฿3,000");

  // The project's Overview: the receipt in hand is the revenue, by channel; no GP line.
  await openPage(page, "Overview", true);
  await expect(line(page, /^ยอดขาย/)).toHaveText(["฿3,000", "100%", "—"]);
  await expect(
    region(page, "P&L รายเดือน").getByRole("row", { name: /^GP / }),
  ).toHaveCount(0);
  const byChannel = region(page, "ยอดขายแยกช่องทางขาย");
  await expect(byChannel).toContainText(/LINE MAN\s*฿3,000 100%/);
  await expect(byChannel).toContainText(/Grab\s*฿0/);
  await expect(byChannel).toContainText("หัก GP 30% แล้ว");
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
      [/^ยอดค้างชำระ \(บาท\)/, amount],
      [/^ผู้จ่าย/, payer],
    );
    await save(page);
  }
  await expect(money(page, "ยอดจ่ายทั้งหมด")).toHaveText("−฿500");
  await expect(money(page, "บริษัทจ่ายเอง")).toHaveText("−฿100");
  await expect(money(page, "พนักงานสำรองจ่าย")).toHaveText("฿400");
  await expect(money(page, "เงินคืนพนักงาน")).toHaveText("฿0");
  await expect(money(page, "เงินออกจากร้านจริง")).toHaveText("−฿100");
  await expect(money(page, "ยอดค้างจ่ายถึงวันนี้")).toHaveText("฿400");
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
  await expect(money(page, "เงินคืนพนักงาน")).toHaveText("−฿250");
  await expect(money(page, "เงินออกจากร้านจริง")).toHaveText("−฿350");
  await expect(money(page, "ยอดจ่ายทั้งหมด")).toHaveText("−฿500");
  await expect(money(page, "ยอดค้างจ่ายถึงวันนี้")).toHaveText("฿150");
  await page.getByRole("radio", { name: "ปี" }).click();
  await expect(money(page, "เงินออกจากร้านจริง", "ปี")).toHaveText("−฿350");

  // The profit counted the ฿500 when it was paid: paying back takes nothing more off it.
  await openPage(page, "Overview", true);
  await expect(figure(page, "กำไรจากการดำเนินงาน")).toHaveText("−฿500");
  // The shop's Overview: the last figure of 「จากรายได้ถึงกำไร」.
  await openPage(page, "Overview");
  await expect(
    region(page, "จากรายได้ถึงกำไร").locator("span").last(),
  ).toHaveText("−฿500");
});

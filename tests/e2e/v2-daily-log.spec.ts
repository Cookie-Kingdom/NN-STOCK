import { expect, test, type Page } from "@playwright/test";
import {
  bangkokDate,
  fill,
  jot,
  logRows,
  openBell,
  openPage,
  openRow,
  pickDay,
  popupTitle,
  region,
  rows,
  save,
  savePo,
  signInAs,
  start,
  theDate,
} from "./helpers";

/* The Daily Log: one table of everything saved, newest first by when it was saved, under a
 * line per day of saving. The Owner filters it by group, every account by the days of saving;
 * nothing on it reminds (the bell does). On a phone a row is one cell of two lines. */

/** A day as the cell of วันที่รายการ prints it, `offset` days from today. */
const noteDate = (offset: number) =>
  new Date(`${bangkokDate(offset)}T00:00:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
/** Every row of the log, a note jotted or a change. */
const entryRows = (page: Page) => page.locator("tr[data-entry]");
/** The lines for the days of saving, one over the rows saved on it. */
const dayLines = (page: Page) => page.locator('th[scope="rowgroup"]');
/** The kinds of the notes in the table, sorted. */
const kindsShown = (page: Page) =>
  entryRows(page)
    .evaluateAll((list) => list.map((row) => row.getAttribute("data-kind")))
    .then((kinds) => kinds.sort());
/** A date of the filter above the table, by its label. */
const savedFilter = (page: Page, label: RegExp) =>
  page.getByRole("main").getByLabel(label);
const giftBox = async (page: Page) => {
  await openPage(page, "Sales");
  await jot(page, "กล่องแจก");
  await fill(
    page,
    [/^ชื่ออินฟลูเอนเซอร์/, "@kinkubnong"],
    [/^กล่องมาตรฐาน/, "2"],
  );
  await save(page);
};
/** A sale of the branch signed in, for the day `offset` days from today. */
const sale = async (page: Page, amount: string, offset = 0) => {
  await openPage(page, "Sales");
  await jot(page, "ยอดขาย");
  if (offset) await fill(page, [theDate, bangkokDate(offset)]);
  await fill(page, [/^กล่องมาตรฐาน/, "10"], [/^ยอดขาย LINE MAN/, amount]);
  await save(page);
};

test("Daily Log: a note jotted today for an earlier day is the top row under today's line, the filter by day of saving empties and refills the table, and nothing on the page reminds", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "saladaeng");
  // Today's gift box first, then a sale for two days ago: the sale was saved last.
  await giftBox(page);
  await sale(page, "3500", -2);
  await openPage(page, "Daily Log");
  await expect(entryRows(page)).toHaveCount(2);
  // Both were saved today: one line, today's, whatever day each note is about.
  await expect(dayLines(page)).toHaveCount(1);
  await expect(dayLines(page)).toContainText("วันนี้");
  const top = entryRows(page).first();
  await expect(top).toHaveAttribute("data-kind", "sale");
  await expect(top).toHaveAttribute("data-action", "jot");
  // A branch's table has no สาขา column: วันที่รายการ is the fourth.
  await expect(page.getByRole("columnheader")).toHaveText([
    "บันทึกเมื่อ",
    "การกระทำ",
    "รายการ",
    "วันที่รายการ",
    "PO / Lot",
    "รายละเอียด",
    "จำนวนเงิน",
  ]);
  await expect(top.getByRole("cell").nth(3)).toHaveText(noteDate(-2));
  await expect(entryRows(page).nth(1).getByRole("cell").nth(3)).toHaveText(
    noteDate(0),
  );

  // Today has a note and no sale: the sale is due, and only the bell says so.
  const main = page.getByRole("main");
  await expect(region(page, "ยังไม่ได้จด")).toHaveCount(0);
  await expect(main).not.toContainText("ยังไม่ได้จด");
  await expect(main).not.toContainText("ยอดขาย วันนี้");
  const reminders = await openBell(page);
  await expect(
    reminders.getByRole("button", { name: "ยอดขาย วันนี้" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // Saved up to yesterday: nothing was. 「ล้าง」 brings the rows back.
  const until = savedFilter(page, /^ถึง/);
  await pickDay(until, bangkokDate(-1));
  await expect(entryRows(page)).toHaveCount(0);
  await expect(main).toContainText("ไม่มีบันทึกตามตัวกรอง");
  await expect(main).toContainText("0 รายการ");
  await until.click();
  await page.getByRole("button", { name: "ล้าง", exact: true }).click();
  await expect(entryRows(page)).toHaveCount(2);
  await expect(main).not.toContainText("ไม่มีบันทึกตามตัวกรอง");
  // Saved from today on: both, the sale of two days ago with them.
  await pickDay(savedFilter(page, /^บันทึกตั้งแต่/), bangkokDate());
  await expect(entryRows(page)).toHaveCount(2);
  await expect(rows(page, "sale")).toHaveCount(1);
});

test("Daily Log: the Owner's filter puts a payment and an expense under เงิน, a branch's sale and a transfer under สาขา, a PO under Lot, and each note in one group only", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "saladaeng");
  await sale(page, "3500");

  await signInAs(page, "owner");
  await openPage(page, "Finance");
  await jot(page, "จ่ายเงิน");
  await fill(page, [/^หมวด/, "ขนส่ง"], [/^ยอด \(บาท\)/, "400"]);
  await save(page);
  await openPage(page, "Accounting");
  await jot(page, "บันทึกค่าใช้จ่าย");
  await fill(
    page,
    [/^ประเภทสินค้า/, "อื่นๆ"],
    [/^รายการ/, "หมึกพิมพ์"],
    [/^ยอดจ่ายจริง/, "500"],
  );
  await save(page);
  // A move of stock from the central warehouse to a branch.
  await openPage(page, "Inventory");
  await jot(page, "จัดสรรสินค้า");
  await fill(
    page,
    [/^รายการ/, "กล่องบรรจุ"],
    [/^คลังปลายทาง/, "สาขาศาลาแดง"],
    [/^จำนวน/, "5"],
  );
  await save(page);
  await openPage(page, "Lots");
  await page.getByRole("button", { name: "+ สร้าง PO เนื้อ" }).click();
  await expect(popupTitle(page)).toHaveText("PO เนื้อ");
  await fill(page, [/^น้ำหนักเนื้อ(?!รอรับ)/, "100"], [/^ราคา \/ กก\./, "700"]);
  await savePo(page);

  await openPage(page, "Daily Log");
  const group = (name: string) =>
    page
      .getByRole("radiogroup", { name: "กรองบันทึก" })
      .getByRole("radio", { name, exact: true });
  const shows = (...kinds: string[]) =>
    expect.poll(() => kindsShown(page)).toEqual(kinds.sort());
  const all = ["expense", "pay", "purchase", "sale", "transfer"];
  await expect(group("ทั้งหมด")).toBeChecked();
  await shows(...all);
  // The Owner's table names the branch of a note.
  await expect(page.getByRole("columnheader").nth(4)).toHaveText("สาขา");
  await expect(rows(page, "sale").getByRole("cell").nth(4)).toHaveText(
    "ศาลาแดง",
  );

  await group("เงิน").click();
  await shows("expense", "pay");
  await group("สาขา").click();
  await shows("sale", "transfer");
  await group("Lot").click();
  await shows("purchase");
  await group("ทั้งหมด").click();
  await shows(...all);
  await expect(logRows(page, "jot")).toHaveCount(5);

  // The filter by day of saving is the Owner's too, over the group picked.
  await group("เงิน").click();
  const until = savedFilter(page, /^ถึง/);
  await pickDay(until, bangkokDate(-1));
  await expect(entryRows(page)).toHaveCount(0);
  await expect(page.getByRole("main")).toContainText("ไม่มีบันทึกตามตัวกรอง");
  await until.click();
  await page.getByRole("button", { name: "ล้าง", exact: true }).click();
  await shows("expense", "pay");
});

test.describe("phone, 390px wide", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Daily Log on a phone: a row is one cell of two lines, the page does not scroll sideways, and a press opens the note's values with แก้ไข and ลบ", async ({
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
    await sale(page, "6100", -1);
    await openPage(page, "Daily Log");
    const row = rows(page, "sale");
    await expect(row).toHaveCount(1);
    // No head and no columns: the one cell holds the whole row.
    await expect(page.getByRole("columnheader")).toHaveCount(0);
    const cell = row.getByRole("cell");
    await expect(cell).toHaveCount(1);
    const title = cell.locator("strong");
    const amount = cell.getByText("+฿6,100", { exact: true });
    const second = cell.getByText(/^วันที่รายการ/);
    await expect(title).toHaveText("ยอดขาย");
    await expect(amount).toBeVisible();
    // The second line: the day the note is about (it was jotted for yesterday), then its detail.
    await expect(second).toBeVisible();
    const [first, money, under] = await Promise.all(
      [title, amount, second].map((part) => part.boundingBox()),
    );
    expect(under!.y).toBeGreaterThanOrEqual(first!.y + first!.height);
    expect(under!.y).toBeGreaterThanOrEqual(money!.y + money!.height);
    await fits();

    // A press opens every value of the note, and what the branch may do with it.
    const opened = await openRow(row);
    await expect(opened).toContainText("ยอดขาย LINE MAN");
    await expect(opened).toContainText("6,100");
    await expect(
      opened.getByRole("button", { name: "แก้ไข", exact: true }),
    ).toBeVisible();
    await expect(
      opened.getByRole("button", { name: "ลบ", exact: true }),
    ).toBeVisible();
    await fits();
  });
});

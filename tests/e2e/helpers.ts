import { expect, test, type Locator, type Page } from "@playwright/test";

/* The v2 suite: each spec walks the checklist of Spec v2 section 11 (its item number and rule
 * id are in the test title) the way a user does: jot through the composer, read the page.
 *
 * Run it only with `pnpm test:e2e:local` (local SQLite, its own port): every test resets the
 * one app_state row, so it never runs against Supabase. */

type AccountKey = "owner" | "saladaeng" | "minburi";

/** A Bangkok business date, `offset` days from today (the app's `today()`). */
export function bangkokDate(offset = 0) {
  const day = new Date(Date.now() + offset * 86_400_000);
  return day.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

/** Resets the local database to the empty `seed` or to the approved `sample` (35 days ending
 *  today, src/lib/store/demo.ts) and opens the sign-in page. */
export async function start(page: Page, state: "seed" | "sample") {
  test.skip(
    process.env.NEXT_PUBLIC_LOCAL_DB !== "1",
    "runs on the local SQLite backend only (pnpm test:e2e:local)",
  );
  const response = await page.request.put(`/api/local-db?state=${state}`);
  expect(response.ok(), `PUT /api/local-db → ${response.status()}`).toBe(true);
  await page.goto("/");
}

/** Signs out (when signed in) and in as `account`: local mode takes `<account>@local.test`. */
export async function signInAs(page: Page, account: AccountKey) {
  const signOut = page.getByRole("button", { name: "ออกจากระบบ" });
  if (await signOut.count()) await signOut.click();
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("อีเมล").fill(`${account}@local.test`);
  await page.getByLabel("รหัสผ่าน").fill("local-test");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(signOut).toBeVisible({ timeout: 30_000 });
  // The page stands in a loading panel until the server's payload is in.
  await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0, {
    timeout: 30_000,
  });
}

/** The page list: the sidebar, or the bottom tabs on a phone. */
export const nav = (page: Page) =>
  page.getByRole("navigation", { name: "หน้า" });

/** The pages of the menu, without the button that folds their section. */
export const pageButtons = (page: Page) =>
  nav(page).locator("button:not([aria-expanded])");

/** Opens a page by its (English) name and waits for its heading. */
export async function openPage(page: Page, name: string, project = false) {
  // The Owner has two pages named Overview: the shop's, then (`project`) the project's.
  const buttons = nav(page).getByRole("button", { name, exact: true });
  await (project ? buttons.last() : buttons.first()).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
}

/** A card or section of a page, by its accessible name. */
export const region = (page: Page, name: string | RegExp) =>
  page.getByRole("region", { name, exact: true });

/** The popup in view: a note's form, a PO document, or the confirm of a delete. */
export const popup = (page: Page) => page.locator("dialog[open]");

/** The popup's title: the note's kind, behind 「แก้ไข: 」 on an edit. */
export const popupTitle = (page: Page) => popup(page).locator("h2");

/** The form of the popup in view. */
export const form = (page: Page) => popup(page).locator("form");

/** The buttons at the head of a page, one per kind of note the page takes. */
export const jotButtons = (page: Page) =>
  page.getByRole("group", { name: "จดบันทึก" }).getByRole("button");

/** Presses the page's button of a kind, by its title: its form opens as a popup. */
export async function jot(page: Page, kind: string) {
  await jotButtons(page)
    .filter({ hasText: new RegExp(`^${kind}$`) })
    .click();
  await expect(popupTitle(page)).toHaveText(kind);
}

/** 「ลบ」 on a note asks first: confirms it. */
export async function confirmDelete(page: Page) {
  await page
    .getByRole("alertdialog", { name: "ลบบันทึกนี้?" })
    .getByRole("button", { name: "ลบ", exact: true })
    .click();
}

/** The rows of the dropdown that is open: one list at a time, in the top layer. */
const dropdownRows = (page: Page) =>
  page.getByRole("listbox").getByRole("option");

/** Opens a dropdown and presses the row of this text, or the row at this place. */
export async function pick(control: Locator, row: string | number) {
  await control.click();
  const rows = dropdownRows(control.page());
  await (
    typeof row === "number"
      ? rows.nth(row)
      : rows.filter({ hasText: new RegExp(`^${escapeRegExp(row)}$`) })
  ).click();
  await expect(rows).toHaveCount(0);
}

/** The rows a dropdown offers, in order: opens it, reads them, closes it. */
export async function choices(control: Locator) {
  await control.click();
  const texts = await dropdownRows(control.page()).allInnerTexts();
  await control.press("Escape");
  return texts;
}

/** The date of the open form, as a label for `fill` and `getByLabel`. It is a DatePicker,
 *  so its label runs on into the day it holds ("วันที่ 9 ต.ค. 2569"); a field such as
 *  「วันที่ Invoice」 is not matched. Its value is its `data-value` (`YYYY-MM-DD`). */
export const theDate = /^วันที่\s*(\d|เลือก)/;

/** Picks `day` (`YYYY-MM-DD`) in a DatePicker: steps its calendar to the month, presses
 *  the day. */
export async function pickDay(control: Locator, day: string) {
  const page = control.page();
  const from = (await control.getAttribute("data-value")) || bangkokDate();
  await control.click();
  const step = page.getByRole("button", {
    name: day < from ? "เดือนก่อนหน้า" : "เดือนถัดไป",
  });
  const cell = page.locator(`button[data-date="${day}"]`);
  while (!(await cell.count())) await step.click();
  await cell.click();
  await expect(cell).toHaveCount(0);
}

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Fills the open form: `[label, value]` pairs in order; a dropdown takes the row's
 *  text, a date its `YYYY-MM-DD`. A label's text runs on into its unit, its hint or its options, so each is matched
 *  from its start (`/^ยอด \(บาท\)/`). */
export async function fill(page: Page, ...pairs: [RegExp, string][]) {
  for (const [label, value] of pairs) {
    const control = form(page).getByLabel(label).filter({ visible: true });
    if ((await control.getAttribute("aria-haspopup")) === "dialog")
      await pickDay(control, value);
    else if ((await control.evaluate((el) => el.tagName)) === "BUTTON")
      await pick(control, value);
    else {
      await control.fill(value);
      // A field with suggestions: its list would lie over the next control.
      await control.blur();
    }
  }
}

/** 「บันทึก」: the form closes on a save and stays open, with the reason, on a refusal. */
export async function save(page: Page) {
  await form(page).getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(form(page)).toHaveCount(0);
}

/** 「บันทึก」 on a PO document: it stays open on the saved PO, so 「ปิด」 after it. */
export async function savePo(page: Page) {
  await form(page).getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(popup(page).locator("header")).toContainText("บันทึกแล้ว");
  await form(page).getByRole("button", { name: "ปิด", exact: true }).click();
  await expect(form(page)).toHaveCount(0);
}

/** The message at the bottom of the screen after a save, a delete or an undo. */
export const toast = (page: Page, message: string | RegExp) =>
  page.locator("main").getByRole("status").filter({ hasText: message });

/** The bell (the sidebar's, or the top bar's on a phone): its name counts what is not jotted
 *  yet. The reminders are here alone; no page lists them. */
export const bell = (page: Page) =>
  page
    .getByRole("button", { name: /^ยังไม่ได้จด \d+ อย่าง$/ })
    .filter({ visible: true });

/** Opens the bell and gives its list: a line per thing not jotted yet. Escape closes it. */
export async function openBell(page: Page) {
  await bell(page).click();
  return region(page, "การแจ้งเตือน");
}

/** Daily Log: draws every row of the table (it starts with its first 50). */
export const allRows = async (page: Page) => {
  const more = page
    .getByRole("main")
    .getByRole("button", { name: /^ดูเพิ่มเติม/ });
  while (await more.count()) await more.click();
};

/** The rows of one kind (`data-kind`) on the page: Daily Log, a Lot, Finance. In the Daily Log
 *  these are the rows of notes jotted, each as it was first jotted: one stays after its note
 *  is edited (「แก้ไขภายหลัง」) or deleted (「ลบแล้ว」). */
export const rows = (page: Page, kind: string) =>
  page.locator(`[data-entry][data-kind="${kind}"]`);

/** Daily Log: the rows of one action (`data-action`): `jot`, `edit`, `void` or `undo`. */
export const logRows = (page: Page, action: string) =>
  page.locator(`tr[data-entry][data-action="${action}"]`);

/** Daily Log: presses a row open (when it is not) and gives the row under it: every value,
 *  who saved it and when, and its 「แก้ไข」 and 「ลบ」, or the 「ย้อนกลับ」 of a change. */
export async function openRow(row: Locator) {
  const head = row.getByRole("button").first();
  if ((await head.getAttribute("aria-expanded")) !== "true") await head.click();
  return row.locator("xpath=following-sibling::tr[1]");
}

/** A branch's daily stock sheet (its Stock, its Inventory): a figure's input or cell, by the
 *  column's name and the item's (「ใช้ไป เนื้อ」, 「คงเหลือ เนื้อ」, 「ของตั้งต้น เนื้อ」). */
export const sheetCell = (page: Page, column: string, item: string) =>
  page.getByRole("main").getByLabel(`${column} ${item}`, { exact: true });

/** The sheet's two views: 「ใบสต๊อกรายวัน」 and 「ตั้งสต๊อกเริ่มต้น」. */
export const sheetView = (page: Page, view: string) =>
  page.getByRole("radiogroup", { name: "มุมมอง" }).getByRole("radio", {
    name: view,
    exact: true,
  });

/** 「แก้ไขบันทึก」 when the sheet in view is saved (it opens locked). */
async function unlockSheet(page: Page) {
  const edit = page
    .getByRole("main")
    .getByRole("button", { name: "แก้ไขบันทึก", exact: true });
  if (await edit.count()) await edit.click();
}

/** Sets the opening stock of the page's sheet: `[item, quantity]` pairs. The sheet goes back
 *  to its daily view on the save. */
export async function setOpening(page: Page, ...pairs: [string, string][]) {
  await sheetView(page, "ตั้งสต๊อกเริ่มต้น").click();
  await unlockSheet(page);
  for (const [item, qty] of pairs)
    await sheetCell(page, "ของตั้งต้น", item).fill(qty);
  await page
    .getByRole("main")
    .getByRole("button", { name: "บันทึกของตั้งต้น", exact: true })
    .click();
  await expect(toast(page, /^จดแล้ว: ตั้งสต๊อกเริ่มต้น/)).toBeVisible();
}

/** Types the day's figures into the daily sheet in view, `[column, item, value]` each, and
 *  saves it: a saved day is unlocked first. */
export async function saveSheet(
  page: Page,
  reporter: string,
  ...figures: [string, string, string][]
) {
  await unlockSheet(page);
  for (const [column, item, value] of figures)
    await sheetCell(page, column, item).fill(value);
  await page
    .getByRole("main")
    .getByLabel(/^ผู้บันทึก/)
    .fill(reporter);
  await page
    .getByRole("main")
    .getByRole("button", { name: "บันทึกการใช้วันนี้", exact: true })
    .click();
  await expect(toast(page, /^จดแล้ว: ใบสต๊อกรายวัน/)).toBeVisible();
}

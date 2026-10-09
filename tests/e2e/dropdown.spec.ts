import { expect, test, type Page } from "@playwright/test";
import {
  choices,
  form,
  jot,
  openPage,
  pick,
  popupTitle,
  save,
  signInAs,
  start,
} from "./helpers";

/* The two dropdowns of a note form (`atoms/Select`, `atoms/Combobox`), walked inside the
 * popup of 「บันทึกค่าใช้จ่าย」: a dropdown to pick from, and a text field with suggestions. */

const list = (page: Page) => page.getByRole("listbox");
const openExpense = async (page: Page) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Accounting");
  await jot(page, "บันทึกค่าใช้จ่าย");
};

test("a dropdown opens over the popup, takes the pointer and the keyboard, and Escape closes the list only", async ({
  page,
}) => {
  await openExpense(page);
  const status = form(page).getByLabel(/^สถานะ/);
  const rows = await choices(status);
  expect(rows.length).toBeGreaterThan(2);
  expect(rows).toContain("จ่ายแล้ว");

  // The pointer: the list lies wholly in view, over the popup, and a press picks and closes it.
  await status.click();
  await expect(list(page)).toBeInViewport({ ratio: 1 });
  await expect(status).toHaveAttribute("aria-expanded", "true");
  await list(page).getByRole("option", { name: "จ่ายแล้ว" }).click();
  await expect(list(page)).toHaveCount(0);
  await expect(status).toHaveText("จ่ายแล้ว");
  await expect(status).toBeFocused();

  // The row chosen is marked when the list opens again.
  await status.press("Enter");
  await expect(list(page).getByRole("option", { selected: true })).toHaveText(
    "จ่ายแล้ว",
  );

  // Escape closes the list and leaves the popup, and the choice, as they were.
  await status.press("End");
  await status.press("Escape");
  await expect(list(page)).toHaveCount(0);
  await expect(popupTitle(page)).toHaveText("บันทึกค่าใช้จ่าย");
  await expect(status).toHaveText("จ่ายแล้ว");

  // The keyboard: an arrow opens, End moves to the last row, Enter picks it.
  await status.press("ArrowDown");
  await status.press("End");
  await status.press("Enter");
  await expect(list(page)).toHaveCount(0);
  await expect(status).toHaveText(rows.at(-1)!);

  // A press outside closes the list.
  await status.click();
  await popupTitle(page).click();
  await expect(list(page)).toHaveCount(0);
  await expect(status).toHaveText(rows.at(-1)!);
});

test("a field with suggestions lists them, narrows as text is typed, and keeps text that matches none", async ({
  page,
}) => {
  await openExpense(page);
  const type = form(page).getByLabel(/^ประเภทสินค้า/);
  const options = list(page).getByRole("option");

  // A press lists every suggestion; typing keeps the ones that hold the text.
  await type.click();
  const all = await options.allInnerTexts();
  expect(all).toContain("สินทรัพย์");
  await type.pressSequentially("สินท");
  await expect(options).toHaveText(all.filter((text) => text.includes("สินท")));

  // An arrow and Enter take the suggestion; the popup stays open.
  await type.press("ArrowDown");
  await type.press("Enter");
  await expect(list(page)).toHaveCount(0);
  await expect(type).toHaveValue("สินทรัพย์");
  await expect(popupTitle(page)).toHaveText("บันทึกค่าใช้จ่าย");

  // The pointer takes one too.
  await type.fill("");
  await options.filter({ hasText: all[0] }).first().click();
  await expect(type).toHaveValue(all[0]);
  await expect(list(page)).toHaveCount(0);

  // Text that matches no suggestion shows no list and is saved as typed.
  await type.fill("ของใหม่ไม่เคยจด");
  await expect(list(page)).toHaveCount(0);
  await form(page)
    .getByLabel(/^รายการ/)
    .fill("ทดสอบ dropdown");
  await pick(form(page).getByLabel(/^สถานะ/), "จ่ายแล้ว");
  await save(page);
  const row = page
    .getByRole("table", { name: "บัญชีรายรับรายจ่าย" })
    .locator("tbody tr")
    .filter({ hasText: "ทดสอบ dropdown" });
  await expect(row).toContainText("ของใหม่ไม่เคยจด");
  await expect(row).toContainText("จ่ายแล้ว");

  // What was typed is a suggestion the next time.
  await jot(page, "บันทึกค่าใช้จ่าย");
  await form(page)
    .getByLabel(/^ประเภทสินค้า/)
    .pressSequentially("ของใหม่");
  await expect(options).toHaveText(["ของใหม่ไม่เคยจด"]);
});

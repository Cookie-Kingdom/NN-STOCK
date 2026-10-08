import { expect, test, type Page } from "@playwright/test";
import {
  choices,
  fill,
  form,
  jot,
  jotButtons,
  nav,
  openPage,
  pageButtons,
  rows,
  save,
  signInAs,
  start,
  openDays,
} from "./helpers";

/* Spec v2 section 11, items 1–4 and 19: who sees which page, and what each account may jot. */

const pagesOf = {
  owner: [
    "Overview",
    // The project's own, under its heading.
    "Overview",
    "Daily Log",
    "Lots",
    "Stock",
    "Inventory",
    "Finance",
    "Old Lots",
    "Accounting",
    "Settings",
  ],
  saladaeng: ["Daily Log", "Stock", "Inventory"],
  minburi: ["Daily Log", "Stock", "Inventory"],
} as const;
const accounts = Object.keys(pagesOf) as (keyof typeof pagesOf)[];
const h1 = (page: Page) => page.getByRole("heading", { level: 1 });
const optionsOf = (page: Page, label: RegExp) =>
  choices(form(page).getByLabel(label));
const serverCopy = async (page: Page) =>
  (await (await page.request.get("/api/local-db")).json()).payload;

test("1 · V2-ACC-09 Owner has 10 pages, Branch 3, all named in English", async ({
  page,
}) => {
  await start(page, "sample");
  for (const account of accounts) {
    await signInAs(page, account);
    await expect(pageButtons(page)).toHaveText([...pagesOf[account]]);
    // The home page: Overview for the Owner, Daily Log for everyone else.
    await expect(h1(page)).toHaveText(pagesOf[account][0]);
    for (const [index, name] of pagesOf[account].entries()) {
      // By its place: the Owner's two Overviews share a name.
      await pageButtons(page).nth(index).click();
      await expect(h1(page)).toHaveText(name);
      await expect(pageButtons(page).nth(index)).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
  }
  await signInAs(page, "owner");
  await openPage(page, "Overview", true);
  await expect(page).toHaveURL(/\/owner\/nn-x-lm\/overview$/);
  // A page the account does not have is not reachable by its address either.
  await signInAs(page, "minburi");
  for (const tab of ["lots", "finance", "overview", "settings"]) {
    await page.goto(`/branch/${tab}`);
    await expect(page.getByText("This page could not be found")).toBeVisible();
    await expect(nav(page)).toHaveCount(0);
  }
  await page.goto("/owner/finance");
  await expect(page).not.toHaveURL(/\/owner/);
  await expect(h1(page)).not.toHaveText("Finance");
});

test("4 · V2-ACC-07 Branch pays in 4 categories and sees nothing of the other branch", async ({
  page,
}) => {
  await start(page, "sample");
  await signInAs(page, "saladaeng");
  // Daily Log is for looking: a branch jots from its Stock and its Inventory, a payment
  // from either (it has no Finance).
  await expect(jotButtons(page)).toHaveCount(0);
  await openPage(page, "Stock");
  await expect(jotButtons(page)).toHaveText([
    "ยอดขาย",
    "รับเนื้อเข้าสาขา",
    "นับเนื้อคงเหลือ",
    "กล่องแจก",
    "จ่ายเงิน",
  ]);
  await openPage(page, "Inventory");
  await expect(jotButtons(page)).toHaveText(["จ่ายเงิน", "นับวัสดุคงเหลือ"]);
  await jot(page, "จ่ายเงิน");
  expect(await optionsOf(page, /^หมวด/)).toEqual([
    "เลือกหมวด",
    "แพ็กเกจ/วัสดุ",
    "วัตถุดิบ",
    "ขนส่ง",
    "อื่น ๆ",
  ]);
  // A stock category asks what and how many, never which branch: it is the account's own.
  await fill(page, [/^หมวด/, "วัตถุดิบ"]);
  await expect(form(page).getByLabel(/^จำนวน/)).toBeVisible();
  await expect(form(page).getByLabel(/^สาขา/)).toHaveCount(0);
  await fill(
    page,
    [/^หมวด/, "ขนส่ง"],
    [/^ยอด \(บาท\)/, "80"],
    [/^รายละเอียด/, "วินส่งของทดสอบ"],
  );
  await save(page);
  await openPage(page, "Daily Log");
  await expect(rows(page, "pay").first()).toContainText(
    "ขนส่ง · วินส่งของทดสอบ",
  );
  // Its own log holds its two payments, not the ones the centre made.
  await page.getByRole("button", { name: "ดูย้อนหลังอีก 7 วัน" }).click();
  await openDays(page);
  await expect(rows(page, "pay")).toHaveCount(2);

  await signInAs(page, "minburi");
  for (const name of pagesOf.minburi) {
    await openPage(page, name);
    if (name === "Daily Log")
      await page.getByRole("button", { name: "ดูย้อนหลังอีก 7 วัน" }).click();
    await openDays(page);
    await expect(page.locator("[data-entry], td").first()).toBeVisible();
    expect(await page.locator("body").innerText(), name).not.toMatch(
      /ศาลาแดง|วินส่งของทดสอบ|Foodiva|กำไร|P&L|GP/,
    );
  }
  await openPage(page, "Daily Log");
  await expect(rows(page, "pay")).toHaveCount(0);
  const copy = await serverCopy(page);
  expect(JSON.stringify(copy)).not.toMatch(/ศาลาแดง|วินส่งของทดสอบ/);
  // Of the branches that count raw rice it is told its own alone: here, that it does not.
  expect(copy.config.rawRiceBranches).toBe("[]");
  expect(
    copy.entries.filter(
      (e: { role: string; branch: string }) =>
        e.role === "branch" && e.branch !== "มีนบุรี",
    ),
  ).toEqual([]);

  // The Owner sees it, under the branch that paid.
  await signInAs(page, "owner");
  await openPage(page, "Finance");
  const paid = rows(page, "pay").filter({ hasText: "วินส่งของทดสอบ" });
  await expect(paid).toContainText("สาขาศาลาแดง");
  await expect(paid).toContainText("−฿80");
});

test("19 · V2-LOT-05 V2-PG-02 no close-day, unlock-day, close-Lot, accept-PO or review-invoice control on any page", async ({
  page,
}) => {
  await start(page, "sample");
  // 「ยืนยันรับ」 alone is back since the central warehouse: a branch confirms a transfer sent
  // to it (`transferReceive`). The retired accepts stay out.
  const retired =
    /ปิดวัน|ปิดยอด|ปลดล็อก|ล็อก|ปิด Lot|ยืนยันรับ PO|ยืนยันรับที่|ยืนยันรับวัสดุ|ยืนยันปิด|ตรวจยอด|จับคู่|อนุมัติ/;
  for (const account of accounts) {
    await signInAs(page, account);
    for (const name of pagesOf[account]) {
      await openPage(page, name);
      const where = `${account} ${name}`;
      // Every Lot and every PO เนื้อ, each with its tiles, documents and notes.
      const lots =
        name === "Lots" ? await page.locator("[data-lot]").all() : [];
      for (const lot of [undefined, ...lots]) {
        await lot?.click();
        expect(await page.locator("body").innerText(), where).not.toMatch(
          retired,
        );
      }
      if (name === "Settings") continue;
      // An open note offers 「แก้ไข」 and 「ลบ」 only, and to the Owner a
      // branch's note offers neither.
      if (name === "Daily Log") {
        await openDays(page);
        const branchNote = page
          .locator(
            '[data-entry]:is([data-kind="sale"], [data-kind="receive"], [data-kind="meatCount"], [data-kind="influencerBox"], [data-kind="materials"])',
          )
          .first();
        await branchNote.getByRole("button").first().click();
        await expect(branchNote.getByRole("button")).toHaveText(
          pagesOf[account].length === 3 ? [/.+/, "แก้ไข", "ลบ"] : [/.+/],
        );
        await expect(jotButtons(page)).toHaveCount(0);
      }
      // The page's buttons are the v2 kinds, and nothing that closes, locks or confirms.
      expect(
        (await jotButtons(page).allInnerTexts()).join(" "),
        where,
      ).not.toMatch(retired);
    }
  }
});

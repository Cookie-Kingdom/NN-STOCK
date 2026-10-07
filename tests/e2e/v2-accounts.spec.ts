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
  region,
  rows,
  save,
  signInAs,
  start,
  toast,
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
  manager: [
    "Daily Log",
    "Lots",
    "Stock",
    "Inventory",
    "Finance",
    "Old Lots",
    "Accounting",
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

test("1 · V2-ACC-09 Owner has 10 pages, Manager 7, Branch 2, all named in English", async ({
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
  await signInAs(page, "manager");
  for (const tab of ["overview", "nn-x-lm/overview", "settings"]) {
    await page.goto(`/owner/${tab}`);
    await expect(h1(page)).toHaveText("Daily Log");
  }
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

test("2 · V2-ACC-01 Manager finds no sale, payroll or P&L on any page, and the server sends it none", async ({
  page,
}) => {
  await start(page, "sample");
  // A branch jots today's sale and the Owner a payroll payment: both must stay out of the
  // Manager's reach.
  await signInAs(page, "saladaeng");
  await openPage(page, "Stock");
  await jot(page, "ยอดขาย");
  await fill(page, [/^กล่องมาตรฐาน/, "22"], [/^ยอดขาย LINE MAN/, "7654"]);
  await save(page);
  await signInAs(page, "owner");
  await openPage(page, "Finance");
  await jot(page, "จ่ายเงิน");
  await fill(
    page,
    [/^หมวด/, "ค่าแรง"],
    [/^ยอด \(บาท\)/, "4321"],
    [/^ชื่อพนักงาน/, "สมชายทดสอบ"],
  );
  await save(page);
  await expect(rows(page, "pay").first()).toContainText("สมชายทดสอบ");
  const full = JSON.stringify(await serverCopy(page));
  expect(full).toContain('"lineMan":"7654"');
  expect(full).toContain("สมชายทดสอบ");

  await signInAs(page, "manager");
  const hidden =
    /ยอดขาย|GP|ค่าแรง|กำไร|P&L|LINE MAN|สมชายทดสอบ|พี่เอ|7,654|4,321/;
  for (const name of pagesOf.manager) {
    await openPage(page, name);
    if (name === "Daily Log")
      await page.getByRole("button", { name: "ดูย้อนหลังอีก 7 วัน" }).click();
    if (name === "Lots")
      await expect(page.locator("[data-lot]")).toHaveCount(5);
    if (name === "Finance")
      await expect(region(page, "ยอดจ่ายแยกหมวด")).toBeVisible();
    // 「Nerdnuea x LINE MAN」 is the shop's name (the menu's section, a ledger Project), not a sale.
    const text = await page.locator("body").innerText();
    expect(text.replaceAll("Nerdnuea x LINE MAN", ""), name).not.toMatch(
      hidden,
    );
  }
  // Neither among the page's buttons nor among the categories of a payment (V2-ACC-02).
  await openPage(page, "Daily Log");
  await expect(jotButtons(page)).toHaveCount(0);
  await openPage(page, "Finance");
  await expect(jotButtons(page)).toHaveText(["จ่ายเงิน"]);
  await jot(page, "จ่ายเงิน");
  expect(await optionsOf(page, /^หมวด/)).not.toContain("ค่าแรง");

  // What the server sends the Manager: no sale-money key on any entry, and of a payroll
  // payment only its category.
  const copy = await serverCopy(page);
  type Sent = { kind: string; values: Record<string, string> };
  const entries: Sent[] = copy.entries;
  const moneyKeys = entries
    .flatMap((e) => Object.keys(e.values))
    .map((key) => key.replace(/^(to|from)\./, ""))
    .filter(
      (key) =>
        ["lineMan", "revenue", "menuTotal"].includes(key) ||
        key.startsWith("sales."),
    );
  expect(moneyKeys).toEqual([]);
  expect(entries.filter((e) => e.kind === "sale").length).toBeGreaterThan(60);
  const payroll = entries.filter((e) => e.values.category === "payroll");
  expect(payroll).toHaveLength(4);
  for (const e of payroll) expect(Object.keys(e.values)).toEqual(["category"]);
  const raw = JSON.stringify(copy);
  expect(raw).not.toMatch(/สมชายทดสอบ|พี่เอ|น้องบีม|"7654"|"4321"/);
});

test("3 · V2-ACC-02 Manager pays in 9 categories, none of them payroll", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "manager");
  // V2-ACC-04: nothing for a branch (a branch jots its own notes), only the move between
  // the warehouses; Daily Log is for looking.
  await openPage(page, "Inventory");
  await expect(jotButtons(page)).toHaveText(["จัดสรรสินค้า"]);
  await expect(page.getByRole("button", { name: /นับเนื้อ/ })).toHaveCount(0);
  await openPage(page, "Daily Log");
  await expect(jotButtons(page)).toHaveCount(0);
  await openPage(page, "Finance");
  await expect(jotButtons(page)).toHaveText(["จ่ายเงิน"]);
  await jot(page, "จ่ายเงิน");
  expect(await optionsOf(page, /^หมวด/)).toEqual([
    "เลือกหมวด",
    "เนื้อ",
    "ค่ารม",
    "แพ็กเกจ/วัสดุ",
    "วัตถุดิบ",
    "ค่าเช่า/น้ำไฟ",
    "ขนส่ง",
    "การตลาด",
    "อุปกรณ์/ลงทุน",
    "อื่น ๆ",
  ]);
  await fill(
    page,
    [/^หมวด/, "ค่าเช่า/น้ำไฟ"],
    [/^ยอด \(บาท\)/, "20500"],
    [/^รายละเอียด/, "ค่าเช่าครัว"],
  );
  await save(page);
  await expect(toast(page, "จดแล้ว: จ่ายเงิน")).toBeVisible();
  await openPage(page, "Daily Log");
  await expect(rows(page, "pay")).toHaveCount(1);
  await expect(rows(page, "pay")).toContainText("ค่าเช่า/น้ำไฟ · ค่าเช่าครัว");
  await expect(rows(page, "pay")).toContainText("−฿20,500");
  await openPage(page, "Finance");
  await expect(
    region(page, "ยอดจ่ายแยกหมวด").getByRole("row", {
      name: /ค่าเช่า\/น้ำไฟ/,
    }),
  ).toContainText("−฿20,500");
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
  await expect(rows(page, "pay")).toHaveCount(2);

  await signInAs(page, "minburi");
  for (const name of pagesOf.minburi) {
    await openPage(page, name);
    if (name === "Daily Log")
      await page.getByRole("button", { name: "ดูย้อนหลังอีก 7 วัน" }).click();
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
      // An open note offers 「แก้ไข」 and 「ลบ」 only, and to the Owner and the Manager a
      // branch's note offers neither.
      if (name === "Daily Log") {
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

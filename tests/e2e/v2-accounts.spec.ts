import { expect, test, type Page } from "@playwright/test";
import {
  fill,
  form,
  jot,
  nav,
  openPage,
  region,
  rows,
  save,
  signInAs,
  start,
  toast,
} from "./helpers";

/* Spec v2 section 11, items 1–4 and 19: who sees which page, and what each account may jot. */

const pagesOf = {
  owner: ["Overview", "Daily Log", "Lots", "Stock", "Finance", "Settings"],
  manager: ["Daily Log", "Lots", "Stock", "Finance"],
  saladaeng: ["Daily Log", "Stock"],
  minburi: ["Daily Log", "Stock"],
} as const;
const accounts = Object.keys(pagesOf) as (keyof typeof pagesOf)[];
const h1 = (page: Page) => page.getByRole("heading", { level: 1 });
const optionsOf = (page: Page, label: RegExp) =>
  form(page).getByLabel(label).locator("option").allInnerTexts();
const serverCopy = async (page: Page) =>
  (await (await page.request.get("/api/local-db")).json()).payload;

test("1 · V2-ACC-09 Owner has 6 pages, Manager 4, Branch 2, all named in English", async ({
  page,
}) => {
  await start(page, "sample");
  for (const account of accounts) {
    await signInAs(page, account);
    await expect(nav(page).getByRole("button")).toHaveText([
      ...pagesOf[account],
    ]);
    // The home page: Overview for the Owner, Daily Log for everyone else.
    await expect(h1(page)).toHaveText(pagesOf[account][0]);
    for (const name of pagesOf[account]) {
      await openPage(page, name);
      await expect(
        nav(page).getByRole("button", { name, exact: true }),
      ).toHaveAttribute("aria-current", "page");
    }
  }
  // A page the account does not have is not reachable by its address either.
  await signInAs(page, "manager");
  for (const tab of ["overview", "settings"]) {
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
  // The Owner jots today's sale and a payroll payment: both must stay out of the Manager's reach.
  await signInAs(page, "owner");
  await openPage(page, "Daily Log");
  await jot(page, "ยอดขาย");
  await fill(
    page,
    [/^สาขา/, "ศาลาแดง"],
    [/^กล่องมาตรฐาน/, "22"],
    [/^ยอดขาย LINE MAN/, "7654"],
  );
  await save(page);
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
      await expect(region(page, "จ่ายเงินแยกหมวด")).toBeVisible();
    expect(await page.locator("body").innerText(), name).not.toMatch(hidden);
  }
  // Neither in the picker nor among the categories of a payment (V2-ACC-02).
  await page.getByRole("button", { name: "จดบันทึก", exact: true }).click();
  await expect(region(page, "จดอะไร")).not.toContainText("ยอดขาย");
  await region(page, "จดอะไร")
    .getByRole("button", { name: "จ่ายเงิน", exact: true })
    .click();
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
  await page.getByRole("button", { name: "จดบันทึก", exact: true }).click();
  // V2-ACC-04: everything for a branch but its sale.
  await expect(
    region(page, "จดอะไร")
      .getByRole("group", { name: "สาขา" })
      .getByRole("button"),
  ).toHaveText([
    "รับเนื้อเข้าสาขา",
    "นับเนื้อคงเหลือ",
    "กล่องแจก",
    "นับวัสดุคงเหลือ",
  ]);
  await region(page, "จดอะไร")
    .getByRole("button", { name: "จ่ายเงิน", exact: true })
    .click();
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
  await expect(rows(page, "pay")).toHaveCount(1);
  await expect(rows(page, "pay")).toContainText("ค่าเช่า/น้ำไฟ · ค่าเช่าครัว");
  await expect(rows(page, "pay")).toContainText("−฿20,500");
  await openPage(page, "Finance");
  await expect(
    region(page, "จ่ายเงินแยกหมวด").getByRole("row", {
      name: /ค่าเช่า\/น้ำไฟ/,
    }),
  ).toContainText("−฿20,500");
});

test("4 · V2-ACC-07 Branch pays in 4 categories and sees nothing of the other branch", async ({
  page,
}) => {
  await start(page, "sample");
  await signInAs(page, "saladaeng");
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
  await expect(form(page).getByLabel(/^เข้าสาขาไหน/)).toHaveCount(0);
  await fill(
    page,
    [/^หมวด/, "ขนส่ง"],
    [/^ยอด \(บาท\)/, "80"],
    [/^รายละเอียด/, "วินส่งของทดสอบ"],
  );
  await save(page);
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
  const retired =
    /ปิดวัน|ปิดยอด|ปลดล็อก|ล็อก|ปิด Lot|ยืนยันรับ|ยืนยันปิด|ตรวจยอด|จับคู่|อนุมัติ/;
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
      // An open note offers 「แก้ไข」 and 「ลบ」 only.
      if (name === "Daily Log") {
        const note = page.locator("[data-entry][data-kind]").first();
        await note.getByRole("button").first().click();
        await expect(note.getByRole("button")).toHaveText([
          /.+/,
          "แก้ไข",
          "ลบ",
        ]);
      }
      // The picker lists the v2 kinds, and nothing that closes, locks or confirms.
      await page.getByRole("button", { name: "จดบันทึก", exact: true }).click();
      const picker = region(page, "จดอะไร");
      expect(await picker.innerText(), where).not.toMatch(retired);
      await picker.getByRole("button", { name: "ปิด", exact: true }).click();
    }
  }
});

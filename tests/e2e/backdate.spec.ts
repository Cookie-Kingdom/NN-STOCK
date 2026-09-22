import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  field,
  foodivaFillsPackingList,
  foodivaIssuesInvoice,
  foodivaOpensManifest,
  menuItem,
  ownerCreatesMeatPo,
  ownerCreatesShipmentRequest,
  pointAndClick,
  saveEntry,
  signInAs,
  startFresh,
  tableSection,
} from "./helpers";

/* Backdating from inside the forms (feature/backdate-in-form; vault:
 * Features/Backdate In Form/Checklist.md). Every form carries the working-date
 * field "วันที่ทำรายการ", bound to the page-heading date; a past date shows the
 * "บันทึกย้อนหลัง" badge, and history tags entries dated before the day they were
 * recorded. mutate() refuses a stage step dated before the lot's latest entry and
 * dates outside systemStartDate … today. */

test.skip(
  process.env.NEXT_PUBLIC_LOCAL_DB !== "1",
  "local sign-in (<account>@local.test) and the state endpoint only exist in pnpm test:e2e:local",
);

/** Bangkok calendar date `offset` days from today (same clock as format.ts `today`). */
function bangkokDate(offset = 0) {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  now.setDate(now.getDate() + offset);
  return now.toLocaleDateString("en-CA");
}
const TODAY = bangkokDate();

const BACKDATED = "บันทึกย้อนหลัง";
const DATE_LABEL = "วันที่ทำรายการ";
const BOX = "กล่องพิมพ์ลาย";

const dialog = (page: Page) => page.getByRole("dialog").last();
/** role=alert also matches Next's route announcer and page banners, so scope + text. */
const alertIn = (scope: Locator, text: string | RegExp) =>
  scope.getByRole("alert").filter({ hasText: text });
/** Sidebar tab by label, so a same-named button in <main> never matches. */
const tab = (page: Page, label: string) =>
  pointAndClick(page, menuItem(page, label));
/** The page-heading date picker: the first "วันที่ทำรายการ" in the DOM (the
 * branch day tab and every open dialog carry their own copy further down). */
const headingDate = (page: Page) => page.getByLabel(DATE_LABEL).first();
const formDate = (page: Page) => dialog(page).getByLabel(DATE_LABEL);

/** Date inputs take a whole value at once. */
async function setFormDate(page: Page, date: string) {
  const input = formDate(page);
  await input.scrollIntoViewIfNeeded();
  await input.fill(date);
  await expect(input).toHaveValue(date);
}

/** Submits the open dialog and expects it to stay open with the message. */
async function submitAndExpectError(page: Page, message: string | RegExp) {
  const open = dialog(page);
  await pointAndClick(page, open.locator('button[type="submit"]').last());
  // The footer and the form body can both carry the same message.
  await expect(alertIn(open, message).first()).toBeVisible();
  await expect(open).toBeVisible();
}

/** A history entry (<details>) by its title and a value it holds. */
const historyEntry = (page: Page, title: string, text: string | RegExp) =>
  page
    .getByRole("main")
    .locator("details")
    .filter({ has: page.locator("summary").filter({ hasText: title }) })
    .filter({ hasText: text });

/** The stored payload, read straight from the local SQLite backend. */
async function storedEntries(page: Page) {
  const response = await page.request.get("/api/local-db");
  expect(response.ok(), `GET /api/local-db → ${response.status()}`).toBe(true);
  const { payload } = (await response.json()) as {
    payload: { entries: { kind: string; date: string }[] };
  };
  return payload.entries;
}

test("สาขาศาลาแดง: บันทึกซื้อข้าวย้อนหลังจากช่องวันที่ในฟอร์ม → หัวหน้าเปลี่ยนตาม และประวัติติด tag บันทึกย้อนหลัง", async ({
  page,
}) => {
  const yesterday = bangkokDate(-1);
  const supplier = "ร้านข้าวย้อนหลัง";
  await startFresh(page);
  await signInAs(page, ACCOUNTS.saladaeng);
  await expect(headingDate(page)).toHaveValue(TODAY);

  // B2: one rice table at every branch; each purchase picks its source first.
  const riceTable = tableSection(
    page,
    "ข้าวเหนียว · นึ่งเอง หรือซื้อข้าวสุกจากข้างนอก",
  );
  await pointAndClick(
    page,
    riceTable
      .getByRole("row")
      .filter({ hasText: "ซื้อข้าวเหนียวเข้าสต๊อก" })
      .getByRole("button", { name: "กรอกข้อมูล" }),
  );
  // The form opens on the heading date; today carries no badge.
  await expect(formDate(page)).toHaveValue(TODAY);
  await expect(dialog(page).getByText(BACKDATED)).toHaveCount(0);

  await dialog(page)
    .getByLabel(/รอบนี้ข้าวเหนียวมาจาก/)
    .selectOption("นึ่งเอง (ซื้อข้าวดิบ)");
  await field(page, /ผู้จำหน่ายข้าว/, supplier);
  await field(page, /ข้าวเหนียวดิบซื้อเข้า/, "4");
  await field(page, /ยอดซื้อข้าวเหนียวดิบ/, "220");

  await setFormDate(page, yesterday);
  await expect(dialog(page).getByText(BACKDATED)).toBeVisible();
  await expect(headingDate(page)).toHaveValue(yesterday);
  // The draft survives the date change.
  await expect(page.getByLabel(/ผู้จำหน่ายข้าว/).last()).toHaveValue(supplier);

  await saveEntry(page);
  await expect(page.getByRole("status")).toContainText(
    "ซื้อข้าวเหนียวเข้าสต๊อกแล้ว",
  );
  await expect(headingDate(page)).toHaveValue(yesterday);

  await tab(page, "ประวัติ");
  const entry = historyEntry(page, "ซื้อข้าวเหนียวเข้าสต๊อก", supplier);
  await expect(entry).toHaveCount(1);
  await expect(entry.locator("summary")).toContainText(`${yesterday} ·`);
  await expect(entry.locator("summary").getByText(BACKDATED)).toBeVisible();
});

test("Owner: ซื้อวัสดุเข้าคลังย้อนหลัง — ค่าที่กรอกไว้ไม่หายเมื่อเปลี่ยนวันที่ และบันทึกด้วยวันที่ที่เลือก", async ({
  page,
}) => {
  const past = bangkokDate(-2);
  const supplier = "ร้านวัสดุย้อนหลัง";
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await tab(page, "สต๊อกของทั้งหมด");
  await button(page, "+ ซื้อวัสดุเข้าคลัง");
  await expect(formDate(page)).toHaveValue(TODAY);
  await expect(dialog(page).getByText(BACKDATED)).toHaveCount(0);

  // Draft first, date second.
  await dialog(page).getByLabel(`ซื้อ ${BOX}`).check();
  await field(page, `จำนวนซื้อ ${BOX}`, "40");
  await field(page, `ราคาซื้อ ${BOX}`, "3");
  await field(page, `ผู้จำหน่าย ${BOX}`, supplier);
  await expect(dialog(page).getByLabel(`วันที่ซื้อ ${BOX}`)).toHaveValue(TODAY);

  await setFormDate(page, past);
  await expect(dialog(page).getByText(BACKDATED)).toBeVisible();
  await expect(headingDate(page)).toHaveValue(past);
  await expect(
    dialog(page).getByRole("checkbox", { name: `ซื้อ ${BOX}`, exact: true }),
  ).toBeChecked();
  await expect(dialog(page).getByLabel(`จำนวนซื้อ ${BOX}`)).toHaveValue("40");
  await expect(dialog(page).getByLabel(`ราคาซื้อ ${BOX}`)).toHaveValue("3");
  await expect(dialog(page).getByLabel(`ผู้จำหน่าย ${BOX}`)).toHaveValue(
    supplier,
  );
  // A row without its own purchase date follows the working date.
  await expect(dialog(page).getByLabel(`วันที่ซื้อ ${BOX}`)).toHaveValue(past);

  await saveEntry(page);
  await expect(
    page.getByRole("main").getByRole("status").filter({
      hasText: "บันทึกการซื้อวัสดุแล้ว",
    }),
  ).toBeVisible();

  await tab(page, "Log");
  const entry = historyEntry(page, "บันทึกซื้อวัสดุเข้าคลัง Owner", supplier);
  await expect(entry).toHaveCount(1);
  await expect(entry.locator("summary")).toContainText(`${past} ·`);
  await expect(entry.locator("summary").getByText(BACKDATED)).toBeVisible();
});

test("Foodiva: ใบขนส่งขาไปลงวันที่ก่อนขั้นตอนก่อนหน้าของ Lot ถูกปฏิเสธ ไม่บันทึกอะไร · ลงวันเดียวกันผ่าน", async ({
  page,
}) => {
  // Every earlier step of the shipment (PO, invoice, Request) is dated today.
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  const poId = await ownerCreatesMeatPo(page, "500");
  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaIssuesInvoice(page, "500", { poId });
  await signInAs(page, ACCOUNTS.owner);
  const shipment = await ownerCreatesShipmentRequest(page, [
    { poId, kg: "500" },
  ]);

  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaOpensManifest(page, shipment);
  await foodivaFillsPackingList(page, ["250", "250"]);

  await setFormDate(page, bangkokDate(-1));
  await expect(dialog(page).getByText(BACKDATED)).toBeVisible();
  await submitAndExpectError(
    page,
    `วันที่ต้องไม่ก่อนขั้นตอนก่อนหน้าของ Lot นี้ (${TODAY})`,
  );
  const stored = await storedEntries(page);
  expect(stored.filter((e) => e.kind === "dispatch")).toHaveLength(0);
  expect(stored.filter((e) => e.kind === "packingList")).toHaveLength(0);

  // Same day as the previous step: allowed, and the Packing List draft is still there.
  await setFormDate(page, TODAY);
  await saveEntry(page);
  await expect
    .poll(async () =>
      (await storedEntries(page))
        .filter((e) => e.kind === "dispatch" || e.kind === "packingList")
        .map((e) => `${e.kind} ${e.date}`),
    )
    .toEqual([`dispatch ${TODAY}`, `packingList ${TODAY}`]);
});

test("Owner: วันที่นอกช่วง (หลังวันนี้ / ก่อนวันเริ่มใช้งานจริง) ขึ้นคำเตือนและบันทึกไม่ได้", async ({
  page,
}) => {
  const start = bangkokDate(-3);
  const range = `วันที่อยู่นอกช่วงที่บันทึกได้ (${start} – ${TODAY})`;
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);

  await tab(page, "ตั้งค่า");
  const main = tableSection(page, "ข้อมูลหลักก่อนเริ่มระบบ (System setup)");
  await pointAndClick(
    page,
    main.getByRole("button", { name: "ขอแก้ไข (Request edit)" }),
  );
  const startInput = main.getByLabel("systemStartDate");
  await startInput.fill(start);
  await expect(startInput).toHaveValue(start);
  await pointAndClick(
    page,
    main.getByRole("button", { name: "บันทึกและล็อก (Save & lock)" }),
  );
  await expect(
    main.getByRole("button", { name: "ขอแก้ไข (Request edit)" }),
  ).toBeVisible();

  await tab(page, "สต๊อกของทั้งหมด");
  await button(page, "+ ซื้อวัสดุเข้าคลัง");
  await expect(formDate(page)).toHaveAttribute("min", start);
  await expect(formDate(page)).toHaveAttribute("max", TODAY);
  await dialog(page).getByLabel(`ซื้อ ${BOX}`).check();
  await field(page, `จำนวนซื้อ ${BOX}`, "10");
  await field(page, `ราคาซื้อ ${BOX}`, "2");
  await field(page, `ผู้จำหน่าย ${BOX}`, "ร้านวัสดุนอกช่วง");

  // After today.
  await setFormDate(page, bangkokDate(1));
  await expect(alertIn(dialog(page), range)).toBeVisible();
  await submitAndExpectError(page, "วันที่ทำรายการต้องไม่เกินวันนี้");

  // Before the system start date.
  await setFormDate(page, bangkokDate(-5));
  await expect(alertIn(dialog(page), range)).toBeVisible();
  await submitAndExpectError(
    page,
    `วันที่ทำรายการต้องไม่ก่อนวันเริ่มใช้ระบบ (${start})`,
  );

  // Back in range: the warning goes away.
  await setFormDate(page, start);
  await expect(alertIn(dialog(page), range)).toHaveCount(0);
  expect(
    (await storedEntries(page)).filter((e) => e.kind === "materialReceive"),
  ).toHaveLength(0);
});

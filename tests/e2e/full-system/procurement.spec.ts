import { statSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  field,
  foodivaIssuesInvoice,
  INVOICE_FIXTURE,
  menuItem,
  ownerCreatesMeatPo,
  ownerIssuesSmokePo,
  pointAndClick,
  saveEntry,
  signInAs,
  startFresh,
  step,
  tableSection,
} from "../helpers";

/* Lane C (vault: Testing/E2E Full System/17-09-2026/Plan.md §5): PO 500 kg @ 250 →
 * Foodiva invoices 490 kg for Chef_house + 10 kg kept for Owner → smoke PO 490 kg
 * @ 220 = 107,800 → outbound 490 → Chef_house weighs in 488. Every negative case
 * expects the exact message mutate() throws in src/lib/store.ts. */

test.skip(
  process.env.NEXT_PUBLIC_LOCAL_DB !== "1",
  "local sign-in (<account>@local.test) only exists in pnpm test:e2e:local",
);

const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "Asia/Bangkok",
});
const YEAR = today.slice(0, 4);
/** Ids mutate() derives for the first lot of the day (store.ts: purchase / smokeOrder / dispatch). */
const LOT = `F${today.slice(2).replaceAll("-", "")}-001`;
const PO = `PO-${YEAR}-0001`;
const SO = `SO-${YEAR}-0001`;
const TR = `TR-${YEAR}-0001`;

const dialog = (page: Page) => page.getByRole("dialog").last();
/** role=alert also matches Next's route announcer and the page banner, so scope + text. */
const alertIn = (scope: Locator, text: string | RegExp) =>
  scope.getByRole("alert").filter({ hasText: text });

/** Submits the open dialog and expects it to stay open with the store's message. */
async function submitAndExpectError(page: Page, message: string | RegExp) {
  const open = dialog(page);
  await pointAndClick(page, open.locator('button[type="submit"]').last());
  await expect(alertIn(open, message)).toBeVisible();
  await expect(open).toBeVisible();
}

async function cancelDialog(page: Page) {
  await pointAndClick(
    page,
    dialog(page).getByRole("button", { name: "ยกเลิก" }),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** Sidebar tab by label: `button(page, "ใบขนส่ง")` would also hit "ทำใบขนส่งขาไป" in <main>. */
const tab = (page: Page, label: string) =>
  pointAndClick(page, menuItem(page, label));

/** The `<tr>` of a table card that mentions `text`. */
const rowIn = (page: Page, title: string | RegExp, text: string | RegExp) =>
  tableSection(page, title).getByRole("row").filter({ hasText: text });

/** A <Stat> card by its label; the value is the sibling <strong>. */
const stat = (page: Page, label: string) =>
  page.getByText(label, { exact: true }).locator("..");

/** type="number" drops letters, so typeValue's toHaveValue would fail; the store must see "". */
async function typeLetters(page: Page, label: RegExp, letters: string) {
  const input = page.getByLabel(label).last();
  await pointAndClick(page, input);
  await input.fill("");
  await input.pressSequentially(letters, { delay: 20 });
  await expect(input).toHaveValue("");
}

async function expectDownload(page: Page, trigger: Locator) {
  const waiting = page.waitForEvent("download");
  await pointAndClick(page, trigger);
  const download = await waiting;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const file = await download.path();
  expect(file && statSync(file).size).toBeGreaterThan(0);
}

/** DocumentPrintButton opens a popup (window.open) and writes the sheet into it. */
async function expectPrintPopup(
  page: Page,
  name: string | RegExp,
  check: (body: Locator) => Promise<void>,
) {
  const popupPromise = page.waitForEvent("popup");
  await button(page, name);
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await check(popup.locator("body"));
  await popup.close();
}

/** Foodiva splits the invoice: `ready` kg go to Chef_house, `reserved` kg wait for Owner. */
async function foodivaSplitsInvoice(
  page: Page,
  invoiceNo: string,
  ready: string,
  reserved: string,
) {
  await button(page, /ออกและอัปโหลด Invoice/);
  await field(page, /เลข Invoice เนื้อ/, invoiceNo);
  await field(page, /พร้อมส่งไป Chef_house/, ready);
  await field(page, /เนื้อส่วนที่เหลือรอ Owner รับ/, reserved);
  await dialog(page).locator('input[type="file"]').setInputFiles(INVOICE_FIXTURE);
  await field(page, /ชื่อผู้ยืนยันจาก Foodiva/, "เจ้าหน้าที่ Foodiva");
}

async function chefAcceptsAndInvoices(page: Page, invoiceNo: string) {
  await tab(page, "งานผลิต");
  await button(page, "ยืนยันรับ PO รมควัน");
  await field(page, /ชื่อผู้รับ PO/, "หัวหน้าผลิต Chef_house");
  await saveEntry(page);
  await button(page, "สร้าง / Submit ใบวางบิล");
  await field(page, /เลข Invoice ค่ารมควัน/, invoiceNo);
  await dialog(page).locator('input[type="file"]').setInputFiles(INVOICE_FIXTURE);
  await button(page, "Submit ใบวางบิล");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** Owner accepts the smoking invoice and pays the prefilled net amount. */
async function ownerReviewsAndPays(page: Page) {
  await tab(page, "ใบ Invoice");
  await button(page, "ตรวจยอด");
  await field(page, /ชื่อผู้ตรวจ/, "Owner QA");
  await saveEntry(page);
  await button(page, "ชำระเงิน");
  await field(page, /ผู้ดำเนินการชำระ/, "Owner QA");
  await saveEntry(page);
}

async function ownerDispatches(page: Page, kg: string) {
  await tab(page, "ใบขนส่ง");
  await button(page, "ทำใบขนส่งขาไป");
  await field(page, /เวลารถรับ/, "06:30");
  await field(page, /ประเภทรถ/, "รถห้องเย็น");
  await field(page, /ทะเบียนรถ/, "กท 1001");
  await field(page, /น้ำหนักที่ส่งเที่ยวนี้/, kg);
  await saveEntry(page);
}

test("C1–C13 จัดซื้อ → รมควัน → ขนส่งขาไป: PO 500 → Invoice 490/10 → PO รมควัน 490 = 107,800 → ส่ง 490 → Chef_house รับ 488", async ({
  page,
}) => {
  test.setTimeout(12 * 60_000);
  await step(page, "ระบบ: เริ่มจาก seed ว่าง", async () => {
    await startFresh(page);
  });
  await step(page, "Owner: เข้าสู่ระบบ", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await expect(page.getByRole("heading", { name: "แดชบอร์ด" })).toBeVisible();
  });

  /* ---- C2 / C1: the PO dialog refuses bad numbers, then saves 500 @ 250 ---- */
  await step(page, "Owner: C2 เปิด \"สร้าง PO เนื้อ\" กรอกข้อมูลบริษัท (ผู้ขาย/ชื่อบริษัท/สินค้าถูกเติมให้)", async () => {
    await tab(page, "ใบสั่งซื้อ PO");
    await button(page, "สร้าง PO เนื้อ");
    const po = dialog(page);
    await expect(po.getByLabel(/ผู้ขาย · Foodiva/)).toHaveValue("Foodiva");
    await expect(po.getByLabel(/ชื่อบริษัท \/ ลูกค้า/)).toHaveValue(
      "บริษัท เนิร์ดเนื้อ จำกัด",
    );
    await expect(po.getByLabel(/รายการสินค้า/)).toHaveValue("เนื้อวัว");
    await field(page, /ที่อยู่บริษัท/, "295/87 แขวงมีนบุรี กรุงเทพมหานคร");
    await field(page, /ชื่อผู้ติดต่อ/, "ฝ่ายจัดซื้อ");
    await field(page, /เบอร์ติดต่อ/, "0800000000");
    await field(page, /เลขประจำตัวผู้เสียภาษี/, "0100000000000");
    await field(page, /ขนาดบรรจุ/, "6 ชิ้นต่อถุง");
    await field(page, /ราคาเนื้อ/, "250");
  });
  await step(page, "Owner: C2 น้ำหนัก 0 → กรอกน้ำหนักสั่งซื้อเป็นตัวเลขมากกว่าศูนย์", async () => {
    await field(page, /น้ำหนักสั่งซื้อ/, "0");
    await submitAndExpectError(page, "กรอกน้ำหนักสั่งซื้อเป็นตัวเลขมากกว่าศูนย์");
  });
  await step(page, "Owner: C2 น้ำหนักว่าง → กรอกน้ำหนักสั่งซื้อเป็นตัวเลขมากกว่าศูนย์", async () => {
    await field(page, /น้ำหนักสั่งซื้อ/, "");
    await submitAndExpectError(page, "กรอกน้ำหนักสั่งซื้อเป็นตัวเลขมากกว่าศูนย์");
  });
  await step(page, "Owner: C2 น้ำหนักเป็นตัวอักษร (ช่องตัวเลขไม่รับ) → กรอกน้ำหนักสั่งซื้อเป็นตัวเลขมากกว่าศูนย์", async () => {
    await typeLetters(page, /น้ำหนักสั่งซื้อ/, "abc");
    await submitAndExpectError(page, "กรอกน้ำหนักสั่งซื้อเป็นตัวเลขมากกว่าศูนย์");
  });
  await step(page, "Owner: C2 ราคา 0 → กรอกราคา / กก.เป็นตัวเลขมากกว่าศูนย์", async () => {
    await field(page, /น้ำหนักสั่งซื้อ/, "500");
    await field(page, /ราคาเนื้อ/, "0");
    await submitAndExpectError(page, "กรอกราคา / กก.เป็นตัวเลขมากกว่าศูนย์");
  });
  await step(page, "Owner: C1 PO 500 กก. @250 หมายเหตุ QA-C1 → preview สด → บันทึก → ตารางแสดงเลข PO / Lot", async () => {
    await field(page, /ราคาเนื้อ/, "250");
    await field(page, /หมายเหตุ/, "QA-C1");
    const preview = dialog(page).locator('[aria-label="ตัวอย่างเอกสาร PO"]');
    await expect(preview).toContainText("PURCHASE ORDER");
    await expect(preview).toContainText("QA-C1");
    await saveEntry(page);
    const row = rowIn(page, "รายการใบสั่งซื้อ PO", PO);
    await expect(row).toContainText(LOT);
    await expect(row).toContainText("500.00 กก.");
    await expect(row).toContainText("รอยืนยัน");
    await expect(row).toContainText("ขนส่ง Foodiva → Chef_house");
    await expect(row).toContainText("รอ Foodiva ออก Invoice");
  });
  await step(page, "Owner: C1 พิมพ์ / PDF เปิดเอกสาร PO พร้อมหมายเหตุ QA-C1", async () => {
    await expectPrintPopup(page, "พิมพ์ / PDF", async (body) => {
      await expect(body).toContainText("PURCHASE ORDER");
      await expect(body).toContainText(PO);
      await expect(body).toContainText("QA-C1");
    });
  });

  /* ---- C5: no transport before Foodiva confirms ---- */
  await step(page, "Owner: C5 ใบขนส่งก่อน Foodiva ยืนยัน → ป้าย \"รอ Foodiva ออก Invoice\" ไม่มีปุ่มทำใบขนส่ง (พฤติกรรมจริง: ปุ่มไม่มี ไม่ใช่ข้อความ store)", async () => {
    await tab(page, "ใบขนส่ง");
    const row = rowIn(page, "รายการขนส่งตาม Lot", LOT);
    await expect(row).toContainText("รอ Foodiva ออก Invoice");
    await expect(row).toContainText("พร้อมส่งเชียงใหม่ 0.00 กก. · รอทำใบขนส่ง");
    await expect(page.getByRole("button", { name: "ทำใบขนส่งขาไป" })).toHaveCount(0);
  });

  /* ---- C3: tax document for the PO (the Supplier Invoice form has no button: E2E-C1) ---- */
  await step(page, "Owner: C3 \"บันทึกใบกำกับภาษี / ใบเสร็จ\" เลขที่ว่าง → กรอกเลขที่เอกสาร", async () => {
    await tab(page, "เอกสารและ Traceability");
    await pointAndClick(page, page.getByRole("button", { name: "ภาษี", exact: true }));
    await expect(dialog(page).getByRole("heading", { name: "บันทึกใบกำกับภาษี / ใบเสร็จ" })).toBeVisible();
    await expect(dialog(page).getByLabel(/ประเภทเอกสาร/)).toHaveValue("Tax Invoice");
    await submitAndExpectError(page, "กรอกเลขที่เอกสาร");
  });
  await step(page, "Owner: C3 ใบกำกับภาษี TX-C3-001 ยอด 125,000 VAT 8,750 → แสดงในตาราง Supplier Invoice และ Tax documents", async () => {
    await field(page, /เลขที่เอกสาร/, "TX-C3-001");
    await field(page, /Amount \(บาท\)/, "125000");
    await field(page, /VAT \(บาท\)/, "8750");
    await saveEntry(page);
    const row = rowIn(page, "Supplier Invoice และ Tax documents", "TX-C3-001");
    await expect(row).toContainText("Tax Invoice");
    await expect(row).toContainText(`${PO} / ${LOT}`);
    await expect(row).toContainText("฿125,000.00");
    await expect(row).toContainText("฿8,750.00");
    await expect(row).toContainText("รอแนบไฟล์");
  });

  /* ---- C4: Foodiva splits the invoice 490 / 10 ---- */
  await step(page, "Foodiva: C4 เห็นงานค้าง 1 (count pill) และ PO รอออก Invoice", async () => {
    await signInAs(page, ACCOUNTS.foodiva);
    await expect(menuItem(page, "PO และสต๊อก Foodiva")).toContainText("1");
    const row = rowIn(page, "PO เนื้อที่ต้องออก Invoice", LOT);
    await expect(row).toContainText("รอออก Invoice");
    await expect(row).toContainText("ต้องออก Invoice");
  });
  await step(page, "Foodiva: C4 Invoice 480 ส่ง + 10 รอ Owner ≠ 500 → บล็อก", async () => {
    await foodivaSplitsInvoice(page, "FD-INV-C4", "480", "10");
    await expect(dialog(page).getByLabel(/น้ำหนักตาม Invoice/)).toHaveValue("500");
    await expect(dialog(page).getByLabel(/ยอดรวม Invoice/)).toHaveValue("125000");
    await submitAndExpectError(
      page,
      "น้ำหนักพร้อมส่งเชียงใหม่และเนื้อส่วนที่เหลือรอ Owner รับต้องรวมเท่ากับน้ำหนักตาม Invoice",
    );
  });
  await step(page, "Foodiva: C4 Invoice 490 ส่ง + 10 รอ Owner → บันทึก · count pill หาย · ตารางแสดง 490 / 10 / คงเหลือ 500", async () => {
    await field(page, /พร้อมส่งไป Chef_house/, "490");
    await saveEntry(page);
    await expect(menuItem(page, "PO และสต๊อก Foodiva")).toHaveText("PO และสต๊อก Foodiva");
    const row = rowIn(page, "PO เนื้อที่ต้องออก Invoice", LOT);
    await expect(row).toContainText("FD-INV-C4 · 500.00 กก.");
    await expect(row.getByRole("cell").nth(4)).toHaveText("490.00 กก.");
    await expect(row.getByRole("cell").nth(5)).toHaveText("10.00 กก.");
    await expect(row.getByRole("cell").nth(6)).toHaveText("500.00 กก.");
    await expect(row).toContainText("รอ Owner เรียกรถ");
    await expect(row).toContainText("แนบ Invoice แล้ว");
    await expect(stat(page, "เนื้อดิบคงเหลือ Foodiva")).toContainText("500.00 กก.");
    await expect(stat(page, "เนื้อส่วนที่เหลือรอ Owner รับ (Waste)")).toContainText("10.00 กก.");
  });
  await step(page, "Owner: C4 เห็น Invoice Foodiva ทันที + ดาวน์โหลดไฟล์แนบได้ไฟล์จริง (BUG-5)", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await tab(page, "ใบ Invoice");
    const row = rowIn(page, "Invoice Foodiva", "FD-INV-C4");
    await expect(row).toContainText(`${PO} / ${LOT}`);
    await expect(row).toContainText("500.00 กก.");
    await expect(row).toContainText("฿125,000.00");
    await expect(row).toContainText("เจ้าหน้าที่ Foodiva");
    await expectDownload(page, row.getByRole("button", { name: "ดาวน์โหลด" }));
    await tab(page, "ใบสั่งซื้อ PO");
    await expect(rowIn(page, "รายการใบสั่งซื้อ PO", PO)).toContainText("FD-INV-C4");
  });

  /* ---- C5 / C9 gates before the smoke PO ---- */
  await step(page, "Owner: C5 หลัง Foodiva ยืนยันแต่ยังไม่มี PO รมควัน → ใบขนส่ง \"รอ Owner ออก PO รมควัน\" · หน้า PO มีปุ่ม \"ไปใบสั่ง PO โรงรมควัน\"", async () => {
    await tab(page, "ใบขนส่ง");
    const row = rowIn(page, "รายการขนส่งตาม Lot", LOT);
    await expect(row).toContainText("พร้อมส่งเชียงใหม่ 490.00 กก. · รอทำใบขนส่ง");
    await expect(row).toContainText("รอ Owner ออก PO รมควัน");
    await expect(page.getByRole("button", { name: "ทำใบขนส่งขาไป" })).toHaveCount(0);
    await tab(page, "ใบสั่งซื้อ PO");
    await button(page, "ไปใบสั่ง PO โรงรมควัน");
    await expect(page.getByRole("heading", { name: "ใบสั่ง PO โรงรมควัน" }).first()).toBeVisible();
  });

  /* ---- C6: smoke PO 490 @ 220 ---- */
  await step(page, "Owner: C6 ออก PO รมควัน 491 > 490 พร้อมส่ง → บล็อก", async () => {
    await button(page, "ออก PO รมควันเนื้อ");
    await expect(dialog(page).getByLabel(/โรงรม \/ ผู้ให้บริการ/)).toHaveValue("Chef_house");
    await expect(dialog(page).getByLabel(/Raw Meat Quantity/)).toHaveValue("490");
    await field(page, /Raw Meat Quantity/, "491");
    await submitAndExpectError(page, "น้ำหนักใน PO รมควันเกินยอดที่ Foodiva ระบุว่าพร้อมส่งเชียงใหม่");
  });
  await step(page, "Owner: C6 PO รมควัน 490 → บันทึก · อัตรา ฿220 / กก. · รอ Chef_house ยืนยัน 1 ใบ", async () => {
    await field(page, /Raw Meat Quantity/, "490");
    await saveEntry(page);
    const row = rowIn(page, "รายการ PO โรงรมควัน", LOT);
    await expect(row).toContainText("FD-INV-C4 · พร้อมส่งเชียงใหม่ 490.00 กก.");
    await expect(row).toContainText("490.00 กก.");
    await expect(row).toContainText("฿220.00 / กก.");
    await expect(row).toContainText("รอยืนยัน");
    await expect(row).toContainText("รอ Chef_house");
    await expect(stat(page, "PO รอยืนยันจาก Chef_house")).toContainText("1 ใบ");
  });
  await step(page, "Owner: C9 gate ก่อน Chef_house ยืนยัน PO → ใบขนส่งแสดง \"รอ Chef_house รับ PO\"", async () => {
    await tab(page, "ใบขนส่ง");
    await expect(rowIn(page, "รายการขนส่งตาม Lot", LOT)).toContainText("รอ Chef_house รับ PO");
    await expect(page.getByRole("button", { name: "ทำใบขนส่งขาไป" })).toHaveCount(0);
  });

  /* ---- C6 / C7: Chef_house accepts and bills 490 × 220 ---- */
  await step(page, "Chef_house: C6 งานผลิต pill 1 · \"ดู PO รมควัน\" เปิด SmokeOrderPreviewDialog แสดงเลข SO และ 490 กก.", async () => {
    await signInAs(page, ACCOUNTS.chef);
    await expect(menuItem(page, "งานผลิต")).toContainText("1");
    await tab(page, "งานผลิต");
    const row = rowIn(page, "รายการ Lot ทั้งหมด", LOT);
    await expect(row).toContainText(SO);
    await expect(row).toContainText("รอยืนยันรับ");
    await pointAndClick(page, row.getByRole("button", { name: "ดู PO รมควัน" }));
    const preview = dialog(page);
    await expect(preview.getByRole("heading", { name: "ใบสั่ง PO โรงรมควัน" })).toBeVisible();
    await expect(preview).toContainText("SMOKING SERVICE PO");
    await expect(preview).toContainText(SO);
    await expect(preview).toContainText("490");
    await pointAndClick(page, preview.getByRole("button", { name: "ปิด", exact: true }));
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
  await step(page, "Chef_house: C7 ยังไม่ยืนยันรับ PO → ไม่มีปุ่มใบวางบิล (พฤติกรรมจริง: ปุ่มถูกซ่อน ข้อความ store ไม่ถึง UI)", async () => {
    await expect(page.getByRole("button", { name: "สร้าง / Submit ใบวางบิล" })).toHaveCount(0);
  });
  await step(page, "Chef_house: C6 ยืนยันรับ PO: ชื่อผู้รับว่าง → กรอกชื่อผู้รับ PO · กรอกแล้ว → ปุ่มยืนยันหาย (ยืนยันซ้ำไม่ได้จาก UI)", async () => {
    await button(page, "ยืนยันรับ PO รมควัน");
    await submitAndExpectError(page, "กรอกชื่อผู้รับ PO");
    await field(page, /ชื่อผู้รับ PO/, "หัวหน้าผลิต Chef_house");
    await saveEntry(page);
    await expect(page.getByRole("button", { name: "ยืนยันรับ PO รมควัน" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "สร้าง / Submit ใบวางบิล" })).toBeVisible();
  });
  await step(page, "Chef_house: C7 ใบวางบิล: เลขว่าง → กรอกเลข Invoice ค่ารม · ไม่แนบไฟล์ → กรอกInvoice ที่แนบ", async () => {
    await button(page, "สร้าง / Submit ใบวางบิล");
    await submitAndExpectError(page, "กรอกเลข Invoice ค่ารม");
    await field(page, /เลข Invoice ค่ารมควัน/, "CH-INV-C7");
    await submitAndExpectError(page, "กรอกInvoice ที่แนบ");
  });
  await step(page, "Chef_house: C7 แนบไฟล์ → Submit → สถานะรอตรวจยอด · งานผลิต pill หาย", async () => {
    await dialog(page).locator('input[type="file"]').setInputFiles(INVOICE_FIXTURE);
    await field(page, /รายละเอียดเพิ่มเติม/, "ค่าบริการรมควันเนื้อ 490 กก.");
    await button(page, "Submit ใบวางบิล");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const row = rowIn(page, "รายการ Lot ทั้งหมด", LOT);
    await expect(row).toContainText("รอตรวจยอด · รอ Owner เรียกรถ");
    await expect(menuItem(page, "งานผลิต")).toHaveText("งานผลิต");
  });

  /* ---- C7 / C8: Owner sees 107,800, reviews, pays ---- */
  await step(page, "Owner: C7 เห็น Invoice Chef_house ฿107,800.00 (490 × 220) สถานะรอตรวจยอด · C8 ยังไม่มีปุ่มชำระเงินก่อนตรวจ", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await tab(page, "ใบ Invoice");
    await expect(stat(page, "Invoice รอตรวจยอด")).toContainText("1 ใบ");
    const row = rowIn(page, "Invoice Chef_house", "CH-INV-C7");
    await expect(row).toContainText(`${PO} / ${LOT}`);
    await expect(row).toContainText("฿107,800.00");
    await expect(row).toContainText("ค่าบริการรมควันเนื้อ 490 กก.");
    await expect(row).toContainText("รอตรวจยอด");
    await expect(row.getByRole("button", { name: "ตรวจยอด" })).toBeVisible();
    await expect(page.getByRole("button", { name: "ชำระเงิน" })).toHaveCount(0);
  });
  await step(page, "Owner: C8 ตรวจยอด: ผลการตรวจยอดมีค่าเริ่มต้น \"รับยอด\" (เลือกว่างไม่ได้จาก UI) · ชื่อผู้ตรวจว่าง → กรอกชื่อผู้ตรวจ · รับยอด → รอชำระ", async () => {
    await button(page, "ตรวจยอด");
    await expect(dialog(page).getByLabel(/ผลการตรวจยอด/)).toHaveValue("รับยอด");
    await submitAndExpectError(page, "กรอกชื่อผู้ตรวจ");
    await field(page, /ชื่อผู้ตรวจ/, "Owner QA");
    await saveEntry(page);
    const row = rowIn(page, "Invoice Chef_house", "CH-INV-C7");
    await expect(row).toContainText("รอชำระ");
    await expect(row.getByRole("button", { name: "ชำระเงิน" })).toBeVisible();
    await expect(stat(page, "Invoice รอตรวจยอด")).toContainText("0 ใบ");
  });
  await step(page, "Owner: C9 gate ก่อนชำระ → ใบขนส่งแสดงปุ่ม \"ชำระ Invoice เพื่อเรียกรถ\" ไม่มีทำใบขนส่ง", async () => {
    await tab(page, "ใบขนส่ง");
    await expect(rowIn(page, "รายการขนส่งตาม Lot", LOT).getByRole("button", { name: "ชำระ Invoice เพื่อเรียกรถ" })).toBeVisible();
    await expect(page.getByRole("button", { name: "ทำใบขนส่งขาไป" })).toHaveCount(0);
  });
  await step(page, "Owner: C8 ชำระ: ยอด 100,000 ≠ 107,800 → บล็อก · ยอด 0 → บล็อก", async () => {
    await tab(page, "ใบ Invoice");
    await button(page, "ชำระเงิน");
    await expect(dialog(page).getByLabel(/ยอดชำระ/)).toHaveValue("107800");
    await field(page, /ผู้ดำเนินการชำระ/, "Owner QA");
    await field(page, /ยอดชำระ/, "100000");
    await submitAndExpectError(page, "ยอดชำระต้องเท่ากับยอดสุทธิใน Invoice");
    await field(page, /ยอดชำระ/, "0");
    await submitAndExpectError(page, "กรอกยอดชำระเป็นตัวเลขมากกว่าศูนย์");
  });
  await step(page, "Owner: C8 ชำระ 107,800 → สถานะชำระแล้ว · ปุ่มชำระเงิน/ตรวจยอดหาย (ชำระซ้ำไม่ได้จาก UI)", async () => {
    await field(page, /ยอดชำระ/, "107800");
    await field(page, /เลขอ้างอิงการชำระ/, "PAY-C8");
    await saveEntry(page);
    const row = rowIn(page, "Invoice Chef_house", "CH-INV-C7");
    await expect(row).toContainText("ชำระแล้ว");
    await expect(page.getByRole("button", { name: "ชำระเงิน" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "ตรวจยอด" })).toHaveCount(0);
  });

  /* ---- C9: outbound transport 490 ---- */
  await step(page, "Owner: C9 ทำใบขนส่งขาไป: ต้นทาง=ปลายทาง → ต้นทางและปลายทางต้องต่างกัน", async () => {
    await tab(page, "ใบขนส่ง");
    await button(page, "ทำใบขนส่งขาไป");
    const form = dialog(page);
    await expect(form.getByLabel(/ต้นทาง/)).toHaveValue("กรุงเทพฯ");
    await expect(form.getByLabel(/ปลายทาง/)).toHaveValue("เชียงใหม่");
    await expect(form.getByLabel(/น้ำหนักที่ส่งเที่ยวนี้/)).toHaveValue("490");
    await field(page, /เวลารถรับ/, "06:30");
    await field(page, /ประเภทรถ/, "รถห้องเย็น");
    await field(page, /ทะเบียนรถ/, "กท 1001");
    await form.getByLabel(/ต้นทาง/).selectOption({ label: "เชียงใหม่" });
    await submitAndExpectError(page, "ต้นทางและปลายทางต้องต่างกัน");
  });
  await step(page, "Owner: C9 ส่ง 600 > 490 พร้อมส่ง → น้ำหนักใบขนส่งเกินยอดที่ Foodiva ระบุว่าพร้อมส่งเชียงใหม่", async () => {
    await dialog(page).getByLabel(/ต้นทาง/).selectOption({ label: "กรุงเทพฯ" });
    await field(page, /น้ำหนักที่ส่งเที่ยวนี้/, "600");
    await submitAndExpectError(page, "น้ำหนักใบขนส่งเกินยอดที่ Foodiva ระบุว่าพร้อมส่งเชียงใหม่");
  });
  await step(page, "Owner: C9 ส่ง 490 หมายเหตุ QA-C9 → ใบขนส่งแสดง 490 กก. · กท 1001 · พรีวิว / PDF · stage รับที่ Chef_house", async () => {
    await field(page, /น้ำหนักที่ส่งเที่ยวนี้/, "490");
    await field(page, /หมายเหตุ/, "QA-C9 dispatch");
    await saveEntry(page);
    const row = rowIn(page, "รายการขนส่งตาม Lot", LOT);
    await expect(row).toContainText("490.00 กก. · กท 1001");
    await expect(row).toContainText("รอ Chef_house ชั่งรับ");
    await expect(row).toContainText("กำลังดำเนินงานที่ Chef_house");
    await expectPrintPopup(page, "พรีวิว / PDF", async (body) => {
      await expect(body).toContainText("ใบขนส่งเนื้อขาไป");
      await expect(body).toContainText(TR);
      await expect(body).toContainText("490.00 กก.");
    });
    await tab(page, "ใบสั่งซื้อ PO");
    await expect(rowIn(page, "รายการใบสั่งซื้อ PO", PO)).toContainText("รับที่ Chef_house");
  });
  await step(page, "Owner: C1 หมายเหตุ PO ยังเป็น QA-C1 หลังทำใบขนส่ง (BUG-4)", async () => {
    await expectPrintPopup(page, "พิมพ์ / PDF", async (body) => {
      await expect(body).toContainText("QA-C1");
      await expect(body).not.toContainText("QA-C9 dispatch");
    });
  });

  /* ---- C10: Chef_house weighs in 488 ---- */
  await step(page, "Chef_house: C10 ยืนยันรับเนื้อ pill 1 · Lot รอรับ 490 กก. รถห้องเย็น · กท 1001", async () => {
    await signInAs(page, ACCOUNTS.chef);
    await expect(menuItem(page, "ยืนยันรับเนื้อ")).toContainText("1");
    await expect(menuItem(page, "งานผลิต")).toHaveText("งานผลิต");
    await tab(page, "ยืนยันรับเนื้อ");
    const row = rowIn(page, "Lot ที่รอยืนยันรับ", LOT);
    await expect(row).toContainText(today);
    await expect(row).toContainText("490.00 กก.");
    await expect(row).toContainText("รถห้องเย็น · กท 1001");
  });
  await step(page, "Chef_house: C10 น้ำหนักรับจริง 0 → กรอกน้ำหนักรับเป็นตัวเลขมากกว่าศูนย์", async () => {
    await pointAndClick(page, rowIn(page, "Lot ที่รอยืนยันรับ", LOT).getByRole("button", { name: "ยืนยันรับเนื้อ" }));
    await expect(dialog(page).getByRole("heading", { name: "ยืนยันรับเนื้อที่ Chef_house" })).toBeVisible();
    await dialog(page).getByLabel(/เวลาที่รถมาถึง/).selectOption({ label: "08:00" });
    await field(page, /น้ำหนักรับจริง/, "0");
    await submitAndExpectError(page, "กรอกน้ำหนักรับเป็นตัวเลขมากกว่าศูนย์");
  });
  await step(page, "Chef_house: C10 รับ 488 → หน้ายืนยันรับเนื้อว่าง · งานผลิต pill 1 · Lot อยู่ขั้น \"ก่อนสโมค\"", async () => {
    await field(page, /น้ำหนักรับจริง/, "488");
    await saveEntry(page);
    await expect(page.getByText("ไม่มี Lot รอยืนยันรับในขณะนี้")).toBeVisible();
    await expect(menuItem(page, "ยืนยันรับเนื้อ")).toHaveText("ยืนยันรับเนื้อ");
    await expect(menuItem(page, "งานผลิต")).toContainText("1");
    await tab(page, "งานผลิต");
    const row = rowIn(page, "รายการ Lot ทั้งหมด", LOT);
    await expect(row).toContainText("488.00 กก.");
    await expect(row).toContainText("ก่อนสโมค");
    await expect(row.getByRole("button", { name: "น้ำหนักก่อนสโมค" })).toBeVisible();
  });

  /* ---- C10 / C11: Owner compares 490 vs 488 and collects the 10 kg ---- */
  await step(page, "Owner: C10 ใบขนส่งเทียบ ส่งจาก Foodiva 490 / Chef_house 488 / ส่วนต่าง -2.00 (BUG-6)", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await tab(page, "ใบขนส่ง");
    const row = rowIn(page, "รายการขนส่งตาม Lot", LOT);
    await expect(row).toContainText("ส่งจาก Foodiva: 490.00 กก.");
    await expect(row).toContainText("Chef_house: 488.00 กก.");
    await expect(row).toContainText(/ส่วนต่าง [-−]2\.00 กก\./);
    await tab(page, "ใบสั่งซื้อ PO");
    await expect(rowIn(page, "รายการใบสั่งซื้อ PO", PO)).toContainText("ก่อนสโมค");
  });
  await step(page, "Owner: C11 สต๊อกของทั้งหมด: เนื้อรอ Owner รับ 10 กก. · รับ 11 → น้ำหนักรับเกินยอดเนื้อส่วนที่เหลือที่ Foodiva รอให้ Owner รับ", async () => {
    await tab(page, "สต๊อกของทั้งหมด");
    const row = rowIn(page, "ตารางสต๊อกทั้งหมด (All inventory)", `${LOT} · เนื้อส่วนที่เหลือรอ Owner รับ (Waste)`);
    await expect(row).toContainText("จาก Invoice 10.00 กก. · Owner รับแล้ว 0.00 กก.");
    await pointAndClick(page, row.getByRole("button", { name: "บันทึกรับเนื้อ" }));
    await expect(dialog(page).getByRole("heading", { name: "รับเนื้อส่วนที่เหลือจาก Foodiva" })).toBeVisible();
    await field(page, /น้ำหนักรับจริง/, "11");
    await field(page, /ผู้รับเนื้อ/, "Owner QA");
    await submitAndExpectError(page, "น้ำหนักรับเกินยอดเนื้อส่วนที่เหลือที่ Foodiva รอให้ Owner รับ");
  });
  await step(page, "Owner: C11 รับ 10 → Owner รับครบแล้ว · เนื้อดิบพร้อมส่ง Chef_house ที่ Foodiva = 0", async () => {
    await field(page, /น้ำหนักรับจริง/, "10");
    await saveEntry(page);
    const table = "ตารางสต๊อกทั้งหมด (All inventory)";
    const waiting = rowIn(page, table, `${LOT} · เนื้อส่วนที่เหลือรอ Owner รับ (Waste)`);
    await expect(waiting).toContainText("Owner รับแล้ว 10.00 กก.");
    await expect(waiting).toContainText("Owner รับครบแล้ว");
    await expect(waiting.getByRole("button", { name: "บันทึกรับเนื้อ" })).toHaveCount(0);
    await expect(rowIn(page, table, `${LOT} · เนื้อส่วนที่ Owner รับแล้ว (Waste)`).getByRole("cell").nth(3)).toHaveText("10.00");
    await expect(rowIn(page, table, `${LOT} · เนื้อดิบพร้อมส่ง Chef_house`).getByRole("cell").nth(3)).toHaveText("0.00");
  });

  /* ---- C13: the same numbers on every read-only screen ---- */
  await step(page, "Owner: C13 Log เนื้อคงเหลือ: Chef_house รอเข้ารอบสโมค 488 · Foodiva เนื้อดิบ 0 · Owner รับแล้ว 10 · ประวัติครบทุกก้าว", async () => {
    await tab(page, "Log เนื้อคงเหลือ");
    const spots = "เนื้อคงเหลือแยกตามจุด";
    const balance = (label: string) => rowIn(page, spots, label).getByRole("cell").nth(3);
    await expect(balance("Chef_house · รอเข้ารอบสโมค")).toHaveText("488.00 กก.");
    await expect(balance("Foodiva · เนื้อดิบ")).toHaveText("0.00 กก.");
    await expect(balance("Foodiva · เนื้อส่วนที่เหลือรอ Owner รับ (Waste)")).toHaveText("0.00 กก.");
    await expect(balance("Owner · เนื้อส่วนที่รับแล้ว (Waste)")).toHaveText("10.00 กก.");
    const history = "ประวัติการเคลื่อนไหวเนื้อ";
    await expect(rowIn(page, history, "ยืนยัน Invoice และแบ่งเนื้อ")).toContainText(
      "Invoice 500.00 · ส่งเชียงใหม่ 490.00 · รอ Owner รับ (Waste) 10.00",
    );
    await expect(rowIn(page, history, "ส่งเนื้อดิบ")).toContainText("490.00 กก.");
    await expect(rowIn(page, history, "ชั่งรับเนื้อจริง")).toContainText("488.00 กก.");
    await expect(rowIn(page, history, "รับเนื้อส่วนที่เหลือจาก Foodiva")).toContainText("10.00 กก. · Owner QA");
  });
  await step(page, "Owner: C13 เอกสารและ Traceability: ที่โรงรม 488 กก. · Stock Transfer Document มีใบขนส่ง TR 490 กก. Received by Chef_house", async () => {
    await tab(page, "เอกสารและ Traceability");
    const lot = rowIn(page, "Beef Lot traceability และสถานะสต๊อก", PO);
    await expect(lot.getByRole("cell").nth(2)).toHaveText("0.00 กก.");
    await expect(lot.getByRole("cell").nth(3)).toHaveText("488.00 กก.");
    const transfer = rowIn(page, "Stock Transfer Document", TR);
    await expect(transfer).toContainText("กรุงเทพฯ → เชียงใหม่");
    await expect(transfer).toContainText("490.00 กก.");
    await expect(transfer).toContainText("488.00 กก.");
    await expect(transfer).toContainText("Received by Chef_house");
  });
  await step(page, "Foodiva: C13 PO และสต๊อก: คงเหลือ Foodiva 0 · สถานะส่งให้ Chef_house แล้ว", async () => {
    await signInAs(page, ACCOUNTS.foodiva);
    const row = rowIn(page, "PO เนื้อที่ต้องออก Invoice", LOT);
    await expect(row).toContainText("ส่งให้ Chef_house แล้ว");
    await expect(row.getByRole("cell").nth(6)).toHaveText("0.00 กก.");
    await expect(stat(page, "เนื้อดิบคงเหลือ Foodiva")).toContainText("0.00 กก.");
  });
});

test("C12 โอนเนื้อสดไปผลิต Steak หักจากเนื้อดิบคงเหลือที่ Foodiva (rawAtFoodiva) และบล็อกเมื่อเกิน", async ({
  page,
}) => {
  test.setTimeout(6 * 60_000);
  await step(page, "ระบบ: seed ว่าง → Owner PO 500 → Foodiva Invoice 500", async () => {
    await startFresh(page);
    await signInAs(page, ACCOUNTS.owner);
    await ownerCreatesMeatPo(page, "500");
    await signInAs(page, ACCOUNTS.foodiva);
    await foodivaIssuesInvoice(page, "500");
  });
  await step(page, "Owner: C12 โอนไป Steak 501 > 500 ที่ Foodiva → เนื้อสดคงเหลือที่ Foodiva ไม่พอ · 0 → กรอกน้ำหนักโอนไป Steakเป็นตัวเลขมากกว่าศูนย์", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await tab(page, "เอกสารและ Traceability");
    const lot = rowIn(page, "Beef Lot traceability และสถานะสต๊อก", PO);
    await expect(lot.getByRole("cell").nth(2)).toHaveText("500.00 กก.");
    await pointAndClick(page, lot.getByRole("button", { name: "โอนไป Steak" }));
    await expect(dialog(page).getByRole("heading", { name: "โอนเนื้อสดไปผลิต Steak" })).toBeVisible();
    await expect(dialog(page).getByLabel(/เหตุผลโอน/)).toHaveValue("Steak Production");
    await field(page, /Quantity Out/, "501");
    await submitAndExpectError(page, "เนื้อสดคงเหลือที่ Foodiva ไม่พอ");
    await field(page, /Quantity Out/, "0");
    await submitAndExpectError(page, "กรอกน้ำหนักโอนไป Steakเป็นตัวเลขมากกว่าศูนย์");
  });
  await step(page, "Owner: C12 โอน 100 → Foodiva 400 / Steak 100 · Stock Transfer Document TR Received", async () => {
    await field(page, /Quantity Out/, "100");
    await saveEntry(page);
    const lot = rowIn(page, "Beef Lot traceability และสถานะสต๊อก", PO);
    await expect(lot.getByRole("cell").nth(2)).toHaveText("400.00 กก.");
    await expect(lot.getByRole("cell").nth(4)).toHaveText("100.00 กก.");
    const transfer = rowIn(page, "Stock Transfer Document", TR);
    await expect(transfer).toContainText("Foodiva / Raw Meat Storage → Steak Production");
    await expect(transfer).toContainText("100.00 กก.");
    await expect(transfer).toContainText("Received");
    await tab(page, "Log เนื้อคงเหลือ");
    await expect(rowIn(page, "เนื้อคงเหลือแยกตามจุด", "Foodiva · เนื้อดิบ").getByRole("cell").nth(3)).toHaveText("400.00 กก.");
  });
  await step(page, "Owner: C12 โอนอีก 401 > 400 → บล็อก", async () => {
    await tab(page, "เอกสารและ Traceability");
    await pointAndClick(page, rowIn(page, "Beef Lot traceability และสถานะสต๊อก", PO).getByRole("button", { name: "โอนไป Steak" }));
    await field(page, /Quantity Out/, "401");
    await submitAndExpectError(page, "เนื้อสดคงเหลือที่ Foodiva ไม่พอ");
    await cancelDialog(page);
  });
  await step(page, "Foodiva: C12 เนื้อดิบคงเหลือ Foodiva 400 กก.", async () => {
    await signInAs(page, ACCOUNTS.foodiva);
    await expect(rowIn(page, "PO เนื้อที่ต้องออก Invoice", LOT).getByRole("cell").nth(6)).toHaveText("400.00 กก.");
    await expect(stat(page, "เนื้อดิบคงเหลือ Foodiva")).toContainText("400.00 กก.");
  });
});

/* ---- Open app bugs: the correct assertion, marked so the lane stays green ---- */

test("E2E-C1: Owner มีปุ่มเปิดฟอร์ม \"บันทึก Supplier Invoice\" สำหรับ PO (C3)", async ({
  page,
}) => {
  test.fail(
    true,
    "E2E-C1: kind supplierInvoice มี form/title/ตาราง/KPI แต่ไม่มีปุ่มเปิดฟอร์มในหน้าใด (DocumentModuleView มีเฉพาะ ภาษี / โอนไป Steak)",
  );
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await ownerCreatesMeatPo(page, "500");
  await step(page, "Owner: C3 หน้าเอกสารและ Traceability ต้องมีปุ่มบันทึก Supplier Invoice", async () => {
    await tab(page, "เอกสารและ Traceability");
    await expect(page.locator("main").getByRole("button", { name: /Supplier Invoice/ })).toBeVisible();
  });
});

test("E2E-C2: หน้า Foodiva แสดงเนื้อรอ Owner รับ = 0 หลัง Owner รับครบ 10 กก. (C11)", async ({
  page,
}) => {
  test.fail(
    true,
    "E2E-C2: FoodivaView ใช้ reservedForOwnerContent (ยอดจาก Invoice) ไม่ใช่ ownerWasteOutstanding จึงยังแสดง 10.00 กก. หลัง Owner รับครบ",
  );
  test.setTimeout(5 * 60_000);
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await ownerCreatesMeatPo(page, "500");
  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaSplitsInvoice(page, "FD-INV-C11", "490", "10");
  await saveEntry(page);
  await step(page, "Owner: C11 รับเนื้อส่วนที่เหลือ 10 กก.", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await tab(page, "สต๊อกของทั้งหมด");
    await button(page, "บันทึกรับเนื้อ");
    await field(page, /น้ำหนักรับจริง/, "10");
    await field(page, /ผู้รับเนื้อ/, "Owner QA");
    await saveEntry(page);
  });
  await step(page, "Foodiva: C11 เนื้อส่วนที่เหลือรอ Owner รับ ต้องเป็น 0.00 กก.", async () => {
    await signInAs(page, ACCOUNTS.foodiva);
    await expect(rowIn(page, "PO เนื้อที่ต้องออก Invoice", LOT).getByRole("cell").nth(5)).toHaveText("0.00 กก.");
    await expect(stat(page, "เนื้อส่วนที่เหลือรอ Owner รับ (Waste)")).toContainText("0.00 กก.");
  });
});

test("E2E-C3: Chef_house รับเนื้อ 300 จากที่ส่ง 500 (เกิน tolerance 20 %) ต้องกรอกเหตุผลส่วนต่าง (C10)", async ({
  page,
}) => {
  test.fail(
    true,
    "E2E-C3: mutate() cmReceive ไม่เรียก variance() (store.ts:985) และ forms.cmReceive ไม่มีช่องเหตุผล จึงรับ 300 ได้เงียบ ๆ",
  );
  test.setTimeout(6 * 60_000);
  await step(page, "ระบบ: เดิน loop ถึงใบขนส่งขาไป 500 กก.", async () => {
    await startFresh(page);
    await signInAs(page, ACCOUNTS.owner);
    await ownerCreatesMeatPo(page, "500");
    await signInAs(page, ACCOUNTS.foodiva);
    await foodivaIssuesInvoice(page, "500");
    await signInAs(page, ACCOUNTS.owner);
    await ownerIssuesSmokePo(page, "500");
    await signInAs(page, ACCOUNTS.chef);
    await chefAcceptsAndInvoices(page, "CH-INV-C10");
    await signInAs(page, ACCOUNTS.owner);
    await ownerReviewsAndPays(page);
    await ownerDispatches(page, "500");
  });
  await step(page, "Chef_house: C10 รับ 300 จาก 500 → กรอกเหตุผลส่วนต่าง", async () => {
    await signInAs(page, ACCOUNTS.chef);
    await tab(page, "ยืนยันรับเนื้อ");
    await pointAndClick(page, rowIn(page, "Lot ที่รอยืนยันรับ", LOT).getByRole("button", { name: "ยืนยันรับเนื้อ" }));
    await field(page, /น้ำหนักรับจริง/, "300");
    await submitAndExpectError(page, "กรอกเหตุผลส่วนต่าง");
  });
});

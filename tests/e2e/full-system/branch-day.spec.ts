import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  field,
  foodivaIssuesInvoice,
  INVOICE_FIXTURE,
  loadSampleData,
  menuItem,
  ownerCreatesMeatPo,
  ownerIssuesSmokePo,
  pointAndClick,
  saveEntry,
  signInAs,
  skipUnlessCredentials,
  startFresh,
  step,
  tableSection,
} from "../helpers";

/* Lane E (vault: Testing/E2E Full System/17-09-2026/Plan.md §5): one lot of
 * 500 kg goes through the loop into central stock as 5 × 100 kg bags, Owner
 * allocates 3 bags to Saladaeng and 2 to Minburi, both branches run a full day
 * (receive → thaw → rice → sale → influencer box → materials → close) and Owner
 * unlocks, re-closes and reads the report and the stock views. Every number
 * below is derived from mutate() in src/lib/store.ts. */

const MATERIALS = [
  "กล่องพิมพ์ลาย",
  "กระดาษรอง",
  "ถุงซีลเนื้อ",
  "ถุงซีลข้าว",
  "ถุงหิ้วกระดาษ",
  "สติกเกอร์โลโก้",
  "การ์ด / สติกเกอร์วิธีอุ่น",
];
const BOX = MATERIALS[0];
/** Lot ids look like F260917-001 (see mutate() "purchase"). */
const LOT = /F\d{6}-\d{3}/;

const openDialog = (page: Page) => page.getByRole("dialog").last();

/** The sample set closes its last seven days (through today) and future dates are blocked,
 * so the day before the sample range is the open working date. */
function openDayBeforeSample() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  now.setDate(now.getDate() - 7);
  return now.toLocaleDateString("en-CA");
}

/** Submits the open dialog and expects it to stay open with a validation message. */
async function submitAndExpectError(page: Page, message: RegExp) {
  const dialog = openDialog(page);
  await pointAndClick(page, dialog.locator('button[type="submit"]').last());
  await expect(
    dialog.getByRole("alert").filter({ hasText: message }),
  ).toBeVisible();
}

async function cancelDialog(page: Page) {
  await pointAndClick(
    page,
    openDialog(page).getByRole("button", { name: "ยกเลิก" }),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** Settings cards are edit-locked until "ขอแก้ไข" is pressed (see owner.spec.ts). */
async function editSection(
  page: Page,
  title: string,
  fill: () => Promise<void>,
) {
  const section = tableSection(page, title);
  await pointAndClick(
    page,
    section.getByRole("button", { name: "ขอแก้ไข (Request edit)" }),
  );
  await fill();
  await pointAndClick(
    page,
    section.getByRole("button", { name: "บันทึกและล็อก (Save & lock)" }),
  );
  await expect(
    section.getByRole("button", { name: "ขอแก้ไข (Request edit)" }),
  ).toBeVisible();
}

const nav = (page: Page, label: string) =>
  pointAndClick(page, menuItem(page, label));

/** The action button of one DailyTaskTable row, addressed by the row's label. */
const rowButton = (page: Page, rowText: string, name = "กรอกข้อมูล") =>
  page
    .getByRole("row")
    .filter({ hasText: rowText })
    .getByRole("button", { name });

/** One cell of the table row whose text contains `rowText` (every DataTable cell is a <td>). */
const cell = (scope: Locator, rowText: string | RegExp, index: number) =>
  scope.getByRole("row").filter({ hasText: rowText }).getByRole("cell").nth(index);

const summary = (page: Page) => tableSection(page, /^สรุปรายวัน/);

/** The inline materials table is not a live-preview dialog, and its "used" input
 * re-renders "" as "0", so a keystroke-by-keystroke typeValue would leave "0150". */
const fillCell = (page: Page, label: string, value: string) =>
  page.getByLabel(label).fill(value);

/** Opens the sales dialog; the chili count opens blank ("ไม่ได้นับ"). */
async function openSale(page: Page) {
  await button(page, "บันทึกยอดขาย");
}

/** Opens "ตรวจและปิดวัน", submits with the simulated clock and expects mutate() to refuse. */
async function closeDayRefused(page: Page, time: string, message: RegExp) {
  await pointAndClick(page, rowButton(page, "ยืนยันปิดวัน", "ตรวจและปิดวัน"));
  await field(page, /เวลาจำลองสำหรับทดสอบปิดวัน/, time);
  await field(page, /ชื่อผู้ยืนยันปิดวัน/, "ผู้ดูแลสาขา");
  await submitAndExpectError(page, message);
  await cancelDialog(page);
}

async function closeDay(page: Page, who: string) {
  await pointAndClick(page, rowButton(page, "ยืนยันปิดวัน", "ตรวจและปิดวัน"));
  await field(page, /เวลาจำลองสำหรับทดสอบปิดวัน/, "22:00");
  await field(page, /ชื่อผู้ยืนยันปิดวัน/, who);
  await saveEntry(page);
  await expect(page.locator("main")).toContainText("ปิดแล้ว");
}

/** Walks the lot from PO to central stock: 500 kg everywhere, 5 bags × 100 kg. */
async function reachAllocation(page: Page) {
  await step(page, "Owner: สร้าง PO เนื้อ 500 กก.", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await ownerCreatesMeatPo(page, "500");
  });
  await step(page, "Foodiva: ออก Invoice 500 กก. พร้อมส่ง Chef_house ทั้งหมด", async () => {
    await signInAs(page, ACCOUNTS.foodiva);
    await foodivaIssuesInvoice(page, "500");
  });
  await step(page, "Owner: ออก PO รมควัน 500 กก.", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await ownerIssuesSmokePo(page, "500");
  });
  await step(page, "Chef_house: ยืนยันรับ PO รมควัน และ Submit ใบวางบิล", async () => {
    await signInAs(page, ACCOUNTS.chef);
    await button(page, "งานผลิต");
    await button(page, "ยืนยันรับ PO รมควัน");
    await field(page, /ชื่อผู้รับ PO/, "หัวหน้าผลิต Chef_house");
    await saveEntry(page);
    await button(page, "สร้าง / Submit ใบวางบิล");
    await field(page, /เลข Invoice ค่ารมควัน/, "CH-INV-001");
    await page
      .getByRole("dialog")
      .locator('input[type="file"]')
      .setInputFiles(INVOICE_FIXTURE);
    await field(page, /รายละเอียดเพิ่มเติม/, "ค่าบริการรมควันเนื้อ 500 กก.");
    await button(page, "Submit ใบวางบิล");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
  await step(page, "Owner: ตรวจยอด ชำระ 110,000 และทำใบขนส่งขาไป 500 กก.", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await button(page, /ใบ Invoice/);
    await button(page, "ตรวจยอด");
    await field(page, /ชื่อผู้ตรวจ/, "Owner Demo");
    await saveEntry(page);
    await button(page, "ชำระเงิน");
    await field(page, /ยอดชำระ/, "110000");
    await field(page, /ผู้ดำเนินการชำระ/, "Owner Demo");
    await field(page, /เลขอ้างอิงการชำระ/, "PAY-001");
    await saveEntry(page);
    await button(page, "ใบขนส่ง");
    await button(page, "ทำใบขนส่งขาไป");
    await field(page, /เวลารถรับ/, "06:30");
    await field(page, /ประเภทรถ/, "รถห้องเย็น");
    await field(page, /ทะเบียนรถ/, "กท 1001");
    await field(page, /ชื่อคนขับ/, "คนขับทดสอบ");
    await field(page, /เบอร์ติดต่อคนขับ/, "0811111111");
    await field(page, /น้ำหนักที่ส่งเที่ยวนี้/, "500");
    await saveEntry(page);
  });
  await step(page, "Chef_house: รับ 500 · ก่อนสโมค 500 · สโมค 5 ถุง × 100 กก. · ปิด Lot", async () => {
    await signInAs(page, ACCOUNTS.chef);
    await nav(page, "ยืนยันรับเนื้อ");
    await pointAndClick(
      page,
      tableSection(page, "Lot ที่รอยืนยันรับ").getByRole("button", {
        name: "ยืนยันรับเนื้อ",
      }),
    );
    await page.getByLabel(/เวลาที่รถมาถึง/).selectOption({ label: "08:00" });
    await field(page, /น้ำหนักรับจริง/, "500");
    await saveEntry(page);
    await button(page, "งานผลิต");
    await button(page, "น้ำหนักก่อนสโมค");
    await field(page, /น้ำหนักหลังแกะซับ/, "500");
    await saveEntry(page);
    await button(page, "บันทึก Lot สโมครายวัน");
    await field(page, /น้ำหนักเข้าเตารอบนี้/, "500");
    await field(page, "น้ำหนักถุงที่ 1", "100");
    for (let bag = 2; bag <= 5; bag += 1) {
      await button(page, "เพิ่มถุง");
      await field(page, `น้ำหนักถุงที่ ${bag}`, "100");
    }
    await saveEntry(page);
    await button(page, "ยืนยันปิด Lot");
    await field(page, /ชื่อผู้ยืนยันปิด Lot/, "หัวหน้าผลิต Chef_house");
    await saveEntry(page);
  });
  await step(page, "Owner: เรียกรถขากลับ 500 กก.", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await button(page, "ใบขนส่ง");
    await button(page, /เรียกรถขากลับ/);
    await field(page, /เวลารถรับจาก Chef_house|เวลารถรับ/, "09:00");
    await field(page, /ประเภทรถ/, "รถห้องเย็น");
    await field(page, /ทะเบียนรถ/, "กท 1002");
    await field(page, /ชื่อคนขับ/, "คนขับขากลับ");
    await field(page, /เบอร์ติดต่อคนขับ/, "0822222222");
    await field(page, /น้ำหนักส่งจาก Chef_house/, "500");
    await saveEntry(page);
  });
  await step(page, "Foodiva: ยืนยันรับเข้าตู้ 500 กก. 5 ถุง", async () => {
    await signInAs(page, ACCOUNTS.foodiva);
    await button(page, "ยืนยันรับเข้าตู้");
    await field(page, /เวลารับ/, "10:00");
    await field(page, /น้ำหนักรับจริง/, "500");
    await field(page, /จำนวนถุงที่รับ/, "5");
    await saveEntry(page);
  });
  await step(page, "Owner: รับเข้าสต๊อกกลาง 500 กก. → stage จัดสรร / ขาย", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await button(page, "รับเนื้อเข้าสต๊อกกลาง");
    await button(page, "รับเข้าสต๊อกกลาง");
    await field(page, /น้ำหนักรับสต๊อกกลาง/, "500");
    await saveEntry(page);
  });
}

test("Lane E: จัดสรร → สาขาศาลาแดง/มีนบุรี รับ ละลาย ข้าว ขาย เช็ควัสดุ ปิดวัน → Owner ปลดล็อก รายงาน สต๊อก (E1–E12)", async ({
  page,
}) => {
  test.setTimeout(20 * 60_000);
  skipUnlessCredentials(
    ACCOUNTS.owner,
    ACCOUNTS.foodiva,
    ACCOUNTS.chef,
    ACCOUNTS.saladaeng,
    ACCOUNTS.minburi,
  );
  await startFresh(page);

  /* ---- Owner setup: material par levels, one material at Saladaeng, chili ---- */

  await step(page, "Owner: ตั้งฐานวัสดุ 500 ชิ้น ราคา 1 บาท ทั้ง 7 รายการ (ใช้กับทั้ง 2 สาขา)", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await expect(page.getByRole("heading", { name: "แดชบอร์ด" })).toBeVisible();
    await button(page, "ตั้งค่า");
    await editSection(
      page,
      "จำนวนฐานและราคาวัสดุทั้งร้าน (Material par levels & unit prices)",
      async () => {
        for (let index = 0; index < MATERIALS.length; index += 1) {
          await field(page, `material${index}`, "500");
          await field(page, `materialPrice${index}`, "1");
        }
      },
    );
  });

  await step(page, "Owner: E11 ปลดล็อกวันที่ยังไม่ปิด → วันนี้ยังไม่ได้ปิด", async () => {
    await button(page, "รายงาน");
    await button(page, "ปลดล็อกวัน");
    await page.getByLabel(/สาขาที่ปลดล็อก/).selectOption({ label: "ศาลาแดง" });
    await field(page, /เหตุผลปลดล็อก/, "ทดสอบปลดล็อกก่อนปิดวัน");
    await submitAndExpectError(page, /วันนี้ยังไม่ได้ปิด/);
    await cancelDialog(page);
  });

  await step(page, `Owner: ซื้อ${BOX} 200 ชิ้นเข้าคลัง และส่ง 100 ชิ้นไปศาลาแดง`, async () => {
    await button(page, "สต๊อกของทั้งหมด");
    await button(page, "+ ซื้อวัสดุเข้าคลัง");
    await openDialog(page).getByLabel(`ซื้อ ${BOX}`).check();
    await field(page, `จำนวนซื้อ ${BOX}`, "200");
    await field(page, `ราคาซื้อ ${BOX}`, "1");
    await field(page, `ผู้จำหน่าย ${BOX}`, "ร้านวัสดุ E2E");
    await button(page, "บันทึกการซื้อ 1 รายการ");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await button(page, "ส่งวัสดุไปสาขา");
    await openDialog(page).getByLabel(`ส่ง ${BOX} ไปศาลาแดง`).check();
    await field(page, `จำนวน ${BOX} ไปศาลาแดง`, "100");
    await field(page, "ผู้รับของสาขาศาลาแดง", "ผู้ดูแลศาลาแดง");
    await button(page, "บันทึกส่งวัสดุ");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  await step(page, "Owner: ซื้อน้ำพริก 100 หลอด และจัดสรร ศาลาแดง 50 / มีนบุรี 20", async () => {
    await button(page, "+ บันทึกการซื้ออื่น ๆ");
    await page
      .getByLabel("เลือกวัตถุดิบ 1")
      .selectOption({ label: "น้ำพริกหลอด" });
    await field(page, "จำนวน 1", "100");
    await field(page, "ราคาต่อหน่วย 1", "20");
    await field(page, "ผู้จำหน่าย 1", "ครัวน้ำพริก E2E");
    await field(page, "ใบเสร็จ 1", "CHILI-E2E");
    await button(page, "บันทึก 1 รายการ");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    for (const [branch, tubes] of [
      ["ศาลาแดง", "50"],
      ["มีนบุรี", "20"],
    ]) {
      await button(page, "จัดสรรน้ำพริกไปสาขา");
      await page.getByLabel(/สาขาปลายทาง/).selectOption({ label: branch });
      await field(page, /จำนวนน้ำพริกที่จัดสรร/, tubes);
      await field(page, /ผู้รับ \/ ผู้ดูแลสาขา/, `ผู้ดูแล${branch}`);
      await saveEntry(page);
    }
  });

  await reachAllocation(page);

  /* ---- E1 Owner allocates the 5 bags ---- */

  const meatTable = tableSection(page, "สต๊อกเนื้อทุกจุด (Meat inventory)");
  await step(page, "Owner: E1 จัดสรรไปสาขา — คลังกลาง 500 กก. 5 ถุง · ไม่เลือกสาขา → เลือกสาขาปลายทางอย่างน้อย 1 ถุง", async () => {
    await button(page, "จัดสรรเนื้อ และสต๊อกไปสาขา");
    await expect(cell(meatTable, LOT, 2)).toHaveText("500.00 กก.");
    await expect(cell(meatTable, LOT, 3)).toHaveText("5 ถุง");
    await pointAndClick(
      page,
      meatTable.getByRole("row").filter({ hasText: LOT }).getByRole("button", {
        name: "จัดสรร",
      }),
    );
    const dialog = openDialog(page);
    for (let bag = 1; bag <= 5; bag += 1)
      await expect(cell(dialog, `ถุงที่ ${bag}`, 1)).toHaveText("100.00 กก.");
    // BagAllocationForm refuses before mutate() gets to see "เลือกสาขา".
    await submitAndExpectError(page, /เลือกสาขาปลายทางอย่างน้อย 1 ถุง/);
  });

  await step(page, "Owner: E1 ศาลาแดง 3 ถุง / มีนบุรี 2 ถุง → คลังกลาง 0 กก. 0 ถุง ปุ่มจัดสรรปิด (BUG-1: ถุงสุดท้ายออกได้)", async () => {
    const dialog = openDialog(page);
    for (let bag = 1; bag <= 5; bag += 1)
      await dialog
        .getByLabel(`เลือกสาขาให้ถุงที่ ${bag}`)
        .selectOption({ label: bag <= 3 ? "ศาลาแดง" : "มีนบุรี" });
    await button(page, "บันทึกการจัดสรร");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(cell(meatTable, LOT, 2)).toHaveText("0.00 กก.");
    await expect(cell(meatTable, LOT, 3)).toHaveText("0 ถุง");
    await expect(
      meatTable.getByRole("row").filter({ hasText: LOT }).getByRole("button", {
        name: "จัดสรร",
      }),
    ).toBeDisabled();
  });

  /* ---- Saladaeng: E2, E4, E5, E10 gates, E7, E8, E9, E10 close ---- */

  await step(page, "สาขาศาลาแดง: E2 รับของ — เห็นเฉพาะใบจัดสรรของตัวเอง (ค้างรับ 300 กก. 3 ถุง)", async () => {
    await signInAs(page, ACCOUNTS.saladaeng);
    await expect(page.locator("main")).toContainText("งานเข้าใหม่ 1 Lot");
    await button(page, "รับของ");
    const allocation = page.getByLabel("ใบจัดสรรที่รับ");
    await expect(allocation.locator("option")).toHaveCount(2);
    await expect(allocation.locator("option").nth(1)).toContainText(
      "ค้างรับ 300.00 กก.",
    );
    await allocation.selectOption({ index: 1 });
    await expect(page.getByLabel(/จำนวนถุงที่รับ/)).toHaveValue("3");
  });

  await step(page, "สาขาศาลาแดง: E2 รับ 290 ≠ 300 → กรอกเหตุผลส่วนต่าง · รับ 300 → ผ่าน", async () => {
    await field(page, /น้ำหนักรับเข้าสาขา/, "290");
    await submitAndExpectError(page, /กรอกเหตุผลส่วนต่าง/);
    await field(page, /น้ำหนักรับเข้าสาขา/, "300");
    await saveEntry(page);
    await expect(page.locator("main")).toContainText("ไม่มีรายการรอรับ");
  });

  await step(page, "สาขาศาลาแดง: E4 แบ่งละลาย 400 > 300 → สต๊อกแช่แข็งไม่พอ · 50 กก. → ผ่าน", async () => {
    await button(page, "แบ่งละลาย");
    await field(page, /น้ำหนักละลาย/, "400");
    await field(page, /จำนวนถุงที่ละลาย/, "1");
    await submitAndExpectError(page, /สต๊อกแช่แข็งไม่พอ/);
    await field(page, /น้ำหนักละลาย/, "50");
    await saveEntry(page);
  });

  await step(page, "สาขาศาลาแดง: E4 สต๊อก — รับแล้ว 300 · แช่แข็ง 250 · พร้อมขาย 50", async () => {
    await nav(page, "สต๊อก");
    const stock = tableSection(page, "สต๊อกเนื้อ · ศาลาแดง");
    await expect(cell(stock, LOT, 2)).toHaveText("300.00 กก.");
    await expect(cell(stock, LOT, 3)).toHaveText("250.00 กก.");
    await expect(cell(stock, LOT, 4)).toHaveText("50.00 กก.");
    await nav(page, "กรอกรายวัน");
  });

  await step(page, "สาขาศาลาแดง: E5 ซื้อข้าวเหนียวดิบ 20 กก.", async () => {
    await pointAndClick(page, rowButton(page, "ซื้อข้าวเหนียวดิบเข้าสต๊อก"));
    await field(page, /ผู้จำหน่ายข้าว/, "ร้านข้าว E2E");
    await field(page, /ข้าวเหนียวดิบซื้อเข้า/, "20");
    await field(page, /ยอดซื้อข้าวเหนียวดิบ/, "1100");
    await saveEntry(page);
  });

  await step(page, "สาขาศาลาแดง: E5 เบิกข้าวดิบ 25 > 20 → ข้าวเหนียวดิบในสต๊อกไม่พอ · เบิก 10 → ผ่าน", async () => {
    await pointAndClick(page, rowButton(page, "เบิกข้าวเหนียวดิบวันนี้"));
    await field(page, /ข้าวเหนียวดิบที่เบิกวันนี้/, "25");
    await field(page, /ผู้รับของ/, "ผู้ดูแลศาลาแดง");
    await submitAndExpectError(page, /ข้าวเหนียวดิบในสต๊อกไม่พอ/);
    await field(page, /ข้าวเหนียวดิบที่เบิกวันนี้/, "10");
    await saveEntry(page);
  });

  await step(page, "สาขาศาลาแดง: E5 หุงข้าว 15 > เบิก 10 → บล็อก · ดิบ 10 → สุก 20 กก.", async () => {
    await pointAndClick(page, rowButton(page, "ข้าวเหนียวช่วงเช้า"));
    await field(page, /ข้าวเหนียวดิบที่นำมาหุง/, "15");
    await field(page, /ข้าวเหนียวสุกที่ได้/, "20");
    await submitAndExpectError(page, /ข้าวเหนียวดิบที่เบิกไว้ไม่พอ/);
    await field(page, /ข้าวเหนียวดิบที่นำมาหุง/, "10");
    await saveEntry(page);
  });

  await step(page, "สาขาศาลาแดง: E5 สรุปสาขา — ข้าวดิบ 10 · เบิกค้าง 0 · ข้าวสุก 20 · น้ำพริกจัดสรร 50 คงเหลือ 50", async () => {
    await nav(page, "สรุปสาขา");
    await expect(cell(summary(page), "ข้าวเหนียวดิบคงเหลือ", 1)).toHaveText("10.00");
    await expect(cell(summary(page), "ข้าวเหนียวดิบที่เบิกแล้วยังไม่หุง", 1)).toHaveText("0.00");
    await expect(cell(summary(page), "ข้าวเหนียวสุกคงเหลือ", 1)).toHaveText("20.00");
    await expect(cell(summary(page), "น้ำพริกที่ Owner จัดสรร", 1)).toHaveText("50");
    await expect(cell(summary(page), "น้ำพริกคงเหลือหลังหักยอดขาย", 1)).toHaveText("50");
    await nav(page, "กรอกรายวัน");
    await expect(cell(tableSection(page, /^น้ำพริกหลอด/), "ยอดตั้งต้นจาก Owner", 1)).toHaveText("50.00");
  });

  await step(page, "สาขาศาลาแดง: E10 ปิดวัน 18:00 → ปิดวันได้ตั้งแต่ 22:00 (นาฬิกาจำลอง)", async () => {
    await closeDayRefused(page, "18:00", /ปิดวันได้ตั้งแต่ 22:00 \(นาฬิกาจำลอง\)/);
  });

  await step(page, "สาขาศาลาแดง: E10 ปิดวัน 22:00 ก่อนขาย → ยังไม่มีรายการขายวันนี้", async () => {
    await closeDayRefused(page, "22:00", /ยังไม่มีรายการขายวันนี้/);
  });

  await step(page, "สาขาศาลาแดง: E7 ยอดขาย — กล่อง 2.5 → จำนวนขายต้องเป็นจำนวนเต็ม", async () => {
    await openSale(page);
    await field(page, /กล่องมาตรฐาน/, "2.5");
    await submitAndExpectError(page, /จำนวนขายต้องเป็นจำนวนเต็ม/);
  });

  await step(page, "สาขาศาลาแดง: E7 50 กล่อง + 10 add-on + 20 น้ำพริก = ฿21,300 ตามเมนู · Waste 50 → เกินเนื้อพร้อมขาย", async () => {
    await field(page, /กล่องมาตรฐาน/, "50");
    await field(page, /เนื้อซีล Add-on/, "10");
    await field(page, /น้ำพริกหลอด · จำหน่ายแยก/, "20");
    await field(page, /น้ำหนักเนื้อซีลพร้อมขาย/, "6");
    await field(page, /Waste เนื้อจาก Lot นี้/, "50");
    await field(page, /ยอดขาย LINE MAN/, "21300");
    await field(page, /เหตุผลส่วนต่าง \/ Waste \/ ข้าม FIFO/, "Waste ทดสอบ E7");
    // 50 × 350 + 10 × 320 + 20 × 30 (seed prices) in the dialog preview.
    await expect(openDialog(page)).toContainText("฿21,300.00");
    await submitAndExpectError(page, /น้ำหนักขายและ Waste เกินเนื้อพร้อมขาย/);
  });

  await step(page, "สาขาศาลาแดง: E7 Waste 0.5 → ผ่าน · สรุปสาขา ยอดขาย LINE MAN 21,300 · พร้อมขายเหลือ 43.5", async () => {
    await field(page, /Waste เนื้อจาก Lot นี้/, "0.5");
    await saveEntry(page);
    await nav(page, "สรุปสาขา");
    await expect(cell(summary(page), "ยอดขาย LINE MAN", 1)).toHaveText("21,300.00");
    await expect(cell(summary(page), "เนื้อพร้อมขายทั้งหมด", 1)).toHaveText("43.50");
    await expect(cell(summary(page), "ข้าวเหนียวสุกคงเหลือ", 1)).toHaveText("10.00");
    await expect(cell(summary(page), "น้ำพริกคงเหลือหลังหักยอดขาย", 1)).toHaveText("30");
    await nav(page, "กรอกรายวัน");
  });

  await step(page, "สาขาศาลาแดง: E10 ปิดวันก่อนเช็ควัสดุ → ยังไม่เช็ควัสดุวันนี้", async () => {
    await closeDayRefused(page, "22:00", /ยังไม่เช็ควัสดุวันนี้/);
  });

  await step(page, "สาขาศาลาแดง: E8 กล่องโปรโมท 2.5 → จำนวนที่ส่งต้องเป็นจำนวนเต็ม · 5 กล่อง 0.5 กก. → หักเนื้อ ไม่นับรายได้", async () => {
    await pointAndClick(page, rowButton(page, "บันทึกกล่องโปรโมทให้อินฟลูเอนเซอร์"));
    await field(page, /ชื่ออินฟลูเอนเซอร์/, "E2E Influencer");
    await field(page, /กล่องมาตรฐานที่ส่ง/, "2.5");
    await submitAndExpectError(page, /จำนวนที่ส่งต้องเป็นจำนวนเต็ม/);
    await field(page, /กล่องมาตรฐานที่ส่ง/, "5");
    await field(page, /น้ำหนักเนื้อที่ส่งจาก Lot นี้/, "0.5");
    await saveEntry(page);
    await nav(page, "สรุปสาขา");
    await expect(cell(summary(page), "ยอดขาย LINE MAN", 1)).toHaveText("21,300.00");
    await expect(cell(summary(page), "เนื้อพร้อมขายทั้งหมด", 1)).toHaveText("43.00");
    await expect(cell(summary(page), "ข้าวเหนียวสุกคงเหลือ", 1)).toHaveText("9.00");
    await nav(page, "กรอกรายวัน");
  });

  const daily = tableSection(page, "วัสดุ 7 รายการ · กรอกการใช้วันนี้");
  await step(page, `สาขาศาลาแดง: E9 ยืนยันรับ${BOX} 100 ชิ้นจาก Owner → ยอดตั้งต้น 100`, async () => {
    await field(page, "ชื่อผู้รับจริง", "ผู้ดูแลศาลาแดง");
    await pointAndClick(
      page,
      page
        .getByRole("row")
        .filter({ hasText: BOX })
        .getByRole("button", { name: "ยืนยันรับ" }),
    );
    await expect(page.getByText(`ยืนยันรับ ${BOX} แล้ว`)).toBeVisible();
    await expect(cell(daily, BOX, 1)).toHaveText("100");
    await expect(cell(daily, BOX, 6)).toHaveText("รอบันทึก");
  });

  await step(page, `สาขาศาลาแดง: E9 ใช้ 150 > 100 → จำนวนใช้ ${BOX} เกินยอดตั้งต้น`, async () => {
    await fillCell(page, `จำนวนใช้ ${BOX} วันนี้`, "150");
    await fillCell(page, `ยอดตรวจนับจริง ${BOX}`, "0");
    await button(page, "บันทึกการใช้วัสดุ");
    await expect(page.getByText(`จำนวนใช้ ${BOX} เกินยอดตั้งต้น`)).toBeVisible();
  });

  await step(page, "สาขาศาลาแดง: E9 ตรวจนับ -1 → บล็อก (ตั้งแต่ศูนย์) · 2.5 → วัสดุต้องเป็นจำนวนเต็ม", async () => {
    await fillCell(page, `จำนวนใช้ ${BOX} วันนี้`, "30");
    await fillCell(page, `ยอดตรวจนับจริง ${BOX}`, "-1");
    await button(page, "บันทึกการใช้วัสดุ");
    // positive() runs before the dedicated "ติดลบไม่ได้" assert in mutate(), so this is the text users get.
    await expect(
      page.getByText(
        new RegExp(`กรอก${BOX}เป็นตัวเลขตั้งแต่ศูนย์|ยอดตรวจนับ ${BOX} ติดลบไม่ได้`),
      ),
    ).toBeVisible();
    await fillCell(page, `ยอดตรวจนับจริง ${BOX}`, "2.5");
    await button(page, "บันทึกการใช้วัสดุ");
    await expect(page.getByText("วัสดุต้องเป็นจำนวนเต็ม")).toBeVisible();
  });

  await step(page, `สาขาศาลาแดง: E9 ใช้ 30 นับตามระบบ → บันทึกแล้ว · สต๊อก${BOX} 70 ชิ้น ใกล้หมด (ฐาน 500)`, async () => {
    await fillCell(page, `ยอดตรวจนับจริง ${BOX}`, "");
    await button(page, "บันทึกการใช้วัสดุ");
    await expect(page.getByText("บันทึกการใช้วัสดุวันนี้แล้ว")).toBeVisible();
    await expect(cell(daily, BOX, 3)).toHaveText("70");
    await expect(cell(daily, BOX, 6)).toHaveText("บันทึกแล้ว");
    await expect(daily.getByRole("button", { name: "บันทึกแก้ไข" })).toBeVisible();
    await nav(page, "สต๊อก");
    const materialStock = tableSection(page, "สต๊อกวัสดุ 7 รายการ (Material inventory)");
    await expect(cell(materialStock, BOX, 2)).toHaveText("70 ชิ้น");
    await expect(cell(materialStock, BOX, 3)).toHaveText("500 ชิ้น");
    await expect(cell(materialStock, BOX, 5)).toHaveText("ใกล้หมด");
    await nav(page, "กรอกรายวัน");
  });

  await step(page, "สาขาศาลาแดง: E10 ปิดวันขณะเหลือพร้อมขาย 43 กก. → ยังมีเนื้อพร้อมขาย ต้องบันทึกขายหรือ Waste ให้เป็นศูนย์", async () => {
    await closeDayRefused(page, "22:00", /ยังมีเนื้อพร้อมขาย ต้องบันทึกขายหรือ Waste ให้เป็นศูนย์/);
  });

  await step(page, "สาขาศาลาแดง: E10 บันทึก Waste 43 กก. ให้เนื้อพร้อมขายเป็นศูนย์", async () => {
    await openSale(page);
    await field(page, /Waste เนื้อจาก Lot นี้/, "43");
    await field(page, /เหตุผลส่วนต่าง \/ Waste \/ ข้าม FIFO/, "Waste ปลายวัน E10");
    await saveEntry(page);
  });

  await step(page, "สาขาศาลาแดง: E10 ปิดวัน 22:00 → สำเร็จ · ทุกปุ่มบันทึกล็อก · สรุปสาขา", async () => {
    await closeDay(page, "ผู้ดูแลศาลาแดง");
    const locked = page.locator("main").getByRole("button", {
      name: /กรอกข้อมูล|ตรวจและปิดวัน|บันทึกแก้ไข|แบ่งละลาย|ปิดวัน/,
    });
    const count = await locked.count();
    expect(count).toBeGreaterThanOrEqual(7);
    for (let index = 0; index < count; index += 1)
      await expect(locked.nth(index)).toBeDisabled();
    await nav(page, "สรุปสาขา");
    await expect(cell(summary(page), "ยอดขาย LINE MAN", 1)).toHaveText("21,300.00");
    await expect(cell(summary(page), "เนื้อพร้อมขายทั้งหมด", 1)).toHaveText("0.00");
    await expect(cell(summary(page), "ตรวจนับวัสดุ", 1)).toHaveText("1");
    await expect(cell(summary(page), "ตรวจนับวัสดุ", 2)).toHaveText("บันทึกแล้ว");
  });

  /* ---- Minburi: E3, E6 and a compact day so the report has two branches ---- */

  await step(page, "สาขามีนบุรี: E3 รับของ — ไม่เห็นใบของศาลาแดง · รับ 2 ถุง 200 กก.", async () => {
    await signInAs(page, ACCOUNTS.minburi);
    await expect(page.locator("main")).toContainText("งานเข้าใหม่ 1 Lot");
    await button(page, "รับของ");
    const allocation = page.getByLabel("ใบจัดสรรที่รับ");
    await expect(allocation.locator("option")).toHaveCount(2);
    await expect(allocation.locator("option").nth(1)).toContainText("ค้างรับ 200.00 กก.");
    await expect(allocation.locator("option").nth(1)).not.toContainText("300.00");
    await allocation.selectOption({ index: 1 });
    await expect(page.getByLabel(/จำนวนถุงที่รับ/)).toHaveValue("2");
    await field(page, /น้ำหนักรับเข้าสาขา/, "200");
    await saveEntry(page);
    await nav(page, "สต๊อก");
    const stock = tableSection(page, "สต๊อกเนื้อ · มีนบุรี");
    await expect(cell(stock, LOT, 2)).toHaveText("200.00 กก.");
    await expect(cell(stock, LOT, 3)).toHaveText("200.00 กก.");
    await nav(page, "กรอกรายวัน");
  });

  await step(page, "สาขามีนบุรี: E6 ไม่มีขั้นตอนเบิกข้าวดิบ/หุงข้าว · ซื้อข้าวสุก 20 < ฐาน 30 → บล็อก · 32 กก. → ผ่าน", async () => {
    const riceTable = tableSection(page, "ข้าวเหนียวสุก · ซื้อที่สาขามีนบุรี");
    await expect(riceTable).not.toContainText("เบิกข้าวเหนียวดิบวันนี้");
    await expect(riceTable).not.toContainText("ข้าวเหนียวช่วงเช้า");
    await expect(riceTable).toContainText("ยืนยันข้าวเหนียวสุกคงเหลือ");
    await pointAndClick(page, rowButton(page, "ซื้อข้าวเหนียวเข้าสต๊อก"));
    await expect(openDialog(page).getByLabel(/ข้าวเหนียวดิบซื้อเข้า/)).toHaveCount(0);
    await field(page, /ผู้จำหน่ายข้าว/, "ร้านข้าวสุก E2E");
    await field(page, /ข้าวเหนียวสุกซื้อเข้า/, "20");
    await field(page, /ยอดซื้อข้าวเหนียวสุก/, "900");
    await submitAndExpectError(page, /ยอดข้าวเหนียวสุกหลังซื้อควรมีอย่างน้อย 30 กก\./);
    await field(page, /ข้าวเหนียวสุกซื้อเข้า/, "32");
    await field(page, /ยอดซื้อข้าวเหนียวสุก/, "1440");
    await saveEntry(page);
  });

  await step(page, "สาขามีนบุรี: แบ่งละลาย 2 กก. · ขาย 10 กล่อง 1.0 กก. Waste 1.0 · LINE MAN 3,500", async () => {
    await button(page, "แบ่งละลาย");
    await field(page, /น้ำหนักละลาย/, "2");
    await field(page, /จำนวนถุงที่ละลาย/, "1");
    await saveEntry(page);
    await openSale(page);
    await field(page, /กล่องมาตรฐาน/, "10");
    await field(page, /น้ำหนักเนื้อซีลพร้อมขาย/, "1");
    await field(page, /Waste เนื้อจาก Lot นี้/, "1");
    await field(page, /ยอดขาย LINE MAN/, "3500");
    await field(page, /เหตุผลส่วนต่าง \/ Waste \/ ข้าม FIFO/, "Waste ปลายวัน มีนบุรี");
    await saveEntry(page);
  });

  await step(page, "สาขามีนบุรี: เช็ควัสดุ (ยังไม่มีวัสดุ) · ปิดวันก่อนยืนยันข้าวสุก → ยังไม่ยืนยันข้าวเหนียวสุกคงเหลือ", async () => {
    await button(page, "บันทึกการใช้วัสดุ");
    await expect(page.getByText("บันทึกการใช้วัสดุวันนี้แล้ว")).toBeVisible();
    await closeDayRefused(page, "22:00", /ยังไม่ยืนยันข้าวเหนียวสุกคงเหลือ/);
  });

  await step(page, "สาขามีนบุรี: ยืนยันข้าวสุกคงเหลือ 30 กก. · ปิดวัน 22:00 → สำเร็จ", async () => {
    await pointAndClick(page, rowButton(page, "ยืนยันข้าวเหนียวสุกคงเหลือ"));
    await field(page, /ข้าวเหนียวสุกเหลือปลายวัน/, "30");
    await saveEntry(page);
    await closeDay(page, "ผู้ดูแลมีนบุรี");
    await nav(page, "สรุปสาขา");
    await expect(cell(summary(page), "ยอดขาย LINE MAN", 1)).toHaveText("3,500.00");
    await expect(cell(summary(page), "ข้าวเหนียวสุกคงเหลือ", 1)).toHaveText("30.00");
    await expect(cell(summary(page), "น้ำพริกคงเหลือหลังหักยอดขาย", 1)).toHaveText("20");
  });

  await step(page, "สาขามีนบุรี: E12 สต๊อก — เนื้อ 198 แช่แข็ง / 0 พร้อมขาย · ข้าวสุก 30 · น้ำพริก 20", async () => {
    await nav(page, "สต๊อก");
    const stock = tableSection(page, "สต๊อกเนื้อ · มีนบุรี");
    await expect(cell(stock, LOT, 3)).toHaveText("198.00 กก.");
    await expect(cell(stock, LOT, 4)).toHaveText("0.00 กก.");
    const supply = tableSection(page, "สต๊อกข้าวเหนียวและน้ำพริก (Rice & chili inventory)");
    await expect(cell(supply, "มีนบุรี", 3)).toHaveText("30.00 กก.");
    await expect(cell(supply, "มีนบุรี", 5)).toHaveText("20.00 หลอด");
  });

  /* ---- E11 Owner unlocks Saladaeng, the branch sells more and closes again ---- */

  await step(page, "Owner: E11 ปลดล็อกวันศาลาแดง → รายงานรายวัน ศาลาแดง เปิดอยู่ · มีนบุรี ปิดแล้ว", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await button(page, "รายงาน");
    await button(page, "ปลดล็อกวัน");
    await page.getByLabel(/สาขาที่ปลดล็อก/).selectOption({ label: "ศาลาแดง" });
    await field(page, /เหตุผลปลดล็อก/, "สาขาลืมบันทึกยอดขายเพิ่ม");
    await saveEntry(page);
    const dailyReport = tableSection(page, "รายงานยอดขายรายวัน");
    await expect(cell(dailyReport, "ศาลาแดง", 7)).toHaveText("เปิดอยู่");
    await expect(cell(dailyReport, "มีนบุรี", 7)).toHaveText("ปิดแล้ว");
  });

  await step(page, "Owner: E9 แดชบอร์ดแจ้งวัสดุใกล้หมดของศาลาแดง (70 < 20% ของฐาน 500)", async () => {
    await button(page, "แดชบอร์ด");
    await button(page, "ดูรายละเอียด");
    await expect(page.locator("main")).toContainText(`วัสดุใกล้หมด: ${BOX}`);
  });

  await step(page, "สาขาศาลาแดง: E11 หลังปลดล็อก ละลาย 0.2 กก. ขายเพิ่ม 2 กล่อง 700 บาท และปิดวันอีกครั้ง", async () => {
    await signInAs(page, ACCOUNTS.saladaeng);
    await expect(page.locator("main")).not.toContainText("ปิดแล้ว");
    await button(page, "แบ่งละลาย");
    await field(page, /น้ำหนักละลาย/, "0.2");
    await field(page, /จำนวนถุงที่ละลาย/, "1");
    await saveEntry(page);
    await openSale(page);
    await field(page, /กล่องมาตรฐาน/, "2");
    await field(page, /น้ำหนักเนื้อซีลพร้อมขาย/, "0.2");
    await field(page, /ยอดขาย LINE MAN/, "700");
    await saveEntry(page);
    await closeDay(page, "ผู้ดูแลศาลาแดง");
  });

  await step(page, "สาขาศาลาแดง: E12 สต๊อก — เนื้อ 249.80 แช่แข็ง / 0 พร้อมขาย · ข้าวดิบ 10 · ข้าวสุก 8.60 · น้ำพริก 30 · กล่อง 70", async () => {
    await nav(page, "สต๊อก");
    const stock = tableSection(page, "สต๊อกเนื้อ · ศาลาแดง");
    await expect(cell(stock, LOT, 3)).toHaveText("249.80 กก.");
    await expect(cell(stock, LOT, 4)).toHaveText("0.00 กก.");
    const supply = tableSection(page, "สต๊อกข้าวเหนียวและน้ำพริก (Rice & chili inventory)");
    await expect(cell(supply, "ศาลาแดง", 1)).toHaveText("10.00 กก.");
    await expect(cell(supply, "ศาลาแดง", 2)).toHaveText("0.00 กก.");
    await expect(cell(supply, "ศาลาแดง", 3)).toHaveText("8.60 กก.");
    await expect(cell(supply, "ศาลาแดง", 4)).toHaveText("50.00 หลอด");
    await expect(cell(supply, "ศาลาแดง", 5)).toHaveText("30.00 หลอด");
    const materialStock = tableSection(page, "สต๊อกวัสดุ 7 รายการ (Material inventory)");
    await expect(cell(materialStock, BOX, 2)).toHaveText("70 ชิ้น");
  });

  await step(page, "Owner: E11 รายงาน — ยอดขายสะสม ศาลาแดง 22,000 · มีนบุรี 3,500 · รวม 25,500 ทั้งสองวันปิดแล้ว", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await button(page, "รายงาน");
    const byBranch = tableSection(page, "ยอดขายสะสมแยกสาขา");
    await expect(cell(byBranch, "ศาลาแดง", 1)).toHaveText("52");
    await expect(cell(byBranch, "ศาลาแดง", 5)).toHaveText("22,000.00");
    await expect(cell(byBranch, "มีนบุรี", 1)).toHaveText("10");
    await expect(cell(byBranch, "มีนบุรี", 5)).toHaveText("3,500.00");
    await expect(cell(tableSection(page, "สรุปผลรวม"), "ยอดขาย LINE MAN", 1)).toHaveText("25,500.00");
    const dailyReport = tableSection(page, "รายงานยอดขายรายวัน");
    await expect(cell(dailyReport, "ศาลาแดง", 7)).toHaveText("ปิดแล้ว");
    await expect(cell(dailyReport, "มีนบุรี", 7)).toHaveText("ปิดแล้ว");
  });

  await step(page, "Owner: E12 สต๊อกของทั้งหมด ตรงกับหน้าสต๊อกของสาขา (เนื้อ ข้าว น้ำพริก วัสดุ)", async () => {
    await button(page, "สต๊อกของทั้งหมด");
    const all = tableSection(page, "ตารางสต๊อกทั้งหมด (All inventory)");
    const rowOf = (item: string | RegExp, location: string) =>
      all
        .getByRole("row")
        .filter({ hasText: item })
        .filter({ hasText: location })
        .getByRole("cell");
    await expect(rowOf(/F\d{6}-\d{3} · เนื้อรมควัน/, "คลังกลาง").nth(3)).toHaveText("0.00");
    await expect(rowOf(/F\d{6}-\d{3} · เนื้อรมควัน/, "ศาลาแดง").nth(3)).toHaveText("249.80");
    await expect(rowOf(/F\d{6}-\d{3} · เนื้อรมควัน/, "ศาลาแดง").nth(5)).toHaveText(
      "จากจัดสรร Owner · แช่แข็ง 249.80 · พร้อมขาย 0.00",
    );
    await expect(rowOf(/F\d{6}-\d{3} · เนื้อรมควัน/, "มีนบุรี").nth(3)).toHaveText("198.00");
    await expect(rowOf("ข้าวเหนียวดิบ (ข้าวสาร)", "ศาลาแดง").nth(3)).toHaveText("10.00");
    await expect(rowOf("ข้าวเหนียวสุก", "ศาลาแดง").nth(3)).toHaveText("8.60");
    await expect(rowOf("ข้าวเหนียวสุก", "มีนบุรี").nth(3)).toHaveText("30.00");
    await expect(rowOf("น้ำพริกหลอด", "ศาลาแดง").nth(3)).toHaveText("30.00");
    await expect(rowOf("น้ำพริกหลอด", "มีนบุรี").nth(3)).toHaveText("20.00");
    await expect(rowOf("น้ำพริกหลอด", "คลัง Owner").nth(3)).toHaveText("30.00");
    await expect(rowOf(BOX, "ศาลาแดง").nth(3)).toHaveText("70.00");
    await expect(rowOf(BOX, "คลัง Owner").nth(3)).toHaveText("100.00");
  });
});

/* E2E-E1 (P2): forms.ts declares `chiliCount` with zero:true, so defaults() fills
 * "0" although the label promises "เว้นว่างถ้าไม่ได้นับ" and mutate() only skips the
 * count when the value is "". A branch that holds chili and does not count it is
 * forced to write a mismatch remark it never claimed. Fixed: the field is optional and opens empty. */
test("E2E-E1: ช่องตรวจนับน้ำพริกในฟอร์มยอดขายต้องว่างเมื่อเปิด (ไม่ได้นับ) ไม่ใช่ 0", async ({
  page,
}) => {
  skipUnlessCredentials(ACCOUNTS.owner, ACCOUNTS.saladaeng);
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await loadSampleData(page);
  await signInAs(page, ACCOUNTS.saladaeng);
  await step(page, "สาขาศาลาแดง: เปิดวันก่อนช่วง sample (วันนี้ปิดแล้วใน sample) และเปิดฟอร์มยอดขาย", async () => {
    const input = page.getByLabel("วันที่ทำรายการ");
    await input.scrollIntoViewIfNeeded();
    await input.fill(openDayBeforeSample());
    await pointAndClick(page, rowButton(page, "บันทึกยอดขาย / Waste"));
    await expect(openDialog(page)).toBeVisible();
  });
  await step(page, "สาขาศาลาแดง: E2E-E1 ช่องตรวจนับน้ำพริกจริงปลายวันต้องว่าง", async () => {
    await expect(
      openDialog(page).getByLabel(/ตรวจนับน้ำพริกจริงปลายวัน/),
    ).toHaveValue("");
  });
});

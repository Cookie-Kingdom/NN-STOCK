import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  c_expectBell,
  c_historyEntry,
  c_ownerDecidesEdit,
  c_requestEdit,
  chefSmokesShipment,
  closeNotifications,
  field,
  foodivaReceivesReturn,
  menuItem,
  openMaterialCount,
  openMenu,
  openNotifications,
  ownerCallsReturnTruck,
  ownerReceivesCentral,
  pointAndClick,
  saveEntry,
  saveMaterialCount,
  sendMeatToChefHouse,
  signInAs,
  skipUnlessCredentials,
  startFresh,
  step,
  tableSection,
  typeValue,
} from "./helpers";

/* Feedback 20-09-2026 (vault: Feedback/20-09-2026 รวมฉบับสมบูรณ์.md), items 5–10: the
 * gaps the Branch Day specs (full-system/branch-day, branch, chef, foodiva,
 * account-manager) leave open.
 *   5  the sale form asks "น้ำหนักเนื้อที่ใช้ไปจริงวันนี้" and "น้ำหนักเนื้อที่เสียไป" apart; the rest is
 *      computed, never typed.
 *   6  one summary of a branch's meat per lot and per day (แช่แข็ง / ชิล / ใช้แล้ว), also
 *      for the Owner with a branch picker.
 *   7  one close button, a checklist that warns before closing, the day locks, no close time.
 *   8  history edits: Owner / Account Manager edit directly, other roles request; both
 *      approvers are notified, either may decide; audit trail; closeDay is not editable.
 *   9  sticky rice is the branch's: Owner has no raw rice to buy; cooked may outweigh raw;
 *      100–103 g per seal is a warning, never a block (9.1).
 *   10 thawed meat left over closes the day as chill and opens the next day. */

function bangkokDate(offset = 0) {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  now.setDate(now.getDate() + offset);
  return now.toLocaleDateString("en-CA");
}
const TODAY = bangkokDate();
/** Future dates are blocked, so a two-day flow runs yesterday → today. */
const DAY1 = bangkokDate(-1);
const LOT = /S\d{6}-\d{3}/;

const openDialog = (page: Page) => page.getByRole("dialog").last();

/** The page-heading date picker (the day tab's cards carry their own copy below it). */
async function setWorkingDate(page: Page, date: string) {
  const input = page.getByLabel("วันที่ทำรายการ").first();
  await input.scrollIntoViewIfNeeded();
  await input.fill(date);
  await expect(input).toHaveValue(date);
}

/** The action button of one row of the branch day tables. */
const rowButton = (page: Page, rowText: string, name = "กรอกข้อมูล") =>
  page
    .getByRole("main")
    .getByRole("row")
    .filter({ hasText: rowText })
    .getByRole("button", { name });

const cell = (scope: Locator, rowText: string | RegExp, index: number) =>
  scope
    .getByRole("row")
    .filter({ hasText: rowText })
    .getByRole("cell")
    .nth(index);

async function cancelDialog(page: Page) {
  await pointAndClick(
    page,
    openDialog(page).getByRole("button", { name: "ยกเลิก" }),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** "ตรวจและปิดวัน" on row "4. ปิดวัน": opens the close dialog with its checklist. */
async function openCloseDay(page: Page) {
  await pointAndClick(page, rowButton(page, "4. ปิดวัน", "ตรวจและปิดวัน"));
  return tableSection(page, "ตรวจก่อนปิดวัน");
}

async function closeDay(page: Page, date: string) {
  const checklist = await openCloseDay(page);
  await expect(openDialog(page)).toContainText("ข้อมูลครบ ปิดวันได้ทุกเวลา");
  await expect(checklist).not.toContainText("ยังไม่ทำ");
  // FB-14: no close-time rule, no simulated time: the day closes whenever it is done.
  await expect(openDialog(page).getByLabel(/เวลา/)).toHaveCount(0);
  await field(page, /ชื่อผู้ยืนยันปิดวัน/, "ผู้ดูแลศาลาแดง");
  await saveEntry(page);
  await expect(page.locator("main")).toContainText(
    `ปิดวันแล้ว · ข้อมูลวันที่ ${date} ถูกล็อก`,
  );
}

async function saveMaterials(page: Page) {
  await openMaterialCount(page);
  await saveMaterialCount(page);
}

async function confirmRiceLeft(page: Page, kg: string) {
  await pointAndClick(page, rowButton(page, "ยืนยันข้าวเหนียวสุกคงเหลือ"));
  await field(page, /ข้าวเหนียวสุกเหลือปลายวัน/, kg);
  await openDialog(page)
    .getByLabel(/การจัดการวันถัดไป/)
    .selectOption("เก็บไว้อุ่นวันถัดไป");
  await saveEntry(page);
}

/** "ซื้อข้าวเหนียวเข้าสต๊อก" for one round of the given source (B2). */
async function buyRice(
  page: Page,
  source: "นึ่งเอง (ซื้อข้าวดิบ)" | "ซื้อข้าวสุกจากข้างนอก",
  kg: string,
  cost: string,
) {
  await pointAndClick(page, rowButton(page, "ซื้อข้าวเหนียวเข้าสต๊อก"));
  await openDialog(page)
    .getByLabel(/รอบนี้ข้าวเหนียวมาจาก/)
    .selectOption(source);
  await field(page, /ผู้จำหน่ายข้าว/, "ร้านข้าว feedback 20-09");
  const raw = source.startsWith("นึ่งเอง");
  await field(
    page,
    raw ? /ข้าวเหนียวดิบซื้อเข้า/ : /ข้าวเหนียวสุกซื้อเข้า/,
    kg,
  );
  await field(
    page,
    raw ? /ยอดซื้อข้าวเหนียวดิบ/ : /ยอดซื้อข้าวเหนียวสุก/,
    cost,
  );
  await saveEntry(page);
}

const branchSummary = (page: Page) => tableSection(page, /^สรุปรายวัน/);

/** The one "เนื้อละลายวันนี้" row of the lot: ชิลยกมา · ละลายแล้ววันนี้ · ใช้จริงวันนี้ ·
 * เวสต์ · คงเหลือชิล (ยกไปวันถัดไป). */
async function expectMeatDay(page: Page, values: string[]) {
  const meatDay = tableSection(page, /^เนื้อละลายวันนี้/);
  for (const [index, kg] of values.entries())
    await expect(cell(meatDay, LOT, index + 1)).toHaveText(`${kg} กก.`);
}

/** The Account Manager (C4) exists only in local SQLite mode: manager@local.test. Same as
 * account-manager.spec.ts (helpers.signInAs knows only the five original accounts). */
async function signInAsManager(page: Page) {
  test.skip(
    process.env.NEXT_PUBLIC_LOCAL_DB !== "1",
    "manager account exists only in local SQLite mode (pnpm test:e2e:local)",
  );
  const signOut = page.getByRole("button", { name: "ออกจากระบบ" });
  if (await signOut.count()) await pointAndClick(page, signOut);
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("อีเมล").fill("manager@local.test");
  await page.getByLabel("รหัสผ่าน").fill("local-test");
  await pointAndClick(
    page,
    page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }),
  );
  await expect(page).toHaveURL(/\/owner\/po(?:[/?#]|$)/, { timeout: 30_000 });
  await expect(signOut).toBeVisible({ timeout: 30_000 });
}

/* ------------------------------------------------------------------------------ */

test("ข้อ 5 · 6 · 7 · 9.1 · 10: ขาย 150 กรัม/ซีลบันทึกได้ · ใช้จริง/เวสต์แยกช่อง · ปิดวันจุดเดียวทั้งที่เหลือชิล 4 กก. · วันถัดไปชิลยกมา · สรุปคงเหลือรายล็อต/รายวัน (สาขาและ Owner)", async ({
  page,
}) => {
  test.setTimeout(20 * 60_000);
  skipUnlessCredentials(
    ACCOUNTS.owner,
    ACCOUNTS.foodiva,
    ACCOUNTS.chef,
    ACCOUNTS.saladaeng,
  );
  await startFresh(page);

  await step(
    page,
    "Owner → Foodiva → Chef House → Foodiva → Owner: เนื้อ 100 กก. ผ่าน Shipment Flow เข้าสต๊อกกลาง",
    async () => {
      const { shipment } = await sendMeatToChefHouse(page, {
        orderedKg: "100",
      });
      await chefSmokesShipment(page, shipment, {
        received: ["100"],
        preSmokeKg: "100",
        packs: ["50", "50"],
      });
      await signInAs(page, ACCOUNTS.owner);
      await ownerCallsReturnTruck(page, shipment, "100");
      await signInAs(page, ACCOUNTS.foodiva);
      await foodivaReceivesReturn(page, shipment, { kg: "100" });
      await signInAs(page, ACCOUNTS.owner);
      await ownerReceivesCentral(page, "100");
    },
  );

  await step(
    page,
    "Owner: จัดสรรเป็นกิโล ศาลาแดง 100 กก. ลงวันที่เมื่อวาน (วันที่ 1 ของสาขา)",
    async () => {
      await openMenu(page, "จัดสรรเนื้อ และสต๊อกไปสาขา");
      await pointAndClick(
        page,
        page
          .locator("main")
          .getByRole("row")
          .filter({ hasText: LOT })
          .getByRole("button", { name: "จัดสรร", exact: true })
          .first(),
      );
      const dialog = openDialog(page);
      await typeValue(page, dialog.getByLabel("ศาลาแดง (กก.)"), "100");
      await dialog.getByLabel("วันที่ทำรายการ").fill(DAY1);
      await expect(dialog.getByLabel("วันที่ทำรายการ")).toHaveValue(DAY1);
      await saveEntry(page);
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: วันที่ 1 รับ 100 กก. · ละลาย 20 กก. (1 กล่องรมควัน) · ซื้อข้าวสุกจากข้างนอก 30 กก.",
    async () => {
      await signInAs(page, ACCOUNTS.saladaeng);
      await setWorkingDate(page, DAY1);
      await button(page, "รับของ");
      await openDialog(page)
        .getByLabel("ใบจัดสรรที่รับ")
        .selectOption({ index: 1 });
      await field(page, /น้ำหนักรับเข้าสาขา/, "100");
      await saveEntry(page);
      await button(page, "แบ่งละลาย");
      await field(page, /น้ำหนักละลาย/, "20");
      await field(page, /จำนวนกล่องรมควันที่ละลาย/, "1");
      await saveEntry(page);
      await buyRice(page, "ซื้อข้าวสุกจากข้างนอก", "30", "1350");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ข้อ 5 ฟอร์มขาย — ช่อง 'น้ำหนักเนื้อที่ใช้ไปจริงวันนี้' กับ 'น้ำหนักเนื้อที่เสียไป' แยกกัน · ไม่มีช่องกรอกคงเหลือ · ไม่มีคำว่า พร้อมขาย",
    async () => {
      await button(page, "บันทึกยอดขาย");
      const dialog = openDialog(page);
      await expect(
        dialog.getByLabel(/น้ำหนักเนื้อที่ใช้ไปจริงวันนี้/),
      ).toHaveCount(1);
      await expect(dialog.getByLabel(/น้ำหนักเนื้อที่เสียไป/)).toHaveCount(1);
      // The remainder is computed: no input asks for it, and the hint says so.
      // A <label> wraps its hint and, for the Lot picker, the option texts — both say
      // "คงเหลือ…" — so those two controls are excluded by their own caption.
      await expect(
        dialog
          .getByLabel(/คงเหลือ/)
          .and(
            dialog.getByLabel(/^(?!น้ำหนักเนื้อที่ใช้ไปจริงวันนี้|Lot ต้นทาง)/),
          ),
      ).toHaveCount(0);
      await expect(dialog).toContainText(
        "เนื้อที่เหลือระบบคำนวณเป็นคงเหลือชิลยกไปวันถัดไป",
      );
      await expect(dialog).not.toContainText("พร้อมขาย");
      await expect(dialog).not.toContainText("น้ำหนักเนื้อซีล");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ข้อ 9.1 ขาย 100 กล่อง ใช้จริง 15 กก. (150 กรัม/ซีล) → เตือนเท่านั้น · เวสต์ 1 กก. → บันทึกได้ ไม่มี error",
    async () => {
      const dialog = openDialog(page);
      await field(page, /กล่องมาตรฐาน/, "100");
      await field(page, /น้ำหนักเนื้อที่ใช้ไปจริงวันนี้/, "15");
      await field(page, /น้ำหนักเนื้อที่เสียไป/, "1");
      await field(page, /ยอดขาย LINE MAN/, "35000");
      await field(
        page,
        /เหตุผลส่วนต่าง \/ Waste \/ ข้าม FIFO/,
        "เศษเนื้อตัดทิ้ง",
      );
      await expect(dialog).toContainText(
        "เฉลี่ย 150.0 กรัมต่อซีล อยู่นอกช่วง 100–103 กรัม",
      );
      // A warning, not a refusal: nothing red, save enabled, and it saves.
      await expect(dialog.getByRole("alert")).toHaveCount(0);
      await expect(
        dialog.locator('button[type="submit"]').last(),
      ).toBeEnabled();
      await saveEntry(page);
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ข้อ 10 เนื้อละลายวันนี้ ละลาย 20 = ใช้ 15 + เวสต์ 1 + คงเหลือชิล 4 · ปิดวันได้ ยกไปวันถัดไป",
    async () => {
      await expectMeatDay(page, ["0.00", "20.00", "15.00", "1.00", "4.00"]);
      const main = page.locator("main");
      await expect(main).toContainText(
        "ใช้ 15.00 กก. + เวสต์ 1.00 กก. + คงเหลือชิล 4.00 กก. = ละลายแล้ว 20.00 กก.",
      );
      await expect(main).toContainText(
        "ปิดวันได้ คงเหลือชิล 4.00 กก. ยกไปวันถัดไป",
      );
      await expect(main).not.toContainText("พร้อมขาย");
      await expect(main).not.toContainText("ต้องใช้เนื้อให้หมด");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ข้อ 7 ปุ่มปิดวันมีจุดเดียว (แท็บกรอกรายวัน 1 ปุ่ม · สรุปสาขา ไม่มี)",
    async () => {
      const closeButtons = page
        .getByRole("main")
        .getByRole("button", { name: /ปิดวัน/ });
      await expect(closeButtons).toHaveCount(1);
      await expect(closeButtons).toHaveText("ตรวจและปิดวัน");
      // Never disabled for missing data: it opens the checklist that says what is missing.
      await expect(closeButtons).toBeEnabled();
      await pointAndClick(page, menuItem(page, "สรุปสาขา"));
      await expect(
        page.getByRole("main").getByRole("button", { name: /ปิดวัน/ }),
      ).toHaveCount(0);
      await pointAndClick(page, menuItem(page, "กรอกรายวัน"));
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ข้อ 7 + 10 ตรวจก่อนปิด — ขาดเช็ควัสดุ/ข้าวสุกคงเหลือ → เตือนและยืนยันไม่ได้ · เนื้อชิลยกไปวันถัดไป 4.00 กก. เป็นข้อมูล ไม่บังคับ",
    async () => {
      const checklist = await openCloseDay(page);
      await expect(cell(checklist, "ยอดขายวันนี้", 1)).toHaveText("✓");
      await expect(cell(checklist, "เช็ควัสดุ", 1)).toHaveText("ยังไม่ทำ");
      await expect(cell(checklist, "ยืนยันข้าวเหนียวสุกคงเหลือ", 1)).toHaveText(
        "ยังไม่ทำ",
      );
      await expect(
        cell(checklist, "เนื้อชิลยกไปวันถัดไป 4.00 กก.", 1),
      ).toHaveText("ข้อมูล · ไม่บังคับ");
      await expect(
        openDialog(page)
          .getByRole("alert")
          .filter({ hasText: "ยังปิดวันไม่ได้" }),
      ).toBeVisible();
      await expect(
        openDialog(page).locator('button[type="submit"]'),
      ).toBeDisabled();
      await cancelDialog(page);
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: เช็ควัสดุ · ข้าวสุกคงเหลือ 10 กก. (30 − 100 × 0.2) · ปิดวันที่ 1 ทั้งที่ยังมีเนื้อชิล 4 กก. → ล็อก",
    async () => {
      await saveMaterials(page);
      await confirmRiceLeft(page, "10");
      await closeDay(page, DAY1);
      await expect(page.locator("main")).not.toContainText(
        "ต้องใช้เนื้อให้หมด",
      );
      for (const name of ["แบ่งละลาย", "บันทึกยอดขาย", "ตรวจและปิดวัน"])
        await expect(
          page.getByRole("main").getByRole("button", { name }).first(),
        ).toBeDisabled();
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ข้อ 8 หลังปิดวัน — รายการปิดวันแก้ไม่ได้ · ยอดขายของวันที่ปิดแล้วยังยื่นคำขอแก้ไขได้",
    async () => {
      await openMenu(page, "ประวัติ");
      const close = c_historyEntry(page, "ยืนยันปิดวัน");
      await pointAndClick(page, close.locator("summary"));
      await expect(close.getByRole("button", { name: /แก้ไข/ })).toHaveCount(0);
      const sale = c_historyEntry(page, "บันทึกยอดขาย / Waste");
      await pointAndClick(page, sale.locator("summary"));
      await expect(
        sale.getByRole("button", { name: "ขอแก้ไข", exact: true }),
      ).toBeVisible();
      // A branch never edits directly.
      await expect(
        sale.getByRole("button", { name: "แก้ไข", exact: true }),
      ).toHaveCount(0);
      await openMenu(page, "กรอกรายวัน");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ข้อ 10 วันที่ 2 (วันนี้) — ชิลยกมา 4.00 กก. โดยไม่ต้องละลายใหม่ · lot picker นับชิลยกมา",
    async () => {
      await setWorkingDate(page, TODAY);
      await expect(page.locator("main")).not.toContainText(
        "ถูกล็อก แก้ไขไม่ได้",
      );
      await expectMeatDay(page, ["4.00", "0.00", "0.00", "0.00", "4.00"]);
      await expect(page.locator("main")).toContainText("+ ชิลยกมา 4.00 กก.");
      await button(page, "บันทึกยอดขาย");
      await expect(
        openDialog(page).getByLabel("Lot ต้นทาง").locator("option:checked"),
      ).toHaveText(/แช่แข็ง 80\.00 กก\. \/ คงเหลือชิล 4\.00 กก\.$/);
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ขายจากชิลยกมา 40 กล่อง ใช้จริง 4 กก. · ข้าวสุกคงเหลือ 2 กก. · ข้อ 7 ปิดวันนี้ตามเวลาจริงได้",
    async () => {
      await field(page, /กล่องมาตรฐาน/, "40");
      await field(page, /น้ำหนักเนื้อที่ใช้ไปจริงวันนี้/, "4");
      await field(page, /ยอดขาย LINE MAN/, "14000");
      await saveEntry(page);
      await expectMeatDay(page, ["4.00", "0.00", "4.00", "0.00", "0.00"]);
      await saveMaterials(page);
      await confirmRiceLeft(page, "2");
      await closeDay(page, TODAY);
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ข้อ 6 แท็บสต๊อก — สรุปคงเหลือเนื้อ รายล็อต ณ วันที่ 1 (แช่แข็ง 80 · ชิล 4 · ใช้แล้ว 15) และรายวันย้อนหลัง · ไม่มีคำว่า พร้อมขาย",
    async () => {
      await openMenu(page, "สต๊อก");
      await expect(
        page.getByRole("heading", {
          name: "สรุปคงเหลือเนื้อ รายวัน / รายล็อต",
        }),
      ).toBeVisible();
      await page.getByLabel("ยอด ณ สิ้นวันที่").fill(DAY1);
      const byLot = tableSection(page, `คงเหลือแยก Lot · ${DAY1} · ศาลาแดง`);
      for (const header of [
        "แช่แข็ง",
        "ชิล (ละลายแล้วคงเหลือ)",
        "ใช้แล้ว (สะสม)",
      ])
        await expect(byLot).toContainText(header);
      // รอรับ · รับเข้า · แช่แข็ง · ชิล · ใช้แล้ว · ชิลยกมา · ละลาย · ใช้จริง · เวสต์
      await expect(
        byLot.getByRole("row").filter({ hasText: LOT }),
      ).toContainText(
        /0\.00 กก\.\s*100\.00 กก\.\s*80\.00 กก\.\s*4\.00 กก\.\s*15\.00 กก\.\s*0\.00 กก\.\s*20\.00 กก\.\s*15\.00 กก\.\s*1\.00 กก\./,
      );
      await expect(
        byLot.getByRole("row").filter({ hasText: "รวม" }),
      ).toBeVisible();
      // The history lists the 14 days ending at "ยอด ณ สิ้นวันที่": end it at today so
      // both day 1 and today are in it.
      await page.getByLabel("ยอด ณ สิ้นวันที่").fill(TODAY);
      const history = tableSection(page, /^ย้อนหลัง \d+ วัน · ศาลาแดง/);
      // ชิลยกมา · ละลาย · ใช้จริง · เวสต์ · คงเหลือชิล · แช่แข็งสิ้นวัน
      await expect(
        history.getByRole("row").filter({ hasText: DAY1 }),
      ).toContainText(
        /0\.00 กก\.\s*20\.00 กก\.\s*15\.00 กก\.\s*1\.00 กก\.\s*4\.00 กก\.\s*80\.00 กก\./,
      );
      await expect(
        history.getByRole("row").filter({ hasText: TODAY }),
      ).toContainText(
        /4\.00 กก\.\s*0\.00 กก\.\s*4\.00 กก\.\s*0\.00 กก\.\s*0\.00 กก\.\s*80\.00 กก\./,
      );
      await expect(page.locator("main")).not.toContainText("พร้อมขาย");
    },
  );

  await step(
    page,
    "Owner: ข้อ 6 สต๊อกของทั้งหมด — สรุปคงเหลือเนื้อเลือกสาขาได้ · ศาลาแดง ณ วันที่ 1 ตรงกับหน้าสาขา · มีนบุรี ว่าง",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await openMenu(page, "สต๊อกของทั้งหมด");
      const heading = page.getByRole("heading", {
        name: "สรุปคงเหลือเนื้อ รายวัน / รายล็อต",
      });
      await expect(heading).toBeVisible();
      const branchPicker = heading.locator("xpath=following::select[1]");
      await branchPicker.selectOption("ศาลาแดง");
      await page.getByLabel("ยอด ณ สิ้นวันที่").fill(DAY1);
      const byLot = tableSection(page, `คงเหลือแยก Lot · ${DAY1} · ศาลาแดง`);
      await expect(
        byLot.getByRole("row").filter({ hasText: LOT }),
      ).toContainText(
        /0\.00 กก\.\s*100\.00 กก\.\s*80\.00 กก\.\s*4\.00 กก\.\s*15\.00 กก\./,
      );
      await branchPicker.selectOption("มีนบุรี");
      await expect(
        tableSection(page, `คงเหลือแยก Lot · ${DAY1} · มีนบุรี`),
      ).toContainText("ยังไม่มีเนื้อของสาขานี้ ณ วันที่เลือก");
    },
  );

  await step(
    page,
    "Owner: ข้อ 8 Log — รายการปิดวันของสาขาไม่มีปุ่มแก้ไข",
    async () => {
      await openMenu(page, "Log");
      const close = c_historyEntry(page, "ยืนยันปิดวัน");
      await pointAndClick(page, close.locator("summary"));
      await expect(
        close.getByRole("button", { name: "แก้ไข", exact: true }),
      ).toHaveCount(0);
    },
  );
});

test("ข้อ 7 + 8 + 9 + 9.1: Owner ไม่มีข้าวดิบให้ซื้อ · สาขานึ่งเอง สุกหนักกว่าดิบ · ขอแก้ → Owner ไม่อนุมัติ/อนุมัติ → กระดิ่งสำเร็จ/ไม่สำเร็จ · Owner แก้ตรง · audit trail", async ({
  page,
}) => {
  test.setTimeout(10 * 60_000);
  skipUnlessCredentials(ACCOUNTS.owner, ACCOUNTS.saladaeng);
  await startFresh(page);

  await step(
    page,
    "Owner: ข้อ 9 ซื้ออื่น ๆ ไม่มีข้าวเหนียวดิบให้เลือก · ข้อ 7 ตั้งค่าไม่มีเวลาเริ่มปิดวัน",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await openMenu(page, "สต๊อกของทั้งหมด");
      await button(page, "+ บันทึกการซื้ออื่น ๆ");
      const options = await page
        .getByLabel("เลือกวัตถุดิบ 1")
        .locator("option")
        .allTextContents();
      expect(options).toContain("น้ำพริกหลอด");
      expect(options.join(" | ")).not.toContain("ข้าวเหนียว");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await openMenu(page, "ตั้งค่า");
      await expect(page.locator("main")).not.toContainText("เวลาเริ่มปิดวัน");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ข้อ 9 นึ่งเอง — ซื้อข้าวดิบ 10 กก. · เบิก 4 · หุงดิบ 4 → สุก 9 (สุกหนักกว่าดิบ) บันทึกได้",
    async () => {
      await signInAs(page, ACCOUNTS.saladaeng);
      await setWorkingDate(page, TODAY);
      await buyRice(page, "นึ่งเอง (ซื้อข้าวดิบ)", "10", "550");
      await pointAndClick(page, rowButton(page, "เบิกข้าวเหนียวดิบวันนี้"));
      await field(page, /ข้าวเหนียวดิบที่เบิกวันนี้/, "4");
      await field(page, /ผู้รับของ/, "ผู้ดูแลศาลาแดง");
      await saveEntry(page);
      await pointAndClick(page, rowButton(page, "ข้าวเหนียวช่วงเช้า"));
      await field(page, /ข้าวเหนียวดิบที่นำมาหุง/, "4");
      await field(page, /ข้าวเหนียวสุกที่ได้/, "9");
      await expect(openDialog(page).getByRole("alert")).toHaveCount(0);
      await saveEntry(page);
      await openMenu(page, "สรุปสาขา");
      await expect(
        cell(branchSummary(page), "ข้าวเหนียวดิบคงเหลือ", 1),
      ).toHaveText("6.00");
      await expect(
        cell(branchSummary(page), "ข้าวเหนียวสุกคงเหลือ", 1),
      ).toHaveText("9.00");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ข้อ 8.1 ขอแก้ไขการเบิกข้าว 4 → 5 กก. (สาขาแก้ตรงไม่ได้) · กระดิ่งรอพิจารณา",
    async () => {
      await openMenu(page, "ประวัติ");
      const issue = c_historyEntry(page, "เบิกข้าวเหนียวดิบวันนี้");
      await pointAndClick(page, issue.locator("summary"));
      await expect(
        issue.getByRole("button", { name: "แก้ไข", exact: true }),
      ).toHaveCount(0);
      // Fold it again: c_requestEdit opens the entry itself.
      await pointAndClick(page, issue.locator("summary"));
      await c_requestEdit(
        page,
        "เบิกข้าวเหนียวดิบวันนี้",
        [[/ข้าวเหนียวดิบที่เบิกวันนี้/, "5"]],
        "เบิกจริง 5 กก.",
      );
      await c_expectBell(
        page,
        `คำขอแก้ไขรอพิจารณา · เบิกข้าวเหนียวดิบวันนี้ ${TODAY}`,
      );
    },
  );

  await step(
    page,
    "Owner: กระดิ่งคำขอรอพิจารณา → ไม่อนุมัติพร้อมหมายเหตุ",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await c_ownerDecidesEdit(page, "ไม่อนุมัติ", "ใบเบิกเขียน 4 กก.");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: กระดิ่งไม่สำเร็จ · ขอแก้ไขข้าวสุกที่ได้ 9 → 9.5 กก.",
    async () => {
      await signInAs(page, ACCOUNTS.saladaeng);
      await c_expectBell(
        page,
        `คำขอแก้ไขไม่สำเร็จ · เบิกข้าวเหนียวดิบวันนี้ ${TODAY}`,
      );
      await c_requestEdit(
        page,
        "ข้าวเหนียวช่วงเช้า",
        [[/ข้าวเหนียวสุกที่ได้/, "9.5"]],
        "ชั่งข้าวสุกใหม่ได้ 9.5 กก.",
      );
    },
  );

  await step(
    page,
    "Owner: อนุมัติ → Log บันทึกผู้ขอ ผู้อนุมัติ ค่าเดิม/ค่าใหม่",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await c_ownerDecidesEdit(page, "อนุมัติ");
      const panel = tableSection(page, "คำขอแก้ไขรายการ");
      // Both requests stay listed: the rejected one and the approved one.
      await expect(panel).toContainText("ไม่อนุมัติ โดย Owner");
      await expect(panel).toContainText(/(?<!ไม่)อนุมัติ โดย Owner/);
      const rice = c_historyEntry(page, "ข้าวเหนียวช่วงเช้า");
      await expect(rice.locator("summary")).toContainText("แก้ไขแล้ว");
      await expect(rice).toContainText("ประวัติการแก้ไข");
      await expect(rice).toContainText("ขอโดย ผู้ดูแลสาขา ศาลาแดง");
      await expect(rice).toContainText("อนุมัติโดย Owner");
      await expect(rice).toContainText("ชั่งข้าวสุกใหม่ได้ 9.5 กก.");
    },
  );

  await step(
    page,
    "Owner: ข้อ 8.1 แก้ไขย้อนหลังได้เองทันที — ข้าวดิบซื้อเข้า 10 → 12 กก. · trail Owner แก้ไขโดยตรง",
    async () => {
      const purchase = c_historyEntry(page, "ซื้อข้าวเหนียวเข้าสต๊อก");
      await pointAndClick(page, purchase.locator("summary"));
      await pointAndClick(
        page,
        purchase.getByRole("button", { name: "แก้ไข", exact: true }),
      );
      await typeValue(page, purchase.getByLabel(/ข้าวเหนียวดิบซื้อเข้า/), "12");
      await typeValue(
        page,
        purchase.getByLabel("เหตุผลที่แก้ไข"),
        "ใบเสร็จจริง 12 กก.",
      );
      await pointAndClick(
        page,
        purchase.getByRole("button", { name: "บันทึกการแก้ไข" }),
      );
      await expect(page.getByRole("status")).toContainText(
        "แก้ไขรายการแล้ว ระบบคำนวณยอดใหม่และเก็บค่าเดิมไว้ในประวัติ",
      );
      await expect(purchase.locator("summary")).toContainText("แก้ไขแล้ว");
      await expect(purchase).toContainText("Owner แก้ไขโดยตรง");
      await expect(purchase).toContainText("ใบเสร็จจริง 12 กก.");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: กระดิ่งสำเร็จ · รายการคำขอเก็บทั้งที่อนุมัติและไม่อนุมัติ · ยอดข้าวใช้ค่าใหม่ (ดิบ 12 − 4 = 8 · สุก 9.5)",
    async () => {
      await signInAs(page, ACCOUNTS.saladaeng);
      await c_expectBell(page, `คำขอแก้ไขสำเร็จ · ข้าวเหนียวช่วงเช้า ${TODAY}`);
      await openMenu(page, "ประวัติ");
      const panel = tableSection(page, "คำขอแก้ไขรายการ");
      await expect(panel).toContainText("ไม่สำเร็จ");
      await expect(panel).toContainText("ใบเบิกเขียน 4 กก.");
      await expect(panel).toContainText(/(?<!ไม่)สำเร็จ/);
      await expect(panel).toContainText(/(?<!ไม่)อนุมัติ โดย Owner/);
      await openMenu(page, "สรุปสาขา");
      await expect(
        cell(branchSummary(page), "ข้าวเหนียวดิบคงเหลือ", 1),
      ).toHaveText("8.00");
      await expect(
        cell(branchSummary(page), "ข้าวเหนียวสุกคงเหลือ", 1),
      ).toHaveText("9.50");
    },
  );
});

test("ข้อ 8.1: คำขอแก้ไขแจ้งทั้ง Owner และ Account Manager · Manager อนุมัติได้ · Manager แก้ไขย้อนหลังได้เอง", async ({
  page,
}) => {
  test.setTimeout(10 * 60_000);
  skipUnlessCredentials(ACCOUNTS.owner, ACCOUNTS.saladaeng);
  await startFresh(page);
  // Skips outside local SQLite before anything is recorded.
  await signInAsManager(page);

  await step(
    page,
    "สาขาศาลาแดง: ซื้อข้าวดิบ 8 กก. → ขอแก้ไขเป็น 7 กก.",
    async () => {
      await signInAs(page, ACCOUNTS.saladaeng);
      await setWorkingDate(page, TODAY);
      await buyRice(page, "นึ่งเอง (ซื้อข้าวดิบ)", "8", "440");
      await c_requestEdit(
        page,
        "ซื้อข้าวเหนียวเข้าสต๊อก",
        [[/ข้าวเหนียวดิบซื้อเข้า/, "7"]],
        "ร้านส่งมาแค่ 7 กก.",
      );
    },
  );

  await step(page, "Owner: กระดิ่งขึ้นคำขอรอพิจารณา 1 รายการ", async () => {
    await signInAs(page, ACCOUNTS.owner);
    const bell = await openNotifications(page);
    await expect(bell).toContainText("คำขอแก้ไขรอพิจารณา 1 รายการ");
    await closeNotifications(page);
  });

  await step(
    page,
    "Account Manager: กระดิ่งขึ้นคำขอเดียวกันพร้อมกัน → อนุมัติ",
    async () => {
      await signInAsManager(page);
      await c_ownerDecidesEdit(page, "อนุมัติ");
      await expect(tableSection(page, "คำขอแก้ไขรายการ")).toContainText(
        "อนุมัติ โดย Account Manager",
      );
    },
  );

  await step(
    page,
    "Account Manager: แก้ไขย้อนหลังได้เอง — ผู้จำหน่ายข้าว · trail อนุมัติโดย / แก้ไขโดยตรง Account Manager",
    async () => {
      const purchase = c_historyEntry(page, "ซื้อข้าวเหนียวเข้าสต๊อก");
      await pointAndClick(page, purchase.locator("summary"));
      await expect(purchase).toContainText("อนุมัติโดย Account Manager");
      await pointAndClick(
        page,
        purchase.getByRole("button", { name: "แก้ไข", exact: true }),
      );
      await typeValue(
        page,
        purchase.getByLabel(/ผู้จำหน่ายข้าว/),
        "ร้านข้าวที่ถูกต้อง",
      );
      await typeValue(
        page,
        purchase.getByLabel("เหตุผลที่แก้ไข"),
        "ชื่อร้านผิด",
      );
      await pointAndClick(
        page,
        purchase.getByRole("button", { name: "บันทึกการแก้ไข" }),
      );
      await expect(page.getByRole("status")).toContainText("แก้ไขรายการแล้ว");
      await expect(purchase).toContainText("Account Manager แก้ไขโดยตรง");
    },
  );

  await step(
    page,
    "Owner: กระดิ่งไม่มีคำขอค้าง · สาขาศาลาแดง: กระดิ่งสำเร็จ · ข้าวดิบคงเหลือ 7 กก.",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      const bell = await openNotifications(page);
      await expect(bell).not.toContainText("คำขอแก้ไขรอพิจารณา");
      await closeNotifications(page);
      await signInAs(page, ACCOUNTS.saladaeng);
      await c_expectBell(
        page,
        `คำขอแก้ไขสำเร็จ · ซื้อข้าวเหนียวเข้าสต๊อก ${TODAY}`,
      );
      await openMenu(page, "สรุปสาขา");
      await expect(
        cell(branchSummary(page), "ข้าวเหนียวดิบคงเหลือ", 1),
      ).toHaveText("7.00");
    },
  );
});

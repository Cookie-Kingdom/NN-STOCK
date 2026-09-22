import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  chefSmokesShipment,
  chefSubmitsInvoice,
  closeNotifications,
  field,
  foodivaReceivesReturn,
  loadSampleData,
  menuItem,
  openMaterialCount,
  openNotifications,
  ownerApprovesSmokingInvoice,
  ownerCallsReturnTruck,
  ownerPaysSmokingInvoice,
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
} from "../helpers";

/* Lane E, rewritten for Branch Day B1–B5 and allocation by kg (vault:
 * Features/Branch Day/Checklist.md, Features/Allocate by kg/Checklist.md). One 500 kg
 * shipment reaches central stock through the Shipment Flow; Owner allocates it by kg,
 * Saladaeng 300 / Minburi 200. Saladaeng runs two days:
 *   day 1 (yesterday): receive by kg (partial, then the rest with "รับครบใบจัดสรรนี้แล้ว"),
 *     thaw 70, self-cooked rice, a sale that uses 65.5, close through the
 *     "ตรวจและปิดวัน" checklist (blocked while something is missing) → 4.5 kg chill left.
 *   day 2 (today): ชิลยกมา 4.5 kg is sold without a new thaw, cooked rice is bought,
 *     materials are counted, the day closes; stock summary as of day 1; an edit request on
 *     the closed day 1 sale is approved by Owner and the branch bell shows สำเร็จ.
 * Minburi runs today with both rice sources and a short receive closed with a reason.
 * Owner unlocks, the branch sells more and closes again, and the report and stock views
 * add up. Day 1 is yesterday because future dates are blocked; the allocation is dated
 * yesterday so the branch may receive on it. Every number follows mutate() in store.ts. */

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
/** Branch stock is kept per shipment lot, S260917-001 (see mutate() "shipmentRequest"). */
const LOT = /S\d{6}-\d{3}/;

function bangkokDate(offset = 0) {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  now.setDate(now.getDate() + offset);
  return now.toLocaleDateString("en-CA");
}
const TODAY = bangkokDate();
const DAY1 = bangkokDate(-1);

const openDialog = (page: Page) => page.getByRole("dialog").last();

/** The sample set closes its last seven days (through today) and future dates are blocked,
 * so the day before the sample range is the open working date. */
function openDayBeforeSample() {
  return bangkokDate(-7);
}

/** The page-heading date picker (the day tab's materials cards carry their own copy). */
async function setWorkingDate(page: Page, date: string) {
  const input = page.getByLabel("วันที่ทำรายการ").first();
  await input.scrollIntoViewIfNeeded();
  await input.fill(date);
  await expect(input).toHaveValue(date);
}

/** The dialog refuses with `message`. A complete form shows mutate()'s refusal live in
 * the footer and disables the save (DialogFooter); a form the live check holds back
 * (allocation left empty) only says why once the save is pressed. */
async function submitAndExpectError(page: Page, message: RegExp) {
  const dialog = openDialog(page);
  const submit = dialog.locator('button[type="submit"]').last();
  const alert = dialog.getByRole("alert").filter({ hasText: message }).first();
  if (!(await alert.isVisible()) && (await submit.isEnabled()))
    await pointAndClick(page, submit);
  await expect(alert).toBeVisible();
}

/** An amount over stock: the red "… · กรอกได้สูงสุด X" shows as it is typed and the
 * save stays disabled, so nothing is clicked. */
async function expectOverStock(page: Page, message: string) {
  const dialog = openDialog(page);
  await expect(
    dialog.getByRole("alert").filter({ hasText: message }).first(),
  ).toBeVisible();
  await expect(dialog.locator('button[type="submit"]').last()).toBeDisabled();
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

/** The action button of one table row, addressed by the row's label. */
const rowButton = (page: Page, rowText: string, name = "กรอกข้อมูล") =>
  page
    .getByRole("main")
    .getByRole("row")
    .filter({ hasText: rowText })
    .getByRole("button", { name });

/** One cell of the table row whose text contains `rowText` (every DataTable cell is a <td>). */
const cell = (scope: Locator, rowText: string | RegExp, index: number) =>
  scope
    .getByRole("row")
    .filter({ hasText: rowText })
    .getByRole("cell")
    .nth(index);

const summary = (page: Page) => tableSection(page, /^สรุปรายวัน/);

/** The inline materials table is not a live-preview dialog, and its "used" input
 * re-renders "" as "0", so a keystroke-by-keystroke typeValue would leave "0150". */
const fillCell = (page: Page, label: string, value: string) =>
  page.getByLabel(label).fill(value);

/** "ตรวจและปิดวัน" (row "4. ปิดวัน" of งานหลักประจำวัน): the only close button. */
async function openCloseDay(page: Page) {
  await pointAndClick(page, rowButton(page, "4. ปิดวัน", "ตรวจและปิดวัน"));
  return tableSection(page, "ตรวจก่อนปิดวัน");
}

/** The checklist row of `label` reads `status`. */
const checklistStatus = (checklist: Locator, label: string | RegExp) =>
  cell(checklist, label, 1);

/** Opens the checklist, expects `missing` to block the close (confirm disabled, reason in
 * the footer), then presses its "ไปกรอก" so the form of that item opens instead. */
async function closeBlockedThenGo(
  page: Page,
  missing: string,
  message: RegExp,
) {
  const checklist = await openCloseDay(page);
  await expect(checklistStatus(checklist, missing)).toHaveText("ยังไม่ทำ");
  await expect(
    openDialog(page).locator('button[type="submit"]'),
  ).toBeDisabled();
  await expect(
    openDialog(page).getByRole("alert").filter({ hasText: message }),
  ).toBeVisible();
  await pointAndClick(
    page,
    checklist
      .getByRole("row")
      .filter({ hasText: missing })
      .getByRole("button", { name: /^ไปกรอก/ }),
  );
}

async function closeDay(page: Page, who: string, date: string) {
  const checklist = await openCloseDay(page);
  await expect(openDialog(page)).toContainText("ข้อมูลครบ ปิดวันได้ทุกเวลา");
  await expect(checklist).not.toContainText("ยังไม่ทำ");
  // No simulated close time any more: complete data closes the day at any hour.
  await expect(
    openDialog(page).getByLabel(/เวลาจำลองสำหรับทดสอบปิดวัน/),
  ).toHaveCount(0);
  await field(page, /ชื่อผู้ยืนยันปิดวัน/, who);
  await saveEntry(page);
  await expect(page.locator("main")).toContainText(
    `ปิดวันแล้ว · ข้อมูลวันที่ ${date} ถูกล็อก`,
  );
}

/** "ซื้อข้าวเหนียวเข้าสต๊อก" with the round's source picked first (B2). */
async function buyRice(
  page: Page,
  source: "นึ่งเอง (ซื้อข้าวดิบ)" | "ซื้อข้าวสุกจากข้างนอก",
  kg: string,
  cost: string,
) {
  await pointAndClick(page, rowButton(page, "ซื้อข้าวเหนียวเข้าสต๊อก"));
  const dialog = openDialog(page);
  // Nothing about raw or cooked rice shows before the source is picked.
  await expect(dialog.getByLabel(/ข้าวเหนียว(ดิบ|สุก)ซื้อเข้า/)).toHaveCount(0);
  await dialog.getByLabel(/รอบนี้ข้าวเหนียวมาจาก/).selectOption(source);
  await field(page, /ผู้จำหน่ายข้าว/, `ร้านข้าว E2E ${source}`);
  const raw = source.startsWith("นึ่งเอง");
  await expect(dialog.getByLabel(/ข้าวเหนียวสุกซื้อเข้า/)).toHaveCount(
    raw ? 0 : 1,
  );
  await expect(dialog.getByLabel(/ข้าวเหนียวดิบซื้อเข้า/)).toHaveCount(
    raw ? 1 : 0,
  );
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
  if (!raw)
    // cookedRicePar is a hint only: buying below it still saves.
    await expect(dialog).toContainText("ควรซื้อเพิ่มอย่างน้อย");
  await saveEntry(page);
}

/** Self-cook round: issue `kg` raw rice and cook it into `cookedKg`. */
async function cookRice(page: Page, kg: string, cookedKg: string) {
  await pointAndClick(page, rowButton(page, "เบิกข้าวเหนียวดิบวันนี้"));
  await field(page, /ข้าวเหนียวดิบที่เบิกวันนี้/, kg);
  await field(page, /ผู้รับของ/, "ผู้ดูแลสาขา");
  await saveEntry(page);
  await pointAndClick(page, rowButton(page, "ข้าวเหนียวช่วงเช้า"));
  await field(page, /ข้าวเหนียวดิบที่นำมาหุง/, kg);
  await field(page, /ข้าวเหนียวสุกที่ได้/, cookedKg);
  await saveEntry(page);
}

/** Fills the open riceCarry form ("ยืนยันข้าวเหนียวสุกคงเหลือ") and saves. */
async function confirmRiceLeft(page: Page, kg: string) {
  await field(page, /ข้าวเหนียวสุกเหลือปลายวัน/, kg);
  await openDialog(page)
    .getByLabel(/การจัดการวันถัดไป/)
    .selectOption("เก็บไว้อุ่นวันถัดไป");
  await saveEntry(page);
}

/** Opens "แบ่งละลาย"; the lot picker shows frozen and chill kg. */
async function openThaw(page: Page, frozen: string, chill: string) {
  await button(page, "แบ่งละลาย");
  await expect(
    openDialog(page).getByLabel("Lot ต้นทาง").locator("option:checked"),
  ).toHaveText(
    new RegExp(
      `S\\d{6}-\\d{3} · แช่แข็ง ${frozen} กก\\. / คงเหลือชิล ${chill} กก\\.`,
    ),
  );
}

/** Saves the inline materials check with whatever the table holds. */
async function saveMaterials(page: Page) {
  await openMaterialCount(page);
  await saveMaterialCount(page);
}

/** Opens "รับของ" and picks the only allocation waiting for this branch. The lot
 * picker says what Owner sent, what is in and what is still to come. */
async function openReceive(
  page: Page,
  outstanding: string,
  { sent, received }: { sent: string; received: string },
) {
  await button(page, "รับของ");
  await expect(
    openDialog(page).getByLabel("Lot ต้นทาง").locator("option:checked"),
  ).toHaveText(
    new RegExp(
      `S\\d{6}-\\d{3} · ส่งมา ${sent} กก\\. · รับแล้ว ${received} กก\\. · ค้างรับ ${outstanding} กก\\.`,
    ),
  );
  const allocation = openDialog(page).getByLabel("ใบจัดสรรที่รับ");
  await expect(allocation.locator("option")).toHaveCount(2);
  await expect(allocation.locator("option").nth(1)).toContainText(
    `ค้างรับ ${outstanding} กก.`,
  );
  await allocation.selectOption({ index: 1 });
  // Receipt is by kg only: no bag count (Allocate by kg).
  await expect(openDialog(page).getByLabel(/จำนวนถุงที่รับ/)).toHaveCount(0);
  return openDialog(page).getByRole("checkbox", {
    name: /รับครบใบจัดสรรนี้แล้ว/,
  });
}

/** Walks one shipment from PO to central stock (Shipment Flow): 500 kg everywhere,
 * 5 กล่องรับเข้า × 100 kg out and 5 กล่องรมควัน × 100 kg back. */
async function reachAllocation(page: Page) {
  const boxes = ["100", "100", "100", "100", "100"];
  let shipment = "";
  await step(
    page,
    "Owner: PO เนื้อ 500 กก. → Foodiva: Invoice → Owner: Request → Foodiva: ใบขนส่ง + Packing List 5 กล่องรับเข้า → Owner: PO รมควัน",
    async () => {
      ({ shipment } = await sendMeatToChefHouse(page, {
        orderedKg: "500",
        boxes,
      }));
    },
  );
  await step(
    page,
    "Chef House: รับ PO · ช่องเหลือง 5 × 100 · ก่อนสโมค 500 · สโมค 5 กล่องรมควัน × 100 กก. · ปิด Lot · Submit ใบวางบิล",
    async () => {
      await chefSmokesShipment(page, shipment, {
        received: boxes,
        preSmokeKg: "500",
        packs: boxes,
      });
      await chefSubmitsInvoice(page, "CH-INV-001");
    },
  );
  await step(page, "Owner: ตรวจยอด ชำระ และเรียกรถขากลับ 500 กก.", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await ownerApprovesSmokingInvoice(page, shipment);
    await ownerPaysSmokingInvoice(page, shipment);
    await ownerCallsReturnTruck(page, shipment, "500");
  });
  await step(page, "Foodiva: ยืนยันรับเข้าตู้ 500 กก.", async () => {
    await signInAs(page, ACCOUNTS.foodiva);
    await foodivaReceivesReturn(page, shipment, { kg: "500" });
  });
  await step(
    page,
    "Owner: รับเข้าสต๊อกกลาง 500 กก. → stage จัดสรร / ขาย",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await ownerReceivesCentral(page, "500");
    },
  );
}

test("Lane E: จัดสรรเป็นกิโล → สาขารับ ละลาย ข้าว ขาย ปิดวันด้วย checklist → ชิลยกมาวันถัดไป → ขอแก้ไข → Owner อนุมัติ ปลดล็อก รายงาน สต๊อก", async ({
  page,
}) => {
  test.setTimeout(25 * 60_000);
  skipUnlessCredentials(
    ACCOUNTS.owner,
    ACCOUNTS.foodiva,
    ACCOUNTS.chef,
    ACCOUNTS.saladaeng,
    ACCOUNTS.minburi,
  );
  await startFresh(page);

  /* ---- Owner setup: material par levels, one material at Saladaeng, chili ---- */

  await step(
    page,
    "Owner: ตั้งฐานวัสดุ 500 ชิ้น ราคา 1 บาท ทั้ง 7 รายการ (ใช้กับทั้ง 2 สาขา)",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await expect(
        page.getByRole("heading", { name: "แดชบอร์ด" }),
      ).toBeVisible();
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
    },
  );

  await step(
    page,
    "Owner: E11 ปลดล็อกวันที่ยังไม่ปิด → วันนี้ยังไม่ได้ปิด",
    async () => {
      await button(page, "รายงาน");
      await button(page, "ปลดล็อกวัน");
      await page
        .getByLabel(/สาขาที่ปลดล็อก/)
        .selectOption({ label: "ศาลาแดง" });
      await field(page, /เหตุผลปลดล็อก/, "ทดสอบปลดล็อกก่อนปิดวัน");
      await submitAndExpectError(page, /วันนี้ยังไม่ได้ปิด/);
      await cancelDialog(page);
    },
  );

  await step(
    page,
    `Owner: ซื้อ${BOX} 200 ชิ้นเข้าคลัง และส่ง 100 ชิ้นไปศาลาแดง`,
    async () => {
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
    },
  );

  await step(
    page,
    "Owner: ซื้อน้ำพริก 100 หลอด และจัดสรร ศาลาแดง 50 / มีนบุรี 20",
    async () => {
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
    },
  );

  await reachAllocation(page);

  /* ---- E1 Owner allocates by kg ---- */

  const meatTable = tableSection(page, "สต๊อกเนื้อทุกจุด (Meat inventory)");
  const allocateButton = meatTable
    .getByRole("row")
    .filter({ hasText: LOT })
    .getByRole("button", { name: "จัดสรร" });
  await step(
    page,
    "Owner: E1 จัดสรรเป็นกิโล — ส่วนกลาง 500 กก. · ไม่กรอก → กรอกอย่างน้อย 1 สาขา · เกิน → เกินสต๊อกกลาง",
    async () => {
      await button(page, "จัดสรรเนื้อ และสต๊อกไปสาขา");
      await expect(cell(meatTable, LOT, 2)).toHaveText("500.00 กก.");
      await pointAndClick(page, allocateButton);
      const dialog = openDialog(page);
      await expect(dialog).toContainText("จัดสรรเนื้อไปสาขา (กก.)");
      await expect(dialog).toContainText(/สต๊อกกลางของ Lot นี้\s*500\.00 กก\./);
      await submitAndExpectError(page, /กรอกน้ำหนักจัดสรรอย่างน้อย 1 สาขา/);
      await dialog.getByLabel("ศาลาแดง (กก.)").fill("300");
      await dialog.getByLabel("มีนบุรี (กก.)").fill("250");
      await expect(
        dialog
          .getByRole("alert")
          // Feedback 13: the live error states the maximum that may be typed.
          .filter({
            hasText:
              "น้ำหนักรวม 550.00 กก. เกินสต๊อกกลาง · กรอกได้สูงสุด 500.00 กก.",
          })
          .first(),
      ).toBeVisible();
    },
  );

  await step(
    page,
    "Owner: E1 ศาลาแดง 300 · มีนบุรี ที่เหลือทั้งหมด (200) ลงวันที่เมื่อวาน → ส่วนกลาง 0 กก. ปุ่มจัดสรรปิด",
    async () => {
      const dialog = openDialog(page);
      await dialog.getByLabel("มีนบุรี (กก.)").fill("");
      await pointAndClick(
        page,
        dialog.getByRole("button", { name: "ที่เหลือทั้งหมด" }).nth(1),
      );
      await expect(dialog.getByLabel("มีนบุรี (กก.)")).toHaveValue("200");
      await expect(dialog).toContainText(
        /คงเหลือในคลังกลางหลังจัดสรร\s*0\.00 กก\./,
      );
      const date = dialog.getByLabel("วันที่ทำรายการ");
      await date.fill(DAY1);
      await expect(date).toHaveValue(DAY1);
      await saveEntry(page);
      await expect(
        page.getByText(
          "จัดสรรไปสาขาแล้ว · ศาลาแดง 300.00 กก. · มีนบุรี 200.00 กก.",
        ),
      ).toBeVisible();
      await expect(cell(meatTable, LOT, 2)).toHaveText("0.00 กก.");
      await expect(allocateButton).toBeDisabled();
    },
  );

  /* ---- Saladaeng day 1 (yesterday) ---- */

  await step(
    page,
    "สาขาศาลาแดง: วันที่ 1 รับของเป็นกิโล — เห็นเฉพาะใบของตัวเอง ค้างรับ 300 · รับเกิน → บล็อก · รับบางส่วน 290 (ไม่ติ๊กรับครบ)",
    async () => {
      await signInAs(page, ACCOUNTS.saladaeng);
      await setWorkingDate(page, DAY1);
      await expect(page.locator("main")).toContainText("งานเข้าใหม่ 1 Lot");
      const complete = await openReceive(page, "300.00", {
        sent: "300.00",
        received: "0.00",
      });
      await expect(complete).toBeChecked();
      await field(page, /น้ำหนักรับเข้าสาขา/, "350");
      await expectOverStock(
        page,
        "รับเกินยอดค้างรับ · กรอกได้สูงสุด 300.00 กก.",
      );
      await field(page, /น้ำหนักรับเข้าสาขา/, "290");
      // Ticked, a shortfall closes the allocation and needs a reason.
      await submitAndExpectError(page, /กรอกเหตุผลส่วนต่าง/);
      await complete.uncheck();
      await saveEntry(page);
      await expect(page.locator("main")).toContainText("งานเข้าใหม่ 1 Lot");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: รับส่วนที่เหลือ 10 กก. + รับครบใบจัดสรรนี้แล้ว → ไม่มีรายการรอรับ",
    async () => {
      const complete = await openReceive(page, "10.00", {
        sent: "300.00",
        received: "290.00",
      });
      await expect(complete).toBeChecked();
      await field(page, /น้ำหนักรับเข้าสาขา/, "10");
      await saveEntry(page);
      await expect(page.locator("main")).toContainText("ไม่มีรายการรอรับ");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: แบ่งละลาย 400 > 300 → สต๊อกแช่แข็งไม่พอ · 70 กก. → ผ่าน · สต๊อก รับ 300 แช่แข็ง 230 ชิล 70",
    async () => {
      await openThaw(page, "300.00", "0.00");
      // The over-stock amount shows before the rest of the form is filled.
      await field(page, /น้ำหนักละลาย/, "400");
      await expectOverStock(
        page,
        "สต๊อกแช่แข็งไม่พอ · กรอกได้สูงสุด 300.00 กก.",
      );
      await field(page, /น้ำหนักละลาย/, "70");
      await field(page, /จำนวนกล่องรมควันที่ละลาย/, "1.5");
      await submitAndExpectError(page, /จำนวนกล่องรมควันต้องเป็นจำนวนเต็ม/);
      await field(page, /จำนวนกล่องรมควันที่ละลาย/, "1");
      await saveEntry(page);
      await nav(page, "สต๊อก");
      const stock = tableSection(page, "สต๊อกเนื้อ · ศาลาแดง");
      await expect(cell(stock, LOT, 2)).toHaveText("300.00 กก.");
      await expect(cell(stock, LOT, 3)).toHaveText("230.00 กก.");
      await expect(cell(stock, LOT, 4)).toHaveText("70.00 กก.");
      await nav(page, "กรอกรายวัน");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ข้าวแบบนึ่งเอง — ซื้อข้าวดิบ 100 · เบิก 150 → ไม่พอ · เบิก 60 · หุง 70 → ไม่พอ · ดิบ 60 → สุก 130",
    async () => {
      await buyRice(page, "นึ่งเอง (ซื้อข้าวดิบ)", "100", "5500");
      await pointAndClick(page, rowButton(page, "เบิกข้าวเหนียวดิบวันนี้"));
      await field(page, /ข้าวเหนียวดิบที่เบิกวันนี้/, "150");
      await expectOverStock(
        page,
        "ข้าวเหนียวดิบในสต๊อกไม่พอ · กรอกได้สูงสุด 100.00 กก.",
      );
      await field(page, /ข้าวเหนียวดิบที่เบิกวันนี้/, "60");
      await field(page, /ผู้รับของ/, "ผู้ดูแลศาลาแดง");
      // The withdrawal card: what leaves, stock now and after.
      await expect(openDialog(page)).toContainText("ตรวจสอบก่อนบันทึก");
      await expect(openDialog(page)).toContainText(
        /ข้าวเหนียวดิบที่เบิก\s*60\.00 กก\./,
      );
      await expect(openDialog(page)).toContainText(
        /ข้าวเหนียวดิบคงเหลือตอนนี้\s*100\.00 กก\./,
      );
      await expect(openDialog(page)).toContainText(
        /ข้าวเหนียวดิบคงเหลือหลังรายการนี้\s*40\.00 กก\./,
      );
      await expect(openDialog(page)).toContainText(
        /ผู้รับของ\s*ผู้ดูแลศาลาแดง/,
      );
      await saveEntry(page);
      await pointAndClick(page, rowButton(page, "ข้าวเหนียวช่วงเช้า"));
      // mutate() checks the cooked weight before the raw one, so both are typed first.
      await field(page, /ข้าวเหนียวสุกที่ได้/, "130");
      await field(page, /ข้าวเหนียวดิบที่นำมาหุง/, "70");
      await expectOverStock(
        page,
        "ข้าวเหนียวดิบที่เบิกไว้ไม่พอ กรุณาบันทึกเบิกก่อนหุง · กรอกได้สูงสุด 60.00 กก.",
      );
      await field(page, /ข้าวเหนียวดิบที่นำมาหุง/, "60");
      await saveEntry(page);
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ตรวจและปิดวันก่อนขาย → checklist ขาดยอดขาย เช็ควัสดุ ข้าวสุกคงเหลือ · ปุ่มยืนยันกดไม่ได้ · ไปกรอกยอดขาย",
    async () => {
      const checklist = await openCloseDay(page);
      await expect(checklistStatus(checklist, "เช็ควัสดุ")).toHaveText(
        "ยังไม่ทำ",
      );
      await expect(
        checklistStatus(checklist, "ยืนยันข้าวเหนียวสุกคงเหลือ"),
      ).toHaveText("ยังไม่ทำ");
      // Raw rice was issued today, so the morning cook is on the list, done.
      await expect(checklistStatus(checklist, "ข้าวเหนียวช่วงเช้า")).toHaveText(
        "✓",
      );
      await cancelDialog(page);
      await closeBlockedThenGo(page, "ยอดขายวันนี้", /ยังไม่มีรายการขายวันนี้/);
      await expect(openDialog(page)).toContainText("บันทึกยอดขาย / Waste");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ยอดขาย — กล่อง 2.5 → จำนวนเต็ม · ใช้จริง 70 กก. / 630 ซีล → เตือนนอก 100–103 กรัม · ใช้ 70 + เวสต์ 5 → เกินเนื้อที่ละลายแล้ว",
    async () => {
      await field(page, /กล่องมาตรฐาน/, "2.5");
      await submitAndExpectError(page, /จำนวนขายต้องเป็นจำนวนเต็ม/);
      await field(page, /กล่องมาตรฐาน/, "600");
      await field(page, /เนื้อซีล Add-on/, "30");
      await field(page, /น้ำหนักที่ใช้ไปจริงวันนี้/, "70");
      // 70 kg over 630 packs = 111.1 g: a warning, not an error.
      await expect(openDialog(page)).toContainText(
        "เฉลี่ย 111.1 กรัมต่อซีล อยู่นอกช่วง 100–103 กรัม",
      );
      await field(page, /น้ำหนักเวสต์/, "5");
      await field(page, /ยอดขาย LINE MAN/, "219600");
      await field(page, /เหตุผลส่วนต่าง \/ Waste \/ ข้าม FIFO/, "Waste ทดสอบ");
      await expectOverStock(
        page,
        "น้ำหนักที่ใช้และเวสต์เกินเนื้อที่ละลายแล้ว (รวมชิลยกมา) · ใช้จริงรวมเวสต์ได้สูงสุด 70.00 กก.",
      );
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ใช้จริง 63.5 กก. เวสต์ 0 → ไม่มีคำเตือน · ฿219,600 ตามเมนู → บันทึก",
    async () => {
      await field(page, /น้ำหนักที่ใช้ไปจริงวันนี้/, "63.5");
      await field(page, /น้ำหนักเวสต์/, "0");
      await expect(openDialog(page)).not.toContainText(
        "กรัมต่อซีล อยู่นอกช่วง",
      );
      // 600 × 350 + 30 × 320 (seed prices) in the dialog preview.
      await expect(openDialog(page)).toContainText("฿219,600.00");
      await saveEntry(page);
    },
  );

  /* The standalone กล่องโปรโมทอินฟลูเอนเซอร์ table is gone: a giveaway is entered
   * inside ตรวจและปิดวัน now (feedback-20-09-c ข้อ 17 walks that section, and
   * qa-regression checks an over-stock one), so this lane no longer records one. */

  await step(
    page,
    "สาขาศาลาแดง: เนื้อละลายวันนี้ ละลาย 70 · ใช้จริง 65.5 · เวสต์ 0 · คงเหลือชิล 4.5 · สรุปสาขา",
    async () => {
      const meatDay = tableSection(page, /^เนื้อละลายวันนี้/);
      await expect(cell(meatDay, LOT, 1)).toHaveText("0.00 กก.");
      await expect(cell(meatDay, LOT, 2)).toHaveText("70.00 กก.");
      await expect(cell(meatDay, LOT, 3)).toHaveText("65.50 กก.");
      await expect(cell(meatDay, LOT, 4)).toHaveText("0.00 กก.");
      await expect(cell(meatDay, LOT, 5)).toHaveText("4.50 กก.");
      // No "พร้อมขาย" on the branch screens any more (B1).
      await expect(page.locator("main")).not.toContainText("พร้อมขาย");
      await nav(page, "สรุปสาขา");
      await expect(cell(summary(page), "ยอดขาย LINE MAN", 1)).toHaveText(
        "219,600.00",
      );
      await expect(
        cell(summary(page), "คงเหลือชิลทั้งหมด (ยกไปวันถัดไป)", 1),
      ).toHaveText("4.50");
      await expect(cell(summary(page), "ข้าวเหนียวดิบคงเหลือ", 1)).toHaveText(
        "40.00",
      );
      // 130 cooked − (600 + 20) × 0.2
      await expect(cell(summary(page), "ข้าวเหนียวสุกคงเหลือ", 1)).toHaveText(
        "6.00",
      );
      await nav(page, "กรอกรายวัน");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: เช็ควัสดุ (ยังไม่มีวัสดุวันนี้) · checklist ยังขาดข้าวสุกคงเหลือ → ไปกรอก 6 กก.",
    async () => {
      await saveMaterials(page);
      await closeBlockedThenGo(
        page,
        "ยืนยันข้าวเหนียวสุกคงเหลือ",
        /ยังไม่ยืนยันข้าวเหนียวสุกคงเหลือ/,
      );
      await confirmRiceLeft(page, "6");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ปิดวันที่ 1 — checklist ครบ · เนื้อชิลยกไปวันถัดไป 4.50 กก. (ข้อมูล ไม่บังคับ) · ทุกปุ่มล็อก",
    async () => {
      const checklist = await openCloseDay(page);
      await expect(
        checklistStatus(checklist, "เนื้อชิลยกไปวันถัดไป 4.50 กก."),
      ).toHaveText("ข้อมูล · ไม่บังคับ");
      await cancelDialog(page);
      await closeDay(page, "ผู้ดูแลศาลาแดง", DAY1);
      const locked = page.locator("main").getByRole("button", {
        name: /กรอกข้อมูล|ตรวจและปิดวัน|ปิดวันแล้ว · แก้ไขไม่ได้|แบ่งละลาย|บันทึกยอดขาย/,
      });
      const count = await locked.count();
      expect(count).toBeGreaterThanOrEqual(7);
      for (let index = 0; index < count; index += 1)
        await expect(locked.nth(index)).toBeDisabled();
    },
  );

  /* ---- Saladaeng day 2 (today): chill carried in ---- */

  await step(
    page,
    "สาขาศาลาแดง: วันที่ 2 — เนื้อละลายวันนี้ ชิลยกมา 4.50 กก. · ไม่ต้องละลายใหม่",
    async () => {
      await setWorkingDate(page, TODAY);
      await expect(page.locator("main")).not.toContainText(
        "ถูกล็อก แก้ไขไม่ได้",
      );
      const meatDay = tableSection(page, /^เนื้อละลายวันนี้/);
      await expect(cell(meatDay, LOT, 1)).toHaveText("4.50 กก.");
      await expect(cell(meatDay, LOT, 2)).toHaveText("0.00 กก.");
      await expect(cell(meatDay, LOT, 5)).toHaveText("4.50 กก.");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ข้าวแบบซื้อข้าวสุกจากข้างนอก 12 กก. (ต่ำกว่าฐาน 30 ก็บันทึกได้)",
    async () => {
      await buyRice(page, "ซื้อข้าวสุกจากข้างนอก", "12", "540");
    },
  );

  const daily = tableSection(page, "วัสดุ 7 รายการ · กรอกการใช้วันนี้");
  await step(
    page,
    `สาขาศาลาแดง: E9 ยืนยันรับ${BOX} 100 ชิ้นจาก Owner → ยอดตั้งต้น 100`,
    async () => {
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
    },
  );

  await step(
    page,
    `สาขาศาลาแดง: E9 ใช้ 150 > 100 → จำนวนใช้ ${BOX} เกินยอดตั้งต้น · ตรวจนับ -1 → บล็อก · 2.5 → จำนวนเต็ม`,
    async () => {
      await openMaterialCount(page);
      await fillCell(page, `จำนวนใช้ ${BOX} วันนี้`, "150");
      await fillCell(page, `ยอดตรวจนับจริง ${BOX}`, "0");
      // Over the opening count: the red message shows as typed and the save is disabled.
      await expect(
        page.getByText(`จำนวนใช้ ${BOX} เกินยอดตั้งต้น · กรอกได้สูงสุด 100`),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "บันทึกและล็อก (Save & lock)" }),
      ).toBeDisabled();
      await fillCell(page, `จำนวนใช้ ${BOX} วันนี้`, "30");
      await fillCell(page, `ยอดตรวจนับจริง ${BOX}`, "-1");
      await button(page, "บันทึกและล็อก (Save & lock)");
      // positive() runs before the dedicated "ติดลบไม่ได้" assert in mutate(), so this is the text users get.
      await expect(
        page.getByText(
          new RegExp(
            `กรอก${BOX}เป็นตัวเลขตั้งแต่ศูนย์|ยอดตรวจนับ ${BOX} ติดลบไม่ได้`,
          ),
        ),
      ).toBeVisible();
      await fillCell(page, `ยอดตรวจนับจริง ${BOX}`, "2.5");
      await button(page, "บันทึกและล็อก (Save & lock)");
      await expect(page.getByText("วัสดุต้องเป็นจำนวนเต็ม")).toBeVisible();
    },
  );

  await step(
    page,
    `สาขาศาลาแดง: E9 ใช้ 30 นับตามระบบ → บันทึกแล้ว · สต๊อก${BOX} 70 ชิ้น ใกล้หมด (ฐาน 500)`,
    async () => {
      await fillCell(page, `ยอดตรวจนับจริง ${BOX}`, "");
      await saveMaterials(page);
      await expect(cell(daily, BOX, 3)).toHaveText("70");
      await expect(cell(daily, BOX, 6)).toHaveText("บันทึกแล้ว");
      await nav(page, "สต๊อก");
      const materialStock = tableSection(
        page,
        "สต๊อกวัสดุ 7 รายการ (Material inventory)",
      );
      await expect(cell(materialStock, BOX, 2)).toHaveText("70 ชิ้น");
      await expect(cell(materialStock, BOX, 3)).toHaveText("500 ชิ้น");
      await expect(cell(materialStock, BOX, 5)).toHaveText("ใกล้หมด");
      await nav(page, "กรอกรายวัน");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ขายจากชิลยกมา 45 กล่อง ใช้จริง 4.5 กก. + น้ำพริก 20 หลอด · ฿16,350 ตามเมนู",
    async () => {
      await button(page, "บันทึกยอดขาย");
      // The lot picker counts the carried-in chill as usable.
      await expect(
        openDialog(page).getByLabel("Lot ต้นทาง").locator("option:checked"),
      ).toHaveText(/ · แช่แข็ง 230\.00 กก\. \/ คงเหลือชิล 4\.50 กก\.$/);
      await field(page, /กล่องมาตรฐาน/, "45");
      await field(page, /น้ำพริกหลอด · จำหน่ายแยก/, "20");
      await field(page, /น้ำหนักที่ใช้ไปจริงวันนี้/, "4.5");
      await field(page, /ยอดขาย LINE MAN/, "16350");
      await expect(openDialog(page)).toContainText("฿16,350.00");
      await saveEntry(page);
      await expect(
        cell(tableSection(page, /^เนื้อละลายวันนี้/), LOT, 5),
      ).toHaveText("0.00 กก.");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ปิดวันที่ 2 — ไม่ได้เบิกข้าวดิบ checklist จึงไม่มีข้าวช่วงเช้า · ยืนยันข้าวสุก 9 กก. → ปิดได้",
    async () => {
      const checklist = await openCloseDay(page);
      await expect(checklist).not.toContainText("ข้าวเหนียวช่วงเช้า");
      await expect(checklistStatus(checklist, "ยอดขายวันนี้")).toHaveText("✓");
      await expect(checklistStatus(checklist, "เช็ควัสดุ")).toHaveText("✓");
      await cancelDialog(page);
      await closeBlockedThenGo(
        page,
        "ยืนยันข้าวเหนียวสุกคงเหลือ",
        /ยังไม่ยืนยันข้าวเหนียวสุกคงเหลือ/,
      );
      // 6 carried + 12 bought − 45 × 0.2
      await confirmRiceLeft(page, "9");
      await closeDay(page, "ผู้ดูแลศาลาแดง", TODAY);
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: แท็บสต๊อก — สรุปคงเหลือ ณ วันที่ 1 (ย้อนหลัง) และวันนี้",
    async () => {
      await nav(page, "สต๊อก");
      await expect(
        page.getByRole("heading", {
          name: "สรุปคงเหลือเนื้อ รายวัน / รายล็อต",
        }),
      ).toBeVisible();
      const asOf = page.getByLabel("ยอด ณ สิ้นวันที่");
      await expect(asOf).toHaveValue(TODAY);
      await asOf.fill(DAY1);
      const byLot = tableSection(page, `คงเหลือแยก Lot · ${DAY1} · ศาลาแดง`);
      // รอรับ · รับเข้า · แช่แข็ง · ชิล · ใช้แล้ว · ชิลยกมา · ละลาย · ใช้จริง · เวสต์
      await expect(
        byLot.getByRole("row").filter({ hasText: LOT }),
      ).toContainText(
        /0\.00 กก\.\s*300\.00 กก\.\s*230\.00 กก\.\s*4\.50 กก\.\s*65\.50 กก\.\s*0\.00 กก\.\s*70\.00 กก\.\s*65\.50 กก\.\s*0\.00 กก\./,
      );
      await asOf.fill(TODAY);
      const todayLot = tableSection(
        page,
        `คงเหลือแยก Lot · ${TODAY} · ศาลาแดง`,
      );
      await expect(
        todayLot.getByRole("row").filter({ hasText: LOT }),
      ).toContainText(
        /0\.00 กก\.\s*300\.00 กก\.\s*230\.00 กก\.\s*0\.00 กก\.\s*70\.00 กก\.\s*4\.50 กก\.\s*0\.00 กก\.\s*4\.50 กก\.\s*0\.00 กก\./,
      );
      const history = tableSection(page, /^ย้อนหลัง \d+ วัน · ศาลาแดง/);
      await expect(
        history.getByRole("row").filter({ hasText: DAY1 }),
      ).toContainText(
        /0\.00 กก\.\s*70\.00 กก\.\s*65\.50 กก\.\s*0\.00 กก\.\s*4\.50 กก\./,
      );
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ประวัติ → ยอดขายวันที่ 1 (ปิดแล้ว) → ขอแก้ไข LINE MAN 219,600 → 219,000 · กระดิ่งขึ้นรอพิจารณา",
    async () => {
      await nav(page, "ประวัติ");
      await expect(page.locator("main")).toContainText("คำขอแก้ไขรายการ");
      const sale = page
        .getByRole("main")
        .locator("details")
        .filter({
          // Anchored: the request itself lists as "ขอแก้ไขรายการ · บันทึกยอดขาย / Waste".
          has: page
            .locator("summary")
            .filter({ hasText: /^บันทึกยอดขาย \/ Waste/ }),
        })
        .filter({ has: page.locator("summary").filter({ hasText: DAY1 }) });
      await expect(sale).toHaveCount(1);
      await pointAndClick(page, sale.locator("summary"));
      await pointAndClick(page, sale.getByRole("button", { name: "ขอแก้ไข" }));
      const lineMan = sale.getByLabel(/ยอดขาย LINE MAN/);
      await expect(lineMan).toHaveValue("219600");
      await lineMan.fill("219000");
      await sale.getByLabel("เหตุผลที่ขอแก้ไข").fill("พิมพ์ยอด LINE MAN ผิด");
      await pointAndClick(
        page,
        sale.getByRole("button", { name: "ส่งคำขอแก้ไข" }),
      );
      await expect(
        page.getByText("ส่งคำขอแก้ไขแล้ว รอ Owner พิจารณา"),
      ).toBeVisible();
      await expect(sale.locator("summary")).toContainText(
        "มีคำขอแก้ไขรอพิจารณา",
      );
      const bell = await openNotifications(page);
      await expect(bell).toContainText(
        `คำขอแก้ไขรอพิจารณา · บันทึกยอดขาย / Waste ${DAY1}`,
      );
      await closeNotifications(page);
    },
  );

  /* ---- Minburi (today): receive with a shortfall, both rice sources ---- */

  await step(
    page,
    "สาขามีนบุรี: รับของ — ไม่เห็นใบของศาลาแดง · รับ 199.5 จาก 200 + รับครบ → ต้องมีเหตุผลส่วนต่าง → ปิดใบ",
    async () => {
      await signInAs(page, ACCOUNTS.minburi);
      await expect(page.locator("main")).toContainText("งานเข้าใหม่ 1 Lot");
      const complete = await openReceive(page, "200.00", {
        sent: "200.00",
        received: "0.00",
      });
      await expect(
        openDialog(page).getByLabel("ใบจัดสรรที่รับ").locator("option").nth(1),
      ).not.toContainText("300.00");
      await expect(complete).toBeChecked();
      await field(page, /น้ำหนักรับเข้าสาขา/, "199.5");
      await submitAndExpectError(page, /กรอกเหตุผลส่วนต่าง/);
      await field(
        page,
        /เหตุผลส่วนต่าง \/ Waste \/ ข้าม FIFO/,
        "ขาด 0.5 กก. ตอนชั่งรับ",
      );
      await saveEntry(page);
      await expect(page.locator("main")).toContainText("ไม่มีรายการรอรับ");
      await nav(page, "สต๊อก");
      const stock = tableSection(page, "สต๊อกเนื้อ · มีนบุรี");
      await expect(cell(stock, LOT, 1)).toHaveText("-");
      await expect(cell(stock, LOT, 2)).toHaveText("199.50 กก.");
      await expect(cell(stock, LOT, 3)).toHaveText("199.50 กก.");
      await nav(page, "กรอกรายวัน");
    },
  );

  await step(
    page,
    "สาขามีนบุรี: ข้าวทั้งสองแบบ — นึ่งเอง ดิบ 5 → เบิก 5 → สุก 10 · ซื้อข้าวสุก 20 กก. (ต่ำกว่าฐาน 30 ไม่บล็อก)",
    async () => {
      const rice = tableSection(
        page,
        "ข้าวเหนียว · นึ่งเอง หรือซื้อข้าวสุกจากข้างนอก",
      );
      await expect(rice).toContainText("เบิกข้าวเหนียวดิบวันนี้");
      await expect(rice).toContainText("ข้าวเหนียวช่วงเช้า");
      await buyRice(page, "นึ่งเอง (ซื้อข้าวดิบ)", "5", "275");
      await cookRice(page, "5", "10");
      await buyRice(page, "ซื้อข้าวสุกจากข้างนอก", "20", "900");
    },
  );

  await step(
    page,
    "สาขามีนบุรี: แบ่งละลาย 2 กก. · ขาย 10 กล่อง ใช้จริง 1.0 เวสต์ 1.0 · LINE MAN 3,500 · เช็ควัสดุ",
    async () => {
      await openThaw(page, "199.50", "0.00");
      await field(page, /น้ำหนักละลาย/, "2");
      await field(page, /จำนวนกล่องรมควันที่ละลาย/, "1");
      await saveEntry(page);
      await button(page, "บันทึกยอดขาย");
      await field(page, /กล่องมาตรฐาน/, "10");
      await field(page, /น้ำหนักที่ใช้ไปจริงวันนี้/, "1");
      await field(page, /น้ำหนักเวสต์/, "1");
      await field(page, /ยอดขาย LINE MAN/, "3500");
      await field(
        page,
        /เหตุผลส่วนต่าง \/ Waste \/ ข้าม FIFO/,
        "Waste ปลายวัน มีนบุรี",
      );
      await saveEntry(page);
      await saveMaterials(page);
    },
  );

  await step(
    page,
    "สาขามีนบุรี: checklist ขาดข้าวสุกคงเหลือ → ไปกรอก 28 กก. → ปิดวัน",
    async () => {
      await closeBlockedThenGo(
        page,
        "ยืนยันข้าวเหนียวสุกคงเหลือ",
        /ยังไม่ยืนยันข้าวเหนียวสุกคงเหลือ/,
      );
      // 10 cooked + 20 bought − 10 × 0.2
      await confirmRiceLeft(page, "28");
      await closeDay(page, "ผู้ดูแลมีนบุรี", TODAY);
      await nav(page, "สรุปสาขา");
      await expect(cell(summary(page), "ยอดขาย LINE MAN", 1)).toHaveText(
        "3,500.00",
      );
      await expect(cell(summary(page), "ข้าวเหนียวสุกคงเหลือ", 1)).toHaveText(
        "28.00",
      );
      await expect(
        cell(summary(page), "น้ำพริกคงเหลือหลังหักยอดขาย", 1),
      ).toHaveText("20");
    },
  );

  /* ---- Owner: approve the edit request, unlock Saladaeng today ---- */

  await step(
    page,
    "Owner: กระดิ่ง คำขอแก้ไขรอพิจารณา 1 รายการ → Log → อนุมัติ",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      const bell = await openNotifications(page);
      await expect(bell).toContainText("คำขอแก้ไขรอพิจารณา 1 รายการ");
      await closeNotifications(page);
      await nav(page, "Log");
      await pointAndClick(
        page,
        page
          .getByRole("main")
          .getByRole("button", { name: "อนุมัติ", exact: true }),
      );
      await expect(
        page.getByText("อนุมัติคำขอแล้ว ระบบใช้ค่าใหม่คำนวณยอดทันที"),
      ).toBeVisible();
    },
  );

  await step(
    page,
    "Owner: E11 ปลดล็อกวันนี้ของศาลาแดง → รายงานรายวัน ศาลาแดง เปิดอยู่ · มีนบุรี ปิดแล้ว",
    async () => {
      await button(page, "รายงาน");
      await setWorkingDate(page, TODAY);
      await button(page, "ปลดล็อกวัน");
      await page
        .getByLabel(/สาขาที่ปลดล็อก/)
        .selectOption({ label: "ศาลาแดง" });
      await field(page, /เหตุผลปลดล็อก/, "สาขาลืมบันทึกยอดขายเพิ่ม");
      await saveEntry(page);
      const dailyReport = tableSection(page, "รายงานยอดขายรายวัน");
      const row = (branch: string, date: string) =>
        dailyReport
          .getByRole("row")
          .filter({ hasText: branch })
          .filter({ hasText: date });
      await expect(row("ศาลาแดง", TODAY).getByRole("cell").nth(7)).toHaveText(
        "เปิดอยู่",
      );
      await expect(row("ศาลาแดง", DAY1).getByRole("cell").nth(7)).toHaveText(
        "ปิดแล้ว",
      );
      await expect(row("มีนบุรี", TODAY).getByRole("cell").nth(7)).toHaveText(
        "ปิดแล้ว",
      );
      // The approved edit: day 1 LINE MAN is 219,000 now.
      await expect(row("ศาลาแดง", DAY1).getByRole("cell").nth(6)).toHaveText(
        "219,000.00",
      );
    },
  );

  await step(
    page,
    "Owner: E9 แดชบอร์ดแจ้งวัสดุใกล้หมดของศาลาแดง (70 < 20% ของฐาน 500)",
    async () => {
      await button(page, "แดชบอร์ด");
      await button(page, "ดูรายละเอียด");
      await expect(page.locator("main")).toContainText(`วัสดุใกล้หมด: ${BOX}`);
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: กระดิ่งขึ้น คำขอแก้ไขสำเร็จ · สรุปวันที่ 1 ใช้ค่าใหม่ 219,000",
    async () => {
      await signInAs(page, ACCOUNTS.saladaeng);
      const bell = await openNotifications(page);
      await expect(bell).toContainText(
        `คำขอแก้ไขสำเร็จ · บันทึกยอดขาย / Waste ${DAY1}`,
      );
      await closeNotifications(page);
      await setWorkingDate(page, DAY1);
      await nav(page, "สรุปสาขา");
      await expect(cell(summary(page), "ยอดขาย LINE MAN", 1)).toHaveText(
        "219,000.00",
      );
      await nav(page, "กรอกรายวัน");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: E11 หลังปลดล็อก ละลาย 0.2 กก. ขายเพิ่ม 2 กล่อง 700 บาท และปิดวันอีกครั้ง",
    async () => {
      await setWorkingDate(page, TODAY);
      await expect(page.locator("main")).not.toContainText(
        "ถูกล็อก แก้ไขไม่ได้",
      );
      await openThaw(page, "230.00", "0.00");
      await field(page, /น้ำหนักละลาย/, "0.2");
      await field(page, /จำนวนกล่องรมควันที่ละลาย/, "1");
      await saveEntry(page);
      await button(page, "บันทึกยอดขาย");
      await field(page, /กล่องมาตรฐาน/, "2");
      await field(page, /น้ำหนักที่ใช้ไปจริงวันนี้/, "0.2");
      await field(page, /ยอดขาย LINE MAN/, "700");
      await saveEntry(page);
      await closeDay(page, "ผู้ดูแลศาลาแดง", TODAY);
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: E12 สต๊อก — เนื้อ 229.80 แช่แข็ง / 0 ชิล · ข้าวดิบ 40 · ข้าวสุก 8.60 · น้ำพริก 30 · กล่อง 70",
    async () => {
      await nav(page, "สต๊อก");
      const stock = tableSection(page, "สต๊อกเนื้อ · ศาลาแดง");
      await expect(cell(stock, LOT, 3)).toHaveText("229.80 กก.");
      await expect(cell(stock, LOT, 4)).toHaveText("0.00 กก.");
      const supply = tableSection(
        page,
        "สต๊อกข้าวเหนียวและน้ำพริก (Rice & chili inventory)",
      );
      await expect(cell(supply, "ศาลาแดง", 1)).toHaveText("40.00 กก.");
      await expect(cell(supply, "ศาลาแดง", 2)).toHaveText("0.00 กก.");
      await expect(cell(supply, "ศาลาแดง", 3)).toHaveText("8.60 กก.");
      await expect(cell(supply, "ศาลาแดง", 4)).toHaveText("50.00 หลอด");
      await expect(cell(supply, "ศาลาแดง", 5)).toHaveText("30.00 หลอด");
      const materialStock = tableSection(
        page,
        "สต๊อกวัสดุ 7 รายการ (Material inventory)",
      );
      await expect(cell(materialStock, BOX, 2)).toHaveText("70 ชิ้น");
    },
  );

  await step(
    page,
    "Owner: E11 รายงาน — ยอดขายสะสม ศาลาแดง 236,050 · มีนบุรี 3,500 · รวม 239,550 ทุกวันปิดแล้ว",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await button(page, "รายงาน");
      const byBranch = tableSection(page, "ยอดขายสะสมแยกสาขา");
      // 600 + 45 + 2 boxes; 219,000 (edited) + 16,350 + 700
      await expect(cell(byBranch, "ศาลาแดง", 1)).toHaveText("647");
      await expect(cell(byBranch, "ศาลาแดง", 5)).toHaveText("236,050.00");
      await expect(cell(byBranch, "มีนบุรี", 1)).toHaveText("10");
      await expect(cell(byBranch, "มีนบุรี", 5)).toHaveText("3,500.00");
      await expect(
        cell(tableSection(page, "สรุปผลรวม"), "ยอดขาย LINE MAN", 1),
      ).toHaveText("239,550.00");
      const dailyReport = tableSection(page, "รายงานยอดขายรายวัน");
      await expect(dailyReport).not.toContainText("เปิดอยู่");
    },
  );

  await step(
    page,
    "Owner: E12 สต๊อกของทั้งหมด ตรงกับหน้าสต๊อกของสาขา (เนื้อ ข้าว น้ำพริก วัสดุ)",
    async () => {
      await button(page, "สต๊อกของทั้งหมด");
      const all = tableSection(page, "ตารางสต๊อกทั้งหมด (All inventory)");
      /** The table pages at 20 rows and the purchase PO adds its own, so narrow it
       * to the location first. The sort select's name lists "สถานที่" too. */
      const cellOf = async (
        item: string | RegExp,
        location: string,
        index = 3,
      ) => {
        await all
          .getByRole("combobox", { name: /^สถานที่/ })
          .selectOption(location);
        return all
          .getByRole("row")
          .filter({ hasText: item })
          .filter({ hasText: location })
          .getByRole("cell")
          .nth(index);
      };
      const smoked = /S\d{6}-\d{3} · เนื้อรมควัน/;
      await expect(await cellOf(smoked, "คลังกลาง")).toHaveText("0.00");
      await expect(await cellOf(smoked, "ศาลาแดง")).toHaveText("229.80");
      await expect(await cellOf(smoked, "ศาลาแดง", 5)).toContainText(
        "แช่แข็ง 229.80",
      );
      await expect(await cellOf(smoked, "มีนบุรี")).toHaveText("197.50");
      await expect(
        await cellOf("ข้าวเหนียวดิบ (ข้าวสาร)", "ศาลาแดง"),
      ).toHaveText("40.00");
      await expect(await cellOf("ข้าวเหนียวสุก", "ศาลาแดง")).toHaveText("8.60");
      await expect(await cellOf("ข้าวเหนียวสุก", "มีนบุรี")).toHaveText(
        "28.00",
      );
      await expect(await cellOf("น้ำพริกหลอด", "ศาลาแดง")).toHaveText("30.00");
      await expect(await cellOf("น้ำพริกหลอด", "มีนบุรี")).toHaveText("20.00");
      await expect(await cellOf("น้ำพริกหลอด", "คลัง Owner")).toHaveText(
        "30.00",
      );
      await expect(await cellOf(BOX, "ศาลาแดง")).toHaveText("70.00");
      await expect(await cellOf(BOX, "คลัง Owner")).toHaveText("100.00");
    },
  );
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
  await step(
    page,
    "สาขาศาลาแดง: เปิดวันก่อนช่วง sample (วันนี้ปิดแล้วใน sample) และเปิดฟอร์มยอดขาย",
    async () => {
      await setWorkingDate(page, openDayBeforeSample());
      await pointAndClick(page, rowButton(page, "บันทึกยอดขาย / Waste"));
      await expect(openDialog(page)).toBeVisible();
    },
  );
  await step(
    page,
    "สาขาศาลาแดง: E2E-E1 ช่องตรวจนับน้ำพริกจริงปลายวันต้องว่าง",
    async () => {
      await expect(
        openDialog(page).getByLabel(/ตรวจนับน้ำพริกจริงปลายวัน/),
      ).toHaveValue("");
    },
  );
});

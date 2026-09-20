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

/* Lane D (vault: Testing/E2E Full System/17-09-2026/Plan.md §5): 500 kg reaches
 * Chef House → trimmed to 480 before smoking → round 1: 240 in, bags 120 + 118,
 * waste 2 → round 2: 240 in, bags 80 + 80 + 78, waste 2 → Edit round 2 to bags
 * 80 + 80 + 77, waste 3 (475 kg, 5 bags) → close lot → return 475 → Foodiva
 * receives 474 → central 474, bags pro-rated by 474 / 475. Every negative case
 * expects the exact message mutate() throws in src/lib/store.ts. */

test.skip(
  process.env.NEXT_PUBLIC_LOCAL_DB !== "1",
  "local sign-in (<account>@local.test) only exists in pnpm test:e2e:local",
);

const dialog = (page: Page) => page.getByRole("dialog").last();
/** role=alert also matches Next's route announcer and page banners, so scope + text. */
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

/** Sidebar tab by label, so a same-named button in <main> is never hit. */
const tab = (page: Page, label: string) =>
  pointAndClick(page, menuItem(page, label));

/** The `<tr>` of a table card that mentions `text`. */
const rowIn = (page: Page, title: string | RegExp, text: string | RegExp) =>
  tableSection(page, title).getByRole("row").filter({ hasText: text });

/** ChefLotEditForm's inputs are plain controlled inputs without a live preview:
 * fill() sets the whole value at once ("80\n80\n77" in the bag textarea). */
async function setValue(scope: Locator, label: string | RegExp, value: string) {
  const input = scope.getByLabel(label).last();
  await input.fill(value);
  await expect(input).toHaveValue(value);
}

const LOTS = "รายการ Lot ทั้งหมด";
const SMOKE_LOG = /^Log Lot สโมครายวัน/;

/** One cell of the single lot row in Chef House "งานผลิต" (columns in ChefLotTable). */
const chefLotCell = (page: Page, index: number) =>
  tableSection(page, LOTS).locator("tbody tr").first().getByRole("cell").nth(index);

/** Walks the lot to stage "ก่อนสโมค": 500 kg ordered, invoiced, shipped and weighed in. */
async function reachPreSmoke(page: Page) {
  await step(page, "Owner: สร้าง PO เนื้อ 500 กก.", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await ownerCreatesMeatPo(page, "500");
  });
  await step(page, "Foodiva: ออก Invoice 500 กก. พร้อมส่ง Chef House ทั้งหมด", async () => {
    await signInAs(page, ACCOUNTS.foodiva);
    await foodivaIssuesInvoice(page, "500");
  });
  await step(page, "Owner: ออก PO รมควัน 500 กก.", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await ownerIssuesSmokePo(page, "500");
  });
  await step(page, "Chef House: ยืนยันรับ PO รมควัน และ Submit ใบวางบิล", async () => {
    await signInAs(page, ACCOUNTS.chef);
    await tab(page, "งานผลิต");
    await button(page, "ยืนยันรับ PO รมควัน");
    await field(page, /ชื่อผู้รับ PO/, "หัวหน้าผลิต Chef House");
    await saveEntry(page);
    await button(page, "สร้าง / Submit ใบวางบิล");
    await field(page, /เลข Invoice ค่ารมควัน/, "CH-INV-001");
    await dialog(page).locator('input[type="file"]').setInputFiles(INVOICE_FIXTURE);
    await field(page, /รายละเอียดเพิ่มเติม/, "ค่าบริการรมควันเนื้อ 500 กก.");
    await button(page, "Submit ใบวางบิล");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
  await step(page, "Owner: ตรวจยอด ชำระ 110,000 และทำใบขนส่งขาไป 500 กก.", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await tab(page, "ใบ Invoice");
    await button(page, "ตรวจยอด");
    await field(page, /ชื่อผู้ตรวจ/, "Owner Demo");
    await saveEntry(page);
    await button(page, "ชำระเงิน");
    await field(page, /ยอดชำระ/, "110000");
    await field(page, /ผู้ดำเนินการชำระ/, "Owner Demo");
    await field(page, /เลขอ้างอิงการชำระ/, "PAY-001");
    await saveEntry(page);
    await tab(page, "ใบขนส่ง");
    await button(page, "ทำใบขนส่งขาไป");
    await field(page, /เวลารถรับ/, "06:30");
    await field(page, /ประเภทรถ/, "รถห้องเย็น");
    await field(page, /ทะเบียนรถ/, "กท 1001");
    await field(page, /ชื่อคนขับ/, "คนขับทดสอบ");
    await field(page, /เบอร์ติดต่อคนขับ/, "0811111111");
    await field(page, /น้ำหนักที่ส่งเที่ยวนี้/, "500");
    await saveEntry(page);
  });
  await step(page, "Chef House: ยืนยันรับเนื้อ 500 กก. → stage ก่อนสโมค", async () => {
    await signInAs(page, ACCOUNTS.chef);
    await tab(page, "ยืนยันรับเนื้อ");
    await pointAndClick(
      page,
      tableSection(page, "Lot ที่รอยืนยันรับ").getByRole("button", {
        name: "ยืนยันรับเนื้อ",
      }),
    );
    await page.getByLabel(/เวลาที่รถมาถึง/).selectOption({ label: "08:00" });
    await field(page, /น้ำหนักรับจริง/, "500");
    await saveEntry(page);
    await tab(page, "งานผลิต");
    await expect(chefLotCell(page, 3)).toHaveText("500.00 กก.");
    await expect(chefLotCell(page, 4)).toHaveText("ก่อนสโมค");
  });
}

/** Fills one smoke round; `bags` go into "น้ำหนักถุงที่ n", adding rows as needed. */
async function fillSmokeRound(
  page: Page,
  inputKg: string,
  wasteKg: string,
  bags: string[],
) {
  const open = dialog(page);
  await field(page, /น้ำหนักเข้าเตารอบนี้/, inputKg);
  await setValue(open, /น้ำหนัก Waste/, wasteKg);
  for (const [index, weight] of bags.entries()) {
    const label = `น้ำหนักถุงที่ ${index + 1}`;
    if ((await open.getByLabel(label, { exact: true }).count()) === 0)
      await pointAndClick(page, open.getByRole("button", { name: "เพิ่มถุง" }));
    await setValue(open, label, weight);
  }
}

test("D1–D11 Chef House ผลิต → กลับสต๊อกกลาง: รับ 500 → ก่อนสโมค 480 → สโมค 2 รอบ 476 → Edit 475 → ปิด Lot → ขากลับ 475 → Foodiva 474 → สต๊อกกลาง 474", async ({
  page,
}) => {
  test.setTimeout(20 * 60_000);
  await startFresh(page);
  await reachPreSmoke(page);

  await step(page, "Chef House: D1 น้ำหนักก่อนสโมค 520 เกินรับจริง → บล็อก · 480 → ผ่าน", async () => {
    await button(page, "น้ำหนักก่อนสโมค");
    await expect(dialog(page)).toContainText("500.00 กก.");
    await field(page, /น้ำหนักหลังแกะซับ/, "520");
    await submitAndExpectError(page, "น้ำหนักก่อนสโมคเกินน้ำหนักรับ");
    await field(page, /น้ำหนักหลังแกะซับ/, "480");
    await saveEntry(page);
    await expect(chefLotCell(page, 4)).toHaveText("บันทึกสโมค");
    await expect(
      chefLotCell(page, 7).getByRole("button", { name: "บันทึก Lot สโมครายวัน" }),
    ).toBeVisible();
  });

  await step(page, "Chef House: D2 บันทึก Lot สโมครายวัน รอบ 1 — negative ทุกกติกา แล้ว 240 = 120 + 118 + waste 2", async () => {
    await button(page, "บันทึก Lot สโมครายวัน");
    // Bags + waste must add up to what went into the smoker.
    await fillSmokeRound(page, "240", "2", ["120", "120"]);
    await submitAndExpectError(page, "น้ำหนักถุงรวมและ Waste ต้องเท่ากับน้ำหนักเข้าเตา");
    // A zero bag is refused before the totals are compared.
    await setValue(dialog(page), "น้ำหนักถุงที่ 2", "0");
    await submitAndExpectError(page, "น้ำหนักถุงใหญ่จาก Chef House ต้องมากกว่า 0 กก.");
    // More into the smoker than is waiting (480) is refused.
    await fillSmokeRound(page, "600", "362", ["120", "118"]);
    await submitAndExpectError(page, "น้ำหนักเข้าเตาเกินน้ำหนักรอผลิต");
    // Blank input weight.
    await setValue(dialog(page), /น้ำหนักเข้าเตารอบนี้/, "");
    await submitAndExpectError(page, "กรอกน้ำหนักเข้าเตาเป็นตัวเลขมากกว่าศูนย์");
    await fillSmokeRound(page, "240", "2", ["120", "118"]);
    await expect(dialog(page)).toContainText("ส่งกลับกรุงเทพฯ 2 ถุง · น้ำหนักรวม 238.00 กก.");
    await saveEntry(page);

    const round = rowIn(page, SMOKE_LOG, "240.00 กก.");
    await expect(round).toHaveCount(1);
    await expect(round).toContainText("2 ถุง · 120.00 × 1 + 118.00 × 1 กก.");
    await expect(round.getByRole("cell").nth(5)).toHaveText("238.00 กก.");
    await expect(round.getByRole("cell").nth(6)).toHaveText("2.00 กก.");
    await expect(round.getByRole("cell").nth(7)).toHaveText("240.00 กก.");
    await expect(chefLotCell(page, 5)).toHaveText("238.00 กก.");
    await expect(chefLotCell(page, 6)).toHaveText("2 ถุง");
  });

  await step(page, "Chef House: D3 หลังรอบ 1 (240 จาก 480) ยังปิด Lot ไม่ได้ — ปุ่ม ยืนยันปิด Lot ไม่มี stage ยังบันทึกสโมค", async () => {
    // closeLot is stage-guarded (stage 5) and the action cell only offers the next round.
    await expect(chefLotCell(page, 4)).toHaveText("บันทึกสโมค");
    await expect(page.getByRole("button", { name: "ยืนยันปิด Lot" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit ข้อมูลก่อนปิด Lot" })).toHaveCount(0);
    await expect(
      chefLotCell(page, 7).getByRole("button", { name: "บันทึก Lot สโมครายวัน" }),
    ).toBeVisible();
  });

  await step(page, "Chef House: D4 รอบ 2 เข้าเตา 240 ถุง 80 + 80 + 78 waste 2 → 5 ถุง 476 กก. stage ปิด Lot", async () => {
    await button(page, "บันทึก Lot สโมครายวัน");
    await expect(dialog(page)).toContainText("240.00 กก.");
    await fillSmokeRound(page, "240", "2", ["80", "80", "78"]);
    await saveEntry(page);
    await expect(tableSection(page, SMOKE_LOG).getByRole("heading")).toHaveText(
      "Log Lot สโมครายวัน 2 รอบ",
    );
    await expect(
      rowIn(page, SMOKE_LOG, "3 ถุง · 80.00 × 2 + 78.00 × 1 กก.").getByRole("cell").nth(7),
    ).toHaveText("0.00 กก.");
    await expect(chefLotCell(page, 4)).toHaveText("ปิด Lot");
    await expect(chefLotCell(page, 5)).toHaveText("476.00 กก.");
    await expect(chefLotCell(page, 6)).toHaveText("5 ถุง");
    await expect(menuItem(page, "งานผลิต")).toHaveText(/งานผลิต\s*1$/);
  });

  await step(page, "Chef House: D4 หน้า สต๊อก แสดงก่อนสโมค 480 รอผลิต 0 หลังรม 476", async () => {
    await tab(page, "สต๊อก");
    const row = tableSection(page, "สต๊อกและงานผลิต Chef House").locator("tbody tr").first();
    await expect(row.getByRole("cell").nth(1)).toHaveText("480.00 กก.");
    await expect(row.getByRole("cell").nth(2)).toHaveText("0.00 กก.");
    await expect(row.getByRole("cell").nth(3)).toHaveText("476.00 กก.");
    await expect(row.getByRole("cell").nth(4)).toHaveText("ปิด Lot");
    await tab(page, "งานผลิต");
  });

  await step(page, "Chef House: D5 Edit ข้อมูลก่อนปิด Lot — negative ทุกกติกา", async () => {
    await button(page, "Edit ข้อมูลก่อนปิด Lot");
    const edit = dialog(page);
    await expect(edit.getByRole("heading", { name: "Edit ข้อมูลก่อนปิด Lot" })).toBeVisible();
    await expect(edit.getByLabel("น้ำหนักรับจริง (กก.)")).toHaveValue("500");
    await expect(edit.getByLabel("น้ำหนักก่อนสโมค (กก.)")).toHaveValue("480");
    await expect(edit).toContainText("ยอดตรงกัน พร้อมปิด Lot");

    await setValue(edit, "น้ำหนักก่อนสโมค (กก.)", "510");
    await submitAndExpectError(page, "น้ำหนักก่อนสโมคมากกว่าน้ำหนักรับจริง");

    await setValue(edit, "น้ำหนักก่อนสโมค (กก.)", "470");
    await expect(edit).toContainText("ยอดยังไม่ตรง");
    await submitAndExpectError(page, "ก่อนปิด Lot น้ำหนักเข้าเตารวมจาก Log ต้องเท่ากับน้ำหนักก่อนสโมค");
    await setValue(edit, "น้ำหนักก่อนสโมค (กก.)", "480");

    await setValue(edit, "น้ำหนัก Waste รอบ 2", "3");
    await submitAndExpectError(page, "น้ำหนักถุงรวมและ Waste ต้องเท่ากับน้ำหนักเข้าเตา");

    await setValue(edit, "น้ำหนักถุงใหญ่ รอบ 2", "80\n80\n0");
    await submitAndExpectError(page, "กรอกน้ำหนักถุงใหญ่ให้ครบและมากกว่า 0 ทุกรอบ");

    await setValue(edit, "น้ำหนักเข้าเตา รอบ 2", "");
    await submitAndExpectError(page, "กรอกวันที่ น้ำหนักเข้าเตา และ Waste ให้ครบทุกรอบ");
  });

  await step(page, "Chef House: D5 Edit รอบ 2 waste 3 ถุง 80 + 80 + 77 → หลังรมรวม 475 กก. 5 ถุง", async () => {
    const edit = dialog(page);
    await setValue(edit, "น้ำหนักเข้าเตา รอบ 2", "240");
    await setValue(edit, "น้ำหนักถุงใหญ่ รอบ 2", "80\n80\n77");
    await setValue(edit, "น้ำหนัก Waste รอบ 2", "3");
    await saveEntry(page);
    await expect(chefLotCell(page, 4)).toHaveText("ปิด Lot");
    await expect(chefLotCell(page, 5)).toHaveText("475.00 กก.");
    await expect(chefLotCell(page, 6)).toHaveText("5 ถุง");
    const round2 = rowIn(page, SMOKE_LOG, "80.00 × 2 + 77.00 × 1");
    await expect(round2.getByRole("cell").nth(5)).toHaveText("237.00 กก.");
    await expect(round2.getByRole("cell").nth(6)).toHaveText("3.00 กก.");
  });

  await step(page, "Owner: D5 Log เนื้อคงเหลือ แสดงรอบ 2 หลังรม 237 Waste 3 และ Waste ก่อนสโมค 20 กก.", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await tab(page, "Log เนื้อคงเหลือ");
    const smokeRows = page.getByRole("row").filter({ hasText: "สโมครอบ" });
    await expect(smokeRows).toHaveCount(2);
    await expect(
      smokeRows.filter({ hasText: "เข้าเตา 240.00 · หลังรม 237.00 · Waste 3.00 กก." }),
    ).toHaveCount(1);
    await expect(
      smokeRows.filter({ hasText: "เข้าเตา 240.00 · หลังรม 238.00 · Waste 2.00 กก." }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("row").filter({ hasText: "Chef House · Waste ก่อนสโมค" }),
    ).toContainText("20.00 กก.");
    await expect(
      page.getByRole("row").filter({ hasText: "Chef House · รอเข้ารอบสโมค" }),
    ).toContainText("0.00 กก.");
  });

  await step(page, "Chef House: D6 ยืนยันปิด Lot → stage ขนส่ง Chef House → Foodiva · ปุ่ม Edit หาย · count pill งานผลิตหมด", async () => {
    await signInAs(page, ACCOUNTS.chef);
    await tab(page, "งานผลิต");
    await button(page, "ยืนยันปิด Lot");
    await expect(dialog(page)).toContainText("475.00 กก.");
    await expect(dialog(page)).toContainText("5 ถุง");
    await submitAndExpectError(page, "กรอกชื่อผู้ยืนยัน");
    await field(page, /ชื่อผู้ยืนยันปิด Lot/, "หัวหน้าผลิต Chef House");
    await saveEntry(page);
    await expect(chefLotCell(page, 4)).toHaveText("ขนส่ง Chef House → Foodiva");
    // Edit is stage-5-only in mutate() ("แก้ไขได้เฉพาะก่อนยืนยันปิด Lot"); the UI no longer offers it.
    await expect(page.getByRole("button", { name: "Edit ข้อมูลก่อนปิด Lot" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "ยืนยันปิด Lot" })).toHaveCount(0);
    await expect(menuItem(page, "งานผลิต")).toHaveText(/^งานผลิต$/);
  });

  await step(page, "Foodiva: D8 ก่อน Owner เรียกรถขากลับ ไม่มีรายการให้ยืนยันรับเข้าตู้", async () => {
    await signInAs(page, ACCOUNTS.foodiva);
    await expect(
      tableSection(page, "เนื้อรมควันรอ Foodiva รับเข้าตู้").getByRole("button", {
        name: "ยืนยันรับเข้าตู้",
      }),
    ).toHaveCount(0);
  });

  await step(page, "Owner: D7 ก่อนเรียกรถขากลับ ยังรับเข้าสต๊อกกลางไม่ได้", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await tab(page, "รับเนื้อเข้าสต๊อกกลาง");
    await expect(page.getByRole("main")).toContainText("ไม่มี Lot รอรับเข้าสต๊อกกลางในขณะนี้");
    await expect(page.getByRole("main").getByRole("button", { name: "รับเข้าสต๊อกกลาง" })).toHaveCount(0);
  });

  await step(page, "Owner: D7 เรียกรถขากลับ ต้นทาง = ปลายทาง → บล็อก · 480 เกินผลผลิต 475 → บล็อก · 475 → ผ่าน", async () => {
    await tab(page, "ใบขนส่ง");
    await button(page, "เรียกรถขากลับ · 475.00 กก.");
    await expect(dialog(page)).toContainText("5 ถุง · 475.00 กก.");
    await field(page, /เวลารถรับ/, "09:00");
    await field(page, /ประเภทรถ/, "รถห้องเย็น");
    await field(page, /ทะเบียนรถ/, "กท 1002");
    await field(page, /ชื่อคนขับ/, "คนขับขากลับ");
    await field(page, /เบอร์ติดต่อคนขับ/, "0822222222");
    await field(page, /น้ำหนักส่งจาก Chef House/, "475");
    await dialog(page).getByLabel(/ปลายทาง/).selectOption({ label: "เชียงใหม่" });
    await submitAndExpectError(page, "ต้นทางและปลายทางต้องต่างกัน");
    await dialog(page).getByLabel(/ปลายทาง/).selectOption({ label: "กรุงเทพฯ" });
    await field(page, /น้ำหนักส่งจาก Chef House/, "480");
    await submitAndExpectError(page, "น้ำหนักส่งกลับเกินผลผลิต");
    await field(page, /น้ำหนักส่งจาก Chef House/, "475");
    await saveEntry(page);
    const row = tableSection(page, "รายการขนส่งตาม Lot").locator("tbody tr").first();
    await expect(row).toContainText("กท 1002");
    await expect(row).toContainText("รอ Foodiva รับเข้าตู้");
  });

  await step(page, "Owner: D7 หลังเรียกรถ ก่อน Foodiva ยืนยันรับ ยังรับเข้าสต๊อกกลางไม่ได้", async () => {
    await tab(page, "รับเนื้อเข้าสต๊อกกลาง");
    await expect(page.getByRole("main")).toContainText("ไม่มี Lot รอรับเข้าสต๊อกกลางในขณะนี้");
  });

  await step(page, "Foodiva: D10 รับ 300 จาก 475 (ส่วนต่างเกิน 20 %) ต้องกรอกเหตุผล · D8 รับ 474 ส่วนต่าง 1 → ผ่านโดยไม่ต้องมีเหตุผล", async () => {
    await signInAs(page, ACCOUNTS.foodiva);
    const waiting = rowIn(page, "เนื้อรมควันรอ Foodiva รับเข้าตู้", "กท 1002");
    await expect(waiting).toContainText("475.00 กก.");
    await pointAndClick(page, waiting.getByRole("button", { name: "ยืนยันรับเข้าตู้" }));
    await field(page, /เวลารับ/, "10:00");
    await field(page, /น้ำหนักรับจริง/, "300");
    await field(page, /จำนวนถุงที่รับ/, "5");
    await submitAndExpectError(page, "กรอกเหตุผลส่วนต่าง");
    await field(page, /น้ำหนักรับจริง/, "474");
    await saveEntry(page);
    await expect(
      tableSection(page, "เนื้อรมควันรอ Foodiva รับเข้าตู้").getByRole("button", {
        name: "ยืนยันรับเข้าตู้",
      }),
    ).toHaveCount(0);
  });

  await step(page, "Owner: D9 รับเข้าสต๊อกกลาง 300 → ต้องกรอกเหตุผล · 474 → สต๊อกกลาง 474 กก. 5 ถุง stage จัดสรร / ขาย", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await tab(page, "รับเนื้อเข้าสต๊อกกลาง");
    const waiting = tableSection(page, "Lot ที่รอรับเข้าสต๊อกกลาง").locator("tbody tr").first();
    await expect(waiting).toContainText("474.00 กก.");
    await expect(waiting).toContainText("5 ถุง");
    await pointAndClick(page, waiting.getByRole("button", { name: "รับเข้าสต๊อกกลาง" }));
    await expect(dialog(page)).toContainText("474.00 กก.");
    await field(page, /น้ำหนักรับสต๊อกกลาง/, "300");
    await submitAndExpectError(page, "กรอกเหตุผลส่วนต่าง");
    await field(page, /น้ำหนักรับสต๊อกกลาง/, "474");
    await saveEntry(page);
    await expect(page.getByRole("main")).toContainText("ไม่มี Lot รอรับเข้าสต๊อกกลางในขณะนี้");

    await tab(page, "สต๊อกของทั้งหมด");
    const stock = rowIn(page, "ตารางสต๊อกทั้งหมด (All inventory)", "เนื้อรมควัน").filter({
      hasText: "คลังกลาง",
    });
    await expect(stock.getByRole("cell").nth(3)).toHaveText("474.00");
    await expect(stock.getByRole("cell").nth(5)).toContainText("5 ถุง พร้อมจัดสรร");
  });

  await step(page, "Owner: D9 ถุงทุกใบถูก pro-rate ตามสต๊อกกลาง 474 / 475 และทุกใบ > 0", async () => {
    await tab(page, "จัดสรรเนื้อ และสต๊อกไปสาขา");
    const lot = rowIn(page, "สต๊อกเนื้อทุกจุด (Meat inventory)", /F\d{6}-\d{3}/);
    await expect(lot.getByRole("cell").nth(2)).toHaveText("474.00 กก.");
    await expect(lot.getByRole("cell").nth(3)).toHaveText("5 ถุง");
    await expect(lot.getByRole("cell").nth(6)).toHaveText("จัดสรร / ขาย");
    await pointAndClick(page, page.getByRole("main").getByRole("button", { name: "จัดสรร", exact: true }));
    const allocation = dialog(page);
    const expected = ["119.75", "117.75", "79.83", "79.83", "76.84"];
    for (const [index, kg] of expected.entries()) {
      await expect(
        allocation.getByRole("row").filter({
          has: page.getByRole("cell", { name: `ถุงที่ ${index + 1}`, exact: true }),
        }),
      ).toContainText(`${kg} กก.`);
    }
    await expect(allocation.getByRole("combobox", { name: /^เลือกสาขาให้ถุงที่/ })).toHaveCount(5);
    await cancelDialog(page);

    await tab(page, "Log เนื้อคงเหลือ");
    const central = page.getByRole("row").filter({ hasText: "คลังกลาง Owner" }).filter({ hasText: "ถุง พร้อมจัดสรร" });
    await expect(central).toContainText("474.00 กก.");
    await expect(central).toContainText("5 ถุง พร้อมจัดสรร");
    await expect(
      page.getByRole("row").filter({ hasText: "Foodiva · เนื้อรมควัน" }),
    ).toContainText("0.00 กก.");
  });

  await step(page, "Owner: D11 เอกสารและ Traceability แสดงทุกก้าวผลิตของ Lot", async () => {
    await tab(page, "เอกสารและ Traceability");
    await pointAndClick(page, page.getByRole("button", { name: "ดู", exact: true }));
    const row = (label: string) => page.getByRole("row").filter({ hasText: label }).last();
    const smokeRows = page.getByRole("row").filter({ hasText: /^Lot สโมครายวัน/ });
    await expect(smokeRows).toHaveCount(2);
    await expect(
      smokeRows.filter({ hasText: "เข้าเตา 240.00 กก. · หลังรม 237.00 กก. · Waste 3.00 กก. · 3 ถุง" }),
    ).toHaveCount(1);
    await expect(
      smokeRows.filter({ hasText: "เข้าเตา 240.00 กก. · หลังรม 238.00 กก. · Waste 2.00 กก. · 2 ถุง" }),
    ).toHaveCount(1);
    await expect(row("ผลผลิตหลังรม")).toContainText("475.00 กก. · 5 ถุง");
    await expect(row("ใบขนส่งกลับ Foodiva")).toContainText("475.00 กก.");
    await expect(row("Foodiva รับเข้าตู้")).toContainText("474.00 กก. · 5 ถุง");
    await expect(row("รับเข้าสต๊อกกลาง")).toContainText("474.00 กก.");
  });

  await step(page, "Owner: D11 รายงาน ต้นทุนแยก Lot = เนื้อ 125,000 + รม 110,000 + รถ 2,400 = 237,400 · 500.84 บาท/กก. (หาร 474)", async () => {
    await tab(page, "รายงาน");
    const cost = rowIn(page, "ต้นทุนแยก Lot", /F\d{6}-\d{3}/);
    const cells = cost.getByRole("cell");
    await expect(cells.nth(1)).toHaveText("จัดสรร / ขาย");
    await expect(cells.nth(2)).toHaveText("125,000.00");
    await expect(cells.nth(3)).toHaveText("110,000.00");
    await expect(cells.nth(4)).toHaveText("2,400.00");
    await expect(cells.nth(5)).toHaveText("237,400.00");
    await expect(cells.nth(6)).toHaveText("500.84");
  });
});

test("E2E-D1: Edit ข้อมูลก่อนปิด Lot น้ำหนักรับจริง 0 ต้องขึ้นข้อความ กรอกน้ำหนักให้ถูกต้อง ในฟอร์ม ไม่ใช่ bubble ของเบราว์เซอร์ (D5)", async ({
  page,
}) => {
  test.setTimeout(10 * 60_000);
  await startFresh(page);
  await reachPreSmoke(page);
  await step(page, "Chef House: ก่อนสโมค 480 · สโมครอบเดียว 480 = 478 + waste 2 → stage ปิด Lot", async () => {
    await button(page, "น้ำหนักก่อนสโมค");
    await field(page, /น้ำหนักหลังแกะซับ/, "480");
    await saveEntry(page);
    await button(page, "บันทึก Lot สโมครายวัน");
    await fillSmokeRound(page, "480", "2", ["478"]);
    await saveEntry(page);
    await expect(chefLotCell(page, 4)).toHaveText("ปิด Lot");
  });
  await step(page, "Chef House: Edit น้ำหนักรับจริง 0 → ข้อความในฟอร์ม", async () => {
    await button(page, "Edit ข้อมูลก่อนปิด Lot");
    await setValue(dialog(page), "น้ำหนักรับจริง (กก.)", "0");
    await submitAndExpectError(page, "กรอกน้ำหนักให้ถูกต้อง");
  });
});

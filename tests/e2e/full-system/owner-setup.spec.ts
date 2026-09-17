import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  field,
  loadSampleData,
  menuItem,
  ownerCreatesMeatPo,
  pointAndClick,
  saveEntry,
  signInAs,
  startFresh,
  step,
  tableSection,
} from "../helpers";

/* Lane B (vault: Testing/E2E Full System/17-09-2026/Plan.md §5): Owner settings
 * (every section, validation, persistence across sign-in), the Owner warehouse
 * (materials, chili, other purchases), transfers the branches confirm, Owner
 * expenses, unlocking a closed day, voiding from the Log and the notification
 * bell. Every negative case expects the message mutate() (src/lib/store.ts) or
 * the form's own submit() throws. */

test.skip(
  process.env.NEXT_PUBLIC_LOCAL_DB !== "1",
  "local sign-in (<account>@local.test) only exists in pnpm test:e2e:local",
);

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
const PAPER = MATERIALS[1];
const STICKER = MATERIALS[5];

const S_MAIN = "ข้อมูลหลักก่อนเริ่มระบบ (System setup)";
const S_DOCS = "ข้อมูลบนใบ PO (PO document setup)";
const S_PRICING = "ราคาและการขาย (Pricing & sales)";
const S_SUPPLIES = "วัตถุดิบสาขา (Branch supplies)";
const S_PRODUCTION = "การผลิตและขนส่ง (Production & logistics)";
const S_BRANCH = "กติกาสาขา (Branch rules)";
const S_MATERIALS =
  "จำนวนฐานและราคาวัสดุทั้งร้าน (Material par levels & unit prices)";
const INVENTORY = "ตารางสต๊อกทั้งหมด (All inventory)";

const REQUEST_EDIT = "ขอแก้ไข (Request edit)";
const SAVE_LOCK = "บันทึกและล็อก (Save & lock)";
const CANCEL_EDIT = "ยกเลิก (Cancel)";

const dialog = (page: Page) => page.getByRole("dialog").last();
/** role=alert also matches Next's route announcer and page banners, so scope + text. */
const alertIn = (scope: Locator, text: string | RegExp) =>
  scope.getByRole("alert").filter({ hasText: text });

const tab = (page: Page, label: string) =>
  pointAndClick(page, menuItem(page, label));

/** Submits the open dialog and expects it to stay open with the message. */
async function submitAndExpectError(page: Page, message: string | RegExp) {
  const open = dialog(page);
  await pointAndClick(page, open.locator('button[type="submit"]').last());
  await expect(alertIn(open, message)).toBeVisible();
  await expect(open).toBeVisible();
}

async function cancelDialog(page: Page) {
  await pointAndClick(page, dialog(page).getByRole("button", { name: "ยกเลิก" }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** Date/time inputs take a whole value at once. */
async function fillControl(scope: Locator | Page, label: string, value: string) {
  const input = scope.getByLabel(label).last();
  await input.scrollIntoViewIfNeeded();
  await input.fill(value);
  await expect(input).toHaveValue(value);
}

/** Settings cards are edit-locked until "ขอแก้ไข" is pressed and lock again on save. */
async function editSection(page: Page, title: string, fill: () => Promise<void>) {
  const section = tableSection(page, title);
  await pointAndClick(page, section.getByRole("button", { name: REQUEST_EDIT }));
  await fill();
  await pointAndClick(page, section.getByRole("button", { name: SAVE_LOCK }));
  await expect(section.getByRole("button", { name: REQUEST_EDIT })).toBeVisible();
}

/** Opens a settings card, runs `fill`, saves and expects the card to stay in edit
 * mode with `message`; then cancels so the stored value is shown again. */
async function sectionRefuses(
  page: Page,
  title: string,
  fill: () => Promise<void>,
  message: string | RegExp,
) {
  const section = tableSection(page, title);
  await pointAndClick(page, section.getByRole("button", { name: REQUEST_EDIT }));
  await fill();
  await pointAndClick(page, section.getByRole("button", { name: SAVE_LOCK }));
  await expect(section.getByText(message)).toBeVisible();
  await expect(section.getByRole("button", { name: SAVE_LOCK })).toBeVisible();
  await pointAndClick(page, section.getByRole("button", { name: CANCEL_EDIT }));
  await expect(section.getByRole("button", { name: REQUEST_EDIT })).toBeVisible();
}

/** One cell of a table row that mentions every text in `texts`. */
function cellOf(scope: Locator, texts: (string | RegExp)[], index: number) {
  let row = scope.getByRole("row");
  for (const text of texts) row = row.filter({ hasText: text });
  return row.getByRole("cell").nth(index);
}

/** Quantity column (index 3) of the Owner "All inventory" table. The table pages
 * at 20 rows, so narrow it to the location first. */
async function ownerStock(page: Page, item: string | RegExp, location: string) {
  const table = tableSection(page, INVENTORY);
  await table.getByLabel("สถานที่").selectOption(location);
  return cellOf(table, [item, location], 3);
}

/** A Log entry (<details>) by its title and a value it holds. */
const logEntry = (page: Page, title: string, text: string | RegExp) =>
  page
    .getByRole("main")
    .locator("details")
    .filter({ has: page.locator("summary").filter({ hasText: title }) })
    .filter({ hasText: text });

const toast = (page: Page, text: string | RegExp) =>
  page.getByRole("main").getByRole("status").filter({ hasText: text });

async function setMaterialPars(page: Page, par: (i: number) => string, price: (i: number) => string) {
  await editSection(page, S_MATERIALS, async () => {
    for (let index = 0; index < MATERIALS.length; index += 1) {
      await field(page, `material${index}`, par(index));
      await field(page, `materialPrice${index}`, price(index));
    }
  });
}

/* ------------------------------------------------------------------------ */

test("Lane B: B1–B2 Owner ตั้งค่าครบทุก section · validation ไม่บันทึก · ออก/เข้าใหม่ค่ายังอยู่", async ({
  page,
}) => {
  test.setTimeout(10 * 60_000);
  await startFresh(page);

  await step(page, "Owner: เข้าสู่ระบบและเปิดหน้าตั้งค่า", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await tab(page, "ตั้งค่า");
    await expect(page.getByRole("heading", { name: "ตั้งค่าระบบ (Settings)" })).toBeVisible();
    // seed: ราคาเริ่มต้น 350 / 320 / 30, tolerance 20, ปิดวัน 22:00
    const pricing = tableSection(page, S_PRICING);
    await expect(pricing).toContainText("฿350.00");
    await expect(pricing).toContainText("฿320.00");
    await expect(tableSection(page, S_BRANCH)).toContainText("22:00");
  });

  await step(page, "Owner: B2 ขณะแก้ section หนึ่ง section อื่นล็อก (กำลังแก้ตารางอื่น)", async () => {
    const pricing = tableSection(page, S_PRICING);
    await pointAndClick(page, pricing.getByRole("button", { name: REQUEST_EDIT }));
    await expect(
      tableSection(page, S_BRANCH).getByRole("button", { name: "กำลังแก้ตารางอื่น" }),
    ).toBeDisabled();
    await pointAndClick(page, pricing.getByRole("button", { name: CANCEL_EDIT }));
    await expect(tableSection(page, S_BRANCH).getByRole("button", { name: REQUEST_EDIT })).toBeEnabled();
  });

  await step(page, "Owner: B2 ราคากล่อง -5 / ว่าง / ตัวอักษร → เป็นตัวเลขตั้งแต่ศูนย์ ไม่บันทึก · packKg 0 → มากกว่าศูนย์", async () => {
    // config lets every setting but packKg be 0 (store.ts: positive(v, key, key, key !== "packKg")).
    const message = /กรอก.*เป็นตัวเลขตั้งแต่ศูนย์/;
    await sectionRefuses(page, S_PRICING, () => field(page, "boxPrice", "-5"), message);
    await sectionRefuses(page, S_PRICING, () => field(page, "boxPrice", ""), message);
    await sectionRefuses(
      page,
      S_PRICING,
      async () => {
        const input = page.getByLabel("boxPrice").last();
        await pointAndClick(page, input);
        await input.fill("");
        await input.pressSequentially("abc", { delay: 20 });
        await expect(input).toHaveValue("");
      },
      message,
    );
    await sectionRefuses(
      page,
      S_PRICING,
      () => field(page, "packKg", "0"),
      /กรอก.*เป็นตัวเลขมากกว่าศูนย์/,
    );
    await expect(tableSection(page, S_PRICING)).toContainText("฿350.00");
    await expect(tableSection(page, S_PRICING)).toContainText("101.50 กรัม");
  });

  await step(page, "Owner: B2 ค่าขนส่งขาไป -1 และ tolerance 101 → บล็อก", async () => {
    await sectionRefuses(
      page,
      S_PRODUCTION,
      () => field(page, "outboundFee", "-1"),
      /กรอก.*เป็นตัวเลขตั้งแต่ศูนย์/,
    );
    await expect(tableSection(page, S_PRODUCTION)).toContainText("฿1,200.00");
    await sectionRefuses(
      page,
      S_BRANCH,
      () => field(page, "tolerance", "101"),
      "ค่าคลาดเคลื่อนต้องไม่เกิน 100%",
    );
    await expect(tableSection(page, S_BRANCH)).toContainText("20.00");
  });

  await step(page, "Owner: B2 ชื่อบริษัทว่าง → กรอกชื่อบริษัท · เวลาปิดวันว่าง → กรอกเวลาเป็น HH:mm", async () => {
    await sectionRefuses(page, S_MAIN, () => field(page, "companyName", ""), "กรอกชื่อบริษัท");
    await sectionRefuses(
      page,
      S_BRANCH,
      () => fillControl(page, "closeTime", ""),
      "กรอกเวลาเป็น HH:mm เช่น 08:00",
    );
  });

  await step(page, "Owner: B2 จำนวนฐานวัสดุ -1 → จำนวนฐาน กล่องพิมพ์ลาย ตั้งแต่ศูนย์ · ตารางวัสดุยังเป็น 0", async () => {
    await sectionRefuses(
      page,
      S_MATERIALS,
      () => field(page, "material0", "-1"),
      `กรอกจำนวนฐาน ${BOX}เป็นตัวเลขตั้งแต่ศูนย์`,
    );
    await expect(cellOf(tableSection(page, S_MATERIALS), [BOX], 1)).toHaveText("0.00 ชิ้น");
  });

  await step(page, "Owner: B1 ข้อมูลหลัก (บริษัท ที่อยู่ ผู้ติดต่อ เบอร์ เลขภาษี วันเริ่มใช้)", async () => {
    await editSection(page, S_MAIN, async () => {
      await field(page, "companyName", "บริษัท เลนบี ทดสอบ จำกัด");
      await field(page, "companyAddress", "77/7 ถนนเลนบี กรุงเทพมหานคร");
      await field(page, "attention", "ฝ่ายจัดซื้อเลนบี");
      await field(page, "companyPhone", "0877777777");
      await field(page, "taxId", "0105500000077");
      await fillControl(page, "systemStartDate", "2026-10-15");
    });
  });

  await step(page, "Owner: B1 ข้อมูลใบ PO (โลโก้ Foodiva Chef_house)", async () => {
    await editSection(page, S_DOCS, async () => {
      await page
        .getByLabel("อัปโหลดโลโก้ NerdNuea")
        .setInputFiles(path.join(process.cwd(), "tests/fixtures/logo-demo.png"));
      await expect(page.getByAltText("ตัวอย่างโลโก้ NerdNuea")).toBeVisible();
      await field(page, "foodivaContact", "คุณฟู้ด ฝ่ายขายเลนบี");
      await field(page, "foodivaAddress", "11 ถนนฟู้ดดีว่า กรุงเทพฯ");
      await field(page, "chefHouseContact", "หัวหน้ารมควันเลนบี");
      await field(page, "chefHouseAddress", "22 ถนนเชฟเฮาส์ เชียงใหม่");
    });
  });

  await step(page, "Owner: B1 ราคาขาย 370/340/0.101/35 · วัตถุดิบสาขา · ค่าขนส่ง 1500/1400/2600", async () => {
    await editSection(page, S_PRICING, async () => {
      await field(page, "boxPrice", "370");
      await field(page, "addonPrice", "340");
      await field(page, "packKg", "0.101");
      await field(page, "chiliPrice", "35");
    });
    await editSection(page, S_SUPPLIES, async () => {
      await field(page, "rawRicePar", "25");
      await field(page, "rawRiceUnitPrice", "55");
      await field(page, "chiliPar", "120");
      await field(page, "chiliUnitPrice", "22");
      await field(page, "cookedRicePar", "35");
      await field(page, "cookedRiceUnitPrice", "48");
    });
    await editSection(page, S_PRODUCTION, async () => {
      await field(page, "outboundFee", "1500");
      await field(page, "returnFee", "1400");
      await field(page, "roundFee", "2600");
    });
  });

  await step(page, "Owner: B1 กติกาสาขา มีนบุรี · tolerance 12 · ปิดวัน 21:30 · ฐาน/ราคาวัสดุ 7 รายการ", async () => {
    await editSection(page, S_BRANCH, async () => {
      await tableSection(page, S_BRANCH).getByLabel("branch").selectOption({ label: "มีนบุรี" });
      await field(page, "tolerance", "12");
      await fillControl(page, "closeTime", "21:30");
    });
    await setMaterialPars(page, (i) => String(200 + i * 10), (i) => String(3 + i));
  });

  const expectSettings = async () => {
    const main = tableSection(page, S_MAIN);
    for (const text of [
      "บริษัท เลนบี ทดสอบ จำกัด",
      "77/7 ถนนเลนบี กรุงเทพมหานคร",
      "ฝ่ายจัดซื้อเลนบี",
      "0877777777",
      "0105500000077",
      "2026-10-15",
    ])
      await expect(main).toContainText(text);
    const docs = tableSection(page, S_DOCS);
    await expect(docs.getByAltText("โลโก้ NerdNuea")).toHaveAttribute("src", /^data:image\/png;base64,/);
    for (const text of [
      "คุณฟู้ด ฝ่ายขายเลนบี",
      "11 ถนนฟู้ดดีว่า กรุงเทพฯ",
      "หัวหน้ารมควันเลนบี",
      "22 ถนนเชฟเฮาส์ เชียงใหม่",
    ])
      await expect(docs).toContainText(text);
    const pricing = tableSection(page, S_PRICING);
    await expect(cellOf(pricing, ["ราคากล่องมาตรฐาน"], 1)).toHaveText("฿370.00");
    await expect(cellOf(pricing, ["ราคาเนื้อซีลเพิ่ม"], 1)).toHaveText("฿340.00");
    await expect(cellOf(pricing, ["น้ำหนักเฉลี่ยต่อซีล"], 1)).toHaveText("101.00 กรัม");
    await expect(cellOf(pricing, ["ราคาขายน้ำพริกหลอด"], 1)).toHaveText("฿35.00");
    const supplies = tableSection(page, S_SUPPLIES);
    await expect(cellOf(supplies, ["จำนวนฐานข้าวเหนียวดิบ"], 1)).toHaveText("25.00");
    await expect(cellOf(supplies, ["ราคาต่อหน่วยข้าวเหนียวดิบ"], 1)).toHaveText("฿55.00");
    await expect(cellOf(supplies, ["จำนวนฐานน้ำพริก"], 1)).toHaveText("120.00");
    await expect(cellOf(supplies, ["ราคาต่อหน่วยน้ำพริก"], 1)).toHaveText("฿22.00");
    await expect(cellOf(supplies, ["จำนวนฐานข้าวเหนียวสุก"], 1)).toHaveText("35.00");
    await expect(cellOf(supplies, ["ราคาต่อหน่วยข้าวเหนียวสุก"], 1)).toHaveText("฿48.00");
    const production = tableSection(page, S_PRODUCTION);
    await expect(cellOf(production, ["ค่าขนส่งขาไป"], 1)).toHaveText("฿1,500.00");
    await expect(cellOf(production, ["ค่าขนส่งขากลับ"], 1)).toHaveText("฿1,400.00");
    await expect(cellOf(production, ["ค่าขนส่งไป-กลับ"], 1)).toHaveText("฿2,600.00");
    const rules = tableSection(page, S_BRANCH);
    await expect(cellOf(rules, ["สาขาเริ่มต้น"], 1)).toHaveText("มีนบุรี");
    await expect(cellOf(rules, ["ค่าคลาดเคลื่อนยอดขาย"], 1)).toHaveText("12.00");
    await expect(cellOf(rules, ["เวลาเริ่มปิดวัน"], 1)).toHaveText("21:30");
    const materialTable = tableSection(page, S_MATERIALS);
    for (let i = 0; i < MATERIALS.length; i += 1) {
      await expect(cellOf(materialTable, [MATERIALS[i]], 1)).toHaveText(`${200 + i * 10}.00 ชิ้น`);
      await expect(cellOf(materialTable, [MATERIALS[i]], 2)).toHaveText(`฿${3 + i}.00 / ชิ้น`);
    }
  };

  await step(page, "Owner: B1 ทุก section แสดงค่าที่บันทึก · แบนเนอร์ตั้งค่าวัสดุยังไม่ครบหายไป", async () => {
    await expectSettings();
    await expect(page.getByText("ตั้งค่าวัสดุยังไม่ครบ")).toHaveCount(0);
  });

  await step(page, "ระบบ: B1 reload + ออกจากระบบแล้วเข้าใหม่ → ค่ายังอยู่ทุกช่อง", async () => {
    await page.reload();
    await signInAs(page, ACCOUNTS.saladaeng);
    await signInAs(page, ACCOUNTS.owner);
    await tab(page, "ตั้งค่า");
    await expectSettings();
  });

  await step(page, "Owner: B1 ขอแก้ไขอีกครั้ง → ช่องกรอกโหลดค่าที่บันทึก (ไม่ใช่ค่า seed) แล้วยกเลิก", async () => {
    const pricing = tableSection(page, S_PRICING);
    await pointAndClick(page, pricing.getByRole("button", { name: REQUEST_EDIT }));
    await expect(pricing.getByLabel("boxPrice")).toHaveValue("370");
    await expect(pricing.getByLabel("packKg")).toHaveValue("0.101");
    await pointAndClick(page, pricing.getByRole("button", { name: CANCEL_EDIT }));
  });

  await step(page, "Owner: B1 ฐาน/ราคาวัสดุใช้กับทั้ง 2 สาขาในสต๊อกของทั้งหมด", async () => {
    await tab(page, "สต๊อกของทั้งหมด");
    for (const branch of ["ศาลาแดง", "มีนบุรี"]) {
      await expect(cellOf(tableSection(page, INVENTORY), [PAPER, branch], 5)).toHaveText(
        "ฐาน 210.00 · ฿4.00 / ชิ้น",
      );
    }
  });
});

test("Lane B: B3–B6, B8 ซื้อวัสดุ → ส่งสาขา → สาขายืนยันรับ · น้ำพริก · ค่าใช้จ่าย Owner · ยกเลิกรายการจาก Log", async ({
  page,
}) => {
  test.setTimeout(15 * 60_000);
  await startFresh(page);

  await step(page, "Owner: B3 ซื้อวัสดุ — ไม่ติ๊ก → ติ๊กเลือกอย่างน้อย 1 รายการ", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await tab(page, "สต๊อกของทั้งหมด");
    await button(page, "+ ซื้อวัสดุเข้าคลัง");
    await submitAndExpectError(page, "ติ๊กเลือกอย่างน้อย 1 รายการ");
  });

  await step(page, "Owner: B3 ไม่กรอกผู้จำหน่าย → กรอกผู้จำหน่าย (inline) · จำนวน 0 / 2.5 → จำนวนเต็มที่มากกว่า 0", async () => {
    await dialog(page).getByLabel(`ซื้อ ${BOX}`).check();
    await field(page, `จำนวนซื้อ ${BOX}`, "100");
    await field(page, `ราคาซื้อ ${BOX}`, "2");
    await submitAndExpectError(page, `กรอกผู้จำหน่าย ${BOX}`);
    await field(page, `ผู้จำหน่าย ${BOX}`, "ร้านวัสดุเลนบี");
    await field(page, `จำนวนซื้อ ${BOX}`, "0");
    await submitAndExpectError(page, `กรอกจำนวน ${BOX} เป็นจำนวนเต็มที่มากกว่า 0`);
    await field(page, `จำนวนซื้อ ${BOX}`, "2.5");
    await submitAndExpectError(page, `กรอกจำนวน ${BOX} เป็นจำนวนเต็มที่มากกว่า 0`);
  });

  await step(page, "Owner: B3 ซื้อครบ 7 รายการ 100…160 ชิ้น @ ฿2 → ยอดรวม ฿1,820", async () => {
    await field(page, `จำนวนซื้อ ${BOX}`, "100");
    for (let i = 1; i < MATERIALS.length; i += 1) {
      await dialog(page).getByLabel(`ซื้อ ${MATERIALS[i]}`).check();
      await field(page, `จำนวนซื้อ ${MATERIALS[i]}`, String(100 + i * 10));
      await field(page, `ราคาซื้อ ${MATERIALS[i]}`, "2");
      await field(page, `ผู้จำหน่าย ${MATERIALS[i]}`, "ร้านวัสดุเลนบี");
    }
    await expect(dialog(page)).toContainText("เลือก 7 รายการ · ยอดซื้อรวม ฿1,820.00");
    await button(page, "บันทึกการซื้อ 7 รายการ");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  await step(page, "Owner: B3 สต๊อกของทั้งหมด — คลัง Owner ตรงทุกรายการ · ประวัติการซื้อ ฿1,820", async () => {
    for (let i = 0; i < MATERIALS.length; i += 1)
      await expect(await ownerStock(page, MATERIALS[i], "คลัง Owner")).toHaveText(`${100 + i * 10}.00`);
    await expect(
      page.getByRole("heading", { name: "ประวัติการซื้อและบัญชี · ต้นทุนซื้อเข้าที่แสดง ฿1,820.00" }),
    ).toBeVisible();
  });

  await step(page, "Owner: B4 ส่งวัสดุก่อนตั้งฐาน → ตั้งจำนวนฐานและราคาต่อหน่วย…ก่อนส่ง", async () => {
    await button(page, "ส่งวัสดุไปสาขา");
    await dialog(page).getByLabel(`ส่ง ${BOX} ไปศาลาแดง`).check();
    await field(page, `จำนวน ${BOX} ไปศาลาแดง`, "60");
    await field(page, "ผู้รับของสาขาศาลาแดง", "ผู้ดูแลศาลาแดง");
    await submitAndExpectError(
      page,
      `ตั้งจำนวนฐานและราคาต่อหน่วยของ ${BOX} สำหรับสาขาศาลาแดง ก่อนส่ง`,
    );
    await cancelDialog(page);
    await expect(await ownerStock(page, BOX, "คลัง Owner")).toHaveText("100.00");
  });

  await step(page, "Owner: B4 ตั้งฐาน 300 ราคา ฿1 ทั้ง 7 รายการ", async () => {
    await tab(page, "ตั้งค่า");
    await setMaterialPars(page, () => "300", () => "1");
    await tab(page, "สต๊อกของทั้งหมด");
  });

  await step(page, "Owner: B4 ส่งเกินคลัง 101 → วัสดุในคลัง Owner ไม่พอ · ส่งกล่อง 60 ศาลาแดง + กระดาษรอง 30 มีนบุรี", async () => {
    await button(page, "ส่งวัสดุไปสาขา");
    await dialog(page).getByLabel(`ส่ง ${BOX} ไปศาลาแดง`).check();
    await field(page, `จำนวน ${BOX} ไปศาลาแดง`, "101");
    await field(page, "ผู้รับของสาขาศาลาแดง", "ผู้ดูแลศาลาแดง");
    await submitAndExpectError(page, "วัสดุในคลัง Owner ไม่พอ");
    await field(page, `จำนวน ${BOX} ไปศาลาแดง`, "60");
    await dialog(page).getByLabel(`ส่ง ${PAPER} ไปมีนบุรี`).check();
    await field(page, `จำนวน ${PAPER} ไปมีนบุรี`, "30");
    await field(page, "ผู้รับของสาขามีนบุรี", "ผู้ดูแลมีนบุรี");
    await button(page, "บันทึกส่งวัสดุ");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  await step(page, "Owner: B4 คลัง Owner ลด (กล่อง 40 · กระดาษรอง 80) · สาขายังเป็น 0 จนกว่าจะยืนยันรับ", async () => {
    await expect(await ownerStock(page, BOX, "คลัง Owner")).toHaveText("40.00");
    await expect(await ownerStock(page, PAPER, "คลัง Owner")).toHaveText("80.00");
    await expect(await ownerStock(page, BOX, "ศาลาแดง")).toHaveText("0.00");
    await expect(await ownerStock(page, PAPER, "มีนบุรี")).toHaveText("0.00");
  });

  await step(page, "Owner: B5 ซื้ออื่น ๆ น้ำพริกหลอด 100 หลอด @ ฿20 → คลัง Owner 100", async () => {
    await button(page, "+ บันทึกการซื้ออื่น ๆ");
    await page.getByLabel("เลือกวัตถุดิบ 1").selectOption({ label: "น้ำพริกหลอด" });
    await field(page, "จำนวน 1", "100");
    await field(page, "ราคาต่อหน่วย 1", "20");
    await field(page, "ผู้จำหน่าย 1", "ครัวน้ำพริกเลนบี");
    await field(page, "ใบเสร็จ 1", "CHILI-B5");
    await button(page, "บันทึก 1 รายการ");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(await ownerStock(page, "น้ำพริกหลอด", "คลัง Owner")).toHaveText("100.00");
  });

  await step(page, "Owner: B5 จัดสรรน้ำพริก — สาขาปลายทางเลือกได้เฉพาะ 2 สาขา · 150 เกินคลัง · 2.5 ไม่เต็มหลอด → บล็อก", async () => {
    await button(page, "จัดสรรน้ำพริกไปสาขา");
    const branch = dialog(page).getByLabel(/สาขาปลายทาง/);
    // "เลือกสาขาปลายทาง" is unreachable from the UI: the select has no empty option.
    await expect(branch.locator("option")).toHaveText(["ศาลาแดง", "มีนบุรี"]);
    await expect(branch).toHaveValue("ศาลาแดง");
    await field(page, /จำนวนน้ำพริกที่จัดสรร/, "150");
    await field(page, /ผู้รับ \/ ผู้ดูแลสาขา/, "ผู้ดูแลศาลาแดง");
    await submitAndExpectError(page, "น้ำพริกในคลัง Owner ไม่พอ กรุณาบันทึกซื้อเข้าบัญชีก่อน");
    await field(page, /จำนวนน้ำพริกที่จัดสรร/, "2.5");
    await submitAndExpectError(page, "น้ำพริกต้องเป็นจำนวนหลอดเต็ม");
    await field(page, /จำนวนน้ำพริกที่จัดสรร/, "0");
    await submitAndExpectError(page, "กรอกจำนวนน้ำพริกที่จัดสรรเป็นตัวเลขมากกว่าศูนย์");
  });

  await step(page, "Owner: B5 จัดสรรน้ำพริก 40 หลอดไปศาลาแดง → คลัง Owner 60 · ศาลาแดง 40", async () => {
    await field(page, /จำนวนน้ำพริกที่จัดสรร/, "40");
    await saveEntry(page);
    await expect(await ownerStock(page, "น้ำพริกหลอด", "คลัง Owner")).toHaveText("60.00");
    await expect(await ownerStock(page, "น้ำพริกหลอด", "ศาลาแดง")).toHaveText("40.00");
    await expect(await ownerStock(page, "น้ำพริกหลอด", "มีนบุรี")).toHaveText("0.00");
  });

  await step(page, "สาขาศาลาแดง: B4 ยืนยันรับกล่อง 55 จากที่ส่ง 60 โดยไม่กรอกเหตุผล → กรอกเหตุผลส่วนต่าง", async () => {
    await signInAs(page, ACCOUNTS.saladaeng);
    await tab(page, "กรอกรายวัน");
    const pending = tableSection(page, "รายการวัสดุรอยืนยันรับ (Pending material receipts)");
    await expect(pending.getByRole("row").filter({ hasText: BOX })).toHaveCount(1);
    // Minburi's transfer is not listed at Saladaeng.
    await expect(pending.getByRole("row").filter({ hasText: PAPER })).toHaveCount(0);
    await pending.getByLabel(`จำนวนที่รับจริง ${BOX}`).fill("55");
    await pointAndClick(page, pending.getByRole("button", { name: "ยืนยันรับ" }));
    await expect(page.getByRole("main").getByText("กรอกเหตุผลส่วนต่าง")).toBeVisible();
    await expect(pending.getByRole("row").filter({ hasText: BOX })).toHaveCount(1);
  });

  await step(page, "สาขาศาลาแดง: B4 รับ 61 > ส่ง 60 → จำนวนรับจริงเกินจำนวนที่ส่ง", async () => {
    const pending = tableSection(page, "รายการวัสดุรอยืนยันรับ (Pending material receipts)");
    await pending.getByLabel(`จำนวนที่รับจริง ${BOX}`).fill("61");
    await pointAndClick(page, pending.getByRole("button", { name: "ยืนยันรับ" }));
    await expect(page.getByRole("main").getByText("จำนวนรับจริงเกินจำนวนที่ส่ง")).toBeVisible();
  });

  await step(page, "สาขาศาลาแดง: B4 รับ 55 + เหตุผล → ยืนยันแล้ว · รายการหายจากรอยืนยัน (ยืนยันซ้ำไม่ได้)", async () => {
    const pending = tableSection(page, "รายการวัสดุรอยืนยันรับ (Pending material receipts)");
    await pending.getByLabel(`จำนวนที่รับจริง ${BOX}`).fill("55");
    await pending.getByLabel(`เหตุผลส่วนต่าง ${BOX}`).fill("กล่องเสียหาย 5 ใบ");
    await pointAndClick(page, pending.getByRole("button", { name: "ยืนยันรับ" }));
    await expect(page.getByRole("main").getByText(`ยืนยันรับ ${BOX} แล้ว`)).toBeVisible();
    // "ยืนยันรับรายการนี้แล้ว" cannot be reached: the confirmed row leaves the table.
    await expect(pending.getByRole("row").filter({ hasText: BOX })).toHaveCount(0);
    await expect(pending.getByRole("button", { name: "ยืนยันรับ" })).toHaveCount(0);
  });

  await step(page, "สาขาศาลาแดง: B4/B5 สต๊อกวัสดุ กล่อง 55 ชิ้น · น้ำพริกตั้งต้นจาก Owner 40", async () => {
    await expect(
      cellOf(tableSection(page, /^น้ำพริกหลอด/), ["ยอดตั้งต้นจาก Owner"], 1),
    ).toHaveText("40.00");
    await tab(page, "สต๊อก");
    const materialStock = tableSection(page, "สต๊อกวัสดุ 7 รายการ (Material inventory)");
    await expect(cellOf(materialStock, [BOX], 2)).toHaveText("55 ชิ้น");
    await expect(cellOf(materialStock, [PAPER], 2)).toHaveText("0 ชิ้น");
  });

  await step(page, "สาขามีนบุรี: B4 ยืนยันรับกระดาษรองครบ 30 (ไม่ต้องกรอกเหตุผล)", async () => {
    await signInAs(page, ACCOUNTS.minburi);
    await tab(page, "กรอกรายวัน");
    const pending = tableSection(page, "รายการวัสดุรอยืนยันรับ (Pending material receipts)");
    await expect(pending.getByRole("row").filter({ hasText: BOX })).toHaveCount(0);
    await pointAndClick(page, pending.getByRole("button", { name: "ยืนยันรับ" }));
    await expect(page.getByRole("main").getByText(`ยืนยันรับ ${PAPER} แล้ว`)).toBeVisible();
    await tab(page, "สต๊อก");
    await expect(
      cellOf(tableSection(page, "สต๊อกวัสดุ 7 รายการ (Material inventory)"), [PAPER], 2),
    ).toHaveText("30 ชิ้น");
  });

  await step(page, "Owner: B4 สต๊อกของทั้งหมด — ศาลาแดง กล่อง 55 · มีนบุรี กระดาษรอง 30 · รายงาน audit trail", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await tab(page, "สต๊อกของทั้งหมด");
    await expect(await ownerStock(page, BOX, "ศาลาแดง")).toHaveText("55.00");
    await expect(await ownerStock(page, PAPER, "มีนบุรี")).toHaveText("30.00");
    await expect(await ownerStock(page, BOX, "คลัง Owner")).toHaveText("40.00");
  });

  await step(page, "Owner: B6 ค่าใช้จ่าย Owner จำนวนเงิน 0 → บล็อก · รายละเอียดว่าง → กรอกรายละเอียด", async () => {
    await tab(page, "รายงาน");
    await button(page, "ค่าใช้จ่าย Owner");
    await page.getByLabel(/หมวดค่าใช้จ่าย/).selectOption({ label: "ค่าเช่า" });
    await field(page, /จำนวนเงิน \(บาท\)/, "0");
    await field(page, /ผู้จ่ายเงิน/, "Owner เลนบี");
    await submitAndExpectError(page, "กรอกยอดเงินเป็นตัวเลขมากกว่าศูนย์");
    await field(page, /จำนวนเงิน \(บาท\)/, "5000");
    await submitAndExpectError(page, "กรอกรายละเอียด");
  });

  await step(page, "Owner: B6 ค่าเช่า ฿5,000 → รายงาน: ตารางค่าใช้จ่าย Owner + สรุปผลรวม", async () => {
    await field(page, /รายละเอียด \/ อ้างอิงการโอน/, "ค่าเช่าร้าน B6");
    await saveEntry(page);
    // Remount the report so its date range picks up the new entry.
    await tab(page, "แดชบอร์ด");
    await tab(page, "รายงาน");
    const expenses = tableSection(page, "ค่าใช้จ่าย Owner");
    await expect(cellOf(expenses, ["ค่าเช่าร้าน B6"], 1)).toHaveText("ค่าเช่า");
    await expect(cellOf(expenses, ["ค่าเช่าร้าน B6"], 3)).toHaveText("Owner เลนบี");
    await expect(cellOf(expenses, ["ค่าเช่าร้าน B6"], 4)).toHaveText("5,000.00");
    const summary = tableSection(page, "สรุปผลรวม");
    await expect(cellOf(summary, ["↳ ค่าใช้จ่าย Owner"], 1)).toHaveText("5,000.00");
    // 1,820 materials + 2,000 chili (100 × ฿20) + 5,000 expense
    await expect(cellOf(summary, ["↳ ซื้อวัสดุบรรจุภัณฑ์"], 1)).toHaveText("1,820.00");
    await expect(cellOf(summary, ["↳ ซื้อวัตถุดิบ / ETC"], 1)).toHaveText("2,000.00");
    await expect(cellOf(summary, ["ต้นทุนรวมทั้งหมด"], 1)).toHaveText("8,820.00");
    await expect(
      cellOf(tableSection(page, "ประวัติจัดสรรน้ำพริกโดย Owner"), ["ศาลาแดง"], 2),
    ).toHaveText("40.00 หลอด");
  });

  await step(page, "Owner: B6 Log มีรายการค่าใช้จ่าย Owner ฿5000", async () => {
    await tab(page, "Log");
    await expect(logEntry(page, "ค่าใช้จ่าย Owner", "ค่าเช่าร้าน B6")).toHaveCount(1);
  });

  await step(page, "Owner: B8 รายการที่ยกเลิกไม่ได้ (บันทึกการตั้งค่า) ไม่มีปุ่มยกเลิก", async () => {
    const config = page
      .getByRole("main")
      .locator("details")
      .filter({ has: page.locator("summary").filter({ hasText: "บันทึกการตั้งค่า" }) })
      .first();
    await pointAndClick(page, config.locator("summary"));
    await expect(config.getByRole("button", { name: "แก้รายการผิดด้วยการยกเลิก" })).toHaveCount(0);
  });

  await step(page, "Owner: B8 ยกเลิกการซื้อสติกเกอร์โลโก้ โดยไม่กรอกเหตุผล → กรอกเหตุผลยกเลิกรายการ", async () => {
    const entry = logEntry(page, "บันทึกซื้อวัสดุเข้าคลัง Owner", STICKER);
    await expect(entry).toHaveCount(1);
    await pointAndClick(page, entry.locator("summary"));
    await pointAndClick(page, entry.getByRole("button", { name: "แก้รายการผิดด้วยการยกเลิก" }));
    await pointAndClick(page, entry.getByRole("button", { name: "ยืนยันยกเลิก" }));
    await expect(toast(page, "กรอกเหตุผลยกเลิกรายการ")).toBeVisible();
    await expect(page.getByRole("main").locator("details").filter({
      has: page.locator("summary").filter({ hasText: /^ยกเลิกรายการ/ }),
    })).toHaveCount(0);
  });

  await step(page, "Owner: B8 กรอกเหตุผลแล้วยืนยัน → ยกเลิกสำเร็จ · Log มีรายการยกเลิกรายการ", async () => {
    const entry = logEntry(page, "บันทึกซื้อวัสดุเข้าคลัง Owner", STICKER);
    await entry.getByLabel("เหตุผลที่ยกเลิกรายการ").fill("บันทึกซ้ำ B8");
    await pointAndClick(page, entry.getByRole("button", { name: "ยืนยันยกเลิก" }));
    await expect(toast(page, "ยกเลิกรายการแล้ว ระบบคำนวณยอดใหม่และเก็บเหตุผลไว้ในประวัติ")).toBeVisible();
    await expect(
      logEntry(page, "ยกเลิกรายการ", "บันทึกซ้ำ B8").filter({ hasText: "materialReceive" }),
    ).toHaveCount(1);
  });

  await step(page, "Owner: B8 ยกเลิกซ้ำ → รายการนี้ถูกยกเลิกแล้ว", async () => {
    const entry = logEntry(page, "บันทึกซื้อวัสดุเข้าคลัง Owner", STICKER);
    await pointAndClick(page, entry.getByRole("button", { name: "ยืนยันยกเลิก" }));
    await expect(toast(page, "รายการนี้ถูกยกเลิกแล้ว")).toBeVisible();
    await expect(logEntry(page, "ยกเลิกรายการ", "บันทึกซ้ำ B8")).toHaveCount(1);
  });

  await step(page, "Owner: B8 สต๊อกถอยกลับ — สติกเกอร์โลโก้ คลัง Owner 150 → 0 · ต้นทุนซื้อวัสดุ 1,820 → 1,520", async () => {
    await tab(page, "สต๊อกของทั้งหมด");
    await expect(await ownerStock(page, STICKER, "คลัง Owner")).toHaveText("0.00");
    await expect(
      page.getByRole("heading", { name: /ประวัติการซื้อและบัญชี · ต้นทุนซื้อเข้าที่แสดง ฿3,520\.00/ }),
    ).toBeVisible();
    await tab(page, "รายงาน");
    await expect(cellOf(tableSection(page, "สรุปผลรวม"), ["↳ ซื้อวัสดุบรรจุภัณฑ์"], 1)).toHaveText("1,520.00");
  });

  await step(page, "ระบบ: B8 reload → การยกเลิกยังอยู่ (สติกเกอร์โลโก้ 0)", async () => {
    await page.reload();
    await tab(page, "สต๊อกของทั้งหมด");
    await expect(await ownerStock(page, STICKER, "คลัง Owner")).toHaveText("0.00");
    await expect(await ownerStock(page, BOX, "คลัง Owner")).toHaveText("40.00");
  });
});

test("Lane B: B7 หลังโหลดข้อมูลจำลอง Owner ปลดล็อกวันศาลาแดง → สาขาบันทึกได้อีก · ปลดล็อกซ้ำ → วันนี้ยังไม่ได้ปิด", async ({
  page,
}) => {
  test.setTimeout(6 * 60_000);
  await startFresh(page);
  await loadSampleData(page);

  await step(page, "สาขาศาลาแดง: B7 วันนี้ปิดแล้วใน sample → ปุ่มกรอกข้อมูลล็อก", async () => {
    await signInAs(page, ACCOUNTS.saladaeng);
    await tab(page, "กรอกรายวัน");
    await expect(page.getByRole("main")).toContainText("ปิดแล้ว");
    await expect(
      page.getByRole("row").filter({ hasText: "ซื้อข้าวเหนียวดิบเข้าสต๊อก" }).getByRole("button", { name: "กรอกข้อมูล" }),
    ).toBeDisabled();
  });

  await step(page, "Owner: B7 ปลดล็อกวันศาลาแดง ไม่กรอกเหตุผล → กรอกเหตุผลปลดล็อก · กรอกแล้วผ่าน", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await tab(page, "รายงาน");
    await button(page, "ปลดล็อกวัน");
    await page.getByLabel(/สาขาที่ปลดล็อก/).selectOption({ label: "ศาลาแดง" });
    await submitAndExpectError(page, "กรอกเหตุผลปลดล็อก");
    await field(page, /เหตุผลปลดล็อก/, "สาขาลืมบันทึกซื้อข้าว B7");
    await saveEntry(page);
  });

  await step(page, "Owner: B7 ปลดล็อกศาลาแดงซ้ำ (เปิดอยู่แล้ว) → วันนี้ยังไม่ได้ปิด", async () => {
    await button(page, "ปลดล็อกวัน");
    await page.getByLabel(/สาขาที่ปลดล็อก/).selectOption({ label: "ศาลาแดง" });
    await field(page, /เหตุผลปลดล็อก/, "ปลดซ้ำ");
    await submitAndExpectError(page, "วันนี้ยังไม่ได้ปิด");
    await cancelDialog(page);
  });

  await step(page, "สาขาศาลาแดง: B7 หลังปลดล็อก ซื้อข้าวเหนียวดิบ 5 กก. บันทึกได้", async () => {
    await signInAs(page, ACCOUNTS.saladaeng);
    await tab(page, "กรอกรายวัน");
    await expect(page.getByRole("main")).not.toContainText("ปิดแล้ว");
    await pointAndClick(
      page,
      page.getByRole("row").filter({ hasText: "ซื้อข้าวเหนียวดิบเข้าสต๊อก" }).getByRole("button", { name: "กรอกข้อมูล" }),
    );
    await field(page, /ผู้จำหน่ายข้าว/, "ร้านข้าว B7");
    await field(page, /ข้าวเหนียวดิบซื้อเข้า/, "5");
    await field(page, /ยอดซื้อข้าวเหนียวดิบ/, "275");
    await saveEntry(page);
    await tab(page, "ประวัติ");
    await expect(logEntry(page, "ซื้อข้าวเหนียวเข้าสต๊อก", "ร้านข้าว B7")).toHaveCount(1);
  });

  await step(page, "สาขามีนบุรี: B7 ยังปิดอยู่ (ปลดล็อกเฉพาะศาลาแดง)", async () => {
    await signInAs(page, ACCOUNTS.minburi);
    await tab(page, "กรอกรายวัน");
    await expect(page.getByRole("main")).toContainText("ปิดแล้ว");
  });
});

test("Lane B: B9 กระดิ่งแจ้งเตือน — seed ว่างมีเฉพาะตั้งค่าวัสดุ · หลัง sample คลิกแล้วไป tab ที่เกี่ยวข้อง", async ({
  page,
}) => {
  test.setTimeout(5 * 60_000);
  await startFresh(page);

  const bell = page.getByRole("button", { name: /^การแจ้งเตือน \d+ รายการ$/ });
  const popover = page.getByRole("region", { name: "รายการที่ต้องทำต่อ" });

  await step(page, "Owner: B9 seed ว่าง → แจ้งเตือน 1 รายการ (ตั้งค่าวัสดุยังไม่ครบ 7) ไม่มี alert ของ Lot", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await expect(bell).toHaveAccessibleName("การแจ้งเตือน 1 รายการ");
    await pointAndClick(page, bell);
    await expect(popover).toContainText("ต้องทำต่อ 1 รายการ");
    const items = popover.getByRole("button").filter({ hasNotText: /^ปิด$/ });
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText("ตั้งค่าวัสดุยังไม่ครบ 7 รายการ");
    await expect(popover).not.toContainText(/Lot|Invoice|F\d{6}-\d{3}/);
  });

  await step(page, "Owner: B9 คลิกแจ้งเตือน → ไปหน้าตั้งค่า popover ปิด", async () => {
    await pointAndClick(page, popover.getByRole("button", { name: /ตั้งค่าวัสดุยังไม่ครบ/ }));
    await expect(page).toHaveURL(/\/owner\/config$/);
    await expect(page.getByRole("heading", { name: "ตั้งค่าระบบ (Settings)" })).toBeVisible();
    await expect(popover).toHaveCount(0);
  });

  await step(page, "Owner: B9 ตั้งฐานวัสดุครบ → กระดิ่งเหลือ 0 · popover ไม่มีงานค้าง", async () => {
    await setMaterialPars(page, () => "50", () => "1");
    await expect(bell).toHaveAccessibleName("การแจ้งเตือน 0 รายการ");
    await pointAndClick(page, bell);
    await expect(popover).toContainText("ไม่มีงานค้าง");
    await expect(popover).toContainText("ยังไม่มีงานที่ต้องทำต่อ");
    await pointAndClick(page, popover.getByRole("button", { name: "ปิด", exact: true }));
  });

  await step(page, "ระบบ: B9 โหลดข้อมูลจำลอง 7 วัน แล้วเข้าสู่ระบบ Owner ใหม่", async () => {
    await loadSampleData(page);
    await signInAs(page, ACCOUNTS.saladaeng);
    await signInAs(page, ACCOUNTS.owner);
  });

  await step(page, "Owner: B9 sample (ทุก Lot จบ วัสดุตั้งครบ) → กระดิ่ง 0 ไม่มี alert ผิด ๆ", async () => {
    await expect(bell).toHaveAccessibleName("การแจ้งเตือน 0 รายการ");
    await pointAndClick(page, bell);
    await expect(popover).toContainText("ไม่มีงานค้าง");
    await pointAndClick(page, popover.getByRole("button", { name: "ปิด", exact: true }));
  });

  await step(page, "Owner: B9 สร้าง PO เนื้อใหม่ → กระดิ่ง 1 (รอ Foodiva ออก Invoice)", async () => {
    await ownerCreatesMeatPo(page, "300");
    await tab(page, "แดชบอร์ด");
    await expect(bell).toHaveAccessibleName("การแจ้งเตือน 1 รายการ");
  });

  await step(page, "Owner: B9 เปิด popover คลิกแจ้งเตือน → ไปหน้าใบสั่งซื้อ PO ที่มี Lot นั้น", async () => {
    await pointAndClick(page, bell);
    const item = popover.getByRole("button", { name: /รอ Foodiva ออก Invoice · F\d{6}-\d{3}/ });
    await expect(item).toHaveCount(1);
    const lot = ((await item.innerText()).match(/F\d{6}-\d{3}/) ?? [""])[0];
    await pointAndClick(page, item);
    await expect(page).toHaveURL(/\/owner\/po$/);
    await expect(popover).toHaveCount(0);
    await expect(tableSection(page, "รายการใบสั่งซื้อ PO")).toContainText(lot);
    await expect(tableSection(page, "รายการใบสั่งซื้อ PO")).toContainText("300.00 กก.");
  });
});

/* ---- confirmed app bugs (OPEN) ------------------------------------------ */

/* E2E-B1 (P3): mutate("config") validates the numeric settings with the storage
 * key as the label — store.ts `positive(v, key, key, …)` — so the Owner reads
 * "กรอกboxPriceเป็นตัวเลขตั้งแต่ศูนย์" instead of the Thai setting name. */
test("E2E-B1: ข้อความ error ตั้งค่าตัวเลขต้องใช้ชื่อช่องภาษาไทย ไม่ใช่ key (boxPrice)", async ({
  page,
}) => {
  test.fail(true, "E2E-B1: config validation message shows the raw key (store.ts positive(v, key, key))");
  await startFresh(page);
  await step(page, "Owner: ราคากล่อง -5 → ข้อความต้องระบุราคากล่องมาตรฐาน", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await tab(page, "ตั้งค่า");
    const pricing = tableSection(page, S_PRICING);
    await pointAndClick(page, pricing.getByRole("button", { name: REQUEST_EDIT }));
    await field(page, "boxPrice", "-5");
    await pointAndClick(page, pricing.getByRole("button", { name: SAVE_LOCK }));
    const message = pricing.getByText(/เป็นตัวเลขตั้งแต่ศูนย์/);
    await expect(message).toBeVisible();
    await expect(message).not.toContainText("boxPrice", { timeout: 2_000 });
  });
});

/* E2E-B2 (P3): MaterialTransferForm's <form> has no noValidate (MaterialPurchaseForm
 * got one in c55a307), and its quantity input is min=1 step=1, so a decimal
 * quantity stops at the native bubble; submit() and its inline
 * "กรอกจำนวน … ที่ส่งไป…" message never run. */
test("E2E-B2: ส่งวัสดุจำนวนทศนิยม ต้องขึ้นข้อความในฟอร์ม ไม่ใช่ native bubble", async ({
  page,
}) => {
  test.fail(true, "E2E-B2: MaterialTransferForm <form> lacks noValidate, native validation swallows the inline message");
  await startFresh(page);
  await step(page, "Owner: ส่งกล่อง 2.5 ชิ้นไปศาลาแดง → ข้อความ inline", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await tab(page, "สต๊อกของทั้งหมด");
    await button(page, "ส่งวัสดุไปสาขา");
    await dialog(page).getByLabel(`ส่ง ${BOX} ไปศาลาแดง`).check();
    await field(page, `จำนวน ${BOX} ไปศาลาแดง`, "2.5");
    await field(page, "ผู้รับของสาขาศาลาแดง", "ผู้ดูแลศาลาแดง");
    await pointAndClick(page, dialog(page).locator('button[type="submit"]').last());
    // Evidence: the browser refuses the step before submit() runs.
    await expect(dialog(page)).toBeVisible();
    expect(
      await dialog(page)
        .getByLabel(`จำนวน ${BOX} ไปศาลาแดง`)
        .evaluate((input) => (input as HTMLInputElement).validity.stepMismatch),
    ).toBe(true);
    await expect(
      alertIn(dialog(page), `กรอกจำนวน ${BOX} ที่ส่งไปศาลาแดง`),
    ).toBeVisible({ timeout: 3_000 });
  });
});

/* E2E-B3 (P2): the Log gives no sign that an entry was voided. EntryDetails.tsx
 * decides `reversible` from the kind alone, so a voided purchase looks unchanged
 * and still offers "แก้รายการผิดด้วยการยกเลิก"; the refusal
 * "รายการนี้ถูกยกเลิกแล้ว" then comes back through onChanged → the green success
 * Toast (role=status), not an error. */
test("E2E-B3: รายการที่ถูกยกเลิกใน Log ต้องมีเครื่องหมายยกเลิก และไม่มีปุ่มยกเลิกซ้ำ", async ({
  page,
}) => {
  test.fail(true, "E2E-B3: voided entry keeps its cancel button and shows no voided mark (EntryDetails.tsx)");
  await startFresh(page);
  await step(page, "Owner: ซื้อกล่อง 10 ชิ้น แล้วยกเลิกจาก Log", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await tab(page, "สต๊อกของทั้งหมด");
    await button(page, "+ ซื้อวัสดุเข้าคลัง");
    await dialog(page).getByLabel(`ซื้อ ${BOX}`).check();
    await field(page, `จำนวนซื้อ ${BOX}`, "10");
    await field(page, `ราคาซื้อ ${BOX}`, "1");
    await field(page, `ผู้จำหน่าย ${BOX}`, "ร้าน B3");
    await button(page, "บันทึกการซื้อ 1 รายการ");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await tab(page, "Log");
    const entry = logEntry(page, "บันทึกซื้อวัสดุเข้าคลัง Owner", BOX);
    await pointAndClick(page, entry.locator("summary"));
    await pointAndClick(page, entry.getByRole("button", { name: "แก้รายการผิดด้วยการยกเลิก" }));
    await entry.getByLabel("เหตุผลที่ยกเลิกรายการ").fill("ทดสอบ B3");
    await pointAndClick(page, entry.getByRole("button", { name: "ยืนยันยกเลิก" }));
    await expect(toast(page, "ยกเลิกรายการแล้ว")).toBeVisible();
  });
  await step(page, "ระบบ: reload → รายการที่ยกเลิกต้องมีเครื่องหมาย และไม่มีปุ่มยกเลิก", async () => {
    await page.reload();
    await tab(page, "Log");
    const entry = logEntry(page, "บันทึกซื้อวัสดุเข้าคลัง Owner", BOX);
    await pointAndClick(page, entry.locator("summary"));
    await expect(entry.getByRole("button", { name: "แก้รายการผิดด้วยการยกเลิก" })).toHaveCount(0, { timeout: 3_000 });
    await expect(entry).toContainText("ยกเลิกแล้ว");
  });
});

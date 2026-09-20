import { expect, test, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  field,
  INVOICE_FIXTURE,
  ownerCreatesMeatPo,
  pointAndClick,
  saveEntry,
  sidebar,
  signInAs,
  startFresh,
  tableSection,
} from "./helpers";

/* Foodiva Rename test plan (vault: Features/Foodiva Rename/Test Plan.md), local SQLite
 * mode. Items 3 and 7 check migrated production data and do not apply here. */

test.skip(
  process.env.NEXT_PUBLIC_LOCAL_DB !== "1",
  "local sign-in (<account>@local.test) only exists in pnpm test:e2e:local",
);

/** The next POST /api/local-db (a save), so a test can assert the server took it. */
function nextSave(page: Page) {
  return page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/local-db" &&
      response.request().method() === "POST",
  );
}

test("Foodiva เข้าสู่ระบบด้วยชื่อใหม่ foodiva และเห็นชื่อ Foodiva บนหน้าจอ", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.foodiva);

  await expect(page).toHaveURL(/\/foodiva(?:[/?#]|$)/);
  await expect(
    sidebar(page).getByText("Foodiva", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/fooddiva/i)).toHaveCount(0);
});

test("อีเมลเก่า fooddiva@local.test เข้าสู่ระบบไม่ได้", async ({ page }) => {
  await startFresh(page);

  await page.getByLabel("อีเมล").fill("fooddiva@local.test");
  await page.getByLabel("รหัสผ่าน").fill("local-test");
  await pointAndClick(
    page,
    page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }),
  );

  await expect(page.getByText(/โหมด local: ใช้อีเมล/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "เข้าสู่ระบบ" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/:\d+\/$/);
  await expect(page.getByRole("button", { name: "ออกจากระบบ" })).toHaveCount(0);
});

test("ฟอร์มยืนยัน Invoice เติมน้ำหนัก/ยอดเงินให้ กล่อง PO อยู่ใต้ช่องกรอก และ Foodiva บันทึกได้", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await ownerCreatesMeatPo(page, "500");

  await signInAs(page, ACCOUNTS.foodiva);
  await button(page, "ออกและอัปโหลด Invoice");
  const dialog = page.getByRole("dialog");

  // น้ำหนักและยอดเงินต้องเติมจาก PO (500 กก. × 250 บาท) ไว้แล้ว
  await expect(dialog.getByLabel(/น้ำหนักตาม Invoice/)).toHaveValue("500");
  await expect(dialog.getByLabel(/พร้อมส่งไป Chef House/)).toHaveValue("500");
  await expect(dialog.getByLabel(/เนื้อส่วนที่เหลือรอ Owner รับ/)).toHaveValue(
    "0",
  );
  await expect(dialog.getByLabel(/ยอดรวม Invoice/)).toHaveValue("125000");

  // กล่อง PO อ้างอิงต้องอยู่ใต้ช่องกรอกทั้งหมด
  const reference = dialog.getByRole("region", {
    name: "เอกสารอ้างอิง Purchase Order",
  });
  await reference.scrollIntoViewIfNeeded();
  const lastInput = await dialog
    .getByLabel(/ชื่อผู้ยืนยันจาก Foodiva/)
    .boundingBox();
  const referenceBox = await reference.boundingBox();
  expect(lastInput && referenceBox).toBeTruthy();
  expect(referenceBox!.y).toBeGreaterThanOrEqual(
    lastInput!.y + lastInput!.height,
  );

  // "ดูเอกสาร" เปิดหน้าต่าง PO
  const popupOpened = page.waitForEvent("popup");
  await pointAndClick(
    page,
    reference.getByRole("button", { name: "ดูเอกสาร" }),
  );
  const popup = await popupOpened;
  await expect(popup.locator("body")).toContainText("PURCHASE ORDER");
  await popup.close();

  await field(page, /เลข Invoice เนื้อ/, "FD-INV-RENAME");
  await dialog.locator('input[type="file"]').setInputFiles(INVOICE_FIXTURE);
  await field(page, /ชื่อผู้ยืนยันจาก Foodiva/, "เจ้าหน้าที่ Foodiva");
  const saved = nextSave(page);
  await saveEntry(page);

  // บันทึกผ่านฝั่ง server ไม่ขึ้น "Entry role does not match signed-in account"
  expect((await saved).ok()).toBe(true);
  await expect(page.getByRole("status")).toContainText(
    "ออกและอัปโหลด Invoice เนื้อแล้ว",
  );
  // role=alert also matches Next's route announcer, so match the error text
  await expect(
    page.getByRole("alert").filter({ hasText: "บันทึกไม่สำเร็จ" }),
  ).toHaveCount(0);
  await expect(page.locator("main")).toContainText("FD-INV-RENAME");
});

test("Owner: ตั้งค่าผู้ติดต่อ/ที่อยู่ Foodiva แล้วยังแสดงครบหลังเข้าสู่ระบบใหม่", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await button(page, "ตั้งค่า");

  const documents = tableSection(page, "ข้อมูลบนใบ PO (PO document setup)");
  await pointAndClick(
    page,
    documents.getByRole("button", { name: "ขอแก้ไข (Request edit)" }),
  );
  await field(page, "foodivaContact", "คุณดีว่า ฝ่ายขาย");
  await field(page, "foodivaAddress", "12 ถนนผู้ขายเนื้อ กรุงเทพฯ");
  const saved = nextSave(page);
  await pointAndClick(
    page,
    documents.getByRole("button", { name: "บันทึกและล็อก (Save & lock)" }),
  );
  expect((await saved).ok()).toBe(true);

  // โหลดข้อมูลจาก server ใหม่ ค่าต้องไม่หายและไม่ว่าง
  await signInAs(page, ACCOUNTS.foodiva);
  await signInAs(page, ACCOUNTS.owner);
  await button(page, "ตั้งค่า");
  await expect(documents).toContainText("คุณดีว่า ฝ่ายขาย");
  await expect(documents).toContainText("12 ถนนผู้ขายเนื้อ กรุงเทพฯ");
});

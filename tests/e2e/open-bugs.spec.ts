import { expect, test, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  field,
  foodivaIssuesInvoice,
  INVOICE_FIXTURE,
  ownerCreatesMeatPo,
  ownerIssuesSmokePo,
  pointAndClick,
  saveEntry,
  signInAs,
  startFresh,
} from "./helpers";

/* Regression checks for vault note Bugs/Open Bugs.md. Bug 2's guards are covered by
 * tests/unit/local-db.test.ts; bug 3 is still open. */

function nextSave(page: Page) {
  return page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/local-db" &&
      response.request().method() === "POST",
  );
}

/** Drives one 500 kg lot to stage 5 (smoked, not closed): the only stage where
 * Chef House may use "Edit ข้อมูลก่อนปิด Lot". Same steps as full-loop.spec.ts. */
async function lotReadyToClose(page: Page) {
  await signInAs(page, ACCOUNTS.owner);
  await ownerCreatesMeatPo(page, "500");
  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaIssuesInvoice(page, "500");
  await signInAs(page, ACCOUNTS.owner);
  await ownerIssuesSmokePo(page, "500");

  await signInAs(page, ACCOUNTS.chef);
  await button(page, "งานผลิต");
  await button(page, "ยืนยันรับ PO รมควัน");
  await field(page, /ชื่อผู้รับ PO/, "หัวหน้าผลิต Chef House");
  await saveEntry(page);
  await button(page, "สร้าง / Submit ใบวางบิล");
  await field(page, /เลข Invoice ค่ารมควัน/, "CH-INV-001");
  await page
    .getByRole("dialog")
    .locator('input[type="file"]')
    .setInputFiles(INVOICE_FIXTURE);
  await field(page, /รายละเอียดเพิ่มเติม/, "ค่าบริการรมควันเนื้อ 500 กก.");
  await pointAndClick(
    page,
    page.getByRole("button", { name: "Submit ใบวางบิล" }).last(),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);

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
  await page.getByLabel(/ต้นทาง/).selectOption({ label: "กรุงเทพฯ" });
  await page.getByLabel(/ปลายทาง/).selectOption({ label: "เชียงใหม่" });
  await field(page, /เวลารถรับ/, "06:30");
  await field(page, /ประเภทรถ/, "รถห้องเย็น");
  await field(page, /ทะเบียนรถ/, "กท 1001");
  await field(page, /ชื่อคนขับ/, "คนขับทดสอบ");
  await field(page, /เบอร์ติดต่อคนขับ/, "0811111111");
  await field(page, /น้ำหนักที่ส่งเที่ยวนี้/, "500");
  await saveEntry(page);

  await signInAs(page, ACCOUNTS.chef);
  await button(page, "ยืนยันรับเนื้อ");
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
}

test("บัก 1: Chef House แก้ข้อมูลก่อนปิด Lot แล้วบันทึกได้ และค่าที่แก้ขึ้นใน Log เนื้อคงเหลือ", async ({
  page,
}) => {
  await startFresh(page);
  await lotReadyToClose(page);

  await button(page, "Edit ข้อมูลก่อนปิด Lot");
  const dialog = page.getByRole("dialog");
  // ถุงสุดท้ายหายไป 2 กก. เป็น Waste: 4×100 + 98 + 2 = 500 เท่าน้ำหนักเข้าเตา
  await field(page, "น้ำหนัก Waste รอบ 1", "2");
  await dialog
    .getByLabel("น้ำหนักถุงใหญ่ รอบ 1")
    .fill("100\n100\n100\n100\n98");
  const saved = nextSave(page);
  await saveEntry(page);

  // เดิมขึ้น "Existing history cannot be changed"
  expect((await saved).ok()).toBe(true);
  await expect(page.getByRole("status")).toContainText("แก้ไขข้อมูล Lot แล้ว");
  // role=alert also matches Next's route announcer, so match the error text
  await expect(
    page.getByRole("alert").filter({ hasText: "บันทึกไม่สำเร็จ" }),
  ).toHaveCount(0);

  await signInAs(page, ACCOUNTS.owner);
  await button(page, "Log เนื้อคงเหลือ");
  await expect(page.locator("main")).toContainText(
    "หลังรม 498.00 · Waste 2.00 กก.",
  );
});

test("บัก 5: บันทึกไม่สำเร็จแล้วต้องขึ้นข้อความสีแดง ไม่เงียบ", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);

  await page.route("**/api/local-db", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 409,
          json: {
            message: "State changed on another device. Reload and try again.",
          },
        })
      : route.continue(),
  );
  await ownerCreatesMeatPo(page, "500");

  // toast สีแดงของ database-error บนหน้า (นอก dialog) — ตั้งแต่ 91340f3 ข้อความ
  // เดียวกันขึ้นในฟอร์มด้วย จึงต้องจำกัดที่ <main>
  const toast = page
    .getByRole("main")
    .getByRole("alert")
    .filter({ hasText: "โหลดข้อมูลล่าสุดแล้ว" });
  await expect(toast).toBeVisible();
  await expect(toast).toContainText("State changed on another device");
  // บัก 8: ไม่ขึ้น toast สีเขียว · dialog ยังเปิดพร้อมข้อความแดงในฟอร์มให้ลองใหม่
  await expect(page.getByText("สร้างใบ PO แล้ว")).toHaveCount(0);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("alert").filter({ hasText: "บันทึกไม่สำเร็จ" }),
  ).toBeVisible();
});

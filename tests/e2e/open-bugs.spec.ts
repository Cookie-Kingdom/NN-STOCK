import { expect, test, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  chefAcceptsSmokePo,
  chefReceivesMeat,
  chefRecordsPreSmoke,
  chefSmokes,
  field,
  saveEntry,
  sendMeatToChefHouse,
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

/** Drives one 500 kg shipment to stage 5 (smoked, not closed): the only stage where
 * Chef House may use "Edit ข้อมูลก่อนปิด Lot". PO → Request → Packing List of one
 * 500 kg กล่องรับเข้า → smoke PO, then Chef House weighs in 500 kg and smokes it into
 * five 100 kg กล่องรมควัน. Ends signed in as Chef House. */
async function lotReadyToClose(page: Page) {
  const { shipment } = await sendMeatToChefHouse(page, { orderedKg: "500" });
  await signInAs(page, ACCOUNTS.chef);
  await chefAcceptsSmokePo(page);
  await chefReceivesMeat(page, shipment, ["500"]);
  await chefRecordsPreSmoke(page, "500");
  await chefSmokes(page, {
    inputKg: "500",
    packs: ["100", "100", "100", "100", "100"],
  });
}

test("บัก 1: Chef House แก้ข้อมูลก่อนปิด Lot แล้วบันทึกได้ และค่าที่แก้ขึ้นใน Log เนื้อคงเหลือ", async ({
  page,
}) => {
  await startFresh(page);
  await lotReadyToClose(page);

  await button(page, "Edit ข้อมูลก่อนปิด Lot");
  const dialog = page.getByRole("dialog");
  // กล่องรมควันสุดท้ายหายไป 2 กก. เป็น Waste: 4×100 + 98 + 2 = 500 เท่าน้ำหนักเข้าเตา
  await field(page, "น้ำหนัก Waste รอบ 1", "2");
  await dialog
    .getByLabel("น้ำหนักกล่องรมควัน รอบ 1")
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
  // Not ownerCreatesMeatPo: it waits for the dialog to close, and here it must not.
  await button(page, "ใบสั่งซื้อ PO");
  await button(page, "สร้าง PO เนื้อ");
  await field(page, /ชื่อบริษัท \/ ลูกค้า/, "บริษัท เนิร์ดเนื้อ จำกัด");
  await field(page, /ที่อยู่บริษัท/, "295/87 แขวงมีนบุรี กรุงเทพมหานคร");
  await field(page, /ชื่อผู้ติดต่อ/, "ฝ่ายจัดซื้อ");
  await field(page, /เบอร์ติดต่อ/, "0800000000");
  await field(page, /เลขประจำตัวผู้เสียภาษี/, "0100000000000");
  await field(page, /ขนาดบรรจุ/, "6 ชิ้นต่อกล่อง");
  await field(page, /น้ำหนักสั่งซื้อ/, "500");
  await field(page, /ราคาเนื้อ/, "250");
  await button(page, "บันทึก PO เนื้อ");

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

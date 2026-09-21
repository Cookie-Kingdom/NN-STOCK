import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  chefLotButton,
  chefSmokesShipment,
  field,
  INVOICE_FIXTURE,
  menuItem,
  openMenu,
  pointAndClick,
  sendMeatToChefHouse,
  sidebar,
  signInAs,
  startFresh,
} from "./helpers";

test("Chef House รับ PO รมควัน รมเสร็จปิด Lot แล้ว Submit ใบวางบิลให้ Owner ตรวจ", async ({
  page,
}) => {
  await startFresh(page);

  // PO → Invoice → Request → ใบขนส่ง + Packing List → PO รมควัน
  const { shipment } = await sendMeatToChefHouse(page, { orderedKg: "500" });

  // รับ PO → ช่องเหลืองน้ำหนักจริง → ก่อนสโมค → รมควัน → ปิด Lot
  await chefSmokesShipment(page, shipment, {
    received: ["500"],
    preSmokeKg: "480",
    packs: ["470"],
    wasteKg: "10",
  });

  // ใบวางบิลออกได้หลังปิด Lot เท่านั้น
  await openMenu(page, "งานผลิต");
  await pointAndClick(page, chefLotButton(page, "สร้าง / Submit ใบวางบิล"));
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
  await expect(page.locator("main")).toContainText("รอตรวจยอด");

  // Owner ต้องเห็นใบวางบิลรอตรวจทันที
  await signInAs(page, ACCOUNTS.owner);
  await button(page, /ใบ Invoice/);
  await expect(page.locator("main")).toContainText("CH-INV-001");
  await expect(page.locator("main")).toContainText("รอตรวจยอด");
});

test("Chef House เห็นเฉพาะเมนูและงานของฝ่ายผลิต", async ({ page }) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.chef);

  // "ยืนยันรับเนื้อ" and "งานผลิต" carry a count pill when work is pending.
  for (const menu of ["ยืนยันรับเนื้อ", "งานผลิต", "สต๊อก", "ประวัติ"]) {
    await expect(menuItem(page, menu)).toBeVisible();
  }
  for (const forbidden of [
    "ตั้งค่า",
    "รายงาน",
    "ใบสั่งซื้อ PO",
    "กรอกรายวัน",
    "PO และสต๊อก Foodiva",
  ]) {
    await expect(
      sidebar(page).getByRole("button", { name: forbidden }),
    ).toHaveCount(0);
  }

  // หน้าจอของฝ่ายผลิตต้องเปิดได้ทุกหน้า
  await button(page, "สต๊อก");
  await expect(
    page.getByRole("heading", { name: "ความคืบหน้างานผลิต" }),
  ).toBeVisible();
  await button(page, "ประวัติ");
  await expect(
    page.getByRole("heading", { name: "ประวัติรายการที่บันทึก" }),
  ).toBeVisible();
  await button(page, "ยืนยันรับเนื้อ");
  await expect(page.locator("main")).toBeVisible();

  // เปิด URL ของบัญชีอื่นตรง ๆ ต้องถูกพากลับที่ทำงานตัวเอง
  await page.goto("/branch");
  await page.waitForURL("**/chef/cm-receive");
  await expect(page.getByRole("button", { name: "ออกจากระบบ" })).toBeVisible();
});

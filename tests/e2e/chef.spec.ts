import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  c_expectBell,
  c_ownerDecidesEdit,
  c_requestEdit,
  chefLotButton,
  expectNoPurchaseData,
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

const CHEF_TABS = ["ยืนยันรับเนื้อ", "งานผลิต", "สต๊อก", "ประวัติ"];
/** A distinctive meat price (฿257/kg × 500 kg) that must never reach Chef House. */
const PRICE = "257";
const SECRETS = ["257.00", "128,500"];

test("Chef House รับ PO รมควัน รมเสร็จปิด Lot Submit ใบวางบิล · ไม่เห็นเลข PO ซื้อ/ราคาเนื้อ · ขอแก้ใบวางบิล → Owner อนุมัติ → กระดิ่ง Chef House สำเร็จ", async ({
  page,
}) => {
  test.setTimeout(12 * 60_000);
  await startFresh(page);

  // PO → Invoice → Request → Foodiva ใบขนส่ง + Packing List → PO รมควัน
  const { shipment } = await sendMeatToChefHouse(page, {
    orderedKg: "500",
    price: PRICE,
  });

  // Chef House ไม่เห็นเลข PO ซื้อหรือราคาเนื้อ ทั้งในทุกแท็บและหน้าต่างรับ PO รมควัน
  await signInAs(page, ACCOUNTS.chef);
  for (const tab of CHEF_TABS) {
    await openMenu(page, tab);
    await expectNoPurchaseData(page, SECRETS);
  }
  await openMenu(page, "งานผลิต");
  await pointAndClick(page, chefLotButton(page, "ยืนยันรับ PO รมควัน"));
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectNoPurchaseData(page, SECRETS);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

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

  // หลังรมเสร็จ ทุกแท็บของ Chef House ยังไม่มีข้อมูลการซื้อ
  await signInAs(page, ACCOUNTS.chef);
  for (const tab of CHEF_TABS) {
    await openMenu(page, tab);
    await expectNoPurchaseData(page, SECRETS);
  }

  // ขอแก้ใบวางบิลที่ยังไม่ชำระ → กระดิ่ง Chef House รอพิจารณา
  await c_requestEdit(
    page,
    "สร้าง / Submit ใบวางบิลค่ารมควัน",
    [[/รายละเอียดเพิ่มเติม/, "ค่าบริการรมควันเนื้อ 500 กก. (แก้ไข)"]],
    "พิมพ์รายละเอียดผิด",
  );
  await c_expectBell(page, "คำขอแก้ไขรอพิจารณา");
  await expectNoPurchaseData(page, SECRETS);

  // Owner เห็นคำขอที่กระดิ่ง แล้วอนุมัติจากแท็บ Log
  await signInAs(page, ACCOUNTS.owner);
  await c_ownerDecidesEdit(page, "อนุมัติ");

  // กระดิ่ง Chef House ขึ้นผล "สำเร็จ" และประวัติใช้ค่าใหม่
  await signInAs(page, ACCOUNTS.chef);
  await c_expectBell(page, "คำขอแก้ไขสำเร็จ");
  await openMenu(page, "ประวัติ");
  await expect(page.locator("main")).toContainText("(แก้ไข)");
  await expectNoPurchaseData(page, SECRETS);
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

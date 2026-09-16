import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  foodivaIssuesInvoice,
  menuItem,
  ownerCreatesMeatPo,
  sidebar,
  signInAs,
  startFresh,
  tableSection,
} from "./helpers";

test("Foodiva รับ PO จาก Owner แล้วออก Invoice เนื้อ", async ({ page }) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await ownerCreatesMeatPo(page, "500");

  await signInAs(page, ACCOUNTS.foodiva);
  await expect(
    page.getByRole("heading", { name: "PO และสต๊อก Foodiva" }),
  ).toBeVisible();

  // งานค้างต้องขึ้นตัวเลขบนเมนู และ PO ต้องรอ Invoice อยู่
  // The CountPill is the only <span> inside the nav button (icon is an <svg>).
  const pending = menuItem(page, "PO และสต๊อก Foodiva").locator("span");
  await expect(pending).toBeVisible();
  const pendingBefore = Number(await pending.innerText());
  await expect(page.locator("main")).toContainText("500.00");

  await foodivaIssuesInvoice(page, "500");

  await expect(page.getByRole("status")).toContainText(
    "ออกและอัปโหลด Invoice เนื้อแล้ว",
  );
  await expect(page.locator("main")).toContainText("FD-INV-001");

  // ออก Invoice แล้วงานค้างต้องลดลงหนึ่งรายการ (pill ไม่แสดงเมื่อเหลือ 0)
  if (pendingBefore > 1)
    await expect(pending).toHaveText(String(pendingBefore - 1));
  else await expect(pending).toHaveCount(0);

  // Owner ต้องเห็นผลทันทีในใบสั่งซื้อ
  await signInAs(page, ACCOUNTS.owner);
  await button(page, "ใบสั่งซื้อ PO");
  await expect(tableSection(page, "รายการใบสั่งซื้อ PO")).toContainText(
    "FD-INV-001",
  );
});

test("Foodiva เห็นเฉพาะเมนูของตัวเอง", async ({ page }) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.foodiva);

  await expect(menuItem(page, "PO และสต๊อก Foodiva")).toBeVisible();
  await expect(menuItem(page, "ประวัติ")).toBeVisible();
  for (const forbidden of [
    "ตั้งค่า",
    "รายงาน",
    "กรอกรายวัน",
    "งานผลิต",
    "ใบสั่งซื้อ PO",
  ]) {
    await expect(
      sidebar(page).getByRole("button", { name: forbidden }),
    ).toHaveCount(0);
  }

  // เปิด URL ของบัญชีอื่นตรง ๆ ต้องไม่เห็นหน้าจอ Owner และถูกพากลับที่ทำงานตัวเอง
  await page.goto("/owner");
  await page.waitForURL("**/foodiva/foodiva");
  await expect(
    page.getByRole("heading", { name: "PO และสต๊อก Foodiva" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "แดชบอร์ด" })).toHaveCount(0);
});

import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  foodDivaIssuesInvoice,
  ownerCreatesMeatPo,
  signInAs,
  startFresh,
  tableSection,
} from "./helpers";

test("Food Diva รับ PO จาก Owner แล้วออก Invoice เนื้อ", async ({ page }) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await ownerCreatesMeatPo(page, "500");

  await signInAs(page, ACCOUNTS.fooddiva);
  await expect(
    page.getByRole("heading", { name: "PO และสต๊อก Food Diva" }),
  ).toBeVisible();

  // งานค้างต้องขึ้นตัวเลขบนเมนู และ PO ต้องรอ Invoice อยู่
  const sidebar = page.locator("aside.app-sidebar");
  const pending = sidebar.locator(".menu-alert");
  await expect(pending).toBeVisible();
  const pendingBefore = Number(await pending.innerText());
  await expect(page.locator("main")).toContainText("500.00");

  await foodDivaIssuesInvoice(page, "500");

  await expect(page.getByRole("status")).toContainText("บันทึก");
  await expect(page.locator("main")).toContainText("FD-INV-001");

  // ออก Invoice แล้วงานค้างต้องลดลงหนึ่งรายการ
  await expect(pending).toHaveText(String(pendingBefore - 1));

  // Owner ต้องเห็นผลทันทีในใบสั่งซื้อ
  await signInAs(page, ACCOUNTS.owner);
  await button(page, "ใบสั่งซื้อ PO");
  await expect(tableSection(page, "รายการใบสั่งซื้อ PO")).toContainText(
    "FD-INV-001",
  );
});

test("Food Diva เห็นเฉพาะเมนูของตัวเอง", async ({ page }) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.fooddiva);

  const sidebar = page.locator("aside.app-sidebar");
  await expect(
    sidebar.getByRole("button", { name: "PO และสต๊อก Food Diva" }),
  ).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "ประวัติ" })).toBeVisible();
  for (const forbidden of [
    "ตั้งค่า",
    "รายงาน",
    "กรอกรายวัน",
    "งานผลิต",
    "ใบสั่งซื้อ PO",
  ]) {
    await expect(sidebar.getByRole("button", { name: forbidden })).toHaveCount(
      0,
    );
  }

  // เปิด URL ของบัญชีอื่นตรง ๆ ต้องไม่เห็นหน้าจอ Owner และถูกพากลับที่ทำงานตัวเอง
  await page.goto("/owner");
  await page.waitForURL("**/fooddiva");
  await expect(
    page.getByRole("heading", { name: "PO และสต๊อก Food Diva" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "แดชบอร์ด" })).toHaveCount(0);
});

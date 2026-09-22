import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  c_expectBell,
  c_historyEntry,
  c_ownerDecidesEdit,
  c_requestEdit,
  foodivaIssuesInvoice,
  openMenu,
  pointAndClick,
  menuItem,
  ownerCreatesMeatPo,
  ownerCreatesShipmentRequest,
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

  // Request ที่ Owner ส่งมาให้ทำใบขนส่ง ก็นับเป็นงานค้างบนเมนูด้วย
  const shipment = await ownerCreatesShipmentRequest(page, [{ kg: "200" }]);
  await signInAs(page, ACCOUNTS.foodiva);
  await expect(pending).toHaveText(String(pendingBefore));
  await expect(tableSection(page, "Request เข้า")).toContainText(shipment);
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

test("Foodiva ขอแก้ Invoice เนื้อจากประวัติ → กระดิ่ง Owner → Owner ไม่อนุมัติพร้อมหมายเหตุ → กระดิ่ง Foodiva ไม่สำเร็จ ค่าเดิมคงอยู่", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await ownerCreatesMeatPo(page, "500");
  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaIssuesInvoice(page, "500");

  // ยังไม่มีคำขอ: กระดิ่ง Foodiva ว่าง แผงคำขอบอกว่ายังไม่มี
  await openMenu(page, "ประวัติ");
  await expect(page.locator("main")).toContainText("ยังไม่มีคำขอแก้ไข");

  await c_requestEdit(
    page,
    "ออกและอัปโหลด Invoice เนื้อ",
    [[/ชื่อผู้ยืนยันจาก Foodiva/, "ผู้ยืนยันคนใหม่"]],
    "สะกดชื่อผู้ยืนยันผิด",
  );
  await c_expectBell(page, "คำขอแก้ไขรอพิจารณา");

  // Owner: กระดิ่งมีคำขอรอ · ไม่อนุมัติต้องกรอกหมายเหตุ
  await signInAs(page, ACCOUNTS.owner);
  await c_ownerDecidesEdit(page, "ไม่อนุมัติ", "ชื่อเดิมถูกต้องแล้ว");

  // Foodiva: กระดิ่งขึ้น "ไม่สำเร็จ" พร้อมหมายเหตุ · ค่าเดิมยังใช้อยู่ · ขอใหม่ได้อีก
  await signInAs(page, ACCOUNTS.foodiva);
  await c_expectBell(page, "คำขอแก้ไขไม่สำเร็จ");
  await c_expectBell(page, "ชื่อเดิมถูกต้องแล้ว");
  await openMenu(page, "ประวัติ");
  const entry = c_historyEntry(page, "ออกและอัปโหลด Invoice เนื้อ");
  await pointAndClick(page, entry.locator("summary"));
  await expect(entry).not.toContainText("ผู้ยืนยันคนใหม่");
  await expect(entry).not.toContainText("แก้ไขแล้ว");
  await expect(
    entry.getByRole("button", { name: "ขอแก้ไข", exact: true }),
  ).toBeVisible();
});

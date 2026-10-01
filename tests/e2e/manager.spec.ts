import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  BATCH_ID,
  SCREENS,
  SHIPMENT_NO,
  closeBatch,
  createPurchasePo,
  issueMeatInvoice,
  menuItem,
  openMenu,
  openSmokingInvoice,
  receiveIntoFreezer,
  recordDispatch,
  recordPreSmoke,
  recordSmoke,
  saveEntry,
  signInAs,
  startFresh,
  step,
  tableRow,
  tableSection,
  weighIn,
} from "./helpers";

/* Checklist Merge Roles 2 + 3: the Account Manager records Foodiva's and Chef House's
 * steps from the same /owner tabs, the log names it "Account Manager · แทน …", and it
 * has no dashboard and no sales money. */
test("Account Manager records Foodiva and Chef House steps; no dashboard, no sales money", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.manager);
  let batch = "";
  let shipment = "";

  await step(page, "Account Manager: ไม่มีแดชบอร์ด", async () => {
    await expect(menuItem(page, SCREENS.ownerDashboard.menu)).toHaveCount(0);
    await expect(menuItem(page, SCREENS.batches.menu)).toBeVisible();
    await expect(menuItem(page, SCREENS.weighIn.menu)).toBeVisible();
    await expect(menuItem(page, SCREENS.production.menu)).toBeVisible();
    // /owner lands the Owner on the dashboard; the manager is sent to its PO tab.
    await page.goto("/owner");
    await expect(page).toHaveURL(/\/owner\/po(?:[/?#]|$)/);
  });

  await step(
    page,
    "Account Manager (แทน Foodiva): PO ซื้อ Invoice เนื้อ ใบขนส่ง + Packing List",
    async () => {
      const poId = await createPurchasePo(page, "100", "250");
      await issueMeatInvoice(page, poId, "100");
      await recordDispatch(page, "", "100");
      const text = await tableRow(
        page,
        SCREENS.batches.table,
        BATCH_ID,
      ).innerText();
      batch = text.match(BATCH_ID)![0];
      shipment = text.match(SHIPMENT_NO)![0];
    },
  );

  await step(
    page,
    "Account Manager (แทน Chef House): ชั่งรับ ก่อนสโมค สโมค ปิด Lot Invoice ค่ารม",
    async () => {
      await weighIn(page, shipment, "98");
      await recordPreSmoke(page, batch, "96");
      await recordSmoke(page, batch, {
        inputKg: "96",
        wasteKg: "4",
        packs: ["46", "46"],
      });
      await closeBatch(page, batch);
      await openSmokingInvoice(page, batch, {
        invoiceNo: "CH-INV-0200",
        billedKg: "92",
        amount: "4600",
      });
      await saveEntry(page);
    },
  );

  await step(page, "Account Manager (แทน Foodiva): รับเข้าตู้", async () => {
    await receiveIntoFreezer(page, shipment, "92", "2");
  });

  await step(page, "Account Manager: Log บอกว่าบันทึกแทนใคร", async () => {
    await openMenu(page, "Log");
    const rows = page.locator("main details");
    await expect(
      rows.filter({ hasText: "Account Manager · แทน Foodiva" }).first(),
    ).toBeVisible();
    await expect(
      rows.filter({ hasText: "Account Manager · แทน Chef House" }).first(),
    ).toBeVisible();
    await expect(rows.filter({ hasText: /Owner · แทน/ })).toHaveCount(0);
  });

  await step(page, "Account Manager: รายงานไม่มีเงินยอดขาย", async () => {
    await openMenu(page, "รายงาน");
    const summary = tableSection(page, /^สรุปผลรวม$/);
    await expect(summary).toBeVisible();
    await expect(summary).not.toContainText("ยอดขาย LINE MAN");
    await expect(summary).not.toContainText("ส่วนต่างหลังต้นทุนที่บันทึก");
  });
});

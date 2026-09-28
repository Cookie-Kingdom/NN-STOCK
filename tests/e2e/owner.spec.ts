import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  SCREENS,
  createPurchasePo,
  expectWarning,
  field,
  issueSmokePoOnNewBatch,
  openMenu,
  pointAndClick,
  saveEntry,
  sidebar,
  signInAs,
  startFresh,
  tableRow,
  topDialog,
  typeValue,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
});

test("PO-03 PO-07 Owner pays a meat PO that has no Foodiva invoice, with a warning", async ({
  page,
}) => {
  const poId = await createPurchasePo(page, "300", "250");
  await openMenu(page, SCREENS.invoices.menu);
  const row = tableRow(page, "Invoice Foodiva", poId);
  await expect(row).toContainText("ยังไม่มี Invoice");
  await expect(row).toContainText("รอชำระ");
  await pointAndClick(page, row.getByRole("button", { name: "ชำระเงิน" }));
  await expectWarning(page, "ยังไม่มี Invoice เนื้อจาก Foodiva");
  await field(page, /ยอดชำระ/, "75000");
  await field(page, /ผู้ดำเนินการชำระ/, "ฝ่ายบัญชี Owner");
  await saveEntry(page);
  await expect(row).toContainText("ชำระแล้ว");
  await expect(row.getByRole("button", { name: "ชำระเงิน" })).toHaveCount(0);
});

test("RET-03 RET-06 BR-01 central receive without a return truck, then allocate over central stock with a warning", async ({
  page,
}) => {
  const batch = await issueSmokePoOnNewBatch(page, "100");

  await openMenu(page, SCREENS.centralReceive.menu);
  const waiting = tableRow(page, "ชุดที่ยังไม่เข้าสต๊อกกลาง", batch);
  await expect(waiting).toContainText("ยังไม่มีใบขนส่งขากลับ");
  await expect(waiting).toContainText("ยังไม่ยืนยันรับ");
  await pointAndClick(
    page,
    waiting.getByRole("button", { name: "รับเข้าสต๊อกกลาง" }),
  );
  await field(page, /น้ำหนักรับสต๊อกกลาง/, "80");
  await saveEntry(page);
  await expect(waiting).toHaveCount(0);

  await openMenu(page, SCREENS.allocate.menu);
  const stock = tableRow(page, "สต๊อกเนื้อทุกจุด (Meat inventory)", batch);
  await expect(stock).toContainText("80.00 กก.");
  await pointAndClick(page, stock.getByRole("button", { name: "จัดสรร" }));
  const dialog = topDialog(page);
  await typeValue(page, dialog.getByLabel("มีนบุรี (กก.)"), "0");
  await typeValue(page, dialog.getByLabel("ศาลาแดง (กก.)"), "100");
  await expectWarning(page, /เกินสต๊อกกลาง · กรอกได้สูงสุด 80\.00 กก\./);
  await saveEntry(page);
  await expect(stock).toContainText("-20.00 กก.");
});

test("SMK-08 SMK-09 no Request document: the smoke PO opens at once from its own button", async ({
  page,
}) => {
  await expect(
    sidebar(page).getByRole("button", { name: /Request/ }),
  ).toHaveCount(0);
  for (const menu of ["ใบขนส่งขาไป", SCREENS.smokePo.menu]) {
    await openMenu(page, menu);
    await expect(
      page.locator("main").getByRole("button", { name: /Request/ }),
    ).toHaveCount(0);
  }
  // Nothing recorded yet: no Packing List, no purchase PO — the button is still open.
  const issue = page.getByRole("button", { name: /^\+ ออก PO รมควันเนื้อ$/ });
  await expect(issue).toBeEnabled();
  await pointAndClick(page, issue);
  await expect(
    topDialog(page).getByRole("combobox", { name: /^ชุดรมควัน/ }),
  ).toHaveValue("");
  await expect(topDialog(page)).toContainText(
    "ชุดใหม่ (ระบบออกเลขที่การส่งให้)",
  );
});
